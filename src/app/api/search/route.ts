/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/prefer-as-const */
import { NextRequest, NextResponse } from 'next/server';
import { generateEmbedding, generateExplanation, llmRerankCandidates, llmProposeCandidates } from '@/lib/gemini';
import { searchVectors, fetchVectorsByPokemonId } from '@/lib/pinecone';
import { buildRagContext, RagContextEntry } from '@/lib/rag-context';
import { findKeywordOverride } from '@/lib/keyword-overrides';
import { fetchPokemon, fetchPokemonSpecies, fetchAbility, extractLoreText, fetchEvolutionChain, getGenerationNumber, getRegionNameFromGeneration, fetchPokemonByName } from '@/lib/pokeapi';
import { ALL_STARTER_BASES, STAT_NAMES, TUNING } from '@/utils/constants';
import { validateQuery, sanitizeQuery } from '@/utils/validation';
import { SearchRequest, SearchResponse, PokeAPIPokemon, PokeAPISpecies, AIDecision } from '@/types/api';
import { ERROR_MESSAGES } from '@/types/errors';

// Rate limiting (simple in-memory implementation)
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const requests = rateLimitMap.get(ip) || [];
  
  // Filter out old requests
  const recentRequests = requests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
  
  if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  // Add current request
  recentRequests.push(now);
  rateLimitMap.set(ip, recentRequests);
  
  return true;
}

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  return 'unknown';
}

async function fetchAbilityDescriptions(abilityNames: string[]): Promise<Record<string, string>> {
  const descriptions: Record<string, string> = {};
  
  for (const abilityName of abilityNames) {
    try {
      const ability = await fetchAbility(abilityName);
      const englishEffect = ability.effect_entries.find(
        entry => entry.language.name === 'en'
      );
      
      descriptions[abilityName] = englishEffect?.effect || 'No description available.';
    } catch (err) {
      console.warn(`Failed to fetch ability ${abilityName}:`, err);
      descriptions[abilityName] = 'No description available.';
    }
  }
  
  return descriptions;
}

const humanizeToken = (value: string): string => {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(token => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
};

const truncateContext = (text: string, max: number): string => {
  if (text.length <= max) return text;
  const sliced = text.slice(0, max);
  const lastSpace = sliced.lastIndexOf(' ');
  return (lastSpace > Math.floor(max * 0.5) ? sliced.slice(0, lastSpace) : sliced).trim() + '…';
};

const buildSupplementalContext = (params: {
  pokemon: PokeAPIPokemon;
  species: PokeAPISpecies;
  abilityDescriptions: Record<string, string>;
  stats: Array<{ name: string; value: number }>;
  manualEntries?: RagContextEntry[];
}): string => {
  const sections: string[] = [];
  const { pokemon, species, abilityDescriptions, stats, manualEntries } = params;

  if (pokemon?.types?.length) {
    const typeNames = pokemon.types
      .map(t => humanizeToken(t.type?.name || ''))
      .filter(Boolean);
    if (typeNames.length > 0) {
      sections.push(`Typing: ${typeNames.join(' / ')}`);
    }
  }

  if (species?.generation?.name) {
    try {
      const genNumber = getGenerationNumber(species.generation.name);
      const region = getRegionNameFromGeneration(genNumber);
      sections.push(`Origin: Generation ${genNumber}${region ? ` (${region})` : ''}`);
    } catch (err) {
      console.warn('Failed to derive supplemental origin context', err);
    }
  }

  if (pokemon?.abilities?.length) {
    const abilitySummaries = pokemon.abilities
      .map(entry => {
        const abilityName = entry?.ability?.name || '';
        const label = humanizeToken(abilityName);
        const effectRaw = abilityDescriptions[abilityName] || '';
        const effect = truncateContext(effectRaw.replace(/\s+/g, ' ').trim(), 180);
        return effect ? `${label}: ${effect}` : `${label}: effect unavailable.`;
      })
      .filter(Boolean)
      .slice(0, 3);

    if (abilitySummaries.length > 0) {
      sections.push(`Abilities:
- ${abilitySummaries.join('\n- ')}`);
    }
  }

  if (stats?.length) {
    const sortedStats = [...stats].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    const topStats = sortedStats.slice(0, 2).map(stat => `${stat.name} ${stat.value}`);
    if (topStats.length > 0) {
      sections.push(`Notable base stats: ${topStats.join(', ')}`);
    }
  }

  if (Array.isArray(manualEntries) && manualEntries.length > 0) {
    const manualHints = manualEntries
      .map(entry => String(entry?.text || '').trim())
      .filter(Boolean)
      .slice(0, 2);
    if (manualHints.length > 0) {
      sections.push(`Manual lore hints:
- ${manualHints.join('\n- ')}`);
    }
  }

  return sections.join('\n\n');
};

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(request);
    if (!checkRateLimit(clientIP)) {
      return NextResponse.json(
        {
          message: ERROR_MESSAGES.rate_limit_exceeded,
          code: 'RATE_LIMIT_EXCEEDED'
        },
        { status: 429 }
      );
    }

    // Parse request body
    let body: SearchRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          message: 'Invalid JSON in request body',
          code: 'INVALID_JSON'
        },
        { status: 400 }
      );
    }

    // Validate and sanitize query
    const sanitizedQuery = sanitizeQuery(body.prompt);
    const validation = validateQuery(sanitizedQuery);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          message: validation.message || ERROR_MESSAGES.invalid_query,
          code: 'INVALID_QUERY'
        },
        { status: 400 }
      );
    }

    console.log(`🔍 Processing search query: "${sanitizedQuery}"`);

    // Detect if the user is asking for a Pokémon resembling a fictional character (analogy)
    const analogyKeywords = ['like', 'resembles', 'similar to', 'resemble', 'similar', 'as in', 'in the style of'];
    const knownFictionalHints = ['character','anime','manga','cartoon','fictional','like goku','like luffy','like gojo'];
    const normalizedForAnalogy = sanitizedQuery.toLowerCase();
    let allowAnalogy = false;
    for (const k of analogyKeywords) {
      if (normalizedForAnalogy.includes(k)) { allowAnalogy = true; break; }
    }
    // If query mentions explicit fictional cues, be more permissive
    for (const h of knownFictionalHints) {
      if (normalizedForAnalogy.includes(h)) { allowAnalogy = true; break; }
    }

  // Track AI decision metadata (filled when LLM proposals or reranks influence the choice)
  let aiDecision: AIDecision | undefined = undefined;

    // Generate embedding for the query
      // If user requested LLM-only mode, ask the LLM to propose candidates and pick directly
      if (body.useLLMOnly) {
        const topN = body.topN && Number(body.topN) > 0 ? Math.min(10, Number(body.topN)) : 5;
        console.log(`🤖 LLM-only mode: asking model to propose top ${topN} candidates`);
        const proposed = await llmProposeCandidates(sanitizedQuery, topN);
        if (!proposed || proposed.length === 0) {
          return NextResponse.json({ message: ERROR_MESSAGES.no_results, code: 'NO_RESULTS' }, { status: 404 });
        }

        // Try to fetch details for the first valid proposed candidate
  let chosenPokemon: any = null;
  let chosenSpecies: any = null;
  let aiDecisionLocal: AIDecision | undefined = undefined;
          for (const p of proposed || []) {
          const name = typeof p === 'string' ? p : (p && (p as any).name);
          if (!name) continue;
          const fetched = await fetchPokemonByName(name).catch(() => null);
          if (fetched) {
            chosenPokemon = fetched.pokemon;
            chosenSpecies = fetched.species;
            // Record the proposal reason/confidence when available
            if (typeof p === 'object') {
              aiDecisionLocal = {
                chosenName: fetched.pokemon.name,
                reason: (p as any).reason ? String((p as any).reason).slice(0, 300) : 'LLM proposed this candidate',
                confidence: ((p as any).confidence as any) || 'medium',
                source: 'llm' as 'llm'
              };
            } else {
              aiDecisionLocal = { chosenName: fetched.pokemon.name, reason: 'LLM proposed this candidate', confidence: 'medium', source: 'llm' as 'llm' };
            }
            console.log(`🤖 LLM proposed candidate accepted: ${name}`);
            break;
          }
        }

        if (!chosenPokemon) {
          return NextResponse.json({ message: ERROR_MESSAGES.no_results, code: 'NO_RESULTS' }, { status: 404 });
        }

        // Fetch ability descriptions
        const abilityNamesLLM = chosenPokemon.abilities.map((a: any) => a.ability.name);
        const abilityDescriptionsLLM = await fetchAbilityDescriptions(abilityNamesLLM);

        // Build aiExplanation using LLM with RAG=false (we didn't retrieve lore)
        const fallbackLoreLLM = extractLoreText(chosenSpecies);
        const statSummaryLLM = chosenPokemon.stats.map((stat: any) => ({
          name: STAT_NAMES[stat.stat.name as keyof typeof STAT_NAMES] || stat.stat.name,
          value: stat.base_stat,
        }));
        const supplementalContextLLM = buildSupplementalContext({
          pokemon: chosenPokemon,
          species: chosenSpecies,
          abilityDescriptions: abilityDescriptionsLLM,
          stats: statSummaryLLM,
        });
        const aiExplanationLLM = await generateExplanation(
          sanitizedQuery,
          chosenPokemon.name,
          fallbackLoreLLM,
          true,
          false,
          allowAnalogy,
          supplementalContextLLM
        );

        const responseLLM: SearchResponse = {
          id: chosenPokemon.id,
          name: chosenPokemon.name,
          spriteUrl: chosenPokemon.sprites.other['official-artwork'].front_default,
          types: chosenPokemon.types.map((t: any) => t.type.name),
          aiInsight: aiExplanationLLM,
          pokedexEntries: chosenSpecies.flavor_text_entries
            .filter((entry: any) => entry.language.name === 'en')
            .slice(0, 3)
            .map((entry: any) => ({ version: entry.version.name, entry: entry.flavor_text.replace(/\f/g, ' ').replace(/\n/g, ' ').trim() })),
          stats: statSummaryLLM,
          height: chosenPokemon.height,
          weight: chosenPokemon.weight,
          abilities: chosenPokemon.abilities.map((ability: any) => ({ name: ability.ability.name, effect: abilityDescriptionsLLM[ability.ability.name] || 'No description available.', isHidden: ability.is_hidden })),
          generation: getGenerationNumber(chosenSpecies.generation.name),
          evolutionChain: (() => {
            const names: string[] = [];
            try {
              if (chosenSpecies.evolution_chain?.url) {
                const evo = fetchEvolutionChain(chosenSpecies.evolution_chain.url);
              }
            } catch (e) {}
            return names;
          })(),
          flavorText: chosenSpecies.flavor_text_entries.find((entry: any) => entry.language.name === 'en')?.flavor_text.replace(/\f/g, ' ').replace(/\n/g, ' ').trim() || '',
          aiDecision: aiDecisionLocal,
        };

        return NextResponse.json(responseLLM);
      }

      console.log('🧠 Generating query embedding...');
      const queryEmbedding = await generateEmbedding(sanitizedQuery);

    // Search for similar vectors in Pinecone
  console.log('📊 Searching vector database...');
  // Retrieve top candidates and then re-rank using lightweight lexical signals
  // Use the tunable candidateK from constants for retrieval and rerank pool
  const CANDIDATE_K = Number(TUNING.candidateK) || 5;
  const searchResults = await searchVectors(queryEmbedding, CANDIDATE_K);

    if (searchResults.length === 0) {
      return NextResponse.json(
        {
          message: ERROR_MESSAGES.no_results,
          code: 'NO_RESULTS'
        },
        { status: 404 }
      );
    }
    // Re-rank candidates: combine vector score with simple lexical boosts
    const normalizedQuery = sanitizedQuery.toLowerCase();
    // Detect region mention in the query (kanto, johto, hoenn, etc.)
    const regionMatches = ['kanto','johto','hoenn','sinnoh','unova','kalos','alola','galar','paldea'];
    let mentionedRegion: string | null = null;
    for (const r of regionMatches) {
      if (normalizedQuery.includes(r)) { mentionedRegion = r; break; }
    }

    // If the Pinecone metadata doesn't include region for candidates, enrich using PokéAPI species
    // Fetch species for the top candidates so we have authoritative generation->region mapping.
    try {
      const speciesPromises = searchResults.slice(0, CANDIDATE_K).map(s => fetchPokemonSpecies(s.metadata.pokemonId).catch(err => {
        console.warn('Failed to fetch species for candidate', s.metadata.pokemonId, err);
        return null as any;
      }));
      const speciesResults = await Promise.all(speciesPromises);

      // For each species result, enrich metadata with region and whether it's a starter family by
      // inspecting the evolution chain (so we mark evolutions of starters as starter families too).
      await Promise.all(speciesResults.map(async (sp, idx) => {
        if (!sp) return;
        try {
          // ...existing code...
          const genNum = getGenerationNumber(sp.generation.name);
          const regionName = getRegionNameFromGeneration(genNum);
          // Write back to our local metadata if not present
          if (searchResults[idx] && (!searchResults[idx].metadata.region || searchResults[idx].metadata.region === '')) {
            searchResults[idx].metadata.region = regionName;
          }

          // Determine starter family membership by fetching the evolution chain and checking any species in the chain
          let isStarter = false;
          if (sp.evolution_chain?.url) {
            try {
              const evoChain = await fetchEvolutionChain(sp.evolution_chain.url);
              // Traverse chain and collect species names
              const names: string[] = [];
              let current = evoChain?.chain;
              while (current) {
                if (current.species?.name) names.push(current.species.name.toLowerCase());
                current = current.evolves_to && current.evolves_to[0];
              }
              // If any name matches a known starter base, mark as starter family
              for (const n of names) {
                if (ALL_STARTER_BASES.includes(n)) {
                  isStarter = true;
                  break;
                }
              }
            } catch (e) {
              console.warn('Failed to fetch evolution chain for species', sp.name, e);
            }
          }

          if (searchResults[idx]) {
            searchResults[idx].metadata.isStarterFamily = isStarter;
          }
        } catch (e) {
          console.warn('Error processing species enrichment for candidate', idx, e);
        }
      }));
    } catch (err) {
      console.warn('Error enriching candidates with species data:', err);
    }
    // If a region was explicitly mentioned, prefer candidates from that region.
    let candidatePool = searchResults;
    if (mentionedRegion) {
      const regionFiltered = searchResults.filter(c => (c.metadata.region || '').toLowerCase() === mentionedRegion);
      if (regionFiltered.length > 0) {
        candidatePool = regionFiltered;
        console.log(`🔎 Filtering candidates to region: ${mentionedRegion} (kept ${regionFiltered.length}/${searchResults.length})`);
      } else {
        console.log(`🔎 No candidates matched region ${mentionedRegion}; falling back to full candidate set`);
      }
    }

    // Detect if the user is asking about a 'starter' (explicitly) and prefer starter families
    const starterKeywords = ['starter', 'starter pokemon', 'starter pokémon', 'starter-family', 'starter family', 'first starter'];
    let wantsStarter = false;
    for (const sk of starterKeywords) {
      if (normalizedQuery.includes(sk)) { wantsStarter = true; break; }
    }

    // Detect if the user explicitly requests the "final"/fully-evolved form
    const finalEvolutionKeywords = ['final evolution', 'final-evolution', 'finalevolution', 'fully evolved', 'final evolution of', 'final form'];
    let wantsFinalEvolution = false;
    for (const fk of finalEvolutionKeywords) {
      if (normalizedQuery.includes(fk)) { wantsFinalEvolution = true; break; }
    }

    if (wantsStarter) {
      const starterFiltered = candidatePool.filter(c => Boolean(c.metadata.isStarterFamily));
      if (starterFiltered.length > 0) {
        console.log(`🔎 Query requests starter; filtering to starter families (kept ${starterFiltered.length}/${candidatePool.length})`);
        candidatePool = starterFiltered;
      } else {
        console.log('🔎 Query requests starter but no candidates flagged as starter families; will boost starters if present');
        // If none are flagged, we'll let re-ranking boost starter-base names that appear in the query tokens
      }
    }

    // Track whether any starter candidates exist after enrichment
    const anyStarterCandidates = candidatePool.some(c => Boolean(c.metadata.isStarterFamily));

    const scoreCandidates = candidatePool.map(candidate => {
      const meta = candidate.metadata;
      let lexicalBoost = 0;
      const name = (meta.name || '').toLowerCase();

      // Exact name match -> big boost
      if (name === normalizedQuery) lexicalBoost += TUNING.exactNameBoost;

      // If the query contains the name tokens (e.g., 'toxel mouse') -> moderate boost
      if (name && normalizedQuery.includes(name)) lexicalBoost += TUNING.nameTokenBoost;

      // If query mentions one of the candidate's types, small boost
      if (meta.types && Array.isArray(meta.types)) {
        for (const t of meta.types) {
          if (normalizedQuery.includes(t.toLowerCase())) {
            lexicalBoost += TUNING.typeMatchBoost;
            break;
          }
        }
      }

      // If user mentioned a region explicitly, boost candidates from that region
      if (mentionedRegion && meta.region && meta.region.toLowerCase() === mentionedRegion) {
        lexicalBoost += TUNING.regionBoost;
      }

      // Starter logic
      if (wantsStarter) {
        if (meta.isStarterFamily) {
          lexicalBoost += TUNING.starterFamilyBoost;
        } else if (!anyStarterCandidates) {
          for (const sb of ALL_STARTER_BASES) {
            if (name.includes(sb)) {
              lexicalBoost += (TUNING.starterFamilyBoost / 1.5);
              break;
            }
          }
          lexicalBoost -= 1.0; // small penalty for non-starters when none flagged
        }
      }

      const baseScore = (candidate.score || 0) + lexicalBoost;

      return { candidate, finalScore: baseScore, lexicalBoost } as any;
    });

    // Before sorting, compute a semantic similarity boost between the query embedding and any
    // retrieved snippet (candidate.metadata.text or candidate.metadata.loreText).
    // This helps favor candidates whose lore/look text directly answers the query.
    try {
      await Promise.all(scoreCandidates.map(async sc => {
        try {
          const meta: any = sc.candidate.metadata || {};
          const snippet = (meta.text || meta.loreText || '').trim();
          if (!snippet) return;

          // Prefer using stored vector values returned from Pinecone to avoid regenerating embeddings at query time.
          // If values are present on the candidate (or artificial candidate), use them. Otherwise fall back to generateEmbedding.
          let snippetEmb: number[] | undefined = undefined;
          if (Array.isArray(sc.candidate.values) && sc.candidate.values.length > 0) {
            snippetEmb = sc.candidate.values as number[];
          } else if (Array.isArray((sc as any).values) && (sc as any).values.length > 0) {
            // sometimes values may be on the wrapper object
            snippetEmb = (sc as any).values as number[];
          } else {
            // last resort: compute embedding at runtime (should be rare)
            // eslint-disable-next-line no-await-in-loop
            snippetEmb = await generateEmbedding(snippet);
          }

          if (!Array.isArray(snippetEmb) || !Array.isArray(queryEmbedding)) return;

          // cosine similarity
          let dot = 0; let na = 0; let nb = 0;
          for (let i = 0; i < Math.min(snippetEmb.length, queryEmbedding.length); i++) {
            dot += (snippetEmb[i] || 0) * (queryEmbedding[i] || 0);
            na += (snippetEmb[i] || 0) * (snippetEmb[i] || 0);
            nb += (queryEmbedding[i] || 0) * (queryEmbedding[i] || 0);
          }
          const cosine = (na > 0 && nb > 0) ? (dot / (Math.sqrt(na) * Math.sqrt(nb))) : 0;
          // Apply a tunable weight from constants
          const semanticWeight = TUNING.semanticWeight;
          const semanticBoost = (cosine * semanticWeight);
          sc.finalScore = (sc.finalScore || 0) + semanticBoost;
          // track semantic score for diagnostics
          (sc as any).semanticScore = semanticBoost;

          // Additional boost if the snippet came from 'lore' (prefer lore for meaning/intent queries)
          if ((meta.section || '').toLowerCase() === 'lore') {
            sc.finalScore += TUNING.loreBoost;
            (sc as any).loreBoost = TUNING.loreBoost;
          }

          // Exact token overlap boost: if the query contains any long token (>=4 chars) present in the snippet, boost
          try {
            const queryTokens = normalizedQuery.split(/\W+/).filter((t: string) => t.length >= 4);
            for (const qt of queryTokens) {
              if (snippet.toLowerCase().includes(qt)) {
                sc.finalScore += TUNING.tokenOverlapBoost; // lexical tie-breaker
                (sc as any).tokenOverlapBoost = TUNING.tokenOverlapBoost;
                break;
              }
            }
          } catch (e) {}
        } catch (e) {
          console.warn('Failed to compute snippet similarity for candidate', sc.candidate.metadata?.name, e);
        }
      }));
    } catch (e) {
      console.warn('Snippet similarity boosting failed:', e);
    }

    // Sort by our lexical/vector + semantic final score
    scoreCandidates.sort((a, b) => b.finalScore - a.finalScore);

  // Prepare variables used by later selection logic (declare early so overrides can assign to them)
  let proposed: any[] | undefined = undefined;
  let bestMatch: any = scoreCandidates[0].candidate;
  let bestFinalScore: number = scoreCandidates[0].finalScore;
  let chosenPokemonFromLLM: any = null;
  let chosenSpeciesFromLLM: any = null;
  const manualContextEntries: RagContextEntry[] = [];

    // If user asked for the "final evolution" of a starter, try to resolve and prefer the highest-stage evolution.
    // This prevents returning a base form (e.g., Charmander) when the user explicitly asked for the final evolution (Charizard).
    if (wantsFinalEvolution && wantsStarter) {
      try {
        // Find a starter-family candidate (prefer any candidate flagged as starterFamily, otherwise any candidate whose name is in ALL_STARTER_BASES)
        const starterCandidate = scoreCandidates.find(sc => Boolean(sc.candidate?.metadata?.isStarterFamily) || ALL_STARTER_BASES.includes(String(sc.candidate?.metadata?.name || '').toLowerCase()));
        if (starterCandidate) {
          const starterPokemonId = starterCandidate.candidate.metadata.pokemonId;
          // Fetch species and evolution chain
          const starterSpecies = await fetchPokemonSpecies(starterPokemonId).catch(() => null as any);
          if (starterSpecies && starterSpecies.evolution_chain?.url) {
            const evo = await fetchEvolutionChain(starterSpecies.evolution_chain.url).catch(() => null as any);
            if (evo && evo.chain) {
              // Walk to the last evolution node
              let current = evo.chain;
              let lastName = current.species.name;
              while (current && Array.isArray(current.evolves_to) && current.evolves_to[0]) {
                current = current.evolves_to[0];
                if (current && current.species && current.species.name) lastName = current.species.name;
              }
              // Resolve the final evolution to a PokéAPI pokemon entry
              const finalResolved = await fetchPokemonByName(lastName).catch(() => null as any);
              if (finalResolved && finalResolved.pokemon && finalResolved.species) {
                // Accept the final evolution as our chosen result (grounded override)
                const finalPokemon = finalResolved.pokemon;
                const finalSpecies = finalResolved.species;
                console.log(`🔎 Final-evolution override applied: user requested final evolution -> selecting ${finalPokemon.name} (id ${finalPokemon.id})`);
                // Attempt to find stored vectors for this final evolution and prioritize them for RAG
                try {
                  const finalVecs = await fetchVectorsByPokemonId(finalPokemon.id, 6).catch(() => [] as any[]);
                  if (Array.isArray(finalVecs) && finalVecs.length > 0) {
                    const artificialCandidates = finalVecs.map((v: any) => ({ candidate: { id: v.id, score: v.score, values: v.values, metadata: { pokemonId: finalPokemon.id, name: finalPokemon.name, section: v.section, text: v.text } }, finalScore: (v.score || 0) + 5 }));
                    // Put artificial snippet candidates at the front so they become the retrieved context
                    scoreCandidates.unshift(...(artificialCandidates as any));
                    console.log(`🔎 Found ${finalVecs.length} vector snippets for final-evolution pokemon ${finalPokemon.id}; they will be prioritized for RAG.`);
                  }
                } catch (e) {
                  console.warn('Failed to fetch/inject vectors for final-evolution override', finalPokemon.id, e);
                }

                // Set chosenPokemonFromLLM so later code will use this resolved final evolution when building the response
                chosenPokemonFromLLM = finalPokemon;
                chosenSpeciesFromLLM = finalSpecies;
                bestMatch = {
                  id: `pokemon-${finalPokemon.id}`,
                  score: starterCandidate.candidate.score,
                  metadata: {
                    pokemonId: finalPokemon.id,
                    name: finalPokemon.name,
                    types: finalPokemon.types.map((t: any) => t.type.name),
                    generation: getGenerationNumber(finalSpecies.generation.name),
                    region: getRegionNameFromGeneration(getGenerationNumber(finalSpecies.generation.name)),
                    loreText: extractLoreText(finalSpecies),
                  }
                } as any;

                aiDecision = {
                  chosenName: finalPokemon.name,
                  reason: 'User requested the final evolution of the starter; selecting the final stage.',
                  confidence: 'high',
                  source: 'hybrid'
                } as AIDecision;
              }
            }
          }
        }
      } catch (e) {
        console.warn('Final-evolution override failed, proceeding with normal ranking', e);
      }
    }

  // Ask the LLM to pick the best candidate from the top set. The LLM's intuition will be primary:
  // we fetch it a pool of up to CANDIDATE_K candidates and ask for scores; the highest LLM score wins.
  const TOP_FOR_RERANK = Math.min(CANDIDATE_K, scoreCandidates.length);

    // Adaptive vector confidence threshold:
    // - If raw vector scores are in [0,1] (cosine), use a 0.8 threshold
    // - Otherwise keep the older 8 threshold (for other score scales)
    const rawTopVectorScore = scoreCandidates[0].candidate.score || 0;
    const VECTOR_CONFIDENCE_THRESHOLD = rawTopVectorScore <= 1 ? 0.8 : 8;
    if (rawTopVectorScore >= VECTOR_CONFIDENCE_THRESHOLD) {
      console.log(`🔒 Top vector score ${rawTopVectorScore} >= ${VECTOR_CONFIDENCE_THRESHOLD}; choosing vector-best candidate: ${scoreCandidates[0].candidate.metadata.name}`);
      bestMatch = scoreCandidates[0].candidate;
      bestFinalScore = scoreCandidates[0].finalScore;
      aiDecision = {
        chosenName: bestMatch.metadata.name,
        reason: `Vector similarity score ${rawTopVectorScore}`,
        confidence: rawTopVectorScore >= VECTOR_CONFIDENCE_THRESHOLD ? 'high' : 'medium',
        source: 'vector'
      } as AIDecision;
    } else {
      console.log(`🔎 Top vector score ${rawTopVectorScore} < ${VECTOR_CONFIDENCE_THRESHOLD}; invoking LLM propose search for top ${TOP_FOR_RERANK}`);

      // If the top candidate already beats the runner-up by at least llmFallbackMargin, skip the LLM to save quota/latency.
      const runnerUpFinalScore = scoreCandidates[1]?.finalScore ?? Number.NEGATIVE_INFINITY;
      const margin = (scoreCandidates[0].finalScore || 0) - (runnerUpFinalScore || 0);
      const llmFallbackMargin = Number(TUNING.llmFallbackMargin || 0);
      if (!isNaN(llmFallbackMargin) && llmFallbackMargin > 0 && margin >= llmFallbackMargin) {
        console.log(`🔒 Skipping LLM propose: top candidate margin ${margin} >= llmFallbackMargin ${llmFallbackMargin}; selecting vector-best candidate.`);
        bestMatch = scoreCandidates[0].candidate;
        bestFinalScore = scoreCandidates[0].finalScore;
        aiDecision = {
          chosenName: bestMatch.metadata.name,
          reason: `Top candidate margin ${margin} >= llmFallbackMargin ${llmFallbackMargin}`,
          confidence: 'high',
          source: 'vector'
        } as AIDecision;
      } else {
        try {
          const normalized = normalizedQuery; // already lowercased earlier
          let overrideResolved = false;
          const overrideMatch = findKeywordOverride(normalized);

          if (overrideMatch) {
            const { override, matchedKeywords } = overrideMatch;
            const matchSummary = matchedKeywords.join(', ');

            for (const name of override.names) {
              try {
                const found = await fetchPokemonByName(name).catch(() => null);
                if (!found || !found.pokemon || !found.species) continue;

                // Check for stored vectors to ensure grounding, or presence in the current pool
                let vecs: any[] = [];
                try {
                  vecs = await fetchVectorsByPokemonId(found.pokemon.id, 6).catch(() => []);
                } catch (e) {
                  vecs = [];
                }

                const proposedNameNorm = String(found.pokemon.name || '').toLowerCase();
                const existsInPool = scoreCandidates.some(sc => {
                  const metaName = String(sc.candidate?.metadata?.name || '').toLowerCase();
                  const metaText = String(sc.candidate?.metadata?.text || '').toLowerCase();
                  return metaName === proposedNameNorm || metaText.includes(proposedNameNorm);
                });

                if ((Array.isArray(vecs) && vecs.length > 0) || existsInPool) {
                  // Accept this override as if the LLM proposed it (grounded)
                  chosenPokemonFromLLM = found.pokemon;
                  chosenSpeciesFromLLM = found.species;
                  console.log(`🔎 Keyword override accepted: ${name} (matched keywords: ${matchSummary || override.keywords.join(',')})`);
                  bestMatch = {
                    id: `pokemon-${chosenPokemonFromLLM.id}`,
                    score: rawTopVectorScore,
                    metadata: {
                      pokemonId: chosenPokemonFromLLM.id,
                      name: chosenPokemonFromLLM.name,
                      types: chosenPokemonFromLLM.types.map((t: any) => t.type.name),
                      generation: getGenerationNumber(chosenSpeciesFromLLM.generation.name),
                      region: getRegionNameFromGeneration(getGenerationNumber(chosenSpeciesFromLLM.generation.name)),
                      loreText: extractLoreText(chosenSpeciesFromLLM),
                    },
                  } as any;
                  aiDecision = {
                    chosenName: found.pokemon.name,
                    reason: override.description
                      ? `Keyword override (${override.description})`
                      : `Keyword override matched (${matchSummary || override.keywords.join(',')})`,
                    confidence: 'high',
                    source: 'hybrid'
                  } as AIDecision;

                  // If we have vector snippets, prioritize them for RAG by adding artificial candidates
                  if (Array.isArray(vecs) && vecs.length > 0) {
                    try {
                      console.log(`🔎 Found ${vecs.length} vector snippets for keyword-chosen pokemon ${chosenPokemonFromLLM.id}; they will be prioritized for RAG.`);
                      const artificialCandidates: Array<{ candidate: any; finalScore: number }> = vecs.map((v: any) => ({
                        candidate: { id: v.id, score: v.score, values: v.values, metadata: { pokemonId: chosenPokemonFromLLM.id, name: chosenPokemonFromLLM.name, section: v.section, text: v.text } },
                        finalScore: (v.score || 0) + 5
                      }));
                      scoreCandidates.unshift(...artificialCandidates as any);
                    } catch (e) {
                      console.warn('Failed to inject vector snippets for keyword-chosen pokemon', chosenPokemonFromLLM.id, e);
                    }
                  }

                  if (Array.isArray(override.loreHints)) {
                    for (const hint of override.loreHints) {
                      const cleanHint = String(hint || '').trim();
                      if (!cleanHint) continue;
                      manualContextEntries.push({ section: 'lore', text: cleanHint, pokemonId: found.pokemon.id });
                    }
                  }

                  overrideResolved = true;
                  break;
                }
              } catch (e) {
                console.warn('Keyword override fetch failed for', name, e);
                continue;
              }
            }
          }

          if (overrideResolved) {
            console.log('✅ Keyword override applied; skipping LLM proposer.');
          }

          // If no keyword override applied, continue to ask the LLM
          if (!overrideResolved) {
            proposed = await llmProposeCandidates(sanitizedQuery, TOP_FOR_RERANK);
            console.log('🤖 LLM proposed candidates:', proposed);
          }
          
          // If proposer returned structured objects, prefer high-confidence proposals immediately
          if (Array.isArray(proposed) && proposed.length > 0 && typeof proposed[0] === 'object') {
            const topProposal = proposed[0] as any;
            const topScore = Number(topProposal.score || 0);
            const topConf = (topProposal.confidence || 'medium') as 'low'|'medium'|'high';
            if ((topConf === 'high' && topScore >= 70) || topScore >= 80) {
              try {
                // Resolve the proposed name to a PokéAPI entry first
                const found = await fetchPokemonByName(topProposal.name).catch(() => null);
                if (found?.pokemon && found?.species) {
                  // Try to fetch vector snippets for the proposed pokemon. We only auto-accept proposals that
                  // are grounded in our stored vectors (or already present in the candidate pool). This avoids
                  // letting unconstrained LLM proposals override clearer vector evidence.
                  let vecs: any[] = [];
                  try {
                    vecs = await fetchVectorsByPokemonId(found.pokemon.id, 6).catch(() => []);
                  } catch (e) {
                    vecs = [];
                  }

                  // Also check whether the proposed name already appears in our current candidate pool (metadata match)
                  const proposedNameNorm = String(found.pokemon.name || '').toLowerCase();
                  const existsInPool = scoreCandidates.some(sc => {
                    const metaName = String(sc.candidate?.metadata?.name || '').toLowerCase();
                    const metaText = String(sc.candidate?.metadata?.text || '').toLowerCase();
                    return metaName === proposedNameNorm || metaText.includes(proposedNameNorm);
                  });

                  // Accept the LLM proposal only if we have stored snippet vectors for it or it already exists in the pool
                  if ((Array.isArray(vecs) && vecs.length > 0) || existsInPool) {
                    chosenPokemonFromLLM = found.pokemon;
                    chosenSpeciesFromLLM = found.species;
                    console.log(`✅ LLM high-confidence proposal accepted (grounded): ${topProposal.name} (id ${chosenPokemonFromLLM.id})`);
                    bestMatch = {
                      id: `pokemon-${chosenPokemonFromLLM.id}`,
                      score: rawTopVectorScore,
                      metadata: {
                        pokemonId: chosenPokemonFromLLM.id,
                        name: chosenPokemonFromLLM.name,
                        types: chosenPokemonFromLLM.types.map((t: any) => t.type.name),
                        generation: getGenerationNumber(chosenSpeciesFromLLM.generation.name),
                        region: getRegionNameFromGeneration(getGenerationNumber(chosenSpeciesFromLLM.generation.name)),
                        loreText: extractLoreText(chosenSpeciesFromLLM),
                      },
                    } as any;
                    aiDecision = {
                      chosenName: found.pokemon.name,
                      reason: topProposal.reason ? String(topProposal.reason).slice(0,300) : 'High-confidence LLM proposal (grounded)',
                      confidence: topConf,
                      source: 'llm'
                    } as AIDecision;

                    // If we have vector snippets, prioritize them for RAG by adding artificial candidates
                    if (Array.isArray(vecs) && vecs.length > 0) {
                      try {
                        console.log(`🔎 Found ${vecs.length} vector snippets for LLM-chosen pokemon ${chosenPokemonFromLLM.id}; they will be prioritized for RAG.`);
                        const artificialCandidates: Array<{ candidate: any; finalScore: number }> = vecs.map((v: any) => ({
                          candidate: { id: v.id, score: v.score, values: v.values, metadata: { pokemonId: chosenPokemonFromLLM.id, name: chosenPokemonFromLLM.name, section: v.section, text: v.text } },
                          finalScore: (v.score || 0) + 5
                        }));
                        scoreCandidates.unshift(...artificialCandidates as any);
                      } catch (e) {
                        console.warn('Failed to inject vector snippets for LLM chosen pokemon', chosenPokemonFromLLM.id, e);
                      }
                    }
                  } else {
                    console.log(`❗ LLM proposal ${topProposal.name} not grounded in stored vectors and not in pool; ignoring auto-accept.`);
                  }
                }
              } catch (e) {
                console.warn('fetchPokemonByName failed for topProposal', topProposal.name, e);
              }
            }
          }

          // If not accepted yet, try to resolve any proposed names (object or string) to PokéAPI entries
          if (!chosenPokemonFromLLM) {
            for (const p of proposed || []) {
              const name = typeof p === 'string' ? p : (p && (p as any).name);
              if (!name) continue;
              try {
                const found = await fetchPokemonByName(name as string);
                if (found && found.pokemon && found.species) {
                  chosenPokemonFromLLM = found.pokemon;
                  chosenSpeciesFromLLM = found.species;
                  console.log(`✅ LLM-chosen Pokémon found via PokéAPI: ${name} (id ${chosenPokemonFromLLM.id})`);
                  bestMatch = {
                    id: `pokemon-${chosenPokemonFromLLM.id}`,
                    score: rawTopVectorScore,
                    metadata: {
                      pokemonId: chosenPokemonFromLLM.id,
                      name: chosenPokemonFromLLM.name,
                      types: chosenPokemonFromLLM.types.map((t: any) => t.type.name),
                      generation: getGenerationNumber(chosenSpeciesFromLLM.generation.name),
                      region: getRegionNameFromGeneration(getGenerationNumber(chosenSpeciesFromLLM.generation.name)),
                      loreText: extractLoreText(chosenSpeciesFromLLM),
                    },
                  } as any;
                  break;
                }
              } catch (e) {
                console.warn('fetchPokemonByName failed for', name, e);
                continue;
              }
            }
          }

          if (!chosenPokemonFromLLM) {
            console.log('🤖 No proposed name mapped to a PokéAPI entry; falling back to LLM reranker among vector candidates');
            const topCandidatesMeta = scoreCandidates.slice(0, TOP_FOR_RERANK).map(sc => sc.candidate.metadata);
            // llmRerankCandidates now returns LLMReRankItem[] (with score/confidence/reason).
            const llmResults = await llmRerankCandidates(sanitizedQuery, topCandidatesMeta).catch(() => [] as any[]);
            if (Array.isArray(llmResults) && llmResults.length === topCandidatesMeta.length) {
              // Choose the candidate with highest LLM score; tie-break by our lexical finalScore.
              let maxIdx = 0;
              let maxScore = -Infinity;
              for (let i = 0; i < llmResults.length; i++) {
                const it = llmResults[i] as any;
                const s = Number(it?.score) || 0;
                if (s > maxScore) {
                  maxScore = s;
                  maxIdx = i;
                } else if (s === maxScore) {
                  if ((scoreCandidates[i].finalScore || 0) > (scoreCandidates[maxIdx].finalScore || 0)) {
                    maxIdx = i;
                  }
                }
              }
              bestMatch = scoreCandidates[maxIdx].candidate;
              bestFinalScore = scoreCandidates[maxIdx].finalScore;
              // Record aiDecision from reranker
              const chosenLLM = llmResults[maxIdx] as any;
              aiDecision = {
                chosenName: bestMatch.metadata.name,
                reason: chosenLLM?.reason ? String(chosenLLM.reason).slice(0,300) : 'LLM reranker chose this candidate',
                confidence: (chosenLLM?.confidence || 'medium') as 'low'|'medium'|'high',
                source: 'llm-rerank'
              } as AIDecision;
              console.log(`🤖 LLM-selected best candidate (rerank fallback): ${bestMatch.metadata.name} (llmScore=${maxScore})`);
            }
          }
        } catch (e) {
          console.warn('LLM-driven search failed; falling back to lexical ordering', e);
        }
      }
    }

    // Fetch detailed Pokémon data (use chosen LLM result directly if available)
    console.log('📦 Fetching detailed Pokémon data...');
    let pokemon: PokeAPIPokemon;
    let species: PokeAPISpecies;
    if (chosenPokemonFromLLM && chosenSpeciesFromLLM) {
      pokemon = chosenPokemonFromLLM as PokeAPIPokemon;
      species = chosenSpeciesFromLLM as PokeAPISpecies;
    } else {
      [pokemon, species] = await Promise.all([
        fetchPokemon(bestMatch.metadata.pokemonId),
        fetchPokemonSpecies(bestMatch.metadata.pokemonId),
      ]);
    }

    // Fetch evolution chain
    const evolutionChainNames: string[] = [];
    if (species.evolution_chain?.url) {
      const evolutionChain = await fetchEvolutionChain(species.evolution_chain.url);
      if (evolutionChain?.chain) {
        let currentEvolution = evolutionChain.chain;
        while (currentEvolution) {
          evolutionChainNames.push(currentEvolution.species.name);
          currentEvolution = currentEvolution.evolves_to[0];
        }
      }
    }

    // Fetch ability descriptions
    const abilityNames = pokemon.abilities.map(a => a.ability.name);
    const abilityDescriptions = await fetchAbilityDescriptions(abilityNames);

    // Generate AI explanation using RAG: collect retrieved lore snippets from top candidates
    console.log('🤖 Generating AI explanation (RAG)...');
    const statSummaryInput = pokemon.stats.map(stat => ({
      name: STAT_NAMES[stat.stat.name as keyof typeof STAT_NAMES] || stat.stat.name,
      value: stat.base_stat,
    }));

    const ragResult = await buildRagContext({
      scoreCandidates,
      pokemonId: pokemon.id,
      fetchVectorsByPokemonId,
      abilityDescriptions,
      pokemonStats: statSummaryInput,
      manualEntries: manualContextEntries,
    });

    const { contextEntries, retrievedContextArr, retrievedLore, usedLook, usedLore } = ragResult;

    console.log(`🔎 Retrieved context snippets count (final): ${contextEntries.length}; usedLook=${usedLook}; usedLore=${usedLore}`);
    if (contextEntries.length > 0) {
      console.log('🔎 Retrieved context preview (final):', retrievedContextArr.slice(0, 5));
    }

    // If no retrieved lore, fall back to the species' lore
    const fallbackLore = extractLoreText(species);

    const supplementalContext = buildSupplementalContext({
      pokemon,
      species,
      abilityDescriptions,
      stats: statSummaryInput,
      manualEntries: manualContextEntries,
    });

    let aiExplanation = await generateExplanation(
      sanitizedQuery,
      pokemon.name,
      retrievedLore || fallbackLore,
      true, // allow model knowledge
      true, // isRag
      allowAnalogy,
      supplementalContext
    );

    // Build an evidence-based explanation prefix (prefer lore/look snippets), include the user's prompt,
    // and avoid mentioning internal signals. Try to extract a whole sentence or natural clause to prevent mid-word cutoff.
    try {
      let evidenceReason = 'its documented characteristics align with the request';

      try {
        if (retrievedContextArr && retrievedContextArr.length > 0) {
          // Prefer lore snippets, then look, then any other retrieved text
          const loreEntry = retrievedContextArr.find(s => s.toLowerCase().startsWith('lore:')) || retrievedContextArr[0];
          if (loreEntry) {
            let snippetText = loreEntry.replace(/^[^:]+:\s*/i, '').trim();
            // Remove any embedded ellipsis markers that indicate prior truncation
            snippetText = snippetText.replace(/[…]+/g, ' ');
            // If the snippet begins with the pokemon name, strip it to avoid repetition
            try {
              const nameRegex = new RegExp(`^${String(pokemon?.name || '').replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}[\\s,:-]*`, 'i');
              snippetText = snippetText.replace(nameRegex, '').trim();
            } catch (e) {
              // ignore regex errors
            }

            // Prefer to pick a full sentence or a natural clause (avoid cutoffs). Try multiple strategies.
            let short = '';
            const maxLen = 300;

            // 1) Split into sentences using common punctuation
            const sentences = snippetText.match(/[^.!?]+[.!?]+/g);
            if (Array.isArray(sentences) && sentences.length > 0) {
              // If the first sentence is very short, include the second sentence as well (if present) to make a complete thought
              let candidate = sentences[0].trim();
              if (candidate.length < 40 && sentences.length > 1) {
                candidate = (sentences[0] + ' ' + sentences[1]).trim();
              }
              short = candidate.length > maxLen ? candidate.slice(0, maxLen) : candidate;
            } else {
              // 2) No clear sentence breaks: try to take a natural clause (split by comma/semicolon)
              const clauses = snippetText.split(/[,;]\s+/).filter(Boolean);
              if (clauses.length > 0) {
                let candidate = clauses.slice(0, 2).join(', ');
                if (candidate.length > maxLen) candidate = candidate.slice(0, maxLen);
                short = candidate.trim();
              } else {
                // 3) Fallback: trim at the nearest word boundary without adding an ellipsis to avoid mid-word cutoffs
                if (snippetText.length <= maxLen) {
                  short = snippetText.trim();
                } else {
                  let cut = snippetText.slice(0, maxLen);
                  const lastSpace = cut.lastIndexOf(' ');
                  if (lastSpace > Math.floor(maxLen * 0.5)) cut = cut.slice(0, lastSpace);
                  short = cut.trim();
                }
              }
            }

            // Remove any leading repeated pokemon name fragments from the short snippet
            try {
              const nameRegex2 = new RegExp(`^${String(pokemon?.name || '').replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}[\\s,:-]*`, 'i');
              short = short.replace(nameRegex2, '').trim();
            } catch (e) {}

            // Avoid duplication: if the AI explanation begins with the pokemon name or the exact short sentence,
            // fall back to a generic evidence phrase rather than repeating the same content.
            try {
              const aiStart = (aiExplanation || '').slice(0, 400).toLowerCase();
              const shortLower = short.toLowerCase();
              if (aiStart.startsWith((pokemon?.name || '').toLowerCase()) || (shortLower && aiStart.includes(shortLower))) {
                short = '';
              }
            } catch (e) {}

            // If short is still empty, fall back to a conservative trimmed snippet without duplication
            if (!short) {
              const fallbackMax = 140;
              let fallbackCut = snippetText.slice(0, fallbackMax);
              const lastSpace2 = fallbackCut.lastIndexOf(' ');
              if (lastSpace2 > Math.floor(fallbackMax * 0.5)) fallbackCut = fallbackCut.slice(0, lastSpace2);
              short = fallbackCut.trim();
            }

            if (short && loreEntry.toLowerCase().startsWith('lore:')) {
              evidenceReason = `its lore describes ${short}`;
            } else if (short && loreEntry.toLowerCase().startsWith('look:')) {
              evidenceReason = `its appearance description mentions ${short}`;
            } else if (short) {
              evidenceReason = `the retrieved description notes ${short}`;
            } else {
              evidenceReason = 'its documented characteristics align with the request';
            }
          }
        } else if (fallbackLore && fallbackLore.length > 0) {
          const short = fallbackLore.length > 200 ? fallbackLore.slice(0, 200).trim() : fallbackLore;
          evidenceReason = `its documented lore includes: ${short}`;
        }
      } catch (e) {
        // ignore and fall back to generic reason
      }

      // Include the original (sanitized) user prompt in the explanation to make the result clearly relate to the user's intent.
      const userPrompt = String(sanitizedQuery || '').replace(/\s+/g, ' ').trim();
      const safePrompt = userPrompt.length > 200 ? userPrompt.slice(0, 200).trim() + '…' : userPrompt;
      const pokemonDisplayName = (pokemon?.name || '').charAt(0).toUpperCase() + (pokemon?.name || '').slice(1);
      const prefix = userPrompt
        ? `Because you asked for "${safePrompt}", I selected ${pokemonDisplayName} because ${evidenceReason}.`
        : `I selected ${pokemonDisplayName} because ${evidenceReason}.`;

      aiExplanation = prefix + '\n\n' + aiExplanation;

      // Deterministic fallback: ensure the explanation explicitly ties back to the user's query.
      // If the model output doesn't mention any meaningful token from the query, append a short, synthesized sentence
      // using the computed evidenceReason so the relation is always clear (avoids relying solely on the LLM).
      try {
        const explanationLower = (aiExplanation || '').toLowerCase();
        // Extract potential character name from the original user prompt (prefer this if present)
        const origPrompt = String((body && body.prompt) || sanitizedQuery || '').trim();
        let characterName: string | null = null;
        try {
          // 1) Check for quoted names: "Luffy" or 'Goku'
          const quoteMatch = origPrompt.match(/["'“”](.{1,80}?)["'“”]/);
          if (quoteMatch && quoteMatch[1]) {
            characterName = quoteMatch[1].trim();
          }

          // 2) Check patterns like 'like <Name>' or 'resembles <Name>' or 'similar to <Name>'
          if (!characterName) {
            const likeMatch = origPrompt.match(/(?:like|resembles|similar to|as in)\s+([A-Z][a-zA-Z0-9_\-]{1,60})/i);
            if (likeMatch && likeMatch[1]) {
              characterName = likeMatch[1].trim();
            }
          }

          // 3) If still not found, look for capitalized words (proper nouns) and pick the first that isn't 'Pokemon'
          if (!characterName) {
            const capMatch = origPrompt.match(/\b([A-Z][a-z]{1,30})\b/g);
            if (Array.isArray(capMatch) && capMatch.length > 0) {
              for (const c of capMatch) {
                if (!/pokemon|pokémon/i.test(c)) { characterName = c.trim(); break; }
              }
            }
          }
        } catch (e) {
          characterName = null;
        }

        const queryTokens = String(sanitizedQuery || '')
          .toLowerCase()
          .split(/[^a-z0-9]+/i)
          .filter(Boolean)
          .filter(t => t.length >= 3 && !/pokemon|pokémon/i.test(t));

        // Basic stopword filter (small set)
        const stopwords = new Set(['the','and','for','with','about','that','this','which','from','your','a','an','is','are','to','of','in','it','like','resembles','similar','character','fictional','anime','manga','cartoon']);
        const keywords = queryTokens.filter(t => !stopwords.has(t));

        let found = false;
        for (const k of keywords) {
          if (explanationLower.includes(k)) { found = true; break; }
        }

        if (!found && (characterName || keywords.length > 0)) {
          // Prefer the character name if detected
          const tieTerms = characterName ? characterName : keywords.slice(0, 2).join(' and ');
          // Use evidenceReason if available, otherwise a generic phrase
          const tieReason = evidenceReason && !/align with the request/i.test(evidenceReason)
            ? evidenceReason
            : 'it matches notable traits from the query';

          // Small curated mapping for common fictional characters to help produce a concise, human-like tie
          const characterTraits: Record<string, string> = {
            'naruto': 'ninja-style combat and relentless determination',
            'goku': 'martial arts prowess and fighting spirit',
            'luffy': 'seafaring adventurer energy and unbreakable resolve',
            'gojo': 'overwhelming power and flashy techniques',
            'goh': 'martial spirit and compassionate heroism',
            'saitama': 'overwhelming strength and blunt combat style',
            
          };

          let tieSentence = '';
          if (characterName) {
            const cname = characterName.toLowerCase();
            const trait = characterTraits[cname];
            if (trait) {
              // Use trait to make a clearer tie between evidence and the fictional character
              tieSentence = `This relates to ${characterName} because ${tieReason}; this echoes ${characterName}'s ${trait}.`;
            } else {
              tieSentence = `This relates to ${characterName} because ${tieReason}.`;
            }
          } else {
            tieSentence = `This relates to "${tieTerms}" because ${tieReason}.`;
          }

          // Append as a single short sentence (avoid duplication)
          aiExplanation = aiExplanation.trim() + '\n' + tieSentence;
        }
      } catch (e) {
        // Non-fatal if fallback fails
      }
    } catch (e) {
      // don't fail if manipulation goes wrong
    }

    // Format Pokédex entries
    const pokedexEntries = species.flavor_text_entries
      .filter(entry => entry.language.name === 'en')
      .slice(0, 3) // Limit to 3 entries
      .map(entry => ({
        version: entry.version.name,
        text: entry.flavor_text.replace(/\f/g, ' ').replace(/\n/g, ' ').trim(),
      }));

    // Format stats
    const stats = statSummaryInput;

    // Format abilities
    const abilities = pokemon.abilities.map(ability => ({
      name: ability.ability.name,
      description: abilityDescriptions[ability.ability.name] || 'No description available.',
      isHidden: ability.is_hidden,
    }));

    

    // Get flavor text
    const flavorText = species.flavor_text_entries
      .find(entry => entry.language.name === 'en')
      ?.flavor_text.replace(/\f/g, ' ').replace(/\n/g, ' ').trim() || '';

  // Build response
    const response: SearchResponse = {
      id: pokemon.id,
      name: pokemon.name,
      spriteUrl: pokemon.sprites.other['official-artwork'].front_default,
      types: pokemon.types.map(t => t.type.name),
      aiInsight: aiExplanation,
      pokedexEntries: pokedexEntries.map(p => ({...p, entry: p.text})),
      stats,
      height: pokemon.height,
      weight: pokemon.weight,
      abilities: abilities.map(a => ({...a, effect: a.description})),
      generation: getGenerationNumber(species.generation.name),
      evolutionChain: evolutionChainNames,
      flavorText: flavorText,
      aiDecision: aiDecision,
      usedLook,
      usedLore,
      retrievedContext: retrievedContextArr,
    };

    // Attach diagnostics if requested
    try {
      const bodyJson = await request.json().catch(() => ({} as any));
      if (bodyJson && bodyJson.diagnostics) {
        // Build per-snippet diagnostics from scoreCandidates (limit to top 12)
        const perSnippet = scoreCandidates.slice(0, 12).map(sc => {
          const c = sc.candidate as any;
          return {
            id: c.id,
            section: c.metadata?.section || c.metadata?.loreText ? 'lore' : 'look',
            lexicalScore: typeof sc.lexicalBoost === 'number' ? sc.lexicalBoost : undefined,
            semanticScore: typeof (sc as any).semanticScore === 'number' ? (sc as any).semanticScore : undefined,
            finalScore: typeof sc.finalScore === 'number' ? sc.finalScore : undefined,
          };
        });
        (response as any).diagnostics = { perSnippet };
      }
    } catch (e) {
      // Don't fail the whole request for diagnostics assembly errors
      console.warn('Failed to assemble diagnostics:', e);
    }

    console.log(`✅ Search completed successfully for ${pokemon.name}`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Search API error:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('rate limit') || error.message.includes('quota')) {
        return NextResponse.json(
          {
            message: ERROR_MESSAGES.rate_limit_exceeded,
            code: 'RATE_LIMIT_EXCEEDED'
          },
          { status: 429 }
        );
      }

      if (error.message.includes('timeout')) {
        return NextResponse.json(
          {
            message: ERROR_MESSAGES.api_timeout,
            code: 'API_TIMEOUT'
          },
          { status: 408 }
        );
      }
    }

    // Generic error response
    return NextResponse.json(
      {
        message: ERROR_MESSAGES.internal_error,
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    {
      message: 'Method not allowed. Use POST to search.',
      code: 'METHOD_NOT_ALLOWED'
    },
    { status: 405 }
  );
}

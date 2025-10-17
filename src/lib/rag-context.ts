import { fetchVectorsByPokemonId as realFetchVectorsByPokemonId } from '@/lib/pinecone';

export type RagContextEntry = {
  section: string;
  text: string;
  pokemonId?: number;
};

export type FetchVectorsFn = (
  pokemonId: number,
  topK?: number
) => Promise<Array<{ section?: string; text?: string }>>;

export interface BuildRagContextParams {
  scoreCandidates: Array<{ candidate: { metadata: Record<string, unknown> } }>;
  pokemonId: number;
  fetchVectorsByPokemonId?: FetchVectorsFn;
  abilityDescriptions?: Record<string, string>;
  pokemonStats?: Array<{ name: string; value: number }>;
  maxSnippets?: number;
  manualEntries?: RagContextEntry[];
}

export interface BuildRagContextResult {
  contextEntries: RagContextEntry[];
  retrievedContextArr: string[];
  retrievedLore: string;
  usedLook: boolean;
  usedLore: boolean;
}

const DEFAULT_MAX_SNIPPETS = 6;

const truncate = (text: string, max: number): string => {
  if (text.length <= max) return text;
  const sliced = text.slice(0, max);
  const lastSpace = sliced.lastIndexOf(' ');
  return (lastSpace > max * 0.5 ? sliced.slice(0, lastSpace) : sliced).trim() + '…';
};

const normalizeKey = (section: string, text: string): string => {
  return `${section.toLowerCase()}::${text.slice(0, 220).toLowerCase()}`;
};

export const buildRagContext = async ({
  scoreCandidates,
  pokemonId,
  fetchVectorsByPokemonId = realFetchVectorsByPokemonId,
  abilityDescriptions,
  pokemonStats,
  maxSnippets = DEFAULT_MAX_SNIPPETS,
  manualEntries,
}: BuildRagContextParams): Promise<BuildRagContextResult> => {
  type ContextEntryInternal = RagContextEntry & { pokemonId?: number };

  const initialContextMap = new Map<string, ContextEntryInternal>();

  for (const sc of scoreCandidates.slice(0, maxSnippets + 2)) {
    const meta = ((sc as unknown) as { candidate?: { metadata?: Record<string, unknown> } })?.candidate?.metadata ?? {};
    const metaRecord = meta as Record<string, unknown>;
    const sourcePokemonId = typeof metaRecord.pokemonId === 'number' ? (metaRecord.pokemonId as number) : undefined;
    const vecText = String(metaRecord.text ?? '').trim();
    const vecSection = String(metaRecord.section ?? '').trim();

    if (vecText) {
      const key = normalizeKey(vecSection || 'unknown', vecText);
      if (!initialContextMap.has(key)) {
        initialContextMap.set(key, {
          section: vecSection || 'unknown',
          text: vecText,
          pokemonId: sourcePokemonId,
        });
      }
      continue;
    }

  const lore = String(metaRecord.loreText ?? '').trim();
    if (lore) {
      const key = normalizeKey('lore', lore);
      if (!initialContextMap.has(key)) {
        initialContextMap.set(key, {
          section: 'lore',
          text: lore,
          pokemonId: sourcePokemonId,
        });
      }
    }
  }

  let contextEntries: ContextEntryInternal[] = Array.from(initialContextMap.values());

  if (Array.isArray(manualEntries) && manualEntries.length > 0) {
    const manualInternal = manualEntries
      .filter(entry => entry?.text)
      .map(entry => ({
        section: entry.section || 'lore',
        text: entry.text,
        pokemonId: typeof entry.pokemonId === 'number' ? entry.pokemonId : pokemonId,
      }));
    contextEntries = [...manualInternal, ...contextEntries];
  }

  // Attempt to pull authoritative snippets directly for the selected Pokémon
  let targetedContextEntries: ContextEntryInternal[] = [];
  try {
    const targetedVectors = await fetchVectorsByPokemonId(pokemonId, maxSnippets * 2);
    targetedContextEntries = targetedVectors
      .map(tv => ({
        section: (tv.section || '').trim() || 'lore',
        text: (tv.text || '').trim(),
        pokemonId,
      }))
      .filter(entry => entry.text);
  } catch (e) {
    console.warn('Targeted snippet fetch failed', e);
  }

  if (targetedContextEntries.length > 0) {
    contextEntries = targetedContextEntries;
  } else {
    const matchingEntries = contextEntries.filter(entry => entry.pokemonId === pokemonId);
    if (matchingEntries.length > 0) {
      contextEntries = matchingEntries;
    }
  }

  if (contextEntries.length === 0) {
    contextEntries = Array.from(initialContextMap.values());
  }

  const dedupedContext = new Map<string, ContextEntryInternal>();
  for (const entry of contextEntries) {
    const cleanText = (entry.text || '').trim();
    if (!cleanText) continue;
    const key = normalizeKey(entry.section || 'unknown', cleanText);
    if (!dedupedContext.has(key)) {
      dedupedContext.set(key, {
        section: entry.section || 'unknown',
        text: cleanText,
        pokemonId: entry.pokemonId,
      });
    }
    if (dedupedContext.size >= maxSnippets) break;
  }

  contextEntries = Array.from(dedupedContext.values());

  // Augment with ability descriptions if we're still sparse
  if (contextEntries.length < maxSnippets && abilityDescriptions) {
    for (const [abilityName, description] of Object.entries(abilityDescriptions)) {
      if (!description) continue;
      const cleanedName = abilityName
        .replaceAll('-', ' ')
        .replaceAll('_', ' ');
      const sentence = `${cleanedName} ability: ${truncate(description, 160)}`;
      const key = normalizeKey('ability', sentence);
      if (!dedupedContext.has(key)) {
        const entry: ContextEntryInternal = {
          section: 'ability',
          text: sentence,
          pokemonId,
        };
        dedupedContext.set(key, entry);
        contextEntries.push(entry);
      }
      if (contextEntries.length >= maxSnippets) break;
    }
  }

  // Augment with stat blurbs if still sparse
  if (contextEntries.length < maxSnippets && pokemonStats && pokemonStats.length > 0) {
    const sortedStats = [...pokemonStats].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    const topStat = sortedStats[0];
    if (topStat) {
      const statSentence = `Key stat ${topStat.name}: ${topStat.value}, highlighting its combat profile.`;
      const key = normalizeKey('stats', statSentence);
      if (!dedupedContext.has(key)) {
        const entry: ContextEntryInternal = {
          section: 'stats',
          text: statSentence,
          pokemonId,
        };
        dedupedContext.set(key, entry);
        contextEntries.push(entry);
      }
    }
  }

  contextEntries = Array.from(dedupedContext.values()).slice(0, maxSnippets);

  const usedLook = contextEntries.some(entry => entry.section.toLowerCase() === 'look');
  const usedLore = contextEntries.some(entry => entry.section.toLowerCase() === 'lore');
  const retrievedContextArr = contextEntries.map(entry => `${entry.section}: ${entry.text}`);
  const retrievedLore = retrievedContextArr.join('\n\n');

  return {
    contextEntries,
    retrievedContextArr,
    retrievedLore,
    usedLook,
    usedLore,
  };
};

#!/usr/bin/env tsx

import { config } from 'dotenv';
config({ path: '.env.local' });

import fs from 'fs';
import path from 'path';
import { fetchPokemonByName, getGenerationNumber } from '../src/lib/pokeapi';
import CANONICAL_NAME_MAP from './canonical-name-map';
import { generateEmbedding } from '../src/lib/gemini';
import { upsertVectors, getIndexStats } from '../src/lib/pinecone';
import { validateEnvironmentVariables } from '../src/utils/validation';

type Section = 'look' | 'lore';

interface ParsedEntry {
  id: number;
  name: string;
  look: string;
  lore: string;
}

const argv = {
  'dry-run': process.argv.includes('--dry-run'),
  'map-only': process.argv.includes('--map-only'),
  'skip-remote': process.argv.includes('--skip-remote'),
  'batch-size': (() => {
    const i = process.argv.findIndex(a => a === '--batch-size');
    if (i >= 0 && process.argv[i+1]) return Number(process.argv[i+1]);
    return 150;
  })(),
  'ids-file': (() => {
    const i = process.argv.findIndex(a => a === '--ids-file');
    if (i >= 0 && process.argv[i+1]) return process.argv[i+1];
    return null;
  })(),
  file: (() => {
    const fileIndex = process.argv.findIndex(a => a === '--file');
    if (fileIndex >= 0 && process.argv[fileIndex + 1]) return process.argv[fileIndex + 1];
    return 'public/lore_looks/lorelooks.md';
  })(),
} as { 'dry-run': boolean; 'map-only': boolean; 'skip-remote': boolean; 'batch-size': number; 'ids-file': string | null; file: string };

const FILE_PATH = path.join(process.cwd(), argv.file);

function parseMarkdownFile(md: string): ParsedEntry[] {
  const lines = md.split(/\r?\n/);
  const entries: ParsedEntry[] = [];

  let current: Partial<ParsedEntry> | null = null;
  let section: Section | null = null;
  let buffer = '';

  const commitBuffer = () => {
    if (!current || !section) return;
    const text = buffer.trim();
    if (!text) return;
    if (section === 'look') current.look = (current.look ? current.look + ' ' : '') + text;
    if (section === 'lore') current.lore = (current.lore ? current.lore + ' ' : '') + text;
    buffer = '';
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('# ')) {
      if (current && current.id && current.name) {
        commitBuffer();
        entries.push({ id: current.id, name: current.name, look: current.look || '', lore: current.lore || '' } as ParsedEntry);
      }
      const match = /#\s*(\d+)\.\s*(.+)/.exec(line);
      current = {};
      if (match) {
        current.id = Number(match[1]);
        current.name = match[2].trim();
      }
      section = null;
      buffer = '';
      continue;
    }

    if (line.startsWith('## ')) {
      commitBuffer();
      const sec = line.replace('## ', '').toLowerCase();
      if (sec.startsWith('look')) section = 'look';
      else if (sec.startsWith('lore')) section = 'lore';
      else section = null;
      continue;
    }

    if (section) {
      buffer += (buffer ? ' ' : '') + line;
    }
  }

  if (current && current.id && current.name) {
    commitBuffer();
    entries.push({ id: current.id, name: current.name, look: current.look || '', lore: current.lore || '' } as ParsedEntry);
  }

  return entries;
}

async function buildRecords(entries: ParsedEntry[]) {
  const records: Array<{ id: string; values: number[]; metadata: any }> = [];
  const mapping: Array<any> = [];
  const failedEmbeds: Array<any> = [];
  const embeddingsCache: Record<string, number[]> = {};

  for (const e of entries) {
  // Try to resolve pokemon by name via PokeAPI using canonical map then multiple normalized candidates
  const key = e.name.trim().toLowerCase();
  const canonical = CANONICAL_NAME_MAP[key];
  const candidates = canonical ? [canonical, ...generateNameCandidates(e.name)] : generateNameCandidates(e.name);
    let resolved: any = null;
    let resolvedBy: string | null = null;
    let resolvedError: string | null = null;
    for (const cand of candidates) {
      try {
        resolved = await fetchPokemonByName(cand);
        if (resolved) {
          resolvedBy = cand;
          break;
        }
      } catch (err: any) {
        // try next candidate
        resolvedError = err?.message ?? String(err);
      }
    }

    const pokemonId = resolved?.pokemon?.id ?? e.id;
    const types = resolved?.pokemon?.types?.map((t: any) => t.type.name) ?? [];
    const generation = resolved && resolved.species && resolved.species.generation
      ? getGenerationNumber(resolved.species.generation.name)
      : Math.floor(e.id / 151) === 0 ? 1 : 1; // fallback to 1 if unknown

    // push mapping info for diagnostics / reconciliation
    mapping.push({
      id: e.id,
      name: e.name,
      resolvedPokemonId: resolved?.pokemon?.id ?? null,
      resolvedName: resolved?.pokemon?.name ?? null,
      resolvedBy,
      resolvedError,
      types,
      generation,
      hasLook: !!(e.look && e.look.trim().length > 0),
      hasLore: !!(e.lore && e.lore.trim().length > 0),
    });

    // For each section (look, lore) create a vector record
      for (const section of ['look', 'lore'] as Section[]) {
        const text = section === 'look' ? e.look : e.lore;
        if (!text || text.trim().length === 0) continue;

        const input = `${e.name} | section: ${section} | types: ${types.join(', ')} | ${text}`;
        console.log(`Generating embedding for ${e.name} (${section})...`);
        try {
          const values = await generateEmbedding(input);
          // cache the values locally for faster re-ranking later
          embeddingsCache[`lorelook-${e.id}-${section}`] = values;
          records.push({
            id: `lorelook-${e.id}-${section}`,
            values,
            metadata: {
              pokemonId,
              name: e.name,
              section,
              types,
              generation,
              source: 'lore_looks_md',
              text: text.slice(0, 5000),
            },
          });
        } catch (err: any) {
          // record failed embedding for this pokemon/section and continue
          console.warn(`Failed to generate embedding for ${e.id} ${e.name} (${section}):`, err?.message ?? err);
          failedEmbeds.push({ id: e.id, name: e.name, section, error: err?.message ?? String(err) });
          continue;
        }
      }
  }

  // write mapping file for later inspection
  try {
    const outDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `lorelooks-map.json`);
    fs.writeFileSync(outPath, JSON.stringify(mapping, null, 2), 'utf8');
    console.log('Wrote mapping file to', outPath);
  } catch (err) {
    console.warn('Failed to write mapping file:', err);
  }

  // persist embeddings cache for reuse at query-time
  try {
    const outDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const embPath = path.join(outDir, `lorelooks-embeddings.json`);
    fs.writeFileSync(embPath, JSON.stringify(embeddingsCache), 'utf8');
    console.log('Wrote embeddings cache to', embPath);
  } catch (err) {
    console.warn('Failed to write embeddings cache:', err);
  }

  return { records, failedEmbeds };
}

function generateNameCandidates(name: string): string[] {
  // Return prioritized candidate slugs to try against PokéAPI
  const orig = name.trim();
  const lower = orig.toLowerCase();

  // Helper: strip diacritics
  const stripDiacritics = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '');

  const stripped = stripDiacritics(lower);

  const variants = new Set<string>();
  variants.add(lower);
  variants.add(stripped);
  // remove punctuation/apostrophes
  variants.add(stripped.replace(/[.'’]/g, ''));
  // replace spaces with hyphens (pokeapi sometimes uses hyphenated slugs)
  variants.add(stripped.replace(/\s+/g, '-'));
  variants.add(stripped.replace(/[.'’]/g, '').replace(/\s+/g, '-'));
  // special case: mr rime -> mr-rime
  variants.add(stripped.replace(/\s+/g, '-').replace(/\W+/g, ''));

  return Array.from(variants);
}

async function main() {
  const md = fs.readFileSync(FILE_PATH, 'utf8');
  let entries = parseMarkdownFile(md);
  console.log(`Parsed ${entries.length} entries from ${FILE_PATH}`);

  // brief preview
  for (let i = 0; i < Math.min(5, entries.length); i++) {
    console.log(`${entries[i].id} - ${entries[i].name} (look ${entries[i].look.length} chars, lore ${entries[i].lore.length} chars)`);
  }

  // If an ids-file was provided, filter to only those IDs so user can retry failed embeds
  if (argv['ids-file']) {
    const idsPath = path.isAbsolute(argv['ids-file']) ? argv['ids-file'] : path.join(process.cwd(), argv['ids-file']);
    try {
      const raw = fs.readFileSync(idsPath, 'utf8');
      const parsed = JSON.parse(raw);
      let ids: number[] = [];
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) ids = [];
        else if (typeof parsed[0] === 'number') ids = parsed as number[];
        else if (parsed[0] && typeof parsed[0].id === 'number') ids = (parsed as any[]).map(p => Number(p.id));
        else ids = (parsed as any[]).map(p => Number(p));
      }

      const idSet = new Set(ids);
      const before = entries.length;
      entries = entries.filter(e => idSet.has(e.id));
      console.log(`Filtered entries by ids-file (${idsPath}): ${before} -> ${entries.length}`);
      if (entries.length === 0) console.warn('No entries matched the provided ids-file. Check the file contents.');
    } catch (err) {
      console.warn('Failed to read or parse ids-file', argv['ids-file'], err);
    }
  }

  // Validate env and keys; allow dry-run
  const isValidEnv = validateEnvironmentVariables().isValid;
  if (argv['dry-run'] || !isValidEnv) {
    console.log('\nDry run mode - no upsert will be performed.');
    if (!isValidEnv) console.log('Environment is missing keys for embeddings or Pinecone; run with proper .env.local to enable upserts.');
  }

  // Build embedding records
  if (argv['map-only']) {
    // perform resolution-only pass and write mapping
    console.log('Map-only mode: resolving names without generating embeddings.');

    if (argv['skip-remote']) {
      // Fast path: write simple mapping from parsed entries without contacting PokéAPI
      const simpleMap = entries.map(e => ({
        id: e.id,
        name: e.name,
        resolvedPokemonId: null,
        resolvedName: null,
        resolvedBy: null,
        resolvedError: 'skip-remote',
        types: [],
        generation: null,
        hasLook: !!(e.look && e.look.trim().length > 0),
        hasLore: !!(e.lore && e.lore.trim().length > 0),
      }));
      const outDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      const outPath = path.join(outDir, `lorelooks-map.json`);
      fs.writeFileSync(outPath, JSON.stringify(simpleMap, null, 2), 'utf8');
      console.log('Wrote simple mapping file to', outPath);
      return;
    }
    // reuse buildRecords but avoid heavy embedding calls by creating a lighter resolver
    const mapping: Array<any> = [];
    for (const e of entries) {
      try {
        const candidates = generateNameCandidates(e.name);
        let resolved: any = null;
        let resolvedBy: string | null = null;
        let resolvedError: string | null = null;
        for (const cand of candidates) {
          try {
            resolved = await fetchPokemonByName(cand);
            if (resolved) {
              resolvedBy = cand;
              break;
            }
          } catch (err: any) {
            // record error and try next candidate
            resolvedError = err?.message ?? String(err);
          }
        }

        const pokemonId = resolved?.pokemon?.id ?? e.id;
        const types = resolved?.pokemon?.types?.map((t: any) => t.type.name) ?? [];
        const generation = resolved && resolved.species && resolved.species.generation
          ? getGenerationNumber(resolved.species.generation.name)
          : Math.floor(e.id / 151) === 0 ? 1 : 1;

        mapping.push({
          id: e.id,
          name: e.name,
          resolvedPokemonId: resolved?.pokemon?.id ?? null,
          resolvedName: resolved?.pokemon?.name ?? null,
          resolvedBy,
          resolvedError,
          types,
          generation,
          hasLook: !!(e.look && e.look.trim().length > 0),
          hasLore: !!(e.lore && e.lore.trim().length > 0),
        });
      } catch (err: any) {
        mapping.push({
          id: e.id,
          name: e.name,
          resolvedPokemonId: null,
          resolvedName: null,
          resolvedBy: null,
          resolvedError: String(err),
          types: [],
          generation: null,
          hasLook: !!(e.look && e.look.trim().length > 0),
          hasLore: !!(e.lore && e.lore.trim().length > 0),
        });
      }

      // small delay to avoid hammering the remote API
      await new Promise(res => setTimeout(res, 50));
    }

    const outDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `lorelooks-map.json`);
    fs.writeFileSync(outPath, JSON.stringify(mapping, null, 2), 'utf8');
    console.log('Wrote mapping file to', outPath);
    return;
  }

  // If not map-only, process entries in batches to avoid long runs and allow partial upserts
  if (!argv['map-only']) {
    const batchSize = argv['batch-size'] ?? 150;
    console.log(`Processing ${entries.length} entries in batches of ${batchSize}...`);
    const chunks: ParsedEntry[][] = [];
    for (let i = 0; i < entries.length; i += batchSize) chunks.push(entries.slice(i, i + batchSize));

    let totalRecords = 0;
    let batchIndex = 0;
    const failedEmbedsAll: Array<any> = [];
    for (const chunk of chunks) {
      batchIndex++;
      console.log(`Building records for batch ${batchIndex}/${chunks.length} (entries ${chunk[0].id}..${chunk[chunk.length-1].id})`);
      const { records, failedEmbeds } = await buildRecords(chunk);
      console.log(`Built ${records.length} embedding records for batch ${batchIndex}.`);

      totalRecords += records.length;

      // append failed embeds from this batch
      if (failedEmbeds && failedEmbeds.length > 0) {
        failedEmbedsAll.push(...failedEmbeds);
      }

      // write a running failed-embeds file so partial runs can be retried
      try {
        const outDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        // Deduplicate by id+section
        const dedupMap = new Map<string, any>();
        for (const f of failedEmbedsAll) {
          const key = `${f.id}-${f.section}`;
          if (!dedupMap.has(key)) dedupMap.set(key, f);
        }
        const deduped = Array.from(dedupMap.values());
        const outPath = path.join(outDir, `lorelooks-failed-embeds.json`);
        fs.writeFileSync(outPath, JSON.stringify(deduped, null, 2), 'utf8');
        console.log(`Wrote ${deduped.length} failed embed entries to`, outPath);

        // Also write a simple list of unique pokemon ids (and sections) to retry by id only
        const failedById = new Map<number, { id: number; name: string; sections: string[] }>();
        for (const f of deduped) {
          const idNum = Number(f.id);
          const existing = failedById.get(idNum);
          if (existing) {
            if (!existing.sections.includes(f.section)) existing.sections.push(f.section);
          } else {
            failedById.set(idNum, { id: idNum, name: f.name, sections: [f.section] });
          }
        }
        const failedIdsPath = path.join(outDir, `lorelooks-failed-ids.json`);
        fs.writeFileSync(failedIdsPath, JSON.stringify(Array.from(failedById.values()), null, 2), 'utf8');
        console.log(`Wrote ${failedById.size} failed pokemon ids to`, failedIdsPath);
      } catch (err) {
        console.warn('Failed to write failed-embeds file:', err);
      }

      if (!argv['dry-run']) {
        console.log(`Uploading batch ${batchIndex}/${chunks.length} to Pinecone...`);
        await upsertVectors(records as any);
        console.log(`Upserted batch ${batchIndex}/${chunks.length}`);
      } else {
        console.log('Dry-run: skipping upsert.');
      }

      // small pause between batches
      await new Promise(res => setTimeout(res, 200));
    }

    console.log(`Processed ${totalRecords} records across ${chunks.length} batches.`);
  }

  if (!argv['map-only']) {
    if (!argv['dry-run'] && isValidEnv) {
      // We already upserted each batch during processing; show index stats now.
      try {
        const stats = await getIndexStats();
        console.log('Index stats after upsert:', stats);
      } catch (err) {
        console.warn('Failed to fetch index stats:', err);
      }
    } else {
      console.log('Finished dry-run or environment invalid; no global upsert performed.');
    }
  }
}

main().catch(err => {
  console.error('Ingest script failed:', err);
  process.exit(1);
});

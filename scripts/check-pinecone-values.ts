// Script: check-pinecone-values.ts
// Purpose: Iterate Pokemon IDs and verify Pinecone stored vectors include `values` (embedding vectors).
// Writes report to data/pinecone-values-report.json

import fs from 'fs';
import path from 'path';

// Load .env.local if present
const projectRoot = path.resolve(__dirname, '..');
const envLocal = path.join(projectRoot, '.env.local');
if (fs.existsSync(envLocal)) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config({ path: envLocal });
  console.log('Loaded environment from .env.local');
} else {
  console.log('No .env.local found; using process.env');
}

import { fetchVectorsByPokemonId } from '../src/lib/pinecone';

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function main() {
  const maxId = 911; // adjust if you have a different range
  let totalVectors = 0;
  let vectorsWithValues = 0;
  let vectorsMissingValues = 0;
  const missingSamples: Array<{ pokemonId: number; vectorId: string }> = [];

  for (let id = 1; id <= maxId; id++) {
    try {
      // fetch up to 10 vectors per pokemon (should usually be 2: look + lore)
      const matches = await fetchVectorsByPokemonId(id, 10);
      await sleep(75); // small throttle to avoid hitting rate limits

      for (const m of matches) {
        totalVectors += 1;
        if (Array.isArray((m as any).values) && (m as any).values.length > 0) {
          vectorsWithValues += 1;
        } else {
          vectorsMissingValues += 1;
          if (missingSamples.length < 200) {
            missingSamples.push({ pokemonId: id, vectorId: m.id });
          }
        }
      }
    } catch (e) {
      console.warn(`Error fetching vectors for pokemon ${id}:`, e);
    }
  }

  const report = {
    checkedPokemonRange: [1, maxId],
    totalVectors,
    vectorsWithValues,
    vectorsMissingValues,
    missingSamplesCount: missingSamples.length,
    missingSamples,
    generatedAt: new Date().toISOString(),
  };

  const outDir = path.join(projectRoot, 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'pinecone-values-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log('Report written to', outPath);
  console.log('Summary:', {
    totalVectors,
    vectorsWithValues,
    vectorsMissingValues,
  });
}

main().catch((e) => {
  console.error('Script failed', e);
  process.exit(1);
});

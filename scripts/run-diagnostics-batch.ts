import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { POST } from '../src/app/api/search/route';

// Ensure .env.local is loaded if present
const projectRoot = path.resolve(__dirname, '..');
const envLocal = path.join(projectRoot, '.env.local');
if (fs.existsSync(envLocal)) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config({ path: envLocal });
  console.log('Loaded environment from .env.local');
}

class MockRequest {
  private body: any;
  headers: Map<string, string> = new Map();
  constructor(body: any) { this.body = body; }
  async json() { return this.body; }
}

const prompts = [
  'a dark looking dragon that helps with ideals',
  'a ghost that lives in a teapot',
  'a small electric mouse that is friendly',
  'the final evolution of the fire starter from Kanto',
  'a legendary Pokémon that controls time',
  'a cute water turtle that likes beaches',
  'a Pokémon that is known for healing others',
  'a bat-like dragon that hunts at night'
];

async function runBatch() {
  const results: Array<{ prompt: string; response: any }> = [];
  for (const p of prompts) {
    console.log('\nRunning prompt:', p);
    const req = new MockRequest({ prompt: p, diagnostics: true });
    try {
      const res: any = await POST(req as any);
      let body: any;
      if (res && typeof res.json === 'function') {
        body = await res.json();
      } else {
        body = res;
      }
      results.push({ prompt: p, response: body });
    } catch (e) {
      console.error('Error for prompt', p, e);
      results.push({ prompt: p, response: { error: String(e) } });
    }
  }

  const outDir = path.join(projectRoot, 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'diagnostics.json');
  fs.writeFileSync(outPath, JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2), 'utf-8');
  console.log('Wrote diagnostics to', outPath);
}

runBatch().catch(e => { console.error('Batch failed', e); process.exit(1); });

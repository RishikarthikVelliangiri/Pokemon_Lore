import 'dotenv/config';
import { POST } from '../src/app/api/search/route';

// Ensure .env.local is loaded if present (dotenv/config will read .env by default).
// If you use a .env.local file, ensure NODE_ENV or dotenv config loads it; for safety, load .env.local explicitly when available.
import fs from 'fs';
import path from 'path';

const projectRoot = path.resolve(__dirname, '..');
const envLocal = path.join(projectRoot, '.env.local');
if (fs.existsSync(envLocal)) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config({ path: envLocal });
  console.log('Loaded environment from .env.local');
} else {
  console.log('No .env.local found; using process.env');
}

// Minimal mock of NextRequest used by the POST handler
class MockRequest {
  private body: any;
  constructor(body: any) { this.body = body; }
  async json() { return this.body; }
  headers: Map<string, string> = new Map();
}

async function run(prompts: string[]) {
  for (const p of prompts) {
    console.log('\n=== Prompt:', p, '\n');
    const req = new MockRequest({ prompt: p });
    try {
      const res: any = await POST(req as any);
      if (res && typeof res.json === 'function') {
        const body = await res.json();
        console.log('Response:', JSON.stringify(body, null, 2));
      } else {
        console.log('Response (raw):', res);
      }
    } catch (e) {
      console.error('Error calling POST:', e);
    }
  }
}

const prompts = [
  'a dark looking dragon that helps with ideals',
  'dragon that will help someone pursuing ideals',
  'a ghost that lives in a teapot',
  'the most fiery dragon who protects the weak'
];

run(prompts).then(() => console.log('\nDone')).catch((e) => console.error('Run failed', e));

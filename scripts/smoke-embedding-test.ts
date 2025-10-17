import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// This smoke test runs the sample search script with DEBUG_EMBEDDINGS=true and counts
// how many times generateEmbedding was invoked by searching for the debug log line.

const projectRoot = path.resolve(__dirname, '..');
const script = path.join(projectRoot, 'scripts', 'run-sample-search.ts');

function runScript(): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
  const env = { ...process.env, DEBUG_EMBEDDINGS: 'true', NODE_ENV: 'development' } as Record<string, string | undefined>;
  const ps = spawn('npx', ['--yes', 'tsx', script], { env: env as any, shell: true });
    let stdout = '';
    let stderr = '';
    ps.stdout.on('data', (d) => { stdout += d.toString(); process.stdout.write(d); });
    ps.stderr.on('data', (d) => { stderr += d.toString(); process.stderr.write(d); });
    ps.on('close', (code) => resolve({ stdout, stderr, code }));
  });
}

(async () => {
  console.log('Running smoke embedding test...');
  const result = await runScript();
  const debugMatches = (result.stdout.match(/DEBUG: generateEmbedding called for text preview:/g) || []).length;
  const promptMatches = (result.stdout.match(/=== Prompt:/g) || []).length;

  console.log('\n=== SUMMARY ===');
  console.log('Prompts executed:', promptMatches);
  console.log('generateEmbedding debug lines:', debugMatches);

  if (debugMatches === promptMatches) {
    console.log('PASS: No snippet embeddings were generated at query-time (only query embeddings).');
    process.exit(0);
  } else {
    console.error('FAIL: Detected more embedding calls than prompts. Investigate potential runtime snippet embedding generation.');
    process.exit(2);
  }
})();

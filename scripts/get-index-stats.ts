#!/usr/bin/env tsx
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getIndexStats } from '../src/lib/pinecone';

(async () => {
  try {
    const s = await getIndexStats();
    console.log('Pinecone index stats:');
    console.log(JSON.stringify(s, null, 2));
  } catch (e) {
    console.error('Failed to get index stats:', e);
    process.exit(1);
  }
})();

#!/usr/bin/env tsx

// Load environment variables FIRST
import { config } from 'dotenv';
config({ path: '.env.local' });

import { generateEmbedding } from '../src/lib/gemini';

async function testIngestEmbedding() {
  try {
    console.log('🔧 Testing embedding generation in ingestion context...');
    
    const testText = "Pikachu is a yellow electric mouse Pokemon known for its lightning attacks.";
    console.log('🧠 Generating embedding for test text...');
    
    const embedding = await generateEmbedding(testText);
    
    if (embedding && embedding.length > 0) {
      console.log('✅ Embedding generation successful! Dimension:', embedding.length);
      console.log('🎉 Ingestion context test passed!');
    } else {
      console.log('❌ Embedding generation failed - no values returned');
    }
    
  } catch (error) {
    console.error('❌ Ingestion context test failed:');
    console.error('Error details:', error);
    process.exit(1);
  }
}

testIngestEmbedding();

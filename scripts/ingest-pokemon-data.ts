#!/usr/bin/env tsx

/**
 * Pokémon Data Ingestion Script
 * 
 * This script fetches all Pokémon data from PokéAPI, processes their lore text,
 * generates embeddings using Google Gemini, and stores them in Pinecone.
 * 
 * Usage: npm run ingest-data
 */

// Load environment variables FIRST before any other imports
import { config } from 'dotenv';
config({ path: '.env.local' });

import { fetchPokemonRange, extractLoreText, getGenerationNumber, getRegionNameFromGeneration } from '../src/lib/pokeapi';
import { STARTERS_BY_REGION, ALL_STARTER_BASES } from '../src/utils/constants';
import { generateEmbedding } from '../src/lib/gemini';
import { upsertVectors, deleteAllVectors, getIndexStats } from '../src/lib/pinecone';
import { validateEnvironmentVariables } from '../src/utils/validation';

interface PokemonVector {
  id: string;
  values: number[];
  metadata: {
    pokemonId: number;
    name: string;
    types: string[];
    generation: number;
    region?: string;
    isStarterFamily?: boolean;
    loreText: string;
  };
}

// Configuration
const BATCH_SIZE = 50; // Process Pokémon in batches
const MAX_POKEMON = 1025; // Total number of Pokémon to process
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds delay between batches

async function validateSetup(): Promise<void> {
  console.log('🔍 Validating environment setup...');
  
  const { isValid, missing } = validateEnvironmentVariables();
  if (!isValid) {
    console.error('❌ Missing required environment variables:', missing);
    process.exit(1);
  }

  console.log('✅ Environment variables validated');
}

async function processLoreText(loreText: string, pokemonName: string): Promise<string> {
  if (!loreText || loreText.trim().length === 0) {
    return `${pokemonName} is a Pokémon with unique characteristics and abilities.`;
  }

  // Clean up the lore text
  return loreText
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[^\w\s.,!?-]/g, '') // Remove special characters except basic punctuation
    .trim();
}

async function processPokemonBatch(start: number, end: number): Promise<PokemonVector[]> {
  console.log(`📦 Processing Pokémon batch ${start}-${end}...`);
  
  const pokemonData = await fetchPokemonRange(start, end);
  const vectors: PokemonVector[] = [];

  for (const { pokemon, species } of pokemonData) {
    try {
      // Extract and process lore text
      const rawLoreText = extractLoreText(species);
      const processedLoreText = await processLoreText(rawLoreText, pokemon.name);

  // Build enriched embedding input: include name and types to give the vector signal about the Pokémon
  const generation = getGenerationNumber(species.generation.name);
  const region = getRegionNameFromGeneration(generation);
  const embeddingInput = `${pokemon.name}. Types: ${pokemon.types.map(t => t.type.name).join(', ')}. Region: ${region}. ${processedLoreText}`;
  // Generate embedding
  console.log(`🧠 Generating embedding for ${pokemon.name}...`);
  const embedding = await generateEmbedding(embeddingInput);

      // Create vector object
      const vector: PokemonVector = {
        id: `pokemon-${pokemon.id}`,
        values: embedding,
        metadata: {
          pokemonId: pokemon.id,
          name: pokemon.name,
          types: pokemon.types.map(t => t.type.name),
          generation: getGenerationNumber(species.generation.name),
          region: region,
          // isStarterFamily: true if the base species (lowercased) is one of the official starters for the region
          isStarterFamily: (() => {
            try {
              const baseName = species.name.toLowerCase();
              const starters = STARTERS_BY_REGION[region as keyof typeof STARTERS_BY_REGION] || [];
              return starters.includes(baseName) || ALL_STARTER_BASES.includes(baseName);
            } catch (e) {
              return false;
            }
          })(),
          loreText: processedLoreText,
        },
      };

      vectors.push(vector);
      console.log(`✅ Processed ${pokemon.name} (${pokemon.id})`);

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`❌ Failed to process ${pokemon.name}:`, error);
      // Continue with next Pokémon
    }
  }

  return vectors;
}

async function ingestAllPokemon(): Promise<void> {
  console.log('🚀 Starting Pokémon data ingestion...');
  
  try {
    // Get initial index stats
    console.log('📊 Getting initial index stats...');
    const initialStats = await getIndexStats();
    console.log('Initial index stats:', initialStats);

    // Ask user if they want to clear existing data
    if (initialStats.totalRecordCount && initialStats.totalRecordCount > 0) {
      console.log(`⚠️  Index contains ${initialStats.totalRecordCount} existing vectors.`);
      console.log('🗑️  Clearing existing data...');
      await deleteAllVectors();
      console.log('✅ Existing data cleared');
    }

    const allVectors: PokemonVector[] = [];
    
    // Process Pokémon in batches
    for (let start = 1; start <= MAX_POKEMON; start += BATCH_SIZE) {
      const end = Math.min(start + BATCH_SIZE - 1, MAX_POKEMON);
      
      try {
        const batchVectors = await processPokemonBatch(start, end);
        allVectors.push(...batchVectors);

        // Upsert batch to Pinecone
        if (batchVectors.length > 0) {
          console.log(`📤 Uploading ${batchVectors.length} vectors to Pinecone...`);
          await upsertVectors(batchVectors);
          console.log(`✅ Batch ${start}-${end} uploaded successfully`);
        }

        // Delay between batches
        if (end < MAX_POKEMON) {
          console.log(`⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
      } catch (error) {
        console.error(`❌ Failed to process batch ${start}-${end}:`, error);
        // Continue with next batch
      }
    }

    // Final stats
    console.log('📊 Getting final index stats...');
    const finalStats = await getIndexStats();
    console.log('Final index stats:', finalStats);

    console.log(`🎉 Data ingestion completed!`);
    console.log(`📈 Total vectors processed: ${allVectors.length}`);
    console.log(`📈 Total vectors in index: ${finalStats.totalRecordCount}`);

  } catch (error) {
    console.error('❌ Data ingestion failed:', error);
    process.exit(1);
  }
}

// Main execution
async function main() {
  try {
    await validateSetup();
    await ingestAllPokemon();
    console.log('🏁 Script completed successfully!');
  } catch (error) {
    console.error('💥 Script failed:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}
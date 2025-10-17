#!/usr/bin/env tsx

/**
 * Connection Testing Script
 * 
 * Tests connections to all external services:
 * - Google Gemini API
 * - Pinecone Vector Database
 * - PokéAPI
 * 
 * Usage: npm run test-connections
 */

import { config } from 'dotenv';
import { testGeminiConnection } from '../src/lib/gemini';
import { testPineconeConnection, getIndexStats } from '../src/lib/pinecone';
import { testPokeAPIConnection } from '../src/lib/pokeapi';
import { validateEnvironmentVariables } from '../src/utils/validation';

// Load environment variables
config({ path: '.env.local' });

async function testEnvironmentVariables(): Promise<boolean> {
  console.log('🔍 Testing environment variables...');
  
  const { isValid, missing } = validateEnvironmentVariables();
  
  if (!isValid) {
    console.error('❌ Missing environment variables:', missing);
    return false;
  }
  
  console.log('✅ All required environment variables are set');
  return true;
}

async function testGemini(): Promise<boolean> {
  console.log('🧠 Testing Google Gemini API connection...');
  
  try {
    const isConnected = await testGeminiConnection();
    
    if (isConnected) {
      console.log('✅ Google Gemini API connection successful');
      return true;
    } else {
      console.error('❌ Google Gemini API connection failed');
      return false;
    }
  } catch (error) {
    console.error('❌ Google Gemini API test error:', error);
    return false;
  }
}

async function testPinecone(): Promise<boolean> {
  console.log('📊 Testing Pinecone connection...');
  
  try {
    const isConnected = await testPineconeConnection();
    
    if (isConnected) {
      console.log('✅ Pinecone connection successful');
      
      // Get index stats
      try {
        const stats = await getIndexStats();
        console.log('📈 Index stats:', {
          totalRecordCount: stats.totalRecordCount,
          dimension: stats.dimension,
        });
      } catch (error) {
        console.warn('⚠️  Could not retrieve index stats:', error);
      }
      
      return true;
    } else {
      console.error('❌ Pinecone connection failed');
      return false;
    }
  } catch (error) {
    console.error('❌ Pinecone test error:', error);
    return false;
  }
}

async function testPokeAPI(): Promise<boolean> {
  console.log('🐾 Testing PokéAPI connection...');
  
  try {
    const isConnected = await testPokeAPIConnection();
    
    if (isConnected) {
      console.log('✅ PokéAPI connection successful');
      return true;
    } else {
      console.error('❌ PokéAPI connection failed');
      return false;
    }
  } catch (error) {
    console.error('❌ PokéAPI test error:', error);
    return false;
  }
}

async function runAllTests(): Promise<void> {
  console.log('🚀 Starting connection tests...\n');
  
  const results = {
    environment: false,
    gemini: false,
    pinecone: false,
    pokeapi: false,
  };

  // Test environment variables
  results.environment = await testEnvironmentVariables();
  console.log('');

  // Only proceed with API tests if environment is valid
  if (results.environment) {
    // Test Gemini API
    results.gemini = await testGemini();
    console.log('');

    // Test Pinecone
    results.pinecone = await testPinecone();
    console.log('');

    // Test PokéAPI
    results.pokeapi = await testPokeAPI();
    console.log('');
  }

  // Summary
  console.log('📋 Test Results Summary:');
  console.log('========================');
  console.log(`Environment Variables: ${results.environment ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Google Gemini API:     ${results.gemini ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Pinecone Database:     ${results.pinecone ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`PokéAPI:               ${results.pokeapi ? '✅ PASS' : '❌ FAIL'}`);

  const allPassed = Object.values(results).every(result => result);
  
  if (allPassed) {
    console.log('\n🎉 All tests passed! System is ready for data ingestion.');
  } else {
    console.log('\n⚠️  Some tests failed. Please check your configuration.');
    process.exit(1);
  }
}

// Main execution
async function main() {
  try {
    await runAllTests();
  } catch (error) {
    console.error('💥 Test script failed:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}
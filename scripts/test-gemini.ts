#!/usr/bin/env tsx

// Load environment variables FIRST
import { config } from 'dotenv';
config({ path: '.env.local' });

import { GoogleGenerativeAI } from '@google/generative-ai';

async function testGeminiConnection() {
  try {
    console.log('🔧 Testing Gemini API connection...');
    
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY environment variable not found');
    }
    
    console.log('✅ API Key loaded:', apiKey.substring(0, 10) + '...');
    
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Try embedding first
    console.log('🧠 Testing embedding model...');
    const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const embeddingResult = await embeddingModel.embedContent('Hello world');
    
    if (embeddingResult.embedding && embeddingResult.embedding.values) {
      console.log('✅ Embedding successful! Dimension:', embeddingResult.embedding.values.length);
    } else {
      console.log('❌ Embedding failed - no values returned');
    }
    
    // Try text generation
    console.log('💬 Testing text generation model...');
    const textModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const textResult = await textModel.generateContent('Say hello');
    const response = await textResult.response;
    
    console.log('✅ Text generation successful:', response.text().substring(0, 50) + '...');
    
    console.log('🎉 All tests passed! Gemini API is working correctly.');
    
  } catch (error) {
    console.error('❌ Gemini API test failed:');
  console.error('Error details:', error);
    
  // Narrow unknown error to any before accessing status
  const errAny: any = error;
  if (errAny?.status === 403) {
      console.error('\n🚨 This looks like an authentication/authorization issue.');
      console.error('Possible solutions:');
      console.error('1. Check if your API key is valid and active');
      console.error('2. Verify billing is enabled for your Google Cloud project');
      console.error('3. Make sure the Generative AI API is enabled in your project');
      console.error('4. Check if you have quota/usage limits');
    }
    
    process.exit(1);
  }
}

testGeminiConnection();

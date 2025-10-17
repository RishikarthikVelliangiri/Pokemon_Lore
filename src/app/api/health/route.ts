import { NextResponse } from 'next/server';
import { testGeminiConnection } from '@/lib/gemini';
import { testPineconeConnection } from '@/lib/pinecone';
import { testPokeAPIConnection } from '@/lib/pokeapi';
import { HealthCheckResponse } from '@/types/api';

export async function GET() {
  const startTime = Date.now();
  
  try {
    console.log('🏥 Running health check...');

    // Test all services in parallel
    const [geminiHealthy, pineconeHealthy, pokeapiHealthy] = await Promise.allSettled([
      testGeminiConnection(),
      testPineconeConnection(),
      testPokeAPIConnection(),
    ]);

    // Extract results
    const services = {
      gemini: geminiHealthy.status === 'fulfilled' && geminiHealthy.value,
      pinecone: pineconeHealthy.status === 'fulfilled' && pineconeHealthy.value,
      pokeapi: pokeapiHealthy.status === 'fulfilled' && pokeapiHealthy.value,
    };

    // Determine overall health
    const allHealthy = Object.values(services).every(healthy => healthy);
    const overallStatus = allHealthy ? 'healthy' : 'unhealthy';

    const response: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services,
    };

    const responseTime = Date.now() - startTime;
    console.log(`🏥 Health check completed in ${responseTime}ms - Status: ${overallStatus}`);

    // Return appropriate status code
    const statusCode = allHealthy ? 200 : 503;
    
    return NextResponse.json(response, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Response-Time': `${responseTime}ms`,
      },
    });

  } catch (error) {
    console.error('❌ Health check failed:', error);

    const response: HealthCheckResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        gemini: false,
        pinecone: false,
        pokeapi: false,
      },
    };

    const responseTime = Date.now() - startTime;

    return NextResponse.json(response, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Response-Time': `${responseTime}ms`,
      },
    });
  }
}

// Handle unsupported methods
export async function POST() {
  return NextResponse.json(
    { 
      message: 'Method not allowed. Use GET for health check.',
      code: 'METHOD_NOT_ALLOWED' 
    },
    { status: 405 }
  );
}
import { Pinecone } from '@pinecone-database/pinecone';
import { ENV } from '@/utils/constants';
import { VectorSearchResult } from '@/types/api';
import { createAPIError } from '@/types/errors';

// Initialize Pinecone client
let pineconeClient: Pinecone | null = null;

const initializePinecone = () => {
  if (!pineconeClient) {
    if (!ENV.pineconeApiKey) {
      throw new Error('Pinecone API key is not configured');
    }

    pineconeClient = new Pinecone({
      apiKey: ENV.pineconeApiKey,
    });
  }
  return pineconeClient;
};

// Get Pinecone index
const getIndex = () => {
  const client = initializePinecone();
  return client.index(ENV.pineconeIndexName);
};

// Upsert vectors to Pinecone
export const upsertVectors = async (vectors: Array<{
  id: string;
  values: number[];
  metadata: {
    pokemonId: number;
    name: string;
    types: string[];
    generation: number;
    region?: string;
    loreText: string;
  };
}>): Promise<void> => {
  try {
    const index = getIndex();
    
    // Upsert in batches of 100
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      await index.upsert(batch);
      console.log(`Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectors.length / batchSize)}`);
    }
  } catch (error: unknown) {
    console.error('Error upserting vectors:', error);
    throw createAPIError(500, 'Failed to upsert vectors to Pinecone', error as Error);
  }
};

// Search for similar vectors
export const searchVectors = async (
  queryVector: number[],
  topK: number = 1
): Promise<VectorSearchResult[]> => {
  try {
    const index = getIndex();
    
    const searchResponse = await index.query({
      vector: queryVector,
      topK,
      includeMetadata: true,
      includeValues: true,
    });

    if (!searchResponse.matches) {
      return [];
    }

    return searchResponse.matches.map(match => ({
      id: match.id || '',
      score: match.score || 0,
      // include raw vector values when present — this lets search use them instead of regenerating embeddings
      values: Array.isArray(match.values) ? match.values as number[] : undefined,
      metadata: {
        pokemonId: match.metadata?.pokemonId as number || 0,
        name: match.metadata?.name as string || '',
        types: match.metadata?.types as string[] || [],
        generation: match.metadata?.generation as number || 1,
        region: match.metadata?.region as string || '',
            loreText: match.metadata?.loreText as string || '',
            section: match.metadata?.section as string || '',
            text: match.metadata?.text as string || '',
            isStarterFamily: Boolean(match.metadata?.isStarterFamily) || false,
      },
    }));
  } catch (error: unknown) {
    console.error('Error searching vectors:', error);
    throw createAPIError(500, 'Failed to search vectors in Pinecone', error as Error);
  }
};

// Delete all vectors (for reindexing)
export const deleteAllVectors = async (): Promise<void> => {
  try {
    const index = getIndex();
    await index.deleteAll();
    console.log('All vectors deleted from Pinecone index');
  } catch (error: unknown) {
    console.error('Error deleting vectors:', error);
    throw createAPIError(500, 'Failed to delete vectors from Pinecone', error as Error);
  }
};

// Get index stats
export const getIndexStats = async () => {
  try {
    const index = getIndex();
    const stats = await index.describeIndexStats();
    return stats;
  } catch (error: unknown) {
    console.error('Error getting index stats:', error);
    throw createAPIError(500, 'Failed to get Pinecone index stats', error as Error);
  }
};

// Test Pinecone connection
export const testPineconeConnection = async (): Promise<boolean> => {
  try {
    if (!ENV.pineconeApiKey) {
      return false;
    }

    await getIndexStats();
    return true;
  } catch (error: unknown) {
    console.error('Pinecone connection test failed:', error);
    return false;
  }
};

// Fetch top vectors for a specific pokemonId (to retrieve look/lore snippets)
export const fetchVectorsByPokemonId = async (
  pokemonId: number,
  topK: number = 5
): Promise<Array<{ id: string; score: number; section?: string; text?: string; values?: number[] }>> => {
  try {
    const index = getIndex();
    // Pinecone doesn't support direct lookup by metadata; instead perform a metadata-filtered query if available
    // We'll query using an empty vector and filter by metadata.pokemonId
    const queryBody = {
      vector: new Array(768).fill(0),
      topK,
      includeMetadata: true,
      includeValues: true,
      filter: { pokemonId },
    } as const;

  // Safely cast the query body to the parameter type expected by the Pinecone client
  // We avoid using `any` here to satisfy eslint/@typescript-eslint rules.
  const res = await index.query(queryBody as unknown as Parameters<typeof index.query>[0]);
    if (!res.matches) return [];

    return res.matches.map((m: unknown) => {
      const match = m as Record<string, unknown>;
      const metadata = (match['metadata'] as Record<string, unknown> | undefined) || undefined;
      const valuesRaw = match['values'];
      const values = Array.isArray(valuesRaw) ? (valuesRaw as unknown[]).map(v => Number(v)) as number[] : undefined;
      return {
        id: (match['id'] as string) || '',
        score: (match['score'] as number) || 0,
        section: (metadata?.section as string) || undefined,
        text: (metadata?.text as string) || (metadata?.loreText as string) || undefined,
        values,
      };
    });
  } catch (error: unknown) {
    console.warn('Failed to fetch vectors by pokemonId', pokemonId, error);
    return [];
  }
};
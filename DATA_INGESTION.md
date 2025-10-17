# Pokémon Data Ingestion Guide

This guide explains how to set up and run the data ingestion pipeline for the Pokémon Lore Engine.

## Prerequisites

1. **Google Gemini API Key**
   - Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Add it to your `.env.local` file as `GOOGLE_GEMINI_API_KEY`

2. **Pinecone Account**
   - Sign up at [Pinecone](https://www.pinecone.io/)
   - Create a new index with the following settings:
     - **Dimension**: 768 (for Google Gemini embeddings)
     - **Metric**: Cosine
     - **Name**: `pokemon-lore-vectors` (or update `PINECONE_INDEX_NAME` in `.env.local`)
   - Get your API key and environment from the Pinecone console
   - Add them to your `.env.local` file

3. **Environment Variables**
   ```bash
   # Copy the example file
   cp .env.example .env.local
   
   # Edit .env.local with your actual API keys
   GOOGLE_GEMINI_API_KEY=your_gemini_api_key_here
   PINECONE_API_KEY=your_pinecone_api_key_here
   PINECONE_ENVIRONMENT=your_pinecone_environment_here
   PINECONE_INDEX_NAME=pokemon-lore-vectors
   ```

## Running the Data Ingestion

### Step 1: Test Connections

Before running the full ingestion, test that all services are accessible:

```bash
npm run test-connections
```

This will verify:
- Environment variables are set correctly
- Google Gemini API is accessible
- Pinecone database connection works
- PokéAPI is accessible

### Step 2: Run Data Ingestion

Once all connections are verified, run the full data ingestion:

```bash
npm run ingest-data
```

This process will:
1. Fetch data for all ~1025 Pokémon from PokéAPI
2. Extract and clean lore text from Pokédex entries
3. Generate embeddings using Google Gemini
4. Store vectors in Pinecone with metadata

**Expected Duration**: 2-4 hours (depending on API rate limits)

## Process Details

### Data Processing Pipeline

1. **Fetch Pokémon Data**
   - Retrieves basic Pokémon info (name, types, stats, abilities)
   - Fetches species data with Pokédex entries
   - Processes data in batches of 50 to avoid rate limits

2. **Lore Text Extraction**
   - Combines all English Pokédex entries for each Pokémon
   - Removes duplicates and cleans formatting
   - Creates comprehensive lore text for embedding

3. **Embedding Generation**
   - Uses Google Gemini's `text-embedding-004` model
   - Generates 768-dimensional vectors
   - Includes rate limiting and error handling

4. **Vector Storage**
   - Stores vectors in Pinecone with rich metadata
   - Metadata includes: Pokémon ID, name, types, generation, lore text
   - Enables efficient similarity search

### Batch Processing

The ingestion processes Pokémon in batches:
- **Batch Size**: 50 Pokémon per batch
- **Delay**: 2 seconds between batches
- **Error Handling**: Continues processing if individual Pokémon fail

### Monitoring Progress

The script provides detailed logging:
```
📦 Processing Pokémon batch 1-50...
🧠 Generating embedding for bulbasaur...
✅ Processed bulbasaur (1)
📤 Uploading 50 vectors to Pinecone...
✅ Batch 1-50 uploaded successfully
```

## Troubleshooting

### Common Issues

1. **API Key Errors**
   ```
   Error: Google Gemini API key is not configured
   ```
   - Verify your `.env.local` file has the correct API key
   - Ensure the key has proper permissions

2. **Rate Limiting**
   ```
   Error: Rate limit exceeded
   ```
   - The script includes automatic delays
   - If you hit limits, wait and restart the script

3. **Network Timeouts**
   ```
   Error: Request timeout
   ```
   - Check your internet connection
   - The script will retry failed requests

4. **Pinecone Index Issues**
   ```
   Error: Index not found
   ```
   - Verify your Pinecone index exists
   - Check the index name in `.env.local`
   - Ensure the index dimension is 768

### Restarting Ingestion

If the ingestion fails partway through:

1. The script will ask if you want to clear existing data
2. Choose "yes" to start fresh, or "no" to append
3. The script handles duplicate prevention automatically

### Verifying Results

After ingestion completes:

1. Check the final statistics in the console output
2. Verify vector count in Pinecone console
3. Test a search query using the API endpoint

## Performance Optimization

### API Rate Limits

- **Google Gemini**: 60 requests per minute (free tier)
- **PokéAPI**: No official limits, but be respectful
- **Pinecone**: Varies by plan

### Memory Usage

The script processes data in batches to minimize memory usage:
- Each batch processes ~50 Pokémon
- Vectors are uploaded immediately after processing
- Memory is freed between batches

### Cost Estimation

**Google Gemini API** (approximate costs):
- Embedding generation: ~$0.10 for all Pokémon
- Text generation during searches: ~$0.01 per query

**Pinecone** (free tier):
- 1M vectors free
- Pokémon dataset uses ~1,025 vectors
- Well within free tier limits

## Next Steps

After successful ingestion:

1. Test the search API endpoint
2. Verify search results quality
3. Monitor API usage and costs
4. Set up monitoring for the production system
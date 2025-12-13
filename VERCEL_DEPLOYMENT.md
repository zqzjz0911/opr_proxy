# Vercel Deployment Guide for OpenRouter Proxy

## Overview

This guide explains how to deploy the OpenRouter Proxy Server to Vercel. The project has been modified to work with Vercel's Serverless Functions and read-only file system.

## Changes Made for Vercel Compatibility

1. **Serverless Function Support**: Modified `server.js` to export a server factory function
2. **Vercel Configuration**: Added `vercel.json` configuration file
3. **File System Adaptation**: 
   - Modified `services/logger.js` to use console logging in Vercel environment
   - Modified `models/ApiKey.js` to use in-memory storage in Vercel environment
4. **API Entry Point**: Created `api/index.js` as the Vercel Serverless Function entry point

## Deployment Steps

### 1. Install Vercel CLI

```bash
npm install -g vercel
```

### 2. Deploy to Vercel

```bash
vercel
```

Follow the prompts to link your project and deploy.

### 3. Set Environment Variables

After deployment, set these environment variables in your Vercel project settings:

- `OPENROUTER_API_KEYS`: Your OpenRouter API keys (comma-separated for multiple keys)
- `HTTP_REFERER`: Your website URL (e.g., `https://yourdomain.com`)
- `SITE_NAME`: Your site name (e.g., `My OpenRouter Proxy`)

### 4. Update DNS (Optional)

If you want to use a custom domain, configure it in your Vercel project settings.

## API Endpoints

After deployment, your API will be available at:

- **Chat Completions**: `POST https://your-vercel-app.vercel.app/v1/chat/completions`
- **Models List**: `GET https://your-vercel-app.vercel.app/v1/models`
- **Admin - Add Keys**: `POST https://your-vercel-app.vercel.app/admin/keys`

## Usage Examples

### JavaScript Client

```javascript
const openai = new OpenAI({
  baseURL: 'https://your-vercel-app.vercel.app/v1',
  apiKey: 'dummy-key' // Actual key managed by proxy
});

// Use as normal OpenAI client
const completion = await openai.chat.completions.create({
  model: 'deepseek/deepseek-chat:free',
  messages: [{ role: 'user', content: 'Hello' }],
  stream: true
});
```

### cURL Example

```bash
curl -X POST https://your-vercel-app.vercel.app/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dummy-key" \
  -d '{
    "model": "deepseek/deepseek-chat:free",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## Important Notes

1. **Cold Starts**: Vercel Serverless Functions may have cold start delays
2. **Concurrency**: Free tier has concurrency limits
3. **Key Management**: API keys are stored in memory and will be reset on cold starts
4. **Logging**: All logs go to console in Vercel environment

## Troubleshooting

### Common Issues

1. **Rate Limits**: Ensure you have multiple API keys configured
2. **Cold Start Delays**: Consider upgrading to paid plan for better performance
3. **Memory Limits**: Large requests may hit memory limits on free tier

### Debugging

Check Vercel function logs in your project dashboard for detailed error information.

## Local Testing

To test locally with Vercel environment:

```bash
VERCEL_ENV=1 node server.js
```

This will use in-memory storage and console logging, simulating the Vercel environment.
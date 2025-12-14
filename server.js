import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

// Helper function to extract and randomly select API key from Authorization header
function extractRandomApiKey(req) {
  try {
    // Get Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw new Error('Authorization header is missing');
    }
    
    // Extract the token part (after "Bearer ")
    const tokenPart = authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7)
      : authHeader;
    
    if (!tokenPart) {
      throw new Error('Authorization token is empty');
    }
    
    // Split by semicolon to get multiple keys
    const keys = tokenPart.split(';').map(k => k.trim()).filter(k => k);
    
    if (keys.length === 0) {
      throw new Error('No valid API keys found in Authorization header');
    }
    
    // Randomly select one key
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    
    return randomKey;
  } catch (error) {
    throw error;
  }
}

// Vercel Serverless Function adapter
const createServer = async () => {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // Helper function to handle streaming response
  async function handleStreamingResponse(axiosResponse, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of axiosResponse.data) {
      res.write(chunk);
    }
    res.end();
  }

  // Root path handler
  app.get('/', (req, res) => {
    res.status(200).setHeader('Content-Type', 'text/html').end(
      'openrouter proxy is running!'
    );
  });

  // OpenRouter proxy endpoint
  app.post('/v1/chat/completions', async (req, res) => {
    const maxRetries = 3;
    let retryCount = 0;
    const isStreaming = req.body?.stream === true;

    while (retryCount < maxRetries) {
      try {
        // Extract random API key from Authorization header
        const apiKey = extractRandomApiKey(req);
        
        const axiosConfig = {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': process.env.HTTP_REFERER || 'http://localhost:3000',
            'X-Title': process.env.SITE_NAME || 'OpenRouterProxy'
          }
        };

        // Add responseType: 'stream' for streaming requests
        if (isStreaming) {
          axiosConfig.responseType = 'stream';
        }

        const response = await axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          req.body,
          axiosConfig
        );

        // Handle streaming response differently
        if (isStreaming) {
          return handleStreamingResponse(response, res);
        }

        return res.json(response.data);
      } catch (error) {
        // Handle streaming errors by ending the response
        if (isStreaming && res.writableEnded === false) {
          res.write(`data: ${JSON.stringify({
            error: {
              message: error.message,
              type: 'stream_error'
            }
          })}\n\n`);
          res.end();
          return;
        }

        // Only retry on rate limits or server errors
        if ((error.response?.status === 429 || error.response?.status >= 500) && retryCount < maxRetries - 1) {
          retryCount++;
          continue;
        }


        // For non-streaming requests, send error response
        if (!isStreaming) {
          return res.status(error.response?.status || 500).json({
            error: {
              message: error.response?.data?.error?.message || error.message,
              type: error.response?.data?.error?.type || 'internal_error'
            }
          });
        }
      }
    }
  });

  // Models endpoint
  app.get('/v1/models', async (req, res) => {
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        // Extract random API key from Authorization header
        const apiKey = extractRandomApiKey(req);
        
        const axiosConfig = {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': process.env.HTTP_REFERER || 'http://localhost:3000',
            'X-Title': process.env.SITE_NAME || 'OpenRouterProxy'
          }
        };

        const response = await axios.get(
          'https://openrouter.ai/api/v1/models',
          axiosConfig
        );

        return res.json(response.data);
      } catch (error) {
        // Only retry on rate limits or server errors
        if ((error.response?.status === 429 || error.response?.status >= 500) && retryCount < maxRetries - 1) {
          retryCount++;
          continue;
        }

        return res.status(error.response?.status || 500).json({
          error: {
            message: error.response?.data?.error?.message || error.message,
            type: error.response?.data?.error?.type || 'internal_error'
          }
        });
      }
    }
  });

  // Error handling middleware
  app.use((err, req, res, next) => {
    res.status(500).json({
      error: {
        message: 'Internal server error',
        type: 'internal_error'
      }
    });
  });

  return app;
};

// Export for Vercel Serverless Function
export default createServer;

// Local development
if (!process.env.VERCEL_ENV) {
  createServer().then(app => {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`OpenRouter Proxy Server running on port ${PORT}`);
    });
  });
}
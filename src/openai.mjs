// OpenRouter Proxy - OpenAI Compatible Interface
// This module provides OpenAI-compatible endpoints that forward to OpenRouter

export default {
  async fetch (request) {
    if (request.method === "OPTIONS") {
      return handleOPTIONS();
    }
    const errHandler = (err) => {
      console.error(err);
      return new Response(err.message, fixCors({ status: err.status ?? 500 }));
    };
    try {
      const { pathname } = new URL(request.url);
      const targetUrl = `https://openrouter.ai/api/v1${pathname}`;
      
      // Process API keys
      let apiKey = request.headers.get("Authorization")?.split(" ")[1];
      if (apiKey && apiKey.includes(',')) {
        const apiKeys = apiKey.split(',').map(k => k.trim()).filter(k => k);
        apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];
        console.log(`OpenRouter Selected API Key: ${apiKey.substring(0, 10)}...`);
      }
      
      // Create headers for OpenRouter
      const headers = new Headers();
      for (const [key, value] of request.headers.entries()) {
        if (key.toLowerCase() === 'authorization' && apiKey) {
          // Ensure proper Bearer format
          if (value.includes('Bearer')) {
            headers.set('authorization', `Bearer ${apiKey}`);
          } else {
            headers.set('authorization', `Bearer ${apiKey}`);
          }
        } else if (key.toLowerCase() !== 'host') {
          headers.set(key, value);
        }
      }

      console.log(`Forwarding ${request.method} ${pathname} to OpenRouter`);
      
      // Forward request to OpenRouter
      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: request.method !== "GET" ? await request.text() : undefined
      });

      // Get response and add CORS headers
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set("Access-Control-Allow-Origin", "*");
      responseHeaders.delete('transfer-encoding');
      responseHeaders.delete('connection');
      responseHeaders.delete('keep-alive');
      responseHeaders.delete('content-encoding');

      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders
      });
      
    } catch (err) {
      return errHandler(err);
    }
  }
};

class HttpError extends Error {
  constructor(message, status) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
  }
}

const fixCors = ({ headers, status, statusText }) => {
  headers = new Headers(headers);
  headers.set("Access-Control-Allow-Origin", "*");
  return { headers, status, statusText };
};

const handleOPTIONS = async () => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "*",
      "Access-Control-Allow-Headers": "*",
    }
  });
};
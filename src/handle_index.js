import { handleVerification } from './verify_keys.js';
import openai from './openai.mjs';

export async function handleRequest(request) {

  const url = new URL(request.url);
  const pathname = url.pathname;
  const search = url.search;

  if (pathname === '/' || pathname === '/index.html') {
    return new Response('<h1>OpenRouter Proxy</h1><p>OpenRouter proxy is running!</p>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
  }

  if (pathname === '/verify' && request.method === 'POST') {
    return handleVerification(request);
  }

  // 处理OpenAI格式请求
  if (url.pathname.endsWith("/chat/completions") || url.pathname.endsWith("/completions") || url.pathname.endsWith("/embeddings") || url.pathname.endsWith("/models")) {
    return openai.fetch(request);
  }

  const targetUrl = `https://openrouter.ai/api/v1${pathname}${search}`;

  try {
    const headers = new Headers();
    for (const [key, value] of request.headers.entries()) {
      if (key.trim().toLowerCase() === 'authorization') {
        // 处理多个 API key，随机选择 OpenRouter 格式
        const apiKeys = value.split(',').map(k => k.trim()).filter(k => k);
        if (apiKeys.length > 0) {
          const selectedKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];
          console.log(`OpenRouter Selected API Key: ${selectedKey.substring(0, 10)}...`);
          // 如果已经是 Bearer 格式，直接使用；否则添加 Bearer 前缀
          if (selectedKey.startsWith('Bearer ')) {
            headers.set('authorization', selectedKey);
          } else {
            headers.set('authorization', `Bearer ${selectedKey}`);
          }
        }
      } else if (key.trim().toLowerCase() === 'x-goog-api-key') {
        // 兼容性处理：将 x-goog-api-key 转换为 Bearer 格式
        const apiKeys = value.split(',').map(k => k.trim()).filter(k => k);
        if (apiKeys.length > 0) {
          const selectedKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];
          console.log(`OpenRouter Selected API Key (from x-goog-api-key): ${selectedKey.substring(0, 10)}...`);
          headers.set('authorization', `Bearer ${selectedKey}`);
        }
      } else {
        if (key.trim().toLowerCase()==='content-type' || key.trim().toLowerCase()==='x-api-key') {
           headers.set(key, value);
        }
      }
    }

    console.log('Request Sending to OpenRouter')
    console.log('targetUrl:'+targetUrl)
    console.log(headers)

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body
    });

    console.log("Call OpenRouter Success")

    const responseHeaders = new Headers(response.headers);

    console.log('Header from OpenRouter:')
    console.log(responseHeaders)

    responseHeaders.delete('transfer-encoding');
    responseHeaders.delete('connection');
    responseHeaders.delete('keep-alive');
    responseHeaders.delete('content-encoding');
    responseHeaders.set('Referrer-Policy', 'no-referrer');

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders
    });

  } catch (error) {
   console.error('Failed to fetch:', error);
   return new Response('Internal Server Error\n' + error?.stack, {
    status: 500,
    headers: { 'Content-Type': 'text/plain' }
   });
}
};
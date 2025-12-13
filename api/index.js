import createServer from '../server.js';

// Vercel Serverless Function adapter
const handler = async (req, res) => {
  const app = await createServer();
  
  // Convert Vercel request to Express-like request
  const expressReq = {
    method: req.method,
    headers: req.headers,
    body: req.body,
    query: req.query,
    url: req.url
  };
  
  // Convert Vercel response to Express-like response
  const expressRes = {
    statusCode: 200,
    headers: {},
    body: null,
    
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    
    json: function(data) {
      this.body = JSON.stringify(data);
      this.headers['Content-Type'] = 'application/json';
    },
    
    setHeader: function(name, value) {
      this.headers[name] = value;
    },
    
    write: function(chunk) {
      if (!this.body) {
        this.body = '';
      }
      this.body += chunk;
    },
    
    end: function() {
      // Return the response
      return {
        statusCode: this.statusCode,
        headers: this.headers,
        body: this.body
      };
    }
  };
  
  // Handle the request
  return new Promise((resolve, reject) => {
    try {
      app(expressReq, expressRes, () => {
        const result = expressRes.end();
        resolve(result);
      });
    } catch (error) {
      reject(error);
    }
  });
};

export default handler;
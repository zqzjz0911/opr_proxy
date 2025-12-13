import winston from 'winston';
// Import sanitize utility
import { sanitizeRequest } from './utils/sanitize.js';

// For Vercel environment, use only console transport since file system is read-only
const isVercel = process.env.VERCEL_ENV === '1';

// Configure transports
let requestTransport, errorTransport, keyTransport;

if (isVercel) {
  // Vercel environment - use console only
  requestTransport = new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  });

  errorTransport = new winston.transports.Console({
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  });

  keyTransport = new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  });
} else {
  // Local environment - use file rotation
  const DailyRotateFile = (await import('winston-daily-rotate-file')).default;
  
  requestTransport = new DailyRotateFile({
    filename: 'logs/requests-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  });

  errorTransport = new DailyRotateFile({
    filename: 'logs/errors-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  });

  keyTransport = new DailyRotateFile({
    filename: 'logs/keys-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  });
}

// Create loggers
export const requestLogger = winston.createLogger({
  transports: [
    requestTransport,
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

export const errorLogger = winston.createLogger({
  transports: [
    errorTransport,
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

export const keyLogger = winston.createLogger({
  transports: [
    keyTransport,
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Helper function to log streaming chunks
export const logStreamChunk = (requestId, chunk) => {
  try {
    const data = chunk.toString();
    requestLogger.info('Stream Chunk', {
      requestId,
      data: data.trim()
    });
  } catch (error) {
    logError(error, { context: 'Stream chunk logging', requestId });
  }
};

// Middleware for logging requests and responses
export const requestLoggingMiddleware = (req, res, next) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  
  // Log request
  const sanitizedRequest = sanitizeRequest({
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body,
  });

  requestLogger.info('Incoming Request', {
    requestId,
    ...sanitizedRequest,
  });

  // Track if this is a streaming request
  const isStreaming = req.body?.stream === true;

  // Override res.json for non-streaming responses
  const originalJson = res.json;
  res.json = function(data) {
    const responseTime = Date.now() - startTime;
    
    const sanitizedResponse = sanitizeRequest({
      statusCode: res.statusCode,
      responseTime,
      headers: res.getHeaders(),
      body: data,
    });

    requestLogger.info('Outgoing Response', {
      requestId,
      ...sanitizedResponse,
      streaming: false
    });

    return originalJson.apply(this, arguments);
  };

  // Handle streaming responses
  if (isStreaming) {
    const originalWrite = res.write;
    const originalEnd = res.end;

    res.write = function(chunk) {
      logStreamChunk(requestId, chunk);
      return originalWrite.apply(this, arguments);
    };

    res.end = function(chunk) {
      if (chunk) {
        logStreamChunk(requestId, chunk);
      }
      const responseTime = Date.now() - startTime;
      requestLogger.info('Stream Ended', {
        requestId,
        responseTime,
        streaming: true
      });
      return originalEnd.apply(this, arguments);
    };
  }

  next();
};

// Helper function to log key management events
export const logKeyEvent = (event, details) => {
  keyLogger.info(event, details);
};

// Helper function to log errors
export const logError = (error, context = {}) => {
  errorLogger.error(error.message, {
    stack: error.stack,
    ...context
  });
};
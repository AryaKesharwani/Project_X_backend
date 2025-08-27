import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { specs } from './config/swagger';
import { initializeWebSocket } from './services/websocket';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import {
  corsOptions,
  rateLimiter,
  authRateLimiter,
  helmetConfig,
  compressionConfig,
  requestLogger,
  securityHeaders,
} from './middleware/security';
import { serverConfig } from './config/env';
import logger from './config/logger';

// Import routes
import authRoutes from './routes/auth';
import ticketRoutes from './routes/tickets';
import voiceRoutes from './routes/voice';
import healthRoutes from './routes/health';

// Load environment variables (already done in env.ts)
dotenv.config();

const app = express();

// Security middleware (order matters!)
app.use(helmetConfig);
app.use(securityHeaders);
app.use(compressionConfig);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use(cors(corsOptions));

// Request logging
app.use(requestLogger);

// Rate limiting
app.use(rateLimiter);

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'LionKey AI API Documentation',
  customfavIcon: '/favicon.ico'
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: serverConfig.nodeEnv,
      version: process.env.npm_package_version || '1.0.0',
    },
    timestamp: new Date().toISOString()
  });
});

// API routes with rate limiting
app.use('/api/auth', authRateLimiter, authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/health', healthRoutes);

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize WebSocket service
let wsServer: any = null;
let server: any = null;

try {
  const { createServer } = require('http');
  const { WebSocketServer } = require('ws');
  
  server = createServer(app);
  
  // Create WebSocket server
  const wss = new WebSocketServer({ 
    server,
    path: '/ws',
    perMessageDeflate: false,
    maxPayload: 1024 * 1024
  });
  
  wsServer = initializeWebSocket(wss);
  logger.info('✅ WebSocket service setup completed');
  
  // Start server with WebSocket
  server.listen(serverConfig.port, () => {
    logger.info(`🚀 LionKey AI Backend running on port ${serverConfig.port}`);
    logger.info('📱 WebSocket server initialized on /ws');
    logger.info(`🏥 Health check: http://localhost:${serverConfig.port}/health`);
    logger.info(`📚 API Documentation: http://localhost:${serverConfig.port}/api-docs`);
    logger.info(`🌍 Environment: ${serverConfig.nodeEnv}`);
  });
  
} catch (error) {
  logger.error('❌ Failed to initialize WebSocket service:', error);
  
  // Start server without WebSocket
  server = app.listen(serverConfig.port, () => {
    logger.info(`🚀 LionKey AI Backend running on port ${serverConfig.port}`);
    logger.warn('⚠️ WebSocket server not available');
    logger.info(`🏥 Health check: http://localhost:${serverConfig.port}/health`);
    logger.info(`📚 API Documentation: http://localhost:${serverConfig.port}/api-docs`);
    logger.info(`🌍 Environment: ${serverConfig.nodeEnv}`);
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (server) {
    server.close(() => {
      logger.info('Process terminated');
      process.exit(0);
    });
  }
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  if (server) {
    server.close(() => {
      logger.info('Process terminated');
      process.exit(0);
    });
  }
});

// Unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { specs } from './config/swagger';
import { initializeWebSocket } from './services/websocket';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './middleware/logger';

// Import routes
import authRoutes from './routes/auth';
import ticketRoutes from './routes/tickets';
import voiceRoutes from './routes/voice';
import healthRoutes from './routes/health';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use(logger);

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
      environment: process.env.NODE_ENV || 'development'
    },
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/health', healthRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    timestamp: new Date().toISOString()
  });
});

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
  console.log('✅ WebSocket service setup completed');
  
  // Start server with WebSocket
  server.listen(PORT, () => {
    console.log(`🚀 LionKey AI Backend running on port ${PORT}`);
    console.log('📱 WebSocket server initialized on /ws');
    console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
  });
  
} catch (error) {
  console.error('❌ Failed to initialize WebSocket service:', error);
  
  // Start server without WebSocket
  server = app.listen(PORT, () => {
    console.log(`🚀 LionKey AI Backend running on port ${PORT}`);
    console.log('⚠️ WebSocket server not available');
    console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
  });
}

// Server startup is handled in the WebSocket initialization block

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

export default app;

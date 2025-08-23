import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

dotenv.config();

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import voiceRoutes from './routes/voice';
import ticketRoutes from './routes/tickets';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { logger } from './middleware/logger';

// Import services
import { initializeWebSocket } from './services/websocket';

// Import config
import { checkDatabaseConnection } from './config/prisma';

const app = express();
const server = createServer(app);

// WebSocket server with error handling
let wss: WebSocketServer;
try {
  wss = new WebSocketServer({ 
    server,
    path: '/ws', // Explicit path to avoid routing issues
    perMessageDeflate: false, // Disable compression to avoid issues
    maxPayload: 1024 * 1024 // 1MB max payload
  });
  
  // Add error handling for WebSocket server
  wss.on('error', (error) => {
    console.error('❌ WebSocket server error:', error);
  });
  
} catch (error) {
  console.error('❌ Failed to create WebSocket server:', error);
  wss = null as any;
}

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(logger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'LionKey AI Backend',
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/tickets', ticketRoutes);

// Initialize WebSocket only if server was created successfully
if (wss) {
  try {
    initializeWebSocket(wss);
    console.log('✅ WebSocket service initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize WebSocket service:', error);
  }
} else {
  console.warn('⚠️ WebSocket server not available - real-time features disabled');
}

// Check database connection on startup
checkDatabaseConnection();

// Error handling middleware (should be last)
app.use(errorHandler);

// 404 handler - use more specific pattern for better compatibility
app.use('/*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The route ${req.method} ${req.originalUrl} does not exist`
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 LionKey AI Backend running on port ${PORT}`);
  if (wss) {
    console.log(`📱 WebSocket server initialized on /ws`);
  } else {
    console.log(`⚠️ WebSocket server not available`);
  }
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  if (wss) {
    wss.close();
  }
  server.close(() => {
    console.log('✅ Process terminated');
  });
});

export default app;

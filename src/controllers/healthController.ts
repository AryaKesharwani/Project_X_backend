import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { getWebSocketService } from '../services/websocket';
import { APIResponse } from '../types';

export class HealthController {
  // Basic health check
  static async healthCheck(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          environment: process.env.NODE_ENV || 'development'
        },
        timestamp: new Date().toISOString()
      } as APIResponse);
    } catch (error) {
      next(error);
    }
  }

  // Detailed system health check
  static async detailedHealthCheck(req: Request, res: Response, next: NextFunction) {
    try {
      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        services: {} as any
      };

      // Check database connection
      try {
        await prisma.$queryRaw`SELECT 1`;
        healthStatus.services.database = {
          status: 'healthy',
          message: 'Database connection successful'
        };
      } catch (error) {
        healthStatus.services.database = {
          status: 'unhealthy',
          message: 'Database connection failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        healthStatus.status = 'degraded';
      }

      // Check WebSocket service
      const wsService = getWebSocketService();
      if (wsService && wsService.isServiceReady()) {
        healthStatus.services.websocket = {
          status: 'healthy',
          message: 'WebSocket service operational',
          connections: wsService.getStatus().clientsCount || 0
        };
      } else {
        healthStatus.services.websocket = {
          status: 'unhealthy',
          message: 'WebSocket service unavailable'
        };
        healthStatus.status = 'degraded';
      }

      // Check memory usage
      const memUsage = process.memoryUsage();
      healthStatus.services.memory = {
        status: 'healthy',
        message: 'Memory usage normal',
        usage: {
          rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
          heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
          heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
          external: `${Math.round(memUsage.external / 1024 / 1024)} MB`
        }
      };

      // Check environment variables
      const requiredEnvVars = [
        'DATABASE_URL',
        'OPENAI_API_KEY',
        'ELEVENLABS_API_KEY'
      ];

      const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
      
      if (missingEnvVars.length > 0) {
        healthStatus.services.environment = {
          status: 'warning',
          message: 'Some environment variables are missing',
          missing: missingEnvVars
        };
        if (healthStatus.status === 'healthy') {
          healthStatus.status = 'warning';
        }
      } else {
        healthStatus.services.environment = {
          status: 'healthy',
          message: 'All required environment variables are set'
        };
      }

      res.json({
        success: true,
        data: healthStatus,
        timestamp: new Date().toISOString()
      } as APIResponse);

    } catch (error) {
      next(error);
    }
  }

  // System metrics
  static async getMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const metrics = {
        timestamp: new Date().toISOString(),
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
          platform: process.platform,
          nodeVersion: process.version,
          pid: process.pid
        },
        database: {} as any,
        websocket: {} as any
      };

      // Database metrics
      try {
        const userCount = await prisma.user.count();
        const ticketCount = await prisma.ticket.count();
        const voiceSessionCount = await prisma.voiceSession.count();

        metrics.database = {
          status: 'healthy',
          counts: {
            users: userCount,
            tickets: ticketCount,
            voiceSessions: voiceSessionCount
          }
        };
      } catch (error) {
        metrics.database = {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }

      // WebSocket metrics
      const wsService = getWebSocketService();
      if (wsService) {
        const wsStatus = wsService.getStatus();
        metrics.websocket = {
          status: wsStatus.initialized ? 'healthy' : 'unhealthy',
          connections: wsStatus.clientsCount || 0,
          isInitialized: wsStatus.initialized
        };
      } else {
        metrics.websocket = {
          status: 'unavailable',
          connections: 0,
          isInitialized: false
        };
      }

      res.json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString()
      } as APIResponse);

    } catch (error) {
      next(error);
    }
  }
}

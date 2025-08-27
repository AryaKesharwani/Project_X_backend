import { Router } from 'express';
import { HealthController } from '../controllers/healthController';

const router = Router();

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Basic health check
 *     tags: [Health]
 *     description: Simple endpoint to check if the service is running
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: healthy
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     uptime:
 *                       type: number
 *                     environment:
 *                       type: string
 */
router.get('/', HealthController.healthCheck);

/**
 * @swagger
 * /api/health/detailed:
 *   get:
 *     summary: Detailed health check
 *     tags: [Health]
 *     description: Comprehensive health check including database and external services
 *     responses:
 *       200:
 *         description: Detailed health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                     database:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                         response_time:
 *                           type: number
 *                     external_services:
 *                       type: object
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 */
router.get('/detailed', HealthController.detailedHealthCheck);

/**
 * @swagger
 * /api/health/metrics:
 *   get:
 *     summary: System metrics
 *     tags: [Health]
 *     description: Get system performance metrics and statistics
 *     responses:
 *       200:
 *         description: System metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     memory_usage:
 *                       type: object
 *                     cpu_usage:
 *                       type: object
 *                     active_connections:
 *                       type: number
 *                     request_count:
 *                       type: number
 *                     average_response_time:
 *                       type: number
 */
router.get('/metrics', HealthController.getMetrics);

export default router;

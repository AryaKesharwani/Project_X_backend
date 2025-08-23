import { Router } from 'express';
import { prisma } from '../config/prisma';
import { APIResponse, User, PaginatedResponse, UserRole } from '../types';
import { authenticateUser, requireSuperAdmin, requireManager } from '../middleware/auth';

const router = Router();

// Get all users (Super Admin and Managers only)
router.get('/', authenticateUser, requireManager, async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      role,
      search,
      hotel_id
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    
    let whereClause: any = { active: true };

    // Apply filters
    if (role) {
      whereClause.role = role;
    }
    
    if (hotel_id) {
      whereClause.hotel_id = hotel_id;
    }
    
    if (search) {
      whereClause.OR = [
        { first_name: { contains: search as string, mode: 'insensitive' } },
        { last_name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    // Get total count
    const total = await prisma.user.count({ where: whereClause });

    // Get users with pagination
    const users = await prisma.user.findMany({
      where: whereClause,
      skip: offset,
      take: Number(limit),
      orderBy: { created_at: 'desc' }
    });

    res.json({
      success: true,
      data: users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      },
      timestamp: new Date().toISOString()
    } as PaginatedResponse<User>);

  } catch (error) {
    next(error);
  }
});

// Get user by ID
router.get('/:id', authenticateUser, requireManager, async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        timestamp: new Date().toISOString()
      } as APIResponse);
    }

    res.json({
      success: true,
      data: user,
      timestamp: new Date().toISOString()
    } as APIResponse<User>);

  } catch (error) {
    next(error);
  }
});

// Update user role (Super Admin only)
router.put('/:id/role', authenticateUser, requireSuperAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    // Validate role
    if (!Object.values(UserRole).includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role',
        timestamp: new Date().toISOString()
      } as APIResponse);
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role }
    });

    // Log the role change
    await prisma.auditLog.create({
      data: {
        user_id: req.user!.id,
        action: 'update_user_role',
        resource_type: 'user',
        resource_id: id,
        new_values: { role }
      }
    });

    res.json({
      success: true,
      data: user,
      message: 'User role updated successfully',
      timestamp: new Date().toISOString()
    } as APIResponse<User>);

  } catch (error) {
    next(error);
  }
});

// Deactivate user (Super Admin only)
router.put('/:id/deactivate', authenticateUser, requireSuperAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.update({
      where: { id },
      data: { active: false }
    });

    // Log the deactivation
    await prisma.auditLog.create({
      data: {
        user_id: req.user!.id,
        action: 'deactivate_user',
        resource_type: 'user',
        resource_id: id
      }
    });

    res.json({
      success: true,
      data: user,
      message: 'User deactivated successfully',
      timestamp: new Date().toISOString()
    } as APIResponse<User>);

  } catch (error) {
    next(error);
  }
});

// Get user statistics (Managers only)
router.get('/stats/overview', authenticateUser, requireManager, async (req, res, next) => {
  try {
    // Get user counts by role
    const roleCounts = await prisma.user.groupBy({
      by: ['role'],
      where: { active: true },
      _count: { role: true }
    });

    const roleStats = roleCounts.reduce((acc, item) => {
      acc[item.role] = item._count.role;
      return acc;
    }, {} as Record<string, number>);

    // Get recent registrations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentUsers = await prisma.user.count({
      where: {
        created_at: { gte: thirtyDaysAgo }
      }
    });

    // Get active users (last 24 hours)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const activeUsers = await prisma.user.count({
      where: {
        last_active: { gte: twentyFourHoursAgo }
      }
    });

    res.json({
      success: true,
      data: {
        totalUsers: Object.values(roleStats).reduce((a, b) => a + b, 0),
        roleDistribution: roleStats,
        recentRegistrations: recentUsers,
        activeUsers24h: activeUsers,
        lastUpdated: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    } as APIResponse);

  } catch (error) {
    next(error);
  }
});

export default router;

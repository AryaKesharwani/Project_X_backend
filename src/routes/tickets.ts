import { Router } from 'express';
import { prisma } from '../config/prisma';
import { APIResponse, Ticket, PaginatedResponse, UserRole, WebSocketMessageType } from '../types';
import { authenticateUser, requireStaff } from '../middleware/auth';
import { getWebSocketService } from '../services/websocket';

const router = Router();

// Create new ticket
router.post('/', authenticateUser, async (req, res, next) => {
  try {
    const {
      title,
      description,
      department,
      room_number,
      priority = 'medium',
      estimated_time,
      guest_notes
    } = req.body;

    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Create ticket
    const ticket = await prisma.ticket.create({
      data: {
        title,
        description,
        status: 'pending',
        priority,
        department,
        room_number,
        guest_notes,
        estimated_time,
        created_by: userId,
        assigned_to: getAutoAssignment(userRole, department)
      },
      include: {
        creator: true,
        assignee: true
      }
    });

    // Send WebSocket notification
    const wsService = getWebSocketService();
    if (wsService) {
      wsService.broadcastToRole('housekeeping', {
        type: WebSocketMessageType.TICKET_UPDATE,
        payload: {
          action: 'created',
          ticket,
          message: `New ${department} request: ${title}`
        },
        timestamp: new Date().toISOString()
      });
    }

    res.status(201).json({
      success: true,
      data: ticket,
      message: 'Ticket created successfully',
      timestamp: new Date().toISOString()
    } as APIResponse<Ticket>);

  } catch (error) {
    next(error);
  }
});

// Get tickets with role-based filtering
router.get('/', authenticateUser, async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      priority,
      department,
      room_number,
      assigned_to
    } = req.query;

    const userId = req.user!.id;
    const userRole = req.user!.role;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause: any = {};

    // Apply role-based filtering
    if (userRole === UserRole.guest) {
      whereClause.created_by = userId;
    } else if (userRole === UserRole.housekeeping) {
      whereClause.OR = [
        { department: 'housekeeping' },
        { assigned_to: userId }
      ];
    } else if (userRole === UserRole.lobby_manager) {
      whereClause.department = { in: ['front_desk', 'concierge', 'room_service'] };
    }
    // General managers and super admins see all tickets (no additional filtering)

    // Apply filters
    if (status && status !== 'all') {
      whereClause.status = status;
    }
    if (priority && priority !== 'all') {
      whereClause.priority = priority;
    }
    if (department && department !== 'all') {
      whereClause.department = department;
    }
    if (room_number) {
      whereClause.room_number = room_number;
    }
    if (assigned_to) {
      whereClause.assigned_to = assigned_to;
    }

    // Get total count
    const total = await prisma.ticket.count({ where: whereClause });

    // Get tickets with pagination
    const tickets = await prisma.ticket.findMany({
      where: whereClause,
      include: {
        creator: true,
        assignee: true
      },
      skip: offset,
      take: Number(limit),
      orderBy: { created_at: 'desc' }
    });

    res.json({
      success: true,
      data: tickets,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      },
      timestamp: new Date().toISOString()
    } as PaginatedResponse<Ticket>);

  } catch (error) {
    next(error);
  }
});

// Get ticket by ID
router.get('/:id', authenticateUser, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        creator: true,
        assignee: true,
        voice_session: true
      }
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found',
        timestamp: new Date().toISOString()
      } as APIResponse);
    }

    // Check access permissions
    if (userRole === UserRole.guest && ticket.created_by !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        timestamp: new Date().toISOString()
      } as APIResponse);
    }

    res.json({
      success: true,
      data: ticket,
      timestamp: new Date().toISOString()
    } as APIResponse<Ticket>);

  } catch (error) {
    next(error);
  }
});

// Update ticket status
router.put('/:id/status', authenticateUser, requireStaff, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, staff_notes } = req.body;
    const userId = req.user!.id;

    // Get current ticket
    const currentTicket = await prisma.ticket.findUnique({
      where: { id }
    });

    if (!currentTicket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found',
        timestamp: new Date().toISOString()
      } as APIResponse);
    }

    // Update ticket
    const ticket = await prisma.ticket.update({
      where: { id },
      data: {
        status,
        staff_notes,
        completed_at: status === 'completed' ? new Date() : null
      },
      include: {
        creator: true,
        assignee: true
      }
    });

    // Send WebSocket notification
    const wsService = getWebSocketService();
    if (wsService) {
      wsService.broadcastToRole('housekeeping', {
        type: WebSocketMessageType.TICKET_UPDATE,
        payload: {
          action: 'status_updated',
          ticket,
          message: `Ticket ${id} status updated to ${status}`
        },
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: ticket,
      message: 'Ticket status updated successfully',
      timestamp: new Date().toISOString()
    } as APIResponse<Ticket>);

  } catch (error) {
    next(error);
  }
});

// Assign ticket to staff member
router.put('/:id/assign', authenticateUser, requireStaff, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { assigned_to } = req.body;

    // Verify assignee exists and has appropriate role
    const assignee = await prisma.user.findUnique({
      where: { id: assigned_to }
    });

    if (!assignee || !assignee.active) {
      return res.status(400).json({
        success: false,
        error: 'Invalid assignee',
        timestamp: new Date().toISOString()
      } as APIResponse);
    }

    const ticket = await prisma.ticket.update({
      where: { id },
      data: { assigned_to },
      include: {
        creator: true,
        assignee: true
      }
    });

    // Send WebSocket notification
    const wsService = getWebSocketService();
    if (wsService) {
      wsService.broadcastToRole('housekeeping', {
        type: WebSocketMessageType.NOTIFICATION,
        payload: {
          title: 'New Assignment',
          message: `You have been assigned ticket: ${ticket.title}`,
          ticket_id: id
        },
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: ticket,
      message: 'Ticket assigned successfully',
      timestamp: new Date().toISOString()
    } as APIResponse<Ticket>);

  } catch (error) {
    next(error);
  }
});

// Delete ticket (Super Admin only)
router.delete('/:id', authenticateUser, requireStaff, async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.ticket.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Ticket deleted successfully',
      timestamp: new Date().toISOString()
    } as APIResponse);

  } catch (error) {
    next(error);
  }
});

// Get ticket statistics
router.get('/stats/overview', authenticateUser, requireStaff, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;

    let whereClause: any = {};

    // Apply role-based filtering
    if (userRole === UserRole.housekeeping) {
      whereClause.OR = [
        { department: 'housekeeping' },
        { assigned_to: userId }
      ];
    } else if (userRole === UserRole.lobby_manager) {
      whereClause.department = { in: ['front_desk', 'concierge', 'room_service'] };
    }

    // Get status statistics
    const statusData = await prisma.ticket.groupBy({
      by: ['status'],
      where: whereClause,
      _count: { status: true }
    });

    const statusStats = statusData.reduce((acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    }, {} as Record<string, number>);

    // Get priority statistics
    const priorityData = await prisma.ticket.groupBy({
      by: ['priority'],
      where: whereClause,
      _count: { priority: true }
    });

    const priorityStats = priorityData.reduce((acc, item) => {
      acc[item.priority] = item._count.priority;
      return acc;
    }, {} as Record<string, number>);

    // Get department statistics
    const departmentData = await prisma.ticket.groupBy({
      by: ['department'],
      where: whereClause,
      _count: { department: true }
    });

    const departmentStats = departmentData.reduce((acc, item) => {
      acc[item.department] = item._count.department;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      success: true,
      data: {
        statusDistribution: statusStats,
        priorityDistribution: priorityStats,
        departmentDistribution: departmentStats,
        totalTickets: Object.values(statusStats).reduce((a, b) => a + b, 0),
        lastUpdated: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    } as APIResponse);

  } catch (error) {
    next(error);
  }
});

// Helper function to auto-assign tickets based on department
function getAutoAssignment(userRole: UserRole, department: string): string | null {
  // For now, return null (no auto-assignment)
  // This can be enhanced with intelligent assignment logic
  return null;
}

export default router;

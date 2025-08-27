import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { APIResponse, Ticket, TicketStatus, TicketPriority, Department, WebSocketMessageType } from '../types';
import { getWebSocketService } from '../services/websocket';

export class TicketController {
  // Create a new ticket
  static async createTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        title,
        description,
        department,
        priority = TicketPriority.medium,
        room_number,
        guest_notes,
        staff_notes,
        estimated_time,
        due_date
      } = req.body;

      // Validate required fields
      if (!title || !description || !department) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: title, description, department',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      // Validate department
      if (!Object.values(Department).includes(department)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid department',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      // Create ticket
      const ticket = await prisma.ticket.create({
        data: {
          title,
          description,
          department,
          priority,
          room_number,
          guest_notes,
          staff_notes,
          estimated_time,
          due_date: due_date ? new Date(due_date) : undefined,
          created_by: req.user!.id,
        },
        include: {
          creator: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              role: true
            }
          }
        }
      });

      // Send WebSocket notification
      const wsService = getWebSocketService();
      if (wsService) {
        wsService.broadcastToRole('housekeeping', {
          type: WebSocketMessageType.TICKET_UPDATE,
          payload: { ticket, action: 'created' },
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
  }

  // Get all tickets with filters
  static async getTickets(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        status,
        priority,
        department,
        assigned_to,
        room_number,
        limit = 50,
        offset = 0
      } = req.query;

      // Build where clause based on user role and filters
      let whereClause: any = {};

      // Role-based filtering
      if (req.user!.role === 'guest') {
        whereClause.created_by = req.user!.id;
      } else if (req.user!.role === 'housekeeping') {
        whereClause.department = 'housekeeping';
      }

      // Apply filters
      if (status) whereClause.status = status;
      if (priority) whereClause.priority = priority;
      if (department) whereClause.department = department;
      if (assigned_to) whereClause.assigned_to = assigned_to;
      if (room_number) whereClause.room_number = room_number;

      const tickets = await prisma.ticket.findMany({
        where: whereClause,
        include: {
          creator: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              role: true
            }
          },
          assignee: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              role: true
            }
          }
        },
        orderBy: { created_at: 'desc' },
        take: Number(limit),
        skip: Number(offset)
      });

      const total = await prisma.ticket.count({ where: whereClause });

      res.json({
        success: true,
        data: tickets,
        pagination: {
          total,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: Number(offset) + Number(limit) < total
        },
        timestamp: new Date().toISOString()
      } as APIResponse<Ticket[]>);

    } catch (error) {
      next(error);
    }
  }

  // Get ticket by ID
  static async getTicketById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const ticket = await prisma.ticket.findUnique({
        where: { id },
        include: {
          creator: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              role: true
            }
          },
          assignee: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              role: true
            }
          },
          voice_session: {
            select: {
              id: true,
              transcript: true,
              response_text: true
            }
          }
        }
      });

      if (!ticket) {
        return res.status(404).json({
          success: false,
          error: 'Ticket not found',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      // Check if user has access to this ticket
      if (req.user!.role === 'guest' && ticket.created_by !== req.user!.id) {
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
  }

  // Update ticket status
  static async updateTicketStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, staff_notes } = req.body;

      if (!status || !Object.values(TicketStatus).includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Valid status is required',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      const ticket = await prisma.ticket.findUnique({
        where: { id }
      });

      if (!ticket) {
        return res.status(404).json({
          success: false,
          error: 'Ticket not found',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      // Check permissions
      if (req.user!.role === 'guest' && ticket.created_by !== req.user!.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      const updateData: any = {
        status,
        updated_at: new Date()
      };

      if (staff_notes) {
        updateData.staff_notes = staff_notes;
      }

      if (status === 'completed') {
        updateData.completed_at = new Date();
      }

      const updatedTicket = await prisma.ticket.update({
        where: { id },
        data: updateData,
        include: {
          creator: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              role: true
            }
          },
          assignee: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              role: true
            }
          }
        }
      });

      // Send WebSocket notification
      const wsService = getWebSocketService();
      if (wsService) {
        wsService.broadcastToRole('housekeeping', {
          type: WebSocketMessageType.TICKET_UPDATE,
          payload: { ticket: updatedTicket, action: 'status_updated' },
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        data: updatedTicket,
        message: 'Ticket status updated successfully',
        timestamp: new Date().toISOString()
      } as APIResponse<Ticket>);

    } catch (error) {
      next(error);
    }
  }

  // Assign ticket to staff member
  static async assignTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { assigned_to } = req.body;

      if (!assigned_to) {
        return res.status(400).json({
          success: false,
          error: 'Assigned user ID is required',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      // Check if assigned user exists and has appropriate role
      const assignedUser = await prisma.user.findUnique({
        where: { id: assigned_to }
      });

      if (!assignedUser || !assignedUser.active) {
        return res.status(400).json({
          success: false,
          error: 'Invalid assigned user',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      const ticket = await prisma.ticket.update({
        where: { id },
        data: {
          assigned_to,
          updated_at: new Date()
        },
        include: {
          creator: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              role: true
            }
          },
          assignee: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              role: true
            }
          }
        }
      });

      // Send WebSocket notification
      const wsService = getWebSocketService();
      if (wsService) {
        wsService.broadcastToUser(assigned_to, {
          type: WebSocketMessageType.TICKET_UPDATE,
          payload: { ticket, action: 'assigned' },
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
  }

  // Delete ticket
  static async deleteTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const ticket = await prisma.ticket.findUnique({
        where: { id }
      });

      if (!ticket) {
        return res.status(404).json({
          success: false,
          error: 'Ticket not found',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      // Only super admin or ticket creator can delete
      if (req.user!.role !== 'super_admin' && ticket.created_by !== req.user!.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

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
  }
}

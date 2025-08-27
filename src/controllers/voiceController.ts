import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { APIResponse, VoiceSession, WebSocketMessageType } from '../types';
import { getWebSocketService } from '../services/websocket';

export class VoiceController {
  // Process voice input and create ticket
  static async processVoice(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        audio_data,
        language = 'en',
        room_number
      } = req.body;

      if (!audio_data) {
        return res.status(400).json({
          success: false,
          error: 'Audio data is required',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      // TODO: Integrate with OpenAI Whisper for STT
      // For now, we'll simulate the process
      const transcript = "Simulated transcript from voice input";
      const intent = "request_service";
      const confidence = 0.95;
      const responseText = "Your request has been received and a ticket has been created.";

      // Create voice session
      const voiceSession = await prisma.voiceSession.create({
        data: {
          user_id: req.user!.id,
          transcript,
          intent_classification: {
            intent,
            confidence,
            entities: {}
          },
          response_text: responseText,
          language,
          processing_time: 1000, // Simulated processing time
        }
      });

      // Create ticket based on voice input
      const ticket = await prisma.ticket.create({
        data: {
          title: `Voice Request - ${intent}`,
          description: transcript,
          department: 'concierge', // Default department
          priority: 'medium',
          room_number: room_number || req.user!.room_number,
          guest_notes: `Voice request: ${transcript}`,
          created_by: req.user!.id,
          voice_session_id: voiceSession.id
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

      // Update voice session with ticket reference
      await prisma.voiceSession.update({
        where: { id: voiceSession.id },
        data: {
          tickets: {
            connect: { id: ticket.id }
          }
        }
      });

      // Send WebSocket notification
      const wsService = getWebSocketService();
      if (wsService) {
        wsService.broadcastToRole('housekeeping', {
          type: WebSocketMessageType.VOICE_RESPONSE,
          payload: { 
            voiceSession, 
            ticket, 
            action: 'voice_request_processed' 
          },
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        data: {
          voiceSession,
          ticket,
          transcript,
          response: responseText
        },
        message: 'Voice request processed successfully',
        timestamp: new Date().toISOString()
      } as APIResponse);

    } catch (error) {
      next(error);
    }
  }

  // Get voice sessions for a user
  static async getVoiceSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.query;
      const targetUserId = userId || req.user!.id;

      // Check permissions
      if (req.user!.role === 'guest' && targetUserId !== req.user!.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      const voiceSessions = await prisma.voiceSession.findMany({
        where: { user_id: targetUserId as string },
        include: {
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              role: true
            }
          },
          tickets: {
            select: {
              id: true,
              title: true,
              status: true,
              created_at: true
            }
          }
        },
        orderBy: { created_at: 'desc' }
      });

      res.json({
        success: true,
        data: voiceSessions,
        timestamp: new Date().toISOString()
      } as APIResponse<VoiceSession[]>);

    } catch (error) {
      next(error);
    }
  }

  // Get voice session by ID
  static async getVoiceSessionById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const voiceSession = await prisma.voiceSession.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              role: true
            }
          },
          tickets: {
            select: {
              id: true,
              title: true,
              description: true,
              status: true,
              priority: true,
              department: true,
              created_at: true,
              updated_at: true
            }
          }
        }
      });

      if (!voiceSession) {
        return res.status(404).json({
          success: false,
          error: 'Voice session not found',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      // Check permissions
      if (req.user!.role === 'guest' && voiceSession.user_id !== req.user!.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      res.json({
        success: true,
        data: voiceSession,
        timestamp: new Date().toISOString()
      } as APIResponse<VoiceSession>);

    } catch (error) {
      next(error);
    }
  }

  // Update voice session
  static async updateVoiceSession(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const {
        transcript,
        intent_classification,
        response_text,
        processing_time
      } = req.body;

      const voiceSession = await prisma.voiceSession.findUnique({
        where: { id }
      });

      if (!voiceSession) {
        return res.status(404).json({
          success: false,
          error: 'Voice session not found',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      // Check permissions
      if (req.user!.role === 'guest' && voiceSession.user_id !== req.user!.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      const updatedSession = await prisma.voiceSession.update({
        where: { id },
        data: {
          transcript,
          intent_classification,
          response_text,
          processing_time,
          updated_at: new Date()
        },
        include: {
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              role: true
            }
          },
          tickets: {
            select: {
              id: true,
              title: true,
              status: true,
              created_at: true
            }
          }
        }
      });

      res.json({
        success: true,
        data: updatedSession,
        message: 'Voice session updated successfully',
        timestamp: new Date().toISOString()
      } as APIResponse<VoiceSession>);

    } catch (error) {
      next(error);
    }
  }

  // Delete voice session
  static async deleteVoiceSession(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const voiceSession = await prisma.voiceSession.findUnique({
        where: { id }
      });

      if (!voiceSession) {
        return res.status(404).json({
          success: false,
          error: 'Voice session not found',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      // Only super admin or session owner can delete
      if (req.user!.role !== 'super_admin' && voiceSession.user_id !== req.user!.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      await prisma.voiceSession.delete({
        where: { id }
      });

      res.json({
        success: true,
        message: 'Voice session deleted successfully',
        timestamp: new Date().toISOString()
      } as APIResponse);

    } catch (error) {
      next(error);
    }
  }
}

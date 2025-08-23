import { Router } from 'express';
import { prisma } from '../config/prisma';
import { APIResponse, User, UserRole } from '../types';
import { authenticateUser } from '../middleware/auth';

const router = Router();

// Register new user
router.post('/register', async (req, res, next) => {
  try {
    const {
      clerk_id,
      email,
      first_name,
      last_name,
      role = UserRole.guest,
      hotel_id,
      room_number,
      phone_number,
      preferences
    } = req.body;

    // Validate required fields
    if (!clerk_id || !email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: clerk_id and email',
        timestamp: new Date().toISOString()
      } as APIResponse);
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { clerk_id },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'User already exists',
        timestamp: new Date().toISOString()
      } as APIResponse);
    }

    // Create new user
    const user = await prisma.user.create({
      data: {
        clerk_id,
        email,
        first_name,
        last_name,
        role,
        hotel_id,
        room_number,
        phone_number,
        preferences: preferences || {
          language: 'en',
          voice_enabled: true,
          notifications_enabled: true,
          theme: 'dark'
        },
      },
    });

    res.status(201).json({
      success: true,
      data: user,
      message: 'User registered successfully',
      timestamp: new Date().toISOString()
    } as APIResponse<User>);

  } catch (error) {
    next(error);
  }
});

// Get current user profile
router.get('/profile', authenticateUser, async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: req.user,
      timestamp: new Date().toISOString()
    } as APIResponse<User>);
  } catch (error) {
    next(error);
  }
});

// Update user profile
router.put('/profile', authenticateUser, async (req, res, next) => {
  try {
    const {
      first_name,
      last_name,
      phone_number,
      preferences,
      room_number
    } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        first_name,
        last_name,
        phone_number,
        preferences,
        room_number,
      },
    });

    res.json({
      success: true,
      data: user,
      message: 'Profile updated successfully',
      timestamp: new Date().toISOString()
    } as APIResponse<User>);

  } catch (error) {
    next(error);
  }
});

// Verify user role and permissions
router.get('/verify', authenticateUser, async (req, res, next) => {
  try {
    const user = req.user!;
    
    res.json({
      success: true,
      data: {
        user_id: user.id,
        role: user.role,
        permissions: getRolePermissions(user.role),
        authenticated: true
      },
      timestamp: new Date().toISOString()
    } as APIResponse);

  } catch (error) {
    next(error);
  }
});

// Helper function to get role permissions
function getRolePermissions(role: UserRole): string[] {
  const permissions: Record<UserRole, string[]> = {
    [UserRole.guest]: [
      'create_ticket',
      'view_own_tickets',
      'use_voice_assistant'
    ],
    [UserRole.housekeeping]: [
      'create_ticket',
      'view_own_tickets',
      'view_assigned_tickets',
      'update_ticket_status',
      'use_voice_assistant'
    ],
    [UserRole.lobby_manager]: [
      'create_ticket',
      'view_all_tickets',
      'assign_tickets',
      'update_ticket_status',
      'view_reports',
      'manage_guests',
      'use_voice_assistant'
    ],
    [UserRole.general_manager]: [
      'create_ticket',
      'view_all_tickets',
      'assign_tickets',
      'update_ticket_status',
      'view_reports',
      'manage_staff',
      'manage_guests',
      'view_analytics',
      'use_voice_assistant'
    ],
    [UserRole.super_admin]: [
      'full_access',
      'manage_users',
      'manage_roles',
      'system_configuration',
      'view_audit_logs',
      'manage_integrations'
    ]
  };

  return permissions[role] || [];
}

export default router;

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { APIResponse, User, UserRole } from '../types';
import { ClerkService } from '../services/clerkService';

export class AuthController {
  // Register user with Clerk (for Clerk integration)
  static async register(req: Request, res: Response, next: NextFunction) {
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
  }

  // Super Admin signup (password-based authentication)
  static async superAdminSignup(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('🚀 Super Admin Signup Request:', {
        email: req.body.email,
        firstName: req.body.first_name,
        lastName: req.body.last_name,
        hasPassword: !!req.body.password,
        hotelId: req.body.hotel_id
      });

      const {
        email,
        password,
        first_name,
        last_name,
        hotel_id
      } = req.body;

      // Validate required fields
      if (!email || !password || !first_name || !last_name) {
        console.log('❌ Missing required fields');
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: email, password, first_name, and last_name',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      console.log('✅ Required fields validated');

      // Check if user already exists in our database
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        console.log('❌ User already exists in database:', existingUser.id);
        return res.status(409).json({
          success: false,
          error: 'User with this email already exists',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      console.log('✅ No existing user found in database');

      // Check if super admin already exists (only allow one)
      const existingSuperAdmin = await prisma.user.findFirst({
        where: { role: UserRole.super_admin },
      });

      if (existingSuperAdmin) {
        console.log('❌ Super admin already exists:', existingSuperAdmin.id);
        return res.status(403).json({
          success: false,
          error: 'Super admin account already exists',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      console.log('✅ No existing super admin found');

      try {
        console.log('🔐 Attempting to create user in Clerk...');
        
        // Create user in Clerk first
        const clerkUser = await ClerkService.createUser({
          email,
          firstName: first_name,
          lastName: last_name,
          password, // Include password for Clerk
          publicMetadata: {
            role: UserRole.super_admin,
            hotel_id,
            preferences: {
              language: 'en',
              voice_enabled: true,
              notifications_enabled: true,
              theme: 'dark'
            }
          }
        });

        console.log('✅ User created in Clerk successfully:', clerkUser.id);

        console.log('💾 Creating user in database...');
        
        // Create super admin user in our database with Clerk ID
        const user = await prisma.user.create({
          data: {
            clerk_id: clerkUser.id, // Use actual Clerk ID
            email,
            first_name,
            last_name,
            role: UserRole.super_admin,
            hotel_id,
            preferences: {
              language: 'en',
              voice_enabled: true,
              notifications_enabled: true,
              theme: 'dark'
            },
          },
        });

        console.log('✅ User created in database successfully:', user.id);

        // Generate JWT token for super admin
        // Note: In production, you should use a proper JWT library and secret
        const token = `super_admin_token_${user.id}_${Date.now()}`;

        console.log('🎉 Super admin signup completed successfully');

        res.status(201).json({
          success: true,
          data: { user, token },
          message: 'Super admin account created successfully in both Clerk and database',
          timestamp: new Date().toISOString()
        } as APIResponse<{ user: User; token: string }>);

      } catch (clerkError) {
        // If Clerk creation fails, clean up and return error
        console.error('❌ Failed to create super admin in Clerk:', clerkError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create super admin in authentication system',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

    } catch (error) {
      console.error('❌ Unexpected error in super admin signup:', error);
      next(error);
    }
  }

  // Create new user (Super Admin only)
  static async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        email,
        first_name,
        last_name,
        role,
        hotel_id,
        room_number,
        phone_number,
        preferences
      } = req.body;

      // Validate required fields
      if (!email || !first_name || !last_name || !role) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: email, first_name, last_name, and role',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      // Check if user already exists in our database
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'User with this email already exists',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      try {
        // Create user in Clerk first
        const clerkUser = await ClerkService.createUser({
          email,
          firstName: first_name,
          lastName: last_name,
          publicMetadata: {
            role,
            hotel_id,
            room_number,
            phone_number,
            preferences: preferences || {
              language: 'en',
              voice_enabled: true,
              notifications_enabled: true,
              theme: 'dark'
            }
          }
        });

        // Create user in our database with Clerk ID
        const user = await prisma.user.create({
          data: {
            clerk_id: clerkUser.id,
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
          message: 'User created successfully in both Clerk and database',
          timestamp: new Date().toISOString()
        } as APIResponse<User>);

      } catch (clerkError) {
        // If Clerk creation fails, clean up and return error
        console.error('Failed to create user in Clerk:', clerkError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create user in authentication system',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

    } catch (error) {
      next(error);
    }
  }

  // Get user by ID (Super Admin only)
  static async getUserById(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;

      const user = await prisma.user.findUnique({
        where: { id: userId },
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
  }

  // Update user (Super Admin only)
  static async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const {
        first_name,
        last_name,
        phone_number,
        hotel_id,
        room_number,
        preferences
      } = req.body;

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      try {
        // Update user in Clerk
        await ClerkService.updateUser(existingUser.clerk_id, {
          firstName: first_name,
          lastName: last_name,
          publicMetadata: {
            role: existingUser.role,
            hotel_id,
            room_number,
            phone_number,
            preferences
          }
        });

        // Update user in our database
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: {
            first_name,
            last_name,
            phone_number,
            hotel_id,
            room_number,
            preferences,
            updated_at: new Date(),
          },
        });

        res.json({
          success: true,
          data: updatedUser,
          message: 'User updated successfully in both Clerk and database',
          timestamp: new Date().toISOString()
        } as APIResponse<User>);

      } catch (clerkError) {
        console.error('Failed to update user in Clerk:', clerkError);
        return res.status(500).json({
          success: false,
          error: 'Failed to update user in authentication system',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

    } catch (error) {
      next(error);
    }
  }

  // Delete user (Super Admin only)
  static async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      // Prevent deletion of super admin
      if (existingUser.role === UserRole.super_admin) {
        return res.status(403).json({
          success: false,
          error: 'Cannot delete super admin account',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      try {
        // Delete user from Clerk
        await ClerkService.deleteUser(existingUser.clerk_id);

        // Delete user from database
        await prisma.user.delete({
          where: { id: userId },
        });

        res.json({
          success: true,
          message: 'User deleted successfully from both Clerk and database',
          timestamp: new Date().toISOString()
        } as APIResponse);

      } catch (clerkError) {
        console.error('Failed to delete user from Clerk:', clerkError);
        return res.status(500).json({
          success: false,
          error: 'Failed to delete user from authentication system',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

    } catch (error) {
      next(error);
    }
  }

  // Get current user profile
  static async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({
        success: true,
        data: req.user,
        timestamp: new Date().toISOString()
      } as APIResponse<User>);
    } catch (error) {
      next(error);
    }
  }

  // Update user profile
  static async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        first_name,
        last_name,
        phone_number,
        preferences,
        room_number
      } = req.body;

      const updatedUser = await prisma.user.update({
        where: { id: req.user!.id },
        data: {
          first_name,
          last_name,
          phone_number,
          preferences,
          room_number,
          updated_at: new Date()
        },
      });

      res.json({
        success: true,
        data: updatedUser,
        message: 'Profile updated successfully',
        timestamp: new Date().toISOString()
      } as APIResponse<User>);

    } catch (error) {
      next(error);
    }
  }

  // Super Admin: Assign roles to users
  static async updateUserRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      if (!role || !Object.values(UserRole).includes(role)) {
        return res.status(400).json({
          success: false,
          error: 'Valid role is required',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { 
          role,
          updated_at: new Date()
        },
      });

      res.json({
        success: true,
        data: updatedUser,
        message: 'User role updated successfully',
        timestamp: new Date().toISOString()
      } as APIResponse<User>);

    } catch (error) {
      next(error);
    }
  }

  // Super Admin: Get all users
  static async getAllUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          role: true,
          hotel_id: true,
          room_number: true,
          active: true,
          created_at: true,
          updated_at: true
        },
        orderBy: { created_at: 'desc' }
      });

      res.json({
        success: true,
        data: users,
        timestamp: new Date().toISOString()
      } as APIResponse<User[]>);

    } catch (error) {
      next(error);
    }
  }

  // Super Admin: Deactivate/Activate user
  static async updateUserStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const { active } = req.body;

      if (typeof active !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'Active status (boolean) is required',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { 
          active,
          updated_at: new Date()
        },
      });

      res.json({
        success: true,
        data: updatedUser,
        message: `User ${active ? 'activated' : 'deactivated'} successfully`,
        timestamp: new Date().toISOString()
      } as APIResponse<User>);

    } catch (error) {
      next(error);
    }
  }
}

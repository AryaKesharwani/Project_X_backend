import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { APIResponse, User, UserRole } from '../types';

export class AuthController {
  // Register user with local authentication
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        email,
        password,
        first_name,
        last_name,
        role = UserRole.guest,
        hotel_id,
        room_number,
        phone_number,
        preferences
      } = req.body;

      // Validate required fields
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: email and password',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      // Check if user already exists
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

      // Hash password
      const saltRounds = 12;
      const password_hash = await bcrypt.hash(password, saltRounds);

      // Create new user
      const user = await prisma.user.create({
        data: {
          email,
          password_hash,
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

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );

      // Remove password hash from response
      const { password_hash: _, ...userWithoutPassword } = user;

      res.status(201).json({
        success: true,
        data: { user: userWithoutPassword, token },
        message: 'User registered successfully',
        timestamp: new Date().toISOString()
      } as APIResponse<{ user: Omit<User, 'password_hash'>; token: string }>);

    } catch (error) {
      next(error);
    }
  }

  // Login user
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      // Validate required fields
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: email and password',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user || !user.active) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials or user inactive',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      // Check if user has password (for users created before password auth)
      if (!user.password_hash) {
        return res.status(401).json({
          success: false,
          error: 'Account requires password reset',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      // Update last active
      await prisma.user.update({
        where: { id: user.id },
        data: { last_active: new Date() }
      });

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );

      // Remove password hash from response
      const { password_hash: _, ...userWithoutPassword } = user;

      res.json({
        success: true,
        data: { user: userWithoutPassword, token },
        message: 'Login successful',
        timestamp: new Date().toISOString()
      } as APIResponse<{ user: Omit<User, 'password_hash'>; token: string }>);

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

      // Hash password
      const saltRounds = 12;
      const password_hash = await bcrypt.hash(password, saltRounds);

      console.log('💾 Creating super admin in database...');
      
      // Create super admin user in our database
      const user = await prisma.user.create({
        data: {
          email,
          password_hash,
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
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );

      console.log('🎉 Super admin signup completed successfully');

      // Remove password hash from response
      const { password_hash: _, ...userWithoutPassword } = user;

      res.status(201).json({
        success: true,
        data: { user: userWithoutPassword, token },
        message: 'Super admin account created successfully',
        timestamp: new Date().toISOString()
      } as APIResponse<{ user: Omit<User, 'password_hash'>; token: string }>);

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
        password,
        first_name,
        last_name,
        role,
        hotel_id,
        room_number,
        phone_number,
        preferences
      } = req.body;

      // Validate required fields
      if (!email || !password || !first_name || !last_name || !role) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: email, password, first_name, last_name, and role',
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

      // Hash password
      const saltRounds = 12;
      const password_hash = await bcrypt.hash(password, saltRounds);

      // Create user in our database
      const user = await prisma.user.create({
        data: {
          email,
          password_hash,
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

      // Remove password hash from response
      const { password_hash: _, ...userWithoutPassword } = user;

      res.status(201).json({
        success: true,
        data: userWithoutPassword,
        message: 'User created successfully',
        timestamp: new Date().toISOString()
      } as APIResponse<Omit<User, 'password_hash'>>);

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
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          phone_number: true,
          role: true,
          hotel_id: true,
          room_number: true,
          preferences: true,
          active: true,
          last_active: true,
          created_at: true,
          updated_at: true
        }
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
      } as APIResponse<Omit<User, 'password_hash'>>);

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
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          phone_number: true,
          role: true,
          hotel_id: true,
          room_number: true,
          preferences: true,
          active: true,
          last_active: true,
          created_at: true,
          updated_at: true
        }
      });

      res.json({
        success: true,
        data: updatedUser,
        message: 'User updated successfully',
        timestamp: new Date().toISOString()
      } as APIResponse<Omit<User, 'password_hash'>>);

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

      // Delete user from database
      await prisma.user.delete({
        where: { id: userId },
      });

      res.json({
        success: true,
        message: 'User deleted successfully',
        timestamp: new Date().toISOString()
      } as APIResponse);

    } catch (error) {
      next(error);
    }
  }

  // Get current user profile
  static async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const { password_hash: _, ...userWithoutPassword } = req.user!;
      
      res.json({
        success: true,
        data: userWithoutPassword,
        timestamp: new Date().toISOString()
      } as APIResponse<Omit<User, 'password_hash'>>);
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
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          phone_number: true,
          role: true,
          hotel_id: true,
          room_number: true,
          preferences: true,
          active: true,
          last_active: true,
          created_at: true,
          updated_at: true
        }
      });

      res.json({
        success: true,
        data: updatedUser,
        message: 'Profile updated successfully',
        timestamp: new Date().toISOString()
      } as APIResponse<Omit<User, 'password_hash'>>);

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
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          phone_number: true,
          role: true,
          hotel_id: true,
          room_number: true,
          preferences: true,
          active: true,
          last_active: true,
          created_at: true,
          updated_at: true
        }
      });

      res.json({
        success: true,
        data: updatedUser,
        message: 'User role updated successfully',
        timestamp: new Date().toISOString()
      } as APIResponse<Omit<User, 'password_hash'>>);

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
      } as APIResponse<Omit<User, 'password_hash'>[]>);

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
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          phone_number: true,
          role: true,
          hotel_id: true,
          room_number: true,
          preferences: true,
          active: true,
          last_active: true,
          created_at: true,
          updated_at: true
        }
      });

      res.json({
        success: true,
        data: updatedUser,
        message: `User ${active ? 'activated' : 'deactivated'} successfully`,
        timestamp: new Date().toISOString()
      } as APIResponse<Omit<User, 'password_hash'>>);

    } catch (error) {
      next(error);
    }
  }

  // Change password
  static async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Current password and new password are required',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      // Get current user with password hash
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { password_hash: true }
      });

      if (!user?.password_hash) {
        return res.status(400).json({
          success: false,
          error: 'Account requires password reset',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isCurrentPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'Current password is incorrect',
          timestamp: new Date().toISOString()
        } as APIResponse);
      }

      // Hash new password
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await prisma.user.update({
        where: { id: req.user!.id },
        data: { 
          password_hash: newPasswordHash,
          updated_at: new Date()
        }
      });

      res.json({
        success: true,
        message: 'Password changed successfully',
        timestamp: new Date().toISOString()
      } as APIResponse);

    } catch (error) {
      next(error);
    }
  }
}

import { Request, Response, NextFunction } from 'express';
import { AuthenticationError, AuthorizationError, User, UserRole } from '../types';
import { prisma } from '../config/prisma';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export const authenticateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // In a real implementation, you would verify the Clerk JWT token here
    // For now, we'll simulate user lookup
    const clerkUserId = token; // This would be extracted from the verified JWT

    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { clerk_id: clerkUserId },
    });

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      if (!allowedRoles.includes(req.user.role)) {
        throw new AuthorizationError(
          `Access denied. Required roles: ${allowedRoles.join(', ')}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const requireSuperAdmin = requireRole(['super_admin']);

export const requireManager = requireRole([
  'super_admin',
  'general_manager'
]);

export const requireStaff = requireRole([
  'super_admin',
  'general_manager',
  'lobby_manager',
  'housekeeping'
]);

export const requireAnyRole = requireRole([
  'super_admin',
  'general_manager',
  'lobby_manager',
  'housekeeping',
  'guest'
]);

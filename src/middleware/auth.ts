import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
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

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    
    // Fetch user from database by user ID
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || !user.active) {
      throw new AuthenticationError('User not found or inactive');
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AuthenticationError('Invalid token'));
    } else {
      next(error);
    }
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

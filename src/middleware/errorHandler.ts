import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { isDevelopment } from '../config/env';

// Custom error classes
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND_ERROR');
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_ERROR');
  }
}

// Error handler middleware
export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let code = 'INTERNAL_ERROR';
  let details: any = null;

  // Handle custom AppError instances
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    code = error.code || 'APP_ERROR';
  }
  // Handle Prisma errors
  else if (error.name === 'PrismaClientKnownRequestError') {
    const prismaError = error as any;
    switch (prismaError.code) {
      case 'P2002':
        statusCode = 409;
        message = 'Resource already exists';
        code = 'DUPLICATE_ERROR';
        break;
      case 'P2025':
        statusCode = 404;
        message = 'Resource not found';
        code = 'NOT_FOUND_ERROR';
        break;
      case 'P2003':
        statusCode = 400;
        message = 'Invalid reference';
        code = 'REFERENCE_ERROR';
        break;
      default:
        statusCode = 400;
        message = 'Database operation failed';
        code = 'DATABASE_ERROR';
    }
  }
  // Handle validation errors
  else if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
    details = error.message;
  }
  // Handle JWT errors
  else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    code = 'JWT_ERROR';
  }
  else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    code = 'JWT_EXPIRED_ERROR';
  }
  // Handle Clerk errors
  else if (error.message.includes('Clerk')) {
    statusCode = 500;
    message = 'Authentication service error';
    code = 'CLERK_ERROR';
  }

  // Log error with context
  const logData = {
    error: {
      name: error.name,
      message: error.message,
      code,
      statusCode,
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.id,
    },
    stack: isDevelopment ? error.stack : undefined,
  };

  if (statusCode >= 500) {
    logger.error('Server Error', logData);
  } else {
    logger.warn('Client Error', logData);
  }

  // Send error response
  const errorResponse: any = {
    success: false,
    error: message,
    code,
    timestamp: new Date().toISOString(),
  };

  // Add details in development
  if (isDevelopment && details) {
    errorResponse.details = details;
  }

  // Add stack trace in development
  if (isDevelopment && error.stack) {
    errorResponse.stack = error.stack;
  }

  res.status(statusCode).json(errorResponse);
};

// 404 handler for unmatched routes
export const notFoundHandler = (req: Request, res: Response) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  
  logger.warn('Route Not Found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  res.status(404).json({
    success: false,
    error: error.message,
    code: error.code,
    timestamp: new Date().toISOString(),
  });
};

// Async error wrapper for controllers
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

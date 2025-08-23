import { Request, Response, NextFunction } from 'express';
import { APIError } from '../types';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Handle custom API errors
  if (error instanceof APIError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString()
    });
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }

  // Handle JSON parsing errors
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON format',
      timestamp: new Date().toISOString()
    });
  }

  // Handle database errors
  if (error.message.includes('duplicate key')) {
    return res.status(409).json({
      success: false,
      error: 'Resource already exists',
      timestamp: new Date().toISOString()
    });
  }

  // Default server error
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
};

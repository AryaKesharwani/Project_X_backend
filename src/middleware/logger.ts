import { Request, Response, NextFunction } from 'express';

export const logger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  // Log request
  console.log(`📥 ${req.method} ${req.path}`, {
    timestamp: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.method === 'POST' || req.method === 'PUT' ? req.body : undefined
  });

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(body) {
    const duration = Date.now() - start;
    
    console.log(`📤 ${req.method} ${req.path} - ${res.statusCode}`, {
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      status: res.statusCode,
      success: res.statusCode < 400
    });

    return originalJson.call(this, body);
  };

  next();
};

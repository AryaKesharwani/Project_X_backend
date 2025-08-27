import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Environment schema validation
const envSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default(3001),
  
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  
  // Frontend URL (for CORS)
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  
  // Rate Limiting
  // RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'), // 15 minutes
  // RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  
  // API Keys (optional for development)
  OPENAI_API_KEY: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
});

// Validate environment variables
const envParseResult = envSchema.safeParse(process.env);

if (!envParseResult.success) {
  console.error('❌ Environment validation failed:');
  console.error(envParseResult.error.format());
  process.exit(1);
}

export const env = envParseResult.data;

// Environment helper functions
export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

// Configuration objects
export const serverConfig = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  frontendUrl: env.FRONTEND_URL,
};

export const databaseConfig = {
  url: env.DATABASE_URL,
};

export const securityConfig = {
  rateLimit: {
    // windowMs: env.RATE_LIMIT_WINDOW_MS,
    // max: env.RATE_LIMIT_MAX_REQUESTS,
  },
};

export const loggingConfig = {
  level: env.LOG_LEVEL,
};

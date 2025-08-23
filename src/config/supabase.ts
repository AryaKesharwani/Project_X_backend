import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder_key';

// Log warning if using placeholder values
if (supabaseUrl.includes('placeholder') || supabaseServiceKey.includes('placeholder')) {
  console.warn('⚠️  Using placeholder Supabase configuration. Database operations will not work until proper credentials are provided.');
}

// Create Supabase client with service role key for backend operations
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Database table names
export const TABLES = {
  USERS: 'users',
  TICKETS: 'tickets',
  VOICE_SESSIONS: 'voice_sessions',
  AUDIT_LOGS: 'audit_logs',
  NOTIFICATIONS: 'notifications',
  ROLES: 'roles',
  PERMISSIONS: 'permissions'
} as const;

// User roles enum
export enum UserRole {
  GUEST = 'guest',
  HOUSEKEEPING = 'housekeeping',
  LOBBY_MANAGER = 'lobby_manager',
  GENERAL_MANAGER = 'general_manager',
  SUPER_ADMIN = 'super_admin'
}

// Ticket status enum
export enum TicketStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

// Ticket priority enum
export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export default supabase;

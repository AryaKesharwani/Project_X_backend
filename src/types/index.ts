// Import and re-export Prisma types
import type {
  User as PrismaUser,
  Ticket as PrismaTicket,
  VoiceSession as PrismaVoiceSession,
  Notification as PrismaNotification,
  AuditLog as PrismaAuditLog,
  Role as PrismaRole,
  Permission as PrismaPermission,
} from '@prisma/client';

export {
  UserRole,
  TicketStatus,
  TicketPriority,
  Department,
  NotificationStatus,
} from '@prisma/client';

// Re-export types with proper names
export type User = PrismaUser;
export type Ticket = PrismaTicket;
export type VoiceSession = PrismaVoiceSession;
export type Notification = PrismaNotification;
export type AuditLog = PrismaAuditLog;
export type Role = PrismaRole;
export type Permission = PrismaPermission;

// Extended types with relations
export type UserWithRelations = User & {
  created_tickets?: Ticket[];
  assigned_tickets?: Ticket[];
  voice_sessions?: VoiceSession[];
  notifications?: Notification[];
};

export type TicketWithRelations = Ticket & {
  creator?: User;
  assignee?: User | null;
  voice_session?: VoiceSession | null;
  notifications?: Notification[];
};

export type VoiceSessionWithRelations = VoiceSession & {
  user?: User;
  tickets?: Ticket[];
};

export type NotificationWithRelations = Notification & {
  user?: User;
  ticket?: Ticket | null;
};

// Keep existing interfaces that don't have Prisma equivalents
export interface UserPreferences {
  language: string;
  voice_enabled: boolean;
  notifications_enabled: boolean;
  theme: 'light' | 'dark' | 'auto';
  voice_settings?: {
    voice_id: string;
    speed: number;
    pitch: number;
  };
}

export interface TicketMetadata {
  items_requested?: string[];
  special_instructions?: string;
  recurring?: boolean;
  guest_present?: boolean;
  urgency_reason?: string;
  estimated_duration?: number;
}

export interface VoiceSessionMetadata {
  audio_quality: number;
  background_noise: boolean;
  processing_time: number;
  model_used: string;
  voice_id: string;
}

export interface NotificationMetadata {
  ticket_id?: string;
  department?: string;
  room_number?: string;
  auto_dismiss?: boolean;
  sound_enabled?: boolean;
}

export interface WebSocketMessage {
  type: WebSocketMessageType;
  payload: any;
  user_id?: string;
  room?: string;
  timestamp: string;
}

export enum WebSocketMessageType {
  TICKET_UPDATE = 'ticket_update',
  NOTIFICATION = 'notification',
  VOICE_RESPONSE = 'voice_response',
  SYSTEM_MESSAGE = 'system_message',
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left'
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T = any> extends APIResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface VoiceRequest {
  audio_data: string; // base64 encoded audio
  format: 'wav' | 'mp3' | 'webm';
  user_id: string;
  room_number?: string;
  language?: string;
}

export interface VoiceResponse {
  transcript: string;
  intent: string;
  confidence: number;
  response_text: string;
  response_audio: string; // base64 encoded audio
  ticket_created?: boolean;
  ticket_id?: string;
  session_id: string;
}

export interface IntentClassification {
  intent: string;
  confidence: number;
  entities: string[];
  department: string;
  priority: string;
}

export interface TicketGeneration {
  title: string;
  description: string;
  priority: string;
  department: string;
  estimated_completion: number; // minutes
  required_resources: string[];
}

// Error types
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class ValidationError extends APIError {
  constructor(message: string, public field?: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends APIError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends APIError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends APIError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND_ERROR');
    this.name = 'NotFoundError';
  }
}
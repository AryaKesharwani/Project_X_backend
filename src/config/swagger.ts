import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'LionKey AI Hospitality API',
      version: '1.0.0',
      description: 'API documentation for LionKey AI Hospitality Management System',
      contact: {
        name: 'LionKey AI Team',
        email: 'support@lionkey.ai'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server'
      },
      {
        url: 'https://api.lionkey.ai',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        },
        ClerkAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'Clerk authentication token'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            clerk_id: { type: 'string' },
            email: { type: 'string', format: 'email' },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            phone_number: { type: 'string' },
            role: { 
              type: 'string', 
              enum: ['guest', 'housekeeping', 'lobby_manager', 'general_manager', 'super_admin'] 
            },
            hotel_id: { type: 'string' },
            room_number: { type: 'string' },
            preferences: { type: 'object' },
            active: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        Ticket: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            status: { 
              type: 'string', 
              enum: ['pending', 'in_progress', 'completed', 'cancelled'] 
            },
            priority: { 
              type: 'string', 
              enum: ['low', 'medium', 'high', 'urgent'] 
            },
            department: { 
              type: 'string', 
              enum: ['housekeeping', 'maintenance', 'front_desk', 'concierge', 'room_service'] 
            },
            room_number: { type: 'string' },
            guest_notes: { type: 'string' },
            staff_notes: { type: 'string' },
            estimated_time: { type: 'integer' },
            actual_time: { type: 'integer' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        VoiceSession: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            user_id: { type: 'string' },
            transcript: { type: 'string' },
            intent: { type: 'string' },
            confidence: { type: 'number' },
            response_text: { type: 'string' },
            response_audio_url: { type: 'string' },
            duration: { type: 'number' },
            language: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            error: { type: 'string' },
            message: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'], // Path to the API docs
};

export const specs = swaggerJsdoc(options);

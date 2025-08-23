import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY || 'placeholder_openai_key';

if (apiKey === 'placeholder_openai_key') {
  console.warn('⚠️  Using placeholder OpenAI API key. AI features will not work until proper credentials are provided.');
}

export const openai = new OpenAI({
  apiKey: apiKey,
});

// OpenAI configuration constants
export const OPENAI_CONFIG = {
  // Model configurations
  MODELS: {
    CHAT: 'gpt-4-turbo-preview',
    EMBEDDING: 'text-embedding-3-small',
    WHISPER: 'whisper-1'
  },
  
  // Default parameters
  CHAT_PARAMS: {
    temperature: 0.7,
    max_tokens: 1000,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0
  },

  // System prompts for different contexts
  SYSTEM_PROMPTS: {
    HOSPITALITY_ASSISTANT: `You are LionKey AI, a sophisticated hospitality assistant for a luxury hotel. 
    You help guests with their requests, provide information, and coordinate with hotel staff.
    
    Guidelines:
    - Be professional, warm, and helpful
    - Understand natural language requests
    - Classify requests by type (housekeeping, room service, concierge, etc.)
    - Provide clear, actionable responses
    - Always confirm understanding before proceeding
    - Escalate complex issues appropriately
    
    You can help with:
    - Room service requests
    - Housekeeping needs
    - Hotel amenities and services
    - Local recommendations
    - Booking assistance
    - General inquiries`,

    INTENT_CLASSIFIER: `You are an intent classification system for a hospitality platform.
    Analyze the user's message and classify it into one of these categories:
    
    - housekeeping: cleaning, towels, amenities, room maintenance
    - room_service: food, drinks, dining requests
    - concierge: local information, bookings, recommendations
    - maintenance: technical issues, repairs, facilities
    - complaint: issues, problems, dissatisfaction
    - inquiry: general questions, information requests
    - compliment: praise, positive feedback
    
    Respond with JSON format: {"intent": "category", "confidence": 0.95, "entities": ["extracted", "entities"]}`,

    TICKET_GENERATOR: `You are a ticket generation system for hotel operations.
    Based on the guest request and intent classification, generate a structured ticket.
    
    Include:
    - Title (brief, descriptive)
    - Description (detailed, actionable)
    - Priority (low, medium, high, urgent)
    - Department (housekeeping, room_service, concierge, maintenance)
    - Estimated completion time
    - Required resources or staff
    
    Respond in JSON format.`
  }
} as const;

export default openai;

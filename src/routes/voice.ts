import { Router } from 'express';
import { openai, OPENAI_CONFIG } from '../config/openai';
import { elevenlabs, ELEVENLABS_CONFIG, getVoiceConfig } from '../config/elevenlabs';
import { prisma } from '../config/prisma';
import { 
  VoiceRequest, 
  VoiceResponse, 
  IntentClassification, 
  TicketGeneration,
  APIResponse,
  UserRole,
  WebSocketMessageType
} from '../types';
import { authenticateUser } from '../middleware/auth';
import { getWebSocketService } from '../services/websocket';

const router = Router();

// Process voice request
router.post('/process', authenticateUser, async (req, res, next) => {
  try {
    const { audio_data, format, language = 'en' }: VoiceRequest = req.body;
    const userId = req.user!.id;
    const roomNumber = req.user!.room_number;

    // Start timing
    const startTime = Date.now();

    // 1. Speech-to-Text with OpenAI Whisper
    const transcript = await processSpeechToText(audio_data, format);
    if (!transcript) {
      throw new Error('Failed to process speech to text');
    }

    // 2. Intent classification with GPT-4
    const intentClassification = await classifyIntent(transcript);
    if (!intentClassification) {
      throw new Error('Failed to classify intent');
    }

    // 3. Generate response text
    const responseText = await generateResponse(transcript, intentClassification);
    if (!responseText) {
      throw new Error('Failed to generate response');
    }

    // 4. Create voice session
    const voiceSession = await prisma.voiceSession.create({
      data: {
        user_id: userId,
        transcript,
        intent_classification: intentClassification as any,
        response_text: responseText,
        confidence_score: intentClassification.confidence,
        processing_time: Date.now() - startTime,
        language
      }
    });

    // 5. Generate ticket if needed
    let ticket = null;
    if (intentClassification.intent !== 'inquiry' && intentClassification.intent !== 'compliment') {
      ticket = await generateTicketFromIntent(intentClassification, transcript, userId, roomNumber || undefined);
    }

    // 6. Text-to-Speech with ElevenLabs
    const responseAudio = await processTextToSpeech(responseText, language);
    if (!responseAudio) {
      throw new Error('Failed to generate speech response');
    }

    // 7. Update voice session with audio
    await prisma.voiceSession.update({
      where: { id: voiceSession.id },
      data: { 
        response_audio_url: responseAudio,
        processing_time: Date.now() - startTime
      }
    });

    // 8. Send WebSocket notification if ticket was created
    if (ticket) {
      const wsService = getWebSocketService();
      if (wsService) {
        wsService.broadcastToRole('housekeeping', {
          type: WebSocketMessageType.TICKET_UPDATE,
          payload: {
            action: 'created',
            ticket,
            message: `New voice request ticket: ${ticket.title}`,
            room_number: roomNumber || undefined
          },
          timestamp: new Date().toISOString()
        });
      }
    }

    const response: VoiceResponse = {
      transcript,
      intent: intentClassification.intent,
      confidence: intentClassification.confidence,
      response_text: responseText,
      response_audio: responseAudio,
      ticket_created: !!ticket,
      ticket_id: ticket?.id,
      session_id: voiceSession.id
    };

    res.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString()
    } as APIResponse<VoiceResponse>);

  } catch (error) {
    next(error);
  }
});

// Get voice session history
router.get('/history', authenticateUser, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const total = await prisma.voiceSession.count({
      where: { user_id: userId }
    });

    const sessions = await prisma.voiceSession.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      skip: offset,
      take: Number(limit)
    });

    res.json({
      success: true,
      data: sessions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      },
      timestamp: new Date().toISOString()
    } as APIResponse);

  } catch (error) {
    next(error);
  }
});

// Helper functions
async function processSpeechToText(audioData: string, format: string): Promise<string> {
  try {
    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audioData, 'base64');
    
    // Use OpenAI Whisper for speech-to-text
    const transcription = await openai.audio.transcriptions.create({
      file: audioBuffer as any,
      model: OPENAI_CONFIG.MODELS.WHISPER,
      language: 'en'
    });

    return transcription.text;
  } catch (error) {
    console.error('Speech-to-text error:', error);
    throw error;
  }
}

async function classifyIntent(transcript: string): Promise<IntentClassification> {
  try {
    const prompt = `Analyze this hospitality request and classify it:

Request: "${transcript}"

Respond with JSON format:
{
  "intent": "housekeeping|room_service|concierge|maintenance|complaint|inquiry|compliment",
  "confidence": 0.95,
  "entities": ["extracted", "entities"],
  "department": "housekeeping|maintenance|front_desk|concierge|room_service",
  "priority": "low|medium|high|urgent"
}`;

    const completion = await openai.chat.completions.create({
      model: OPENAI_CONFIG.MODELS.CHAT,
      messages: [
        { role: 'system', content: 'You are an intent classification system for hospitality requests.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 200
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from GPT');
    }

    // Parse JSON response
    const classification = JSON.parse(response);
    return {
      intent: classification.intent,
      confidence: classification.confidence,
      entities: classification.entities || [],
      department: classification.department,
      priority: classification.priority
    };
  } catch (error) {
    console.error('Intent classification error:', error);
    throw error;
  }
}

async function generateResponse(transcript: string, intent: IntentClassification): Promise<string> {
  try {
    const prompt = `You are LionKey AI, a sophisticated hospitality assistant. Respond to this guest request:

Guest Request: "${transcript}"
Intent: ${intent.intent}
Department: ${intent.department}
Priority: ${intent.priority}

Provide a helpful, professional response that:
1. Acknowledges their request
2. Confirms understanding
3. Sets appropriate expectations
4. Is warm and welcoming

Keep response under 100 words.`;

    const completion = await openai.chat.completions.create({
      model: OPENAI_CONFIG.MODELS.CHAT,
      messages: [
        { role: 'system', content: 'You are LionKey AI, a luxury hotel assistant.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 150
    });

    return completion.choices[0]?.message?.content || 'Thank you for your request. We will assist you shortly.';
  } catch (error) {
    console.error('Response generation error:', error);
    return 'Thank you for your request. We will assist you shortly.';
  }
}

async function generateTicketFromIntent(
  intent: IntentClassification, 
  transcript: string, 
  userId: string, 
  roomNumber?: string
): Promise<any> {
  try {
    const prompt = `Generate a ticket from this hospitality request:

Request: "${transcript}"
Intent: ${intent.intent}
Department: ${intent.department}
Priority: ${intent.priority}

Create a structured ticket with:
- Title (brief, descriptive)
- Description (detailed, actionable)
- Priority (low|medium|high|urgent)
- Department (housekeeping|maintenance|front_desk|concierge|room_service)
- Estimated completion time (in minutes)
- Required resources or staff

Respond in JSON format.`;

    const completion = await openai.chat.completions.create({
      model: OPENAI_CONFIG.MODELS.CHAT,
      messages: [
        { role: 'system', content: 'You are a ticket generation system for hotel operations.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 300
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from GPT');
    }

    const ticketData = JSON.parse(response);

    // Create ticket in database
    const ticket = await prisma.ticket.create({
      data: {
        title: ticketData.title,
        description: ticketData.description,
        status: 'pending',
        priority: ticketData.priority,
        department: ticketData.department,
        room_number: roomNumber,
        guest_notes: transcript,
        estimated_time: ticketData.estimated_completion,
        created_by: userId
      }
    });

    return ticket;
  } catch (error) {
    console.error('Ticket generation error:', error);
    throw error;
  }
}

async function processTextToSpeech(text: string, language: string): Promise<string> {
  try {
    // Use ElevenLabs for text-to-speech
    const audioUrl = await elevenlabs.textToSpeech({
      text,
      voice_id: ELEVENLABS_CONFIG.VOICES.PROFESSIONAL_FEMALE,
      model_id: 'eleven_monolingual_v1'
    });

    return audioUrl.toString();
  } catch (error) {
    console.error('Text-to-speech error:', error);
    // Return a placeholder or fallback
    return 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT';
  }
}

// Helper function to get department role mapping
function getDepartmentRole(department: string): UserRole {
  switch (department) {
    case 'housekeeping':
      return UserRole.housekeeping;
    case 'room_service':
      return UserRole.lobby_manager;
    case 'concierge':
      return UserRole.lobby_manager;
    case 'front_desk':
      return UserRole.lobby_manager;
    case 'maintenance':
      return UserRole.general_manager; // Maintenance handled by GM for now
    default:
      return UserRole.general_manager;
  }
}

export default router;

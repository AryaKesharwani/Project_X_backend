import { Router } from 'express';
import { VoiceController } from '../controllers/voiceController';
import { authenticateUser } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all voice routes
router.use(authenticateUser);

/**
 * @swagger
 * /api/voice/process:
 *   post:
 *     summary: Process voice input and create ticket
 *     tags: [Voice]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - audio_data
 *               - user_id
 *             properties:
 *               audio_data:
 *                 type: string
 *                 description: Base64 encoded audio data
 *               user_id:
 *                 type: string
 *                 description: User ID
 *               language:
 *                 type: string
 *                 default: en
 *                 description: Language code
 *               metadata:
 *                 type: object
 *                 description: Additional metadata
 *     responses:
 *       200:
 *         description: Voice processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Invalid audio data
 *       401:
 *         description: Unauthorized
 */
router.post('/process', VoiceController.processVoice);

/**
 * @swagger
 * /api/voice/sessions:
 *   get:
 *     summary: Get voice sessions for a user
 *     tags: [Voice]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *         description: User ID to filter sessions
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of sessions to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of sessions to skip
 *     responses:
 *       200:
 *         description: Voice sessions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Unauthorized
 */
router.get('/sessions', VoiceController.getVoiceSessions);

/**
 * @swagger
 * /api/voice/sessions/{id}:
 *   get:
 *     summary: Get voice session by ID
 *     tags: [Voice]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Voice session ID
 *     responses:
 *       200:
 *         description: Voice session retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Voice session not found
 */
router.get('/sessions/:id', VoiceController.getVoiceSessionById);

/**
 * @swagger
 * /api/voice/sessions/{id}:
 *   put:
 *     summary: Update voice session
 *     tags: [Voice]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Voice session ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               transcript:
 *                 type: string
 *                 description: Updated transcript
 *               intent:
 *                 type: string
 *                 description: Updated intent
 *               confidence:
 *                 type: number
 *                 description: Updated confidence score
 *               response_text:
 *                 type: string
 *                 description: Updated response text
 *               metadata:
 *                 type: object
 *                 description: Updated metadata
 *     responses:
 *       200:
 *         description: Voice session updated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Voice session not found
 */
router.put('/sessions/:id', VoiceController.updateVoiceSession);

/**
 * @swagger
 * /api/voice/sessions/{id}:
 *   delete:
 *     summary: Delete voice session
 *     tags: [Voice]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Voice session ID
 *     responses:
 *       200:
 *         description: Voice session deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Voice session not found
 */
router.delete('/sessions/:id', VoiceController.deleteVoiceSession);

export default router;

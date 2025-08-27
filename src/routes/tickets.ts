import { Router } from 'express';
import { TicketController } from '../controllers/ticketController';
import { authenticateUser, requireStaff } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all ticket routes
router.use(authenticateUser);

/**
 * @swagger
 * /api/tickets:
 *   post:
 *     summary: Create a new ticket
 *     tags: [Tickets]
 *     security:
 *       - ClerkAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - department
 *             properties:
 *               title:
 *                 type: string
 *                 description: Ticket title
 *               description:
 *                 type: string
 *                 description: Ticket description
 *               department:
 *                 type: string
 *                 enum: [housekeeping, maintenance, front_desk, concierge, room_service]
 *                 description: Department to handle the ticket
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *                 default: medium
 *                 description: Ticket priority
 *               room_number:
 *                 type: string
 *                 description: Room number
 *               guest_notes:
 *                 type: string
 *                 description: Notes from guest
 *               estimated_time:
 *                 type: integer
 *                 description: Estimated completion time in minutes
 *     responses:
 *       201:
 *         description: Ticket created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 */
router.post('/', TicketController.createTicket);

/**
 * @swagger
 * /api/tickets:
 *   get:
 *     summary: Get all tickets with filters
 *     tags: [Tickets]
 *     security:
 *       - ClerkAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, in_progress, completed, cancelled]
 *         description: Filter by ticket status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         description: Filter by ticket priority
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *           enum: [housekeeping, maintenance, front_desk, concierge, room_service]
 *         description: Filter by department
 *       - in: query
 *         name: room_number
 *         schema:
 *           type: string
 *         description: Filter by room number
 *     responses:
 *       200:
 *         description: Tickets retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Unauthorized
 */
router.get('/', TicketController.getTickets);

/**
 * @swagger
 * /api/tickets/{id}:
 *   get:
 *     summary: Get ticket by ID
 *     tags: [Tickets]
 *     security:
 *       - ClerkAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket ID
 *     responses:
 *       200:
 *         description: Ticket retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Ticket not found
 */
router.get('/:id', TicketController.getTicketById);

/**
 * @swagger
 * /api/tickets/{id}/status:
 *   put:
 *     summary: Update ticket status
 *     tags: [Tickets]
 *     security:
 *       - ClerkAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, in_progress, completed, cancelled]
 *                 description: New ticket status
 *               staff_notes:
 *                 type: string
 *                 description: Staff notes about the status change
 *     responses:
 *       200:
 *         description: Ticket status updated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Ticket not found
 */
router.put('/:id/status', TicketController.updateTicketStatus);

/**
 * @swagger
 * /api/tickets/{id}/assign:
 *   put:
 *     summary: Assign ticket to staff member
 *     tags: [Tickets]
 *     security:
 *       - ClerkAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - assigned_to
 *             properties:
 *               assigned_to:
 *                 type: string
 *                 description: User ID to assign the ticket to
 *     responses:
 *       200:
 *         description: Ticket assigned successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires staff access
 *       404:
 *         description: Ticket not found
 */
router.put('/:id/assign', requireStaff, TicketController.assignTicket);

/**
 * @swagger
 * /api/tickets/{id}:
 *   delete:
 *     summary: Delete ticket
 *     tags: [Tickets]
 *     security:
 *       - ClerkAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket ID
 *     responses:
 *       200:
 *         description: Ticket deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Ticket not found
 */
router.delete('/:id', TicketController.deleteTicket);

export default router;

import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticateUser, requireSuperAdmin } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user with Clerk
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clerk_id
 *               - email
 *             properties:
 *               clerk_id:
 *                 type: string
 *                 description: Clerk user ID
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email address
 *               first_name:
 *                 type: string
 *                 description: User first name
 *               last_name:
 *                 type: string
 *                 description: User last name
 *               role:
 *                 type: string
 *                 enum: [guest, housekeeping, lobby_manager, general_manager]
 *                 default: guest
 *                 description: User role
 *               hotel_id:
 *                 type: string
 *                 description: Hotel ID
 *               room_number:
 *                 type: string
 *                 description: Room number
 *               phone_number:
 *                 type: string
 *                 description: Phone number
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Missing required fields
 *       409:
 *         description: User already exists
 */
router.post('/register', AuthController.register);

/**
 * @swagger
 * /api/auth/super-admin/signup:
 *   post:
 *     summary: Create a super admin account
 *     tags: [Authentication]
 *     description: Creates the first and only super admin account for the system
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - first_name
 *               - last_name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Super admin email address
 *               password:
 *                 type: string
 *                 description: Super admin password
 *               first_name:
 *                 type: string
 *                 description: Super admin first name
 *               last_name:
 *                 type: string
 *                 description: Super admin last name
 *               hotel_id:
 *                 type: string
 *                 description: Hotel ID (optional)
 *     responses:
 *       201:
 *         description: Super admin account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     token:
 *                       type: string
 *                       description: Authentication token
 *       400:
 *         description: Missing required fields
 *       403:
 *         description: Super admin account already exists
 *       409:
 *         description: User with this email already exists
 */
router.post('/super-admin/signup', AuthController.superAdminSignup);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - ClerkAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Unauthorized
 */
router.get('/profile', authenticateUser, AuthController.getProfile);

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Authentication]
 *     security:
 *       - ClerkAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               phone_number:
 *                 type: string
 *               preferences:
 *                 type: object
 *               room_number:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Unauthorized
 */
router.put('/profile', authenticateUser, AuthController.updateProfile);

/**
 * @swagger
 * /api/auth/users/{userId}/role:
 *   put:
 *     summary: Update user role (Super Admin only)
 *     tags: [Authentication]
 *     security:
 *       - ClerkAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [guest, housekeeping, lobby_manager, general_manager, super_admin]
 *                 description: New user role
 *     responses:
 *       200:
 *         description: User role updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires super admin access
 */
router.put('/users/:userId/role', requireSuperAdmin, AuthController.updateUserRole);

/**
 * @swagger
 * /api/auth/users:
 *   get:
 *     summary: Get all users (Super Admin only)
 *     tags: [Authentication]
 *     security:
 *       - ClerkAuth: []
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires super admin access
 */
router.get('/users', requireSuperAdmin, AuthController.getAllUsers);

/**
 * @swagger
 * /api/auth/users/{userId}/status:
 *   put:
 *     summary: Update user status (Super Admin only)
 *     tags: [Authentication]
 *     security:
 *       - ClerkAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - active
 *             properties:
 *               active:
 *                 type: boolean
 *                 description: User active status
 *     responses:
 *       200:
 *         description: User status updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires super admin access
 */
router.put('/users/:userId/status', requireSuperAdmin, AuthController.updateUserStatus);

/**
 * @swagger
 * /api/auth/users:
 *   post:
 *     summary: Create new user (Super Admin only)
 *     tags: [Authentication]
 *     security:
 *       - ClerkAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - first_name
 *               - last_name
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email address
 *               first_name:
 *                 type: string
 *                 description: User first name
 *               last_name:
 *                 type: string
 *                 description: User last name
 *               role:
 *                 type: string
 *                 enum: [guest, housekeeping, lobby_manager, general_manager]
 *                 description: User role
 *               hotel_id:
 *                 type: string
 *                 description: Hotel ID
 *               room_number:
 *                 type: string
 *                 description: Room number
 *               phone_number:
 *                 type: string
 *                 description: Phone number
 *               preferences:
 *                 type: object
 *                 description: User preferences
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires super admin access
 *       409:
 *         description: User with this email already exists
 */
router.post('/users', requireSuperAdmin, AuthController.createUser);

/**
 * @swagger
 * /api/auth/users/{userId}:
 *   get:
 *     summary: Get user by ID (Super Admin only)
 *     tags: [Authentication]
 *     security:
 *       - ClerkAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires super admin access
 *       404:
 *         description: User not found
 */
router.get('/users/:userId', requireSuperAdmin, AuthController.getUserById);

/**
 * @swagger
 * /api/auth/users/{userId}:
 *   put:
 *     summary: Update user (Super Admin only)
 *     tags: [Authentication]
 *     security:
 *       - ClerkAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               phone_number:
 *                 type: string
 *               hotel_id:
 *                 type: string
 *               room_number:
 *                 type: string
 *               preferences:
 *                 type: object
 *     responses:
 *       200:
 *         description: User updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires super admin access
 *       404:
 *         description: User not found
 */
router.put('/users/:userId', requireSuperAdmin, AuthController.updateUser);

/**
 * @swagger
 * /api/auth/users/{userId}:
 *   delete:
 *     summary: Delete user (Super Admin only)
 *     tags: [Authentication]
 *     security:
 *       - ClerkAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires super admin access
 *       404:
 *         description: User not found
 */
router.delete('/users/:userId', requireSuperAdmin, AuthController.deleteUser);

export default router;

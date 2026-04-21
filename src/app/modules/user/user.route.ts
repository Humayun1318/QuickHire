/**
 * @file user.route.ts
 * @description User management API routes
 * Defines all user-related endpoints with authentication, authorization, and validation
 */

import { Router } from 'express';
import { userController } from './user.controller';
import { validateRequest } from '../../middlewares/validateRequest';
import { createUserZodSchema } from './user.validation';
import { checkAuth } from '../../middlewares/checkAuth';
import { Role } from './user.interface';

// Initialize Express router for user routes
const router = Router();

/**
 * User Registration Endpoint
 * HTTP Method: POST
 * Route: /api/v1/users/register
 *
 * Middleware chain:
 * 1. validateRequest(createUserZodSchema) - Validates request body using Zod schema
 *    - Checks required fields, types, formats, and custom validations
 *    - Throws 400 error if validation fails
 * 2. userController.createUser - Creates new user in database
 *
 * Request Body:
 * {
 *   name: string,
 *   email: string,
 *   password: string,
 *   role: 'user' | 'admin'
 * }
 *
 * Response:
 * Status: 201 Created
 * Body: { statusCode: 201, success: true, data: newUser }
 *
 * Errors:
 * - 400: Validation failed (missing fields, invalid formats, etc.)
 * - 400: Duplicate email already exists
 * - 500: Server error
 */
router.post(
  '/register',
  validateRequest(createUserZodSchema),
  userController.createUser,
);

/**
 * Update User Endpoint
 * HTTP Method: PATCH
 * Route: /api/v1/users/update/:id
 *
 * Parameters:
 * - :id (URL parameter) - MongoDB ObjectID of user to update
 *
 * Request Body: Partial user data with fields to update
 *
 * Response:
 * Status: 200 OK
 * Body: { statusCode: 200, success: true, data: updatedUser }
 *
 * TODO: Add authentication middleware to ensure user can only update their own profile
 * Currently no auth check - potential security issue!
 */
router.patch('/update/:id', userController.updateUser);

/**
 * Delete User Endpoint
 * HTTP Method: DELETE
 * Route: /api/v1/users/delete/:id
 *
 * Parameters:
 * - :id (URL parameter) - MongoDB ObjectID of user to delete
 *
 * Response:
 * Status: 200 OK
 * Body: { statusCode: 200, success: true, data: deletedUser }
 *
 * Note: Soft delete - user marked as deleted but not removed from database
 *
 * TODO: Add authentication middleware to protect this endpoint
 * Currently no auth check - only admin should be able to delete users!
 */
router.delete('/delete/:id', userController.deleteUser);

/**
 * Get User by ID Endpoint
 * HTTP Method: GET
 * Route: /api/v1/users/:id
 *
 * Parameters:
 * - :id (URL parameter) - MongoDB ObjectID of user to retrieve
 *
 * Response:
 * Status: 200 OK
 * Body: { statusCode: 200, success: true, data: user }
 *
 * TODO: Add authentication middleware
 * Currently no auth check - user data might be publicly exposed!
 */
router.get('/:id', userController.getUserById);

/**
 * Get All Users Endpoint
 * HTTP Method: GET
 * Route: /api/v1/users
 *
 * Middleware chain:
 * 1. checkAuth(Role.ADMIN, Role.SUPER_ADMIN) - Only admins and super admins can access
 *    - Verifies JWT token
 *    - Checks user has admin or super_admin role
 *    - Validates user account status (not blocked, not deleted)
 * 2. userController.getAllUser - Fetches all users
 *
 * Query Parameters: (Optional)
 * - page: Page number for pagination
 * - limit: Number of users per page
 * - search: Search term to filter users
 *
 * Response:
 * Status: 200 OK
 * Body: { statusCode: 200, success: true, data: users[] }
 *
 * Auth Errors:
 * - 401: No token provided
 * - 401: Token expired or invalid
 * - 403: User doesn't have admin role
 * - 400: User account is blocked/inactive/deleted
 */
router.get(
  '/',
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  userController.getAllUser,
);

// Export router for use in main routes
export const userRoutes = router;

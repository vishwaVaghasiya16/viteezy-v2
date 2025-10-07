import { Router } from 'express';
import { query, param, body } from 'express-validator';
import { userController } from '@/controllers/userController';
import { authenticate, authorize } from '@/middleware/auth';
import { validateRequest } from '@/middleware/validation';

const router = Router();

// Validation rules
const getUserByIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid user ID format')
];

const updateUserStatusValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid user ID format'),
  body('isActive')
    .isBoolean()
    .withMessage('isActive must be a boolean value')
];

const getAllUsersValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
  query('role')
    .optional()
    .isIn(['user', 'admin', 'moderator'])
    .withMessage('Role must be user, admin, or moderator'),
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value'),
  query('sort')
    .optional()
    .isIn(['name', 'email', 'createdAt', 'updatedAt'])
    .withMessage('Sort field must be name, email, createdAt, or updatedAt'),
  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Order must be asc or desc')
];

// Routes
router.get(
  '/',
  authenticate,
  authorize('admin', 'moderator'),
  getAllUsersValidation,
  validateRequest,
  userController.getAllUsers
);

router.get(
  '/stats',
  authenticate,
  authorize('admin'),
  userController.getUserStats
);

router.get(
  '/:id',
  authenticate,
  authorize('admin', 'moderator'),
  getUserByIdValidation,
  validateRequest,
  userController.getUserById
);

router.patch(
  '/:id/status',
  authenticate,
  authorize('admin'),
  updateUserStatusValidation,
  validateRequest,
  userController.updateUserStatus
);

router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  getUserByIdValidation,
  validateRequest,
  userController.deleteUser
);

export default router;

import { Router } from 'express';
import { query, param } from 'express-validator';
import { exampleController } from '@/controllers/exampleController';
import { validateRequest } from '@/middleware/validation';

const router = Router();

// Validation rules
const getErrorExampleValidation = [
  query('type')
    .optional()
    .isIn(['notfound', 'unauthorized', 'forbidden', 'validation', 'conflict', 'badrequest'])
    .withMessage('Invalid error type')
];

const deleteDataValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID must be a positive integer')
];

// Routes
router.get('/simple', exampleController.getSimpleData);

router.get('/paginated', exampleController.getPaginatedData);

router.post('/create', exampleController.createData);

router.get('/error', getErrorExampleValidation, validateRequest, exampleController.getErrorExample);

router.get('/complex', exampleController.getComplexData);

router.delete('/:id', deleteDataValidation, validateRequest, exampleController.deleteData);

export default router;

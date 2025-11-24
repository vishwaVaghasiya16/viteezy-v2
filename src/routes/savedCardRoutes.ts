import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import {
  validateJoi,
  validateQuery,
  validateParams,
} from "@/middleware/joiValidation";
import {
  createSavedCardSchema,
  updateSavedCardSchema,
  getCardDetailsParamsSchema,
  getSavedCardsQuerySchema,
} from "@/validation/savedCardValidation";
import { savedCardController } from "@/controllers/savedCardController";

const router = Router();

/**
 * All saved card routes require authentication
 */
router.use(authenticate);

/**
 * @route   POST /api/saved-cards
 * @desc    Save a new card
 * @access  Private
 */
router.post(
  "/",
  validateJoi(createSavedCardSchema),
  savedCardController.createSavedCard
);

/**
 * @route   GET /api/saved-cards
 * @desc    Get user's saved cards (Paginated)
 * @access  Private
 * @query   paymentMethod, isActive, page, limit
 */
router.get(
  "/",
  validateQuery(getSavedCardsQuerySchema),
  savedCardController.getSavedCards
);

/**
 * @route   GET /api/saved-cards/:cardId
 * @desc    Get saved card details by ID
 * @access  Private
 * @params  cardId
 */
router.get(
  "/:cardId",
  validateParams(getCardDetailsParamsSchema),
  savedCardController.getCardDetails
);

/**
 * @route   PUT /api/saved-cards/:cardId
 * @desc    Update saved card
 * @access  Private
 * @params  cardId
 */
router.put(
  "/:cardId",
  validateParams(getCardDetailsParamsSchema),
  validateJoi(updateSavedCardSchema),
  savedCardController.updateSavedCard
);

/**
 * @route   DELETE /api/saved-cards/:cardId
 * @desc    Delete saved card
 * @access  Private
 * @params  cardId
 */
router.delete(
  "/:cardId",
  validateParams(getCardDetailsParamsSchema),
  savedCardController.deleteSavedCard
);

export default router;

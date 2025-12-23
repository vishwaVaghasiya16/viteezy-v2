import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationOptions, getPaginationMeta } from "@/utils";
import { AppError } from "@/utils/AppError";
import { SavedCards } from "@/models/commerce";
import { Addresses } from "@/models/core";
import { logger } from "@/utils/logger";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    email?: string;
    name?: string;
  };
}

class SavedCardController {
  /**
   * Create a saved card
   * @route POST /api/saved-cards
   * @access Private
   */
  createSavedCard = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const {
        paymentMethod,
        last4,
        cardType,
        cardholderName,
        expiryMonth,
        expiryYear,
        gatewayToken,
        gatewayCustomerId,
        isDefault,
        billingAddressId,
        metadata,
      } = req.body;

      const userId = new mongoose.Types.ObjectId(req.user._id);

      // Validate expiry date is not in the past
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;

      if (
        expiryYear < currentYear ||
        (expiryYear === currentYear && expiryMonth < currentMonth)
      ) {
        throw new AppError("Card expiry date cannot be in the past", 400);
      }

      // Validate billing address if provided
      if (billingAddressId) {
        const billingAddress = await Addresses.findOne({
          _id: new mongoose.Types.ObjectId(billingAddressId),
          userId,
          isDeleted: false,
        }).lean();

        if (!billingAddress) {
          throw new AppError(
            "Billing address not found or does not belong to user",
            404
          );
        }
      }

      // Check if gateway token already exists (if provided)
      if (gatewayToken) {
        const existingCard = await SavedCards.findOne({
          gatewayToken,
          isDeleted: false,
        }).lean();

        if (existingCard) {
          throw new AppError("This card is already saved", 400);
        }
      }

      // Create saved card
      const savedCard = await SavedCards.create({
        userId,
        paymentMethod,
        last4,
        cardType,
        cardholderName: cardholderName?.trim(),
        expiryMonth,
        expiryYear,
        gatewayToken: gatewayToken?.trim(),
        gatewayCustomerId: gatewayCustomerId?.trim(),
        isDefault: isDefault || false,
        billingAddressId: billingAddressId
          ? new mongoose.Types.ObjectId(billingAddressId)
          : undefined,
        metadata: metadata || {},
      });

      logger.info(`Saved card created: ${savedCard._id} for user: ${userId}`);

      // Calculate virtual properties manually
      const maskedCardNumber = `**** **** **** ${savedCard.last4}`;
      const formattedExpiry = `${savedCard.expiryMonth
        .toString()
        .padStart(2, "0")}/${savedCard.expiryYear}`;
      const cardCheckDate = new Date();
      const cardCheckYear = cardCheckDate.getFullYear();
      const cardCheckMonth = cardCheckDate.getMonth() + 1;
      const isExpired =
        savedCard.expiryYear < cardCheckYear ||
        (savedCard.expiryYear === cardCheckYear &&
          savedCard.expiryMonth < cardCheckMonth);

      res.status(201).json({
        success: true,
        message: "Card saved successfully",
        data: {
          card: {
            id: savedCard._id,
            paymentMethod: savedCard.paymentMethod,
            maskedCardNumber,
            cardType: savedCard.cardType,
            cardholderName: savedCard.cardholderName,
            formattedExpiry,
            isDefault: savedCard.isDefault,
            isActive: savedCard.isActive,
            isExpired,
            billingAddressId: savedCard.billingAddressId,
            createdAt: savedCard.createdAt,
          },
        },
      });
    }
  );

  /**
   * Get user's saved cards
   * @route GET /api/saved-cards
   * @access Private
   */
  getSavedCards = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { paymentMethod, isActive } = req.query;
      const userId = new mongoose.Types.ObjectId(req.user._id);

      const paginationOptions = getPaginationOptions(req);
      const skip = (paginationOptions.page - 1) * paginationOptions.limit;

      // Build query
      const query: any = {
        userId,
        isDeleted: false,
      };

      if (paymentMethod) {
        query.paymentMethod = paymentMethod;
      }

      if (isActive !== undefined) {
        query.isActive = isActive === "true";
      }

      // Get saved cards
      const [cards, total] = await Promise.all([
        SavedCards.find(query)
          .populate("billingAddressId", "firstName lastName city country")
          .sort({ isDefault: -1, createdAt: -1 })
          .skip(skip)
          .limit(paginationOptions.limit)
          .lean(),
        SavedCards.countDocuments(query),
      ]);

      const paginationMeta = getPaginationMeta(
        paginationOptions.page,
        paginationOptions.limit,
        total
      );

      // Format response (exclude sensitive data)
      const formattedCards = cards.map((card: any) => ({
        id: card._id,
        paymentMethod: card.paymentMethod,
        maskedCardNumber: `**** **** **** ${card.last4}`,
        cardType: card.cardType,
        cardholderName: card.cardholderName,
        formattedExpiry: `${card.expiryMonth.toString().padStart(2, "0")}/${
          card.expiryYear
        }`,
        isDefault: card.isDefault,
        isActive: card.isActive,
        isExpired:
          card.expiryYear < new Date().getFullYear() ||
          (card.expiryYear === new Date().getFullYear() &&
            card.expiryMonth < new Date().getMonth() + 1),
        billingAddress: card.billingAddressId,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
      }));

      res.status(200).json({
        success: true,
        message: "Saved cards retrieved successfully",
        data: formattedCards,
        pagination: paginationMeta,
      });
    }
  );

  /**
   * Get saved card details
   * @route GET /api/saved-cards/:cardId
   * @access Private
   */
  getCardDetails = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { cardId } = req.params;
      const userId = new mongoose.Types.ObjectId(req.user._id);

      const card = await SavedCards.findOne({
        _id: new mongoose.Types.ObjectId(cardId),
        userId,
        isDeleted: false,
      })
        .populate("billingAddressId")
        .lean();

      if (!card) {
        throw new AppError("Card not found", 404);
      }

      res.status(200).json({
        success: true,
        message: "Card details retrieved successfully",
        data: {
          card: {
            id: card._id,
            paymentMethod: card.paymentMethod,
            maskedCardNumber: `**** **** **** ${card.last4}`,
            cardType: card.cardType,
            cardholderName: card.cardholderName,
            formattedExpiry: `${card.expiryMonth.toString().padStart(2, "0")}/${
              card.expiryYear
            }`,
            isDefault: card.isDefault,
            isActive: card.isActive,
            isExpired:
              card.expiryYear < new Date().getFullYear() ||
              (card.expiryYear === new Date().getFullYear() &&
                card.expiryMonth < new Date().getMonth() + 1),
            billingAddress: card.billingAddressId,
            createdAt: card.createdAt,
            updatedAt: card.updatedAt,
          },
        },
      });
    }
  );

  /**
   * Update saved card
   * @route PUT /api/saved-cards/:cardId
   * @access Private
   */
  updateSavedCard = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { cardId } = req.params;
      const {
        cardholderName,
        expiryMonth,
        expiryYear,
        isDefault,
        isActive,
        billingAddressId,
        metadata,
      } = req.body;

      const userId = new mongoose.Types.ObjectId(req.user._id);

      // Find card
      const card = await SavedCards.findOne({
        _id: new mongoose.Types.ObjectId(cardId),
        userId,
        isDeleted: false,
      });

      if (!card) {
        throw new AppError("Card not found", 404);
      }

      // Validate expiry date if provided
      if (expiryMonth !== undefined || expiryYear !== undefined) {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const finalExpiryMonth = expiryMonth ?? card.expiryMonth;
        const finalExpiryYear = expiryYear ?? card.expiryYear;

        if (
          finalExpiryYear < currentYear ||
          (finalExpiryYear === currentYear && finalExpiryMonth < currentMonth)
        ) {
          throw new AppError("Card expiry date cannot be in the past", 400);
        }
      }

      // Validate billing address if provided
      if (billingAddressId) {
        const billingAddress = await Addresses.findOne({
          _id: new mongoose.Types.ObjectId(billingAddressId),
          userId,
          isDeleted: false,
        }).lean();

        if (!billingAddress) {
          throw new AppError(
            "Billing address not found or does not belong to user",
            404
          );
        }
      }

      // Update card
      if (cardholderName !== undefined) {
        card.cardholderName = cardholderName?.trim();
      }
      if (expiryMonth !== undefined) {
        card.expiryMonth = expiryMonth;
      }
      if (expiryYear !== undefined) {
        card.expiryYear = expiryYear;
      }
      if (isDefault !== undefined) {
        card.isDefault = isDefault;
      }
      if (isActive !== undefined) {
        card.isActive = isActive;
      }
      if (billingAddressId !== undefined) {
        card.billingAddressId = billingAddressId
          ? new mongoose.Types.ObjectId(billingAddressId)
          : undefined;
      }
      if (metadata !== undefined) {
        card.metadata = { ...card.metadata, ...metadata };
      }

      await card.save();

      logger.info(`Saved card updated: ${cardId} for user: ${userId}`);

      // Calculate virtual properties manually
      const maskedCardNumber = `**** **** **** ${card.last4}`;
      const formattedExpiry = `${card.expiryMonth
        .toString()
        .padStart(2, "0")}/${card.expiryYear}`;
      const updateCheckDate = new Date();
      const updateCheckYear = updateCheckDate.getFullYear();
      const updateCheckMonth = updateCheckDate.getMonth() + 1;
      const isExpired =
        card.expiryYear < updateCheckYear ||
        (card.expiryYear === updateCheckYear &&
          card.expiryMonth < updateCheckMonth);

      res.status(200).json({
        success: true,
        message: "Card updated successfully",
        data: {
          card: {
            id: card._id,
            paymentMethod: card.paymentMethod,
            maskedCardNumber,
            cardType: card.cardType,
            cardholderName: card.cardholderName,
            formattedExpiry,
            isDefault: card.isDefault,
            isActive: card.isActive,
            isExpired,
            billingAddressId: card.billingAddressId,
            updatedAt: card.updatedAt,
          },
        },
      });
    }
  );

  /**
   * Delete saved card
   * @route DELETE /api/saved-cards/:cardId
   * @access Private
   */
  deleteSavedCard = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { cardId } = req.params;
      const userId = new mongoose.Types.ObjectId(req.user._id);

      const card = await SavedCards.findOne({
        _id: new mongoose.Types.ObjectId(cardId),
        userId,
        isDeleted: false,
      });

      if (!card) {
        throw new AppError("Card not found", 404);
      }

      // Soft delete - mark as deleted and inactive
      (card as any).isDeleted = true;
      card.isActive = false;
      await card.save();

      logger.info(`Saved card deleted: ${cardId} for user: ${userId}`);

      res.status(200).json({
        success: true,
        message: "Card deleted successfully",
        data: null,
      });
    }
  );
}

export const savedCardController = new SavedCardController();

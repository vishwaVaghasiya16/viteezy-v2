import { Router } from "express";
import { userController } from "@/controllers/userController";
import { authenticate } from "@/middleware/auth";
import { validateJoi } from "@/middleware/joiValidation";
import { updateCurrentUserSchema } from "@/validation/userValidation";
import {
  userImageUpload,
  handleProfileImageUploadError,
} from "@/middleware/profileImageUpload";

const router = Router();

/**
 * Get current authenticated user profile
 */
router.get("/me", authenticate, userController.getCurrentUser);

/**
 * Update current authenticated user profile
 * Supports multipart/form-data for profile image and avatar upload
 * @body {String} [firstName] - User first name
 * @body {String} [lastName] - User last name
 * @body {String} [phone] - Phone number
 * @body {String} [countryCode] - Country code (2 characters)
 * @body {File} [profileImage] - Profile image file (JPEG, PNG, GIF, WEBP, max 5MB)
 * @body {File} [avatar] - Avatar image file (JPEG, PNG, GIF, WEBP, max 5MB)
 * @body {String} [gender] - Gender (Male, Female, Other)
 * @body {Number} [age] - Age (1-150)
 * @body {String} [language] - Preferred language
 */
router.put(
  "/me",
  authenticate,
  handleProfileImageUploadError(
    userImageUpload.fields([
      { name: "profileImage", maxCount: 1 },
      { name: "avatar", maxCount: 1 },
    ])
  ),
  validateJoi(updateCurrentUserSchema),
  userController.updateCurrentUser
);

/**
 * Remove profile image
 * Deletes the profile image from cloud storage and removes it from user profile
 */
router.delete(
  "/me/profile-image",
  authenticate,
  userController.removeProfileImage
);

/**
 * Remove avatar
 * Deletes the avatar from cloud storage and removes it from user profile
 */
router.delete("/me/avatar", authenticate, userController.removeAvatar);

/**
 * Get transaction history for the logged-in user with optional filters
 * Query params: page, limit, sort, order, status, paymentMethod, search
 */
router.get(
  "/me/transactions",
  authenticate,
  userController.getTransactionHistory
);

/**
 * Register device token for push notifications
 * @route POST /api/v1/users/device-token
 * @access Private
 * @body {String} deviceToken - FCM/APNs device token
 * @body {String} [platform] - Platform (android/ios) - optional for tracking
 */
router.post(
  "/device-token",
  authenticate,
  userController.registerDeviceToken
);

/**
 * Remove device token for push notifications
 * @route DELETE /api/v1/users/device-token
 * @access Private
 * @body {String} deviceToken - FCM/APNs device token to remove
 */
router.delete(
  "/device-token",
  authenticate,
  userController.removeDeviceToken
);

export default router;

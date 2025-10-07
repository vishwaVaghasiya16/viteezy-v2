import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { validateAuth } from '../validation/authValidation';
import { 
  registerSchema, 
  loginSchema, 
  sendOTPSchema, 
  verifyOTPSchema, 
  resendOTPSchema, 
  forgotPasswordSchema, 
  resetPasswordSchema, 
  changePasswordSchema, 
  updateProfileSchema,
  refreshTokenSchema
} from '../validation/authValidation';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Public routes (no authentication required)
router.post('/register', validateAuth(registerSchema), AuthController.register);
router.post('/login', validateAuth(loginSchema), AuthController.login);
router.post('/refresh-token', validateAuth(refreshTokenSchema), AuthController.refreshToken);
router.post('/send-otp', validateAuth(sendOTPSchema), AuthController.sendOTP);
router.post('/verify-otp', validateAuth(verifyOTPSchema), AuthController.verifyOTP);
router.post('/resend-otp', validateAuth(resendOTPSchema), AuthController.resendOTP);
router.post('/forgot-password', validateAuth(forgotPasswordSchema), AuthController.forgotPassword);
router.post('/reset-password', validateAuth(resetPasswordSchema), AuthController.resetPassword);

// Protected routes (authentication required)
router.use(authMiddleware); // Apply auth middleware to all routes below

router.post('/change-password', validateAuth(changePasswordSchema), AuthController.changePassword);
router.post('/logout', AuthController.logout);
router.post('/logout-all-devices', AuthController.logoutAllDevices);
router.get('/profile', AuthController.getProfile);
router.put('/profile', validateAuth(updateProfileSchema), AuthController.updateProfile);

// Admin routes for OTP management
router.post('/cleanup-otps', AuthController.cleanupOTPs);
router.get('/otp-stats', AuthController.getOTPStats);

export default router;
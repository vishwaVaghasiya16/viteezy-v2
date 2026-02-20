import { Router } from "express";
import { validateJoi } from "@/middleware/joiValidation";
import { submitContactSchema, footerSubscribeSchema } from "@/validation/contactValidation";
import * as contactController from "@/controllers/contactController";

const router = Router();

/**
 * POST /api/v1/contact
 * Submit contact form (Ask us a question)
 * Body: { subject, name?, email, phone?, message, privacyAccepted: true }
 */
router.post("/", validateJoi(submitContactSchema), contactController.submitContact);

/**
 * POST /api/v1/contact/footer-subscribe
 * Footer email signup – store email and send welcome/promotional mail via SendGrid
 * Body: { email }
 */
router.post("/footer-subscribe", validateJoi(footerSubscribeSchema), contactController.footerSubscribe);

export default router;

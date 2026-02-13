import { Request, Response } from "express";
import { asyncHandler } from "@/utils";
import { contactService } from "@/services/contactService";
import { emailService } from "@/services/emailService";

/**
 * Public: Submit contact form (Ask us a question)
 * POST /api/v1/contact
 */
export const submitContact = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { subject, name, email, phone, message, privacyAccepted } = req.body;

  const inquiry = await contactService.submitContact({
    subject,
    name,
    email,
    phone,
    message,
    privacyAccepted,
  });

  // Send confirmation email to user (non-blocking)
  emailService.sendContactConfirmationEmail(email, name, subject).catch(() => {});

  res.apiSuccess(
    { inquiry: { _id: (inquiry as any)._id, subject, message: "Received" } },
    "Thank you for your message. We will get back to you soon."
  );
});

/**
 * Public: Footer email signup – store email and send welcome/promotional mail via SendGrid
 * POST /api/v1/contact/footer-subscribe
 */
export const footerSubscribe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  const result = await contactService.footerSubscribe(email);

  // Send welcome / ad email via SendGrid (only when newly subscribed)
  if (!result.alreadySubscribed) {
    emailService.sendFooterWelcomeEmail(email).catch(() => {});
  }

  res.apiSuccess(
    {
      subscribed: result.subscribed,
      message: result.alreadySubscribed
        ? "You are already subscribed."
        : "Thank you for subscribing. Check your inbox for a welcome email.",
    },
    result.alreadySubscribed ? "Already subscribed" : "Subscribed successfully"
  );
});

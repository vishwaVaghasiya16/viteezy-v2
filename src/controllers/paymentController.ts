import { Request, Response } from "express";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { logger } from "@/utils/logger";
import { paymentService } from "@/services/payment";
import { membershipService } from "@/services/membershipService";
import { PaymentMethod, PaymentStatus } from "@/models/enums";
import mongoose from "mongoose";
import { Payments } from "@/models/commerce/payments.model";

interface AuthenticatedRequest extends Request {
  user?: any;
  userId?: string;
}

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}
class PaymentController {
  /**
   * Get available payment methods
   */
  getAvailableMethods = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const countryCode =
        (req.query.country as string) ||
        (req.query.countryCode as string) ||
        (req.query.shippingCountry as string);
      const methods = paymentService.getAvailablePaymentMethods(
        countryCode?.toString()
      );

      res.apiSuccess(
        {
          methods,
          country: countryCode ? countryCode.toUpperCase() : undefined,
        },
        "Payment methods retrieved successfully"
      );
    }
  );

  /**
   * Create payment
   */
  createPayment = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const {
        orderId,
        paymentMethod,
        amount,
        description,
        metadata,
        returnUrl,
      } = req.body;

      const result = await paymentService.createPayment({
        orderId,
        userId,
        paymentMethod: paymentMethod as PaymentMethod,
        amount,
        description,
        metadata,
        returnUrl,
      });

      res.apiCreated(
        {
          payment: {
            _id: result.payment._id,
            orderId: result.payment.orderId,
            status: result.payment.status,
            amount: result.payment.amount,
            paymentMethod: result.payment.paymentMethod,
          },
          gateway: {
            redirectUrl: result.result.redirectUrl,
            clientSecret: result.result.clientSecret,
            gatewayTransactionId: result.result.gatewayTransactionId,
            sessionId: result.result.sessionId,
          },
        },
        "Payment created successfully"
      );
    }
  );

  /**
   * Verify payment
   */
  verifyPayment = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { paymentId, gatewayTransactionId } = req.body;

      const payment = await paymentService.verifyPayment(
        paymentId,
        gatewayTransactionId
      );

      res.apiSuccess(
        {
          payment: {
            _id: payment._id,
            orderId: payment.orderId,
            status: payment.status,
            amount: payment.amount,
            paymentMethod: payment.paymentMethod,
          },
        },
        "Payment verified successfully"
      );
    }
  );

  /**
   * Create payment intent for product checkout (order-based)
   */
  createPaymentIntent = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const { orderId, paymentMethod, returnUrl, cancelUrl } = req.body;

      const result = await paymentService.createPaymentIntentForOrder({
        orderId,
        userId,
        paymentMethod: paymentMethod as PaymentMethod,
        returnUrl,
        cancelUrl,
      });

      res.apiCreated(
        {
          payment: {
            _id: result.payment._id,
            orderId: result.payment.orderId,
            status: result.payment.status,
            amount: result.payment.amount,
            paymentMethod: result.payment.paymentMethod,
            gatewayTransactionId: result.payment.gatewayTransactionId,
          },
          order: {
            _id: result.order._id,
            orderNumber: result.order.orderNumber,
            status: result.order.status,
            paymentStatus: result.order.paymentStatus,
            total: {
              amount: result.order.grandTotal,
              currency: result.order.currency,
            },
          },
          gateway: {
            redirectUrl: result.result.redirectUrl,
            clientSecret: result.result.clientSecret,
            gatewayTransactionId: result.result.gatewayTransactionId,
            sessionId: result.result.sessionId,
          },
        },
        "Payment intent created successfully"
      );
    }
  );

  /**
   * Verify payment and update order status (Frontend Callback)
   */
  verifyPaymentCallback = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const { paymentId, gatewayTransactionId } = req.body;

      const result = await paymentService.verifyPaymentAndUpdateOrder({
        paymentId,
        gatewayTransactionId,
      });

      // Verify payment belongs to user
      if (result.payment.userId.toString() !== userId) {
        throw new AppError("Payment does not belong to user", 403);
      }

      // Verify order belongs to user
      if (result.order.userId.toString() !== userId) {
        throw new AppError("Order does not belong to user", 403);
      }

      res.apiSuccess(
        {
          payment: {
            _id: result.payment._id,
            orderId: result.payment.orderId,
            status: result.payment.status,
            amount: result.payment.amount,
            paymentMethod: result.payment.paymentMethod,
            gatewayTransactionId: result.payment.gatewayTransactionId,
          },
          order: {
            _id: result.order._id,
            orderNumber: result.order.orderNumber,
            status: result.order.status,
            paymentStatus: result.order.paymentStatus,
            total: {
              amount: result.order.grandTotal,
              currency: result.order.currency,
            },
          },
          updated: result.updated,
        },
        result.updated
          ? "Payment verified and order updated successfully"
          : "Payment verified successfully"
      );
    }
  );

  /**
   * Process Stripe webhook
   */
  processStripeWebhook = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      console.log("🔵 [WEBHOOK] ========== Stripe Webhook Received ==========");
      console.log("🔵 [WEBHOOK] Timestamp:", new Date().toISOString());

      try {
        const signature = req.headers["stripe-signature"] as string;
        const payload = req.body;
        const rawBody = (req as RawBodyRequest).rawBody;

        console.log("🔵 [WEBHOOK] Step 1: Request received");
        console.log("🔵 [WEBHOOK] - Has Signature:", !!signature);
        console.log("🔵 [WEBHOOK] - Has Raw Body:", !!rawBody);
        console.log("🔵 [WEBHOOK] - Has Payload:", !!payload);
        console.log("🔵 [WEBHOOK] - Event Type:", payload?.type);
        console.log("🔵 [WEBHOOK] - Event ID:", payload?.id);

        logger.info("Stripe webhook received", {
          hasSignature: !!signature,
          hasRawBody: !!rawBody,
          hasPayload: !!payload,
          eventType: payload?.type,
          eventId: payload?.id,
        });

        if (!rawBody) {
          console.error("❌ [WEBHOOK] ERROR: Raw body is missing!");
          logger.error("Stripe webhook: rawBody is missing");
          throw new AppError(
            "Raw body is required for webhook verification",
            400
          );
        }

        console.log(
          "🔵 [WEBHOOK] Step 2: Calling paymentService.processWebhook"
        );
        const payment = await paymentService.processWebhook(
          PaymentMethod.STRIPE,
          payload,
          signature,
          rawBody
        );

        console.log("✅ [WEBHOOK] Step 3: Webhook processed successfully");
        console.log("✅ [WEBHOOK] - Payment ID:", payment._id);
        console.log("✅ [WEBHOOK] - Payment Status:", payment.status);
        console.log("✅ [WEBHOOK] - Order ID:", payment.orderId);
        console.log(
          "✅ [WEBHOOK] ============================================"
        );

        logger.info("Stripe webhook processed successfully", {
          paymentId: payment._id,
          status: payment.status,
          orderId: payment.orderId,
        });

        // Use standard Express response (webhook routes are before responseMiddleware)
        res.status(200).json({
          success: true,
          message: "Webhook processed successfully",
          data: {
            payment: {
              _id: payment._id,
              status: payment.status,
            },
          },
        });
      } catch (error) {
        console.error("❌ [WEBHOOK] ========== ERROR ==========");
        console.error(
          "❌ [WEBHOOK] Error Message:",
          error instanceof Error ? error.message : "Unknown error"
        );
        console.error(
          "❌ [WEBHOOK] Error Stack:",
          error instanceof Error ? error.stack : undefined
        );
        console.error("❌ [WEBHOOK] ==========================");

        logger.error("Stripe webhook processing error:", {
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
          signature: req.headers["stripe-signature"] ? "present" : "missing",
          hasRawBody: !!(req as RawBodyRequest).rawBody,
        });
        // Still return 200 to prevent webhook retries
        res.status(200).json({
          success: false,
          message: "Webhook processing failed",
          errorType: "Webhook Error",
          error: error instanceof Error ? error.message : "Unknown error",
          data: null,
        });
      }
    }
  );

  /**
   * Process Mollie webhook
   */
  processMollieWebhook = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      console.log("🔵 [WEBHOOK] ========== Mollie Webhook Received ==========");
      console.log("🔵 [WEBHOOK] Timestamp:", new Date().toISOString());

      try {
        const payload = req.body || {};
        // Mollie sends payment ID in query parameters as 'id'
        const queryPaymentId = (req.query.id || req.query.payment_id) as string;

        // Also check URL path for payment ID (Mollie sometimes includes it in the path)
        const urlPath = req.url || req.originalUrl || "";
        const urlPaymentIdMatch = urlPath.match(/[\/](tr_[a-zA-Z0-9]+)/);
        const urlPaymentId = urlPaymentIdMatch ? urlPaymentIdMatch[1] : null;

        console.log("🔵 [WEBHOOK] Step 1: Request received");
        console.log("🔵 [WEBHOOK] - Method:", req.method);
        console.log("🔵 [WEBHOOK] - URL:", req.url);
        console.log("🔵 [WEBHOOK] - Original URL:", req.originalUrl);
        console.log("🔵 [WEBHOOK] - Query params:", req.query);
        console.log(
          "🔵 [WEBHOOK] - Has Payload:",
          !!payload && Object.keys(payload).length > 0
        );
        console.log("🔵 [WEBHOOK] - Query Payment ID:", queryPaymentId);
        console.log("🔵 [WEBHOOK] - URL Payment ID:", urlPaymentId);
        console.log(
          "🔵 [WEBHOOK] - Payment ID from payload:",
          payload?.id || payload?.paymentId
        );

        // Check if this is a test webhook (Mollie sends test webhooks as arrays)
        if (
          Array.isArray(payload) &&
          payload.length > 0 &&
          typeof payload[0] === "string"
        ) {
          console.log("ℹ️ [WEBHOOK] - Test webhook detected, acknowledging");
          logger.info("Mollie test webhook received and acknowledged", {
            testMessage: payload[0],
          });
          res.status(200).json({
            success: true,
            message: "Test webhook acknowledged",
            data: { test: true },
          });
          return;
        }

        // Build final payload with payment ID from any available source
        const finalPayload = { ...payload };

        // Priority: payload.id > query.id > url path > payload.paymentId
        if (!finalPayload.id) {
          if (queryPaymentId) {
            finalPayload.id = queryPaymentId;
            console.log(
              "ℹ️ [WEBHOOK] - Using payment ID from query parameter:",
              queryPaymentId
            );
          } else if (urlPaymentId) {
            finalPayload.id = urlPaymentId;
            console.log(
              "ℹ️ [WEBHOOK] - Using payment ID from URL path:",
              urlPaymentId
            );
          } else if (payload.paymentId) {
            finalPayload.id = payload.paymentId;
            console.log(
              "ℹ️ [WEBHOOK] - Using payment ID from payload.paymentId:",
              payload.paymentId
            );
          }
        }

        const extractedPaymentId =
          finalPayload.id ||
          finalPayload.paymentId ||
          queryPaymentId ||
          urlPaymentId;

        if (!extractedPaymentId) {
          console.error("❌ [WEBHOOK] - No payment ID found in webhook");
          console.error(
            "❌ [WEBHOOK] - Payload:",
            JSON.stringify(payload, null, 2)
          );
          console.error("❌ [WEBHOOK] - Query:", req.query);
          // Still acknowledge to prevent retries
          res.status(200).json({
            success: true,
            message: "Webhook received but no payment ID found",
            data: { acknowledged: true },
          });
          return;
        }

        logger.info("Mollie webhook received", {
          hasPayload: !!payload,
          paymentId:
            finalPayload?.id || finalPayload?.paymentId || queryPaymentId,
        });

        console.log(
          "🔵 [WEBHOOK] Step 2: Calling paymentService.processWebhook"
        );
        const payment = await paymentService.processWebhook(
          PaymentMethod.MOLLIE,
          finalPayload
        );

        // Check if this was a test webhook or unhandled event
        if (payment && payment._id === "unhandled_event") {
          console.log(
            "ℹ️ [WEBHOOK] - Unhandled event or test webhook acknowledged"
          );
          res.status(200).json({
            success: true,
            message: "Webhook acknowledged (test or unhandled event)",
            data: { acknowledged: true },
          });
          return;
        }

        console.log("✅ [WEBHOOK] Step 3: Webhook processed successfully");
        console.log("✅ [WEBHOOK] - Payment ID:", payment._id);
        console.log("✅ [WEBHOOK] - Payment Status:", payment.status);
        console.log("✅ [WEBHOOK] - Order ID:", payment.orderId);
        console.log(
          "✅ [WEBHOOK] ============================================"
        );

        logger.info("Mollie webhook processed successfully", {
          paymentId: payment._id,
          status: payment.status,
          orderId: payment.orderId,
        });

        // Use standard Express response (webhook routes are before responseMiddleware)
        res.status(200).json({
          success: true,
          message: "Webhook processed successfully",
          data: {
            payment: {
              _id: payment._id,
              status: payment.status,
            },
          },
        });
      } catch (error) {
        console.error("❌ [WEBHOOK] ========== ERROR ==========");
        console.error(
          "❌ [WEBHOOK] Error Message:",
          error instanceof Error ? error.message : "Unknown error"
        );
        console.error(
          "❌ [WEBHOOK] Error Stack:",
          error instanceof Error ? error.stack : undefined
        );
        console.error("❌ [WEBHOOK] ==========================");

        logger.error("Mollie webhook processing error:", {
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        });
        // Still return 200 to prevent webhook retries
        res.status(200).json({
          success: false,
          message: "Webhook processing failed",
          errorType: "Webhook Error",
          error: error instanceof Error ? error.message : "Unknown error",
          data: null,
        });
      }
    }
  );

  /**
   * Handle payment return/callback from payment gateway
   * This is called when user is redirected back from payment gateway
   */
  handlePaymentReturn = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      try {
        console.log(
          "🟢 [PAYMENT RETURN] ========== Payment Return Handler =========="
        );
        console.log("🟢 [PAYMENT RETURN] Query params:", req.query);
        console.log("🟢 [PAYMENT RETURN] URL:", req.url);

        // Mollie sends payment ID as 'id' query parameter
        // Also check for payment_id, paymentId for compatibility
        const molliePaymentId =
          (req.query.id as string) ||
          (req.query.payment_id as string) ||
          (req.query.paymentId as string);

        // Get orderId and userId from query params (we include these in redirect URL)
        const orderId = (req.query.orderId || req.query.order_id) as string;
        const userId = (req.query.userId || req.query.user_id) as string;
        const membershipIdParam = (req.query.membershipId ||
          req.query.membership_id) as string;

        console.log(
          "🟢 [PAYMENT RETURN] - Mollie Payment ID (id param):",
          molliePaymentId
        );
        console.log("🟢 [PAYMENT RETURN] - Order ID:", orderId);
        console.log("🟢 [PAYMENT RETURN] - User ID:", userId);
        console.log("🟢 [PAYMENT RETURN] - Membership ID:", membershipIdParam);

        // If no Mollie payment ID, try to find payment by orderId and userId
        let payment;
        if (!molliePaymentId) {
          console.warn(
            "⚠️ [PAYMENT RETURN] - Mollie payment ID not found in query"
          );
          console.warn(
            "⚠️ [PAYMENT RETURN] - Trying to find payment by orderId/membershipId and userId"
          );

          const orderObjectId =
            orderId && mongoose.Types.ObjectId.isValid(orderId)
              ? new mongoose.Types.ObjectId(orderId)
              : null;
          const userObjectId =
            userId && mongoose.Types.ObjectId.isValid(userId)
              ? new mongoose.Types.ObjectId(userId)
              : null;

          if (orderObjectId && userObjectId) {
            try {
              // Find most recent payment for this order and user
              const foundPayment = await Payments.findOne({
                orderId: orderObjectId,
                userId: userObjectId,
                paymentMethod: PaymentMethod.MOLLIE,
              })
                .sort({ createdAt: -1 })
                .exec();

              if (foundPayment) {
                console.log(
                  "✅ [PAYMENT RETURN] - Payment found by orderId/userId:",
                  foundPayment._id
                );
                payment = foundPayment;
              }
            } catch (error) {
              console.error(
                "❌ [PAYMENT RETURN] - Error finding payment by orderId/userId:",
                error
              );
            }
          }

          // If still not found, try membership payments (orderId can actually be membershipId for membership purchases)
          const membershipLookupId = membershipIdParam || orderId || undefined;
          const membershipObjectId =
            membershipLookupId &&
            mongoose.Types.ObjectId.isValid(membershipLookupId)
              ? new mongoose.Types.ObjectId(membershipLookupId)
              : null;

          if (!payment && membershipObjectId) {
            try {
              const membershipPayment = await Payments.findOne({
                membershipId: membershipObjectId,
                ...(userObjectId ? { userId: userObjectId } : {}),
                paymentMethod: PaymentMethod.MOLLIE,
              })
                .sort({ createdAt: -1 })
                .exec();

              if (membershipPayment) {
                console.log(
                  "✅ [PAYMENT RETURN] - Payment found by membershipId:",
                  membershipPayment._id
                );
                payment = membershipPayment;
              }
            } catch (error) {
              console.error(
                "❌ [PAYMENT RETURN] - Error finding payment by membershipId:",
                error
              );
            }
          }

          if (!payment) {
            console.error(
              "❌ [PAYMENT RETURN] - Payment ID not found and cannot find payment by orderId/membershipId"
            );
            console.error(
              "❌ [PAYMENT RETURN] - Available query params:",
              Object.keys(req.query)
            );
            const frontendUrl =
              process.env.FRONTEND_URL || "http://localhost:3000";
            return res.redirect(
              `${frontendUrl}/payment/failed?error=Payment ID not found`
            );
          }
        }

        // If we don't have payment yet, find it by gateway transaction ID
        if (!payment && molliePaymentId) {
          try {
            console.log(
              "🟢 [PAYMENT RETURN] - Looking up payment with gateway ID:",
              molliePaymentId
            );
            payment = await paymentService.getPaymentByGatewayTransactionId(
              molliePaymentId,
              PaymentMethod.MOLLIE
            );
            console.log("✅ [PAYMENT RETURN] - Payment found:", payment._id);
          } catch (error) {
            console.error(
              "❌ [PAYMENT RETURN] - Payment lookup failed:",
              error
            );
            logger.warn(
              `Payment not found for gateway transaction: ${molliePaymentId}`,
              error
            );
            const frontendUrl =
              process.env.FRONTEND_URL || "http://localhost:3000";
            return res.redirect(
              `${frontendUrl}/payment/failed?error=Payment not found for ID: ${molliePaymentId}`
            );
          }
        }

        // Verify payment status with gateway
        // This ensures database is updated even if webhook didn't fire
        console.log(
          "🟢 [PAYMENT RETURN] - Verifying payment status with Mollie"
        );
        const gatewayIdToVerify =
          molliePaymentId || payment?.gatewayTransactionId;
        if (!gatewayIdToVerify) {
          console.error(
            "❌ [PAYMENT RETURN] - No gateway ID available for verification"
          );
          const frontendUrl =
            process.env.FRONTEND_URL || "http://localhost:3000";
          return res.redirect(
            `${frontendUrl}/payment/failed?error=Payment gateway ID not found`
          );
        }

        // Use appropriate verification flow based on payment type (order vs membership)
        console.log(
          "🟢 [PAYMENT RETURN] - Verifying payment and updating entity"
        );
        let verifiedPayment;
        const isMembershipPayment = !!payment.membershipId;

        try {
          if (isMembershipPayment) {
            verifiedPayment = await paymentService.verifyPayment(
              payment._id.toString(),
              gatewayIdToVerify
            );
            console.log("✅ [PAYMENT RETURN] - Membership payment verified");
            console.log(
              "✅ [PAYMENT RETURN] - Status:",
              verifiedPayment.status
            );

            if (verifiedPayment.status === PaymentStatus.COMPLETED) {
              try {
                await membershipService.activateMembership(
                  verifiedPayment.membershipId?.toString() ||
                    payment.membershipId?.toString(),
                  payment._id.toString()
                );
                console.log(
                  "✅ [PAYMENT RETURN] - Membership activated successfully"
                );
              } catch (membershipError) {
                console.error(
                  "❌ [PAYMENT RETURN] - Failed to activate membership:",
                  membershipError
                );
              }
            }
          } else {
            const verifyResult =
              await paymentService.verifyPaymentAndUpdateOrder({
                paymentId: payment._id.toString(),
                gatewayTransactionId: gatewayIdToVerify,
              });
            verifiedPayment = verifyResult.payment;
            console.log("✅ [PAYMENT RETURN] - Payment verified");
            console.log(
              "✅ [PAYMENT RETURN] - Status:",
              verifiedPayment.status
            );
            console.log(
              "✅ [PAYMENT RETURN] - Order updated:",
              verifyResult.updated
            );
            if (verifyResult.updated) {
              console.log(
                "✅ [PAYMENT RETURN] - Order paymentStatus:",
                verifyResult.order.paymentStatus
              );
              console.log(
                "✅ [PAYMENT RETURN] - Order status:",
                verifyResult.order.status
              );
            }
          }
        } catch (verifyError) {
          console.error(
            "❌ [PAYMENT RETURN] - Verification failed:",
            verifyError
          );
          // Fallback to just verify payment if downstream update fails
          verifiedPayment = await paymentService.verifyPayment(
            payment._id.toString(),
            gatewayIdToVerify
          );
          console.warn(
            "⚠️ [PAYMENT RETURN] - Used fallback verification (entity may not be updated)"
          );
        }

        // Determine redirect URL based on payment type
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        let redirectUrl = `${frontendUrl}/payment/return`;

        const resolvedMembershipId =
          membershipIdParam ||
          orderId ||
          payment.membershipId?.toString() ||
          null;

        if (verifiedPayment.status === PaymentStatus.COMPLETED) {
          if (resolvedMembershipId || payment.membershipId) {
            redirectUrl = `${frontendUrl}/membership/success?paymentId=${payment._id}`;
          } else if (orderId || payment.orderId) {
            redirectUrl = `${frontendUrl}/order/success?paymentId=${
              payment._id
            }&orderId=${orderId || payment.orderId}`;
          } else {
            redirectUrl = `${frontendUrl}/payment/success?paymentId=${payment._id}`;
          }
        } else if (verifiedPayment.status === PaymentStatus.FAILED) {
          redirectUrl = `${frontendUrl}/payment/failed?paymentId=${
            payment._id
          }&error=${verifiedPayment.failureReason || "Payment failed"}`;
        } else {
          redirectUrl = `${frontendUrl}/payment/pending?paymentId=${payment._id}`;
        }

        logger.info(
          `Payment return handled: ${payment._id}, status: ${verifiedPayment.status}, redirecting to: ${redirectUrl}`
        );

        res.redirect(redirectUrl);
      } catch (error) {
        logger.error("Payment return handling error:", error);
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        res.redirect(
          `${frontendUrl}/payment/failed?error=${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }
  );

  /**
   * Refund payment
   */
  refundPayment = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { paymentId, amount, reason, metadata } = req.body;

      const payment = await paymentService.refundPayment({
        paymentId,
        amount,
        reason,
        metadata,
      });

      res.apiSuccess(
        {
          payment: {
            _id: payment._id,
            status: payment.status,
            refundAmount: payment.refundAmount,
            refundReason: payment.refundReason,
          },
        },
        "Refund processed successfully"
      );
    }
  );

  /**
   * Cancel payment
   */
  cancelPayment = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { paymentId } = req.body;

      const payment = await paymentService.cancelPayment(paymentId);

      res.apiSuccess(
        {
          payment: {
            _id: payment._id,
            status: payment.status,
          },
        },
        "Payment cancelled successfully"
      );
    }
  );

  /**
   * Get payment by ID
   */
  getPayment = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { paymentId } = req.params;

      const payment = await paymentService.getPayment(paymentId);

      res.apiSuccess(
        {
          payment,
        },
        "Payment retrieved successfully"
      );
    }
  );

  /**
   * Get payments by order
   */
  getPaymentsByOrder = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { orderId } = req.params;

      const payments = await paymentService.getPaymentsByOrder(orderId);

      res.apiSuccess(
        {
          payments,
        },
        "Payments retrieved successfully"
      );
    }
  );

  /**
   * Get payments by user
   */
  getPaymentsByUser = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const payments = await paymentService.getPaymentsByUser(userId);

      res.apiSuccess(
        {
          payments,
        },
        "Payments retrieved successfully"
      );
    }
  );

  /**
   * Track payment status (Public API for Mobile App)
   * @route GET /api/v1/payments/track
   * @access Public
   * @query orderId or membershipId (one is required)
   */
  trackPaymentStatus = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { orderId, membershipId } = req.query;

      // Validate that at least one ID is provided
      if (!orderId && !membershipId) {
        throw new AppError(
          "Either orderId or membershipId is required in query parameters",
          400
        );
      }

      console.log("🔍 [PAYMENT TRACKING] Tracking payment");
      console.log("  - orderId:", orderId || "not provided");
      console.log("  - membershipId:", membershipId || "not provided");

      let payment = null;
      let referenceType = null;
      let referenceDetails: any = null;

      // 1. Try to find by order ID
      if (orderId) {
        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(orderId as string)) {
          throw new AppError("Invalid orderId format", 400);
        }

        const orderObjectId = new mongoose.Types.ObjectId(orderId as string);

        payment = await Payments.findOne({ orderId: orderObjectId })
          .populate("orderId")
          .populate("membershipId")
          .lean();

        if (payment) {
          referenceType = "order";
          console.log("✅ [PAYMENT TRACKING] Found by order ID");
        }
      }

      // 2. Try to find by membership ID
      if (!payment && membershipId) {
        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(membershipId as string)) {
          throw new AppError("Invalid membershipId format", 400);
        }

        const membershipObjectId = new mongoose.Types.ObjectId(
          membershipId as string
        );

        payment = await Payments.findOne({ membershipId: membershipObjectId })
          .populate("orderId")
          .populate("membershipId")
          .lean();

        if (payment) {
          referenceType = "membership";
          console.log("✅ [PAYMENT TRACKING] Found by membership ID");
        }
      }

      if (!payment) {
        throw new AppError(
          "Payment not found for the provided orderId or membershipId",
          404
        );
      }

      // Extract reference details
      if (payment.orderId) {
        const order = payment.orderId as any;
        referenceDetails = {
          type: "order",
          orderNumber: order.orderNumber,
          orderId: order._id,
          orderStatus: order.status,
          paymentStatus: order.paymentStatus,
          grandTotal: order.grandTotal,
          currency: order.currency,
          items: order.items?.length || 0,
          isOneTime: order.isOneTime,
          planType: order.planType,
          variantType: order.variantType,
          selectedPlanDays: order.selectedPlanDays,
        };
      } else if (payment.membershipId) {
        const membership = payment.membershipId as any;
        referenceDetails = {
          type: "membership",
          membershipId: membership._id,
          membershipStatus: membership.status,
          planName: membership.planName,
          planPrice: membership.planPrice,
          startDate: membership.startDate,
          endDate: membership.endDate,
        };
      } else {
        referenceDetails = {
          type: "payment",
          paymentId: payment._id,
        };
      }

      // Build response
      const response = {
        paymentId: payment._id,
        paymentStatus: payment.status,
        paymentMethod: payment.paymentMethod,
        amount: payment.amount?.amount || 0,
        currency: payment.currency || payment.amount?.currency || "EUR",
        gatewayTransactionId: payment.gatewayTransactionId,
        processedAt: payment.processedAt,
        createdAt: payment.createdAt,
        reference: referenceDetails,
        // Status flags for easy mobile app handling
        isPending: payment.status === PaymentStatus.PENDING,
        isCompleted: payment.status === PaymentStatus.COMPLETED,
        isFailed: payment.status === PaymentStatus.FAILED,
        isCancelled: payment.status === PaymentStatus.CANCELLED,
        isRefunded: payment.status === PaymentStatus.REFUNDED,
      };

      console.log("✅ [PAYMENT TRACKING] Payment status:", payment.status);

      res.apiSuccess(response, "Payment status retrieved successfully");
    }
  );
}

export const paymentController = new PaymentController();

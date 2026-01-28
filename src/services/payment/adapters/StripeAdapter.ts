import Stripe from "stripe";
import {
  IPaymentGateway,
  PaymentIntentData,
  PaymentResult,
  RefundData,
  RefundResult,
  PaymentLineItem,
} from "../interfaces/IPaymentGateway";
import { PaymentMethod, PaymentStatus } from "../../../models/enums";
import { logger } from "../../../utils/logger";
import { AppError } from "../../../utils/AppError";

export class StripeAdapter implements IPaymentGateway {
  private stripe: Stripe;
  private webhookSecret: string;
  private defaultSuccessUrl: string;
  private defaultCancelUrl: string;

  constructor() {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new AppError("STRIPE_SECRET_KEY is required", 500);
    }

    this.stripe = new Stripe(apiKey, {
      apiVersion: "2025-10-29.clover",
    });

    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8080";
    this.defaultSuccessUrl = `${frontendUrl}/orderConfirmed/success`;
    this.defaultCancelUrl = `${frontendUrl}/orderConfirmed/cancel`;

    logger.info("Stripe payment gateway initialized");
  }

  getPaymentMethod(): PaymentMethod {
    return PaymentMethod.STRIPE;
  }

  async createPaymentIntent(data: PaymentIntentData): Promise<PaymentResult> {
    try {
      // Check if this is a membership payment (has membershipId in metadata)
      const isMembershipPayment = !!data.metadata?.membershipId;

      const session = await this.stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        billing_address_collection: "required",
        customer_email: data.customerEmail,
        line_items: this.buildLineItems(data),
        success_url: this.buildSuccessUrl(
          data.returnUrl,
          data.orderId,
          isMembershipPayment
        ),
        cancel_url: this.buildCancelUrl(
          data.cancelUrl,
          data.orderId,
          isMembershipPayment
        ),
        client_reference_id: data.orderId,
        metadata: {
          orderId: data.orderId,
          userId: data.userId,
          ...data.metadata,
        },
        payment_intent_data: {
          metadata: {
            orderId: data.orderId,
            userId: data.userId,
            ...data.metadata,
          },
        },
      });

      return {
        success: true,
        paymentId: session.id,
        gatewayTransactionId: session.id,
        sessionId: session.id,
        status: PaymentStatus.PENDING,
        redirectUrl: session.url || undefined,
        gatewayResponse: session as any,
      };
    } catch (error: any) {
      logger.error("Stripe payment intent creation failed:", error);
      return {
        success: false,
        status: PaymentStatus.FAILED,
        error: error.message || "Failed to create payment intent",
        gatewayResponse: error as any,
      };
    }
  }

  async verifyPayment(gatewayTransactionId: string): Promise<PaymentResult> {
    try {
      let session: Stripe.Checkout.Session | null = null;
      let paymentIntentId = gatewayTransactionId;

      if (this.isCheckoutSessionId(gatewayTransactionId)) {
        session = await this.stripe.checkout.sessions.retrieve(
          gatewayTransactionId
        );
        const extracted = this.extractPaymentIntentId(session.payment_intent);
        paymentIntentId = extracted || "";
      }

      if (!paymentIntentId) {
        throw new AppError("Payment intent not found for transaction", 404);
      }

      const paymentIntent = await this.stripe.paymentIntents.retrieve(
        paymentIntentId
      );

      return {
        success: paymentIntent.status === "succeeded",
        paymentId: paymentIntent.id,
        gatewayTransactionId: paymentIntent.id,
        sessionId: session?.id,
        status: this.mapStripeStatusToPaymentStatus(paymentIntent.status),
        gatewayResponse: {
          paymentIntent,
          checkoutSession: session || undefined,
        } as any,
      };
    } catch (error: any) {
      logger.error("Stripe payment verification failed:", error);
      return {
        success: false,
        status: PaymentStatus.FAILED,
        error: error.message || "Failed to verify payment",
        gatewayResponse: error as any,
      };
    }
  }

  async processWebhook(
    payload: any,
    signature?: string,
    rawBody?: Buffer | string
  ): Promise<PaymentResult> {
    try {
      let event: Stripe.Event;

      if (signature && this.webhookSecret) {
        if (!rawBody) {
          logger.error(
            "Stripe webhook: rawBody is required for signature verification"
          );
          throw new AppError(
            "Raw body is required for webhook verification",
            400
          );
        }

        const bodyToVerify = Buffer.isBuffer(rawBody)
          ? rawBody
          : typeof rawBody === "string"
          ? rawBody
          : JSON.stringify(payload);

        logger.debug("Verifying Stripe webhook signature", {
          hasSignature: !!signature,
          hasWebhookSecret: !!this.webhookSecret,
          bodyLength: Buffer.isBuffer(bodyToVerify)
            ? bodyToVerify.length
            : bodyToVerify.length,
        });

        // Verify webhook signature
        event = this.stripe.webhooks.constructEvent(
          bodyToVerify,
          signature,
          this.webhookSecret
        );

        logger.info("Stripe webhook signature verified", {
          eventType: event.type,
          eventId: event.id,
        });
      } else {
        // For testing without signature verification
        if (!signature) {
          logger.warn("Stripe webhook: No signature provided");
        }
        if (!this.webhookSecret) {
          logger.warn("Stripe webhook: STRIPE_WEBHOOK_SECRET not configured");
        }
        event = payload as Stripe.Event;
        logger.warn("Processing webhook without signature verification");
      }

      console.log(
        "🟡 [STRIPE ADAPTER] Step 3: Processing event type:",
        event.type
      );

      switch (event.type) {
        case "checkout.session.completed": {
          console.log(
            "🟡 [STRIPE ADAPTER] - Handling checkout.session.completed"
          );
          const session = event.data.object as Stripe.Checkout.Session;
          const paymentIntentId = this.extractPaymentIntentId(
            session.payment_intent
          );

          console.log("🟡 [STRIPE ADAPTER] - Session ID:", session.id);
          console.log(
            "🟡 [STRIPE ADAPTER] - Payment Intent ID:",
            paymentIntentId
          );
          console.log(
            "🟡 [STRIPE ADAPTER] - Payment Status:",
            session.payment_status
          );

          const result = {
            success: session.payment_status === "paid",
            paymentId: paymentIntentId || undefined,
            gatewayTransactionId: paymentIntentId || session.id,
            sessionId: session.id,
            status:
              session.payment_status === "paid"
                ? PaymentStatus.COMPLETED
                : PaymentStatus.PROCESSING,
            gatewayResponse: session as any,
          };

          console.log("✅ [STRIPE ADAPTER] - Result Status:", result.status);
          return result;
        }
        case "payment_intent.succeeded": {
          console.log(
            "🟡 [STRIPE ADAPTER] - Handling payment_intent.succeeded"
          );
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          console.log(
            "🟡 [STRIPE ADAPTER] - Payment Intent ID:",
            paymentIntent.id
          );
          console.log("✅ [STRIPE ADAPTER] - Payment succeeded");

          return {
            success: true,
            paymentId: paymentIntent.id,
            gatewayTransactionId: paymentIntent.id,
            status: PaymentStatus.COMPLETED,
            gatewayResponse: paymentIntent as any,
          };
        }
        case "payment_intent.payment_failed": {
          console.log(
            "🟡 [STRIPE ADAPTER] - Handling payment_intent.payment_failed"
          );
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          console.log("❌ [STRIPE ADAPTER] - Payment failed");
          console.log(
            "❌ [STRIPE ADAPTER] - Error:",
            paymentIntent.last_payment_error?.message
          );

          return {
            success: false,
            paymentId: paymentIntent.id,
            gatewayTransactionId: paymentIntent.id,
            status: PaymentStatus.FAILED,
            error:
              paymentIntent.last_payment_error?.message || "Payment failed",
            gatewayResponse: paymentIntent as any,
          };
        }
        case "payment_intent.canceled": {
          console.log("🟡 [STRIPE ADAPTER] - Handling payment_intent.canceled");
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          console.log("⚠️ [STRIPE ADAPTER] - Payment canceled");

          return {
            success: false,
            paymentId: paymentIntent.id,
            gatewayTransactionId: paymentIntent.id,
            status: PaymentStatus.CANCELLED,
            gatewayResponse: paymentIntent as any,
          };
        }
        case "charge.succeeded":
        case "charge.updated": {
          console.log(`🟡 [STRIPE ADAPTER] - Handling ${event.type}`);
          const charge = event.data.object as Stripe.Charge;
          const paymentIntentId =
            typeof charge.payment_intent === "string"
              ? charge.payment_intent
              : charge.payment_intent?.id;

          console.log("🟡 [STRIPE ADAPTER] - Charge ID:", charge.id);
          console.log(
            "🟡 [STRIPE ADAPTER] - Payment Intent ID:",
            paymentIntentId
          );
          console.log("🟡 [STRIPE ADAPTER] - Charge Status:", charge.status);

          // For charge.updated, check the actual charge status
          // If charge is succeeded, return COMPLETED status
          // Otherwise, return the appropriate status based on charge status
          let paymentStatus = PaymentStatus.PENDING;
          if (charge.status === "succeeded") {
            paymentStatus = PaymentStatus.COMPLETED;
            console.log(
              "✅ [STRIPE ADAPTER] - Charge succeeded, returning COMPLETED status"
            );
          } else if (charge.status === "failed") {
            paymentStatus = PaymentStatus.FAILED;
            console.log(
              "❌ [STRIPE ADAPTER] - Charge failed, returning FAILED status"
            );
          } else if (charge.status === "pending") {
            paymentStatus = PaymentStatus.PENDING;
            console.log(
              "ℹ️ [STRIPE ADAPTER] - Charge pending, returning PENDING status"
            );
          } else {
            console.log(
              `ℹ️ [STRIPE ADAPTER] - Charge status: ${charge.status}, returning PENDING`
            );
          }

          return {
            success: charge.status === "succeeded",
            paymentId: paymentIntentId || charge.id,
            gatewayTransactionId: paymentIntentId || charge.id,
            status: paymentStatus,
            gatewayResponse: charge as any,
          };
        }
        case "charge.succeeded": {
          console.log(`🟡 [STRIPE ADAPTER] - Handling ${event.type}`);
          const charge = event.data.object as Stripe.Charge;
          const paymentIntentId =
            typeof charge.payment_intent === "string"
              ? charge.payment_intent
              : charge.payment_intent?.id;

          console.log("🟡 [STRIPE ADAPTER] - Charge ID:", charge.id);
          console.log(
            "🟡 [STRIPE ADAPTER] - Payment Intent ID:",
            paymentIntentId
          );
          console.log("✅ [STRIPE ADAPTER] - Charge succeeded");

          return {
            success: true,
            paymentId: paymentIntentId || charge.id,
            gatewayTransactionId: paymentIntentId || charge.id,
            status: PaymentStatus.COMPLETED,
            gatewayResponse: charge as any,
          };
        }
        case "charge.failed": {
          console.log("🟡 [STRIPE ADAPTER] - Handling charge.failed");
          const charge = event.data.object as Stripe.Charge;
          const paymentIntentId =
            typeof charge.payment_intent === "string"
              ? charge.payment_intent
              : charge.payment_intent?.id;

          console.log("❌ [STRIPE ADAPTER] - Charge failed");
          console.log(
            "❌ [STRIPE ADAPTER] - Failure Code:",
            charge.failure_code
          );
          console.log(
            "❌ [STRIPE ADAPTER] - Failure Message:",
            charge.failure_message
          );

          return {
            success: false,
            paymentId: paymentIntentId || charge.id,
            gatewayTransactionId: paymentIntentId || charge.id,
            status: PaymentStatus.FAILED,
            error:
              charge.failure_message || charge.failure_code || "Charge failed",
            gatewayResponse: charge as any,
          };
        }
        default:
          console.warn(
            "⚠️ [STRIPE ADAPTER] - Unhandled event type:",
            event.type
          );
          console.warn("⚠️ [STRIPE ADAPTER] - Event ID:", event.id);
          // For unhandled events, return success but with pending status
          // This prevents Stripe from retrying and causing errors
          // We still log it for monitoring
          return {
            success: true, // Return success to prevent retries
            status: PaymentStatus.PENDING,
            error: `Unhandled event type: ${event.type} (acknowledged)`,
            gatewayResponse: event.data.object as any,
          };
      }
    } catch (error: any) {
      console.error("❌ [STRIPE ADAPTER] ========== ERROR ==========");
      console.error("❌ [STRIPE ADAPTER] Error:", error.message);
      console.error("❌ [STRIPE ADAPTER] Stack:", error.stack);
      console.error("❌ [STRIPE ADAPTER] ===========================");

      logger.error("Stripe webhook processing failed:", error);
      return {
        success: false,
        status: PaymentStatus.FAILED,
        error: error.message || "Failed to process webhook",
        gatewayResponse: error as any,
      };
    }
  }

  async refundPayment(data: RefundData): Promise<RefundResult> {
    try {
      const refundOptions: Stripe.RefundCreateParams = {
        payment_intent: data.paymentId,
        metadata: data.metadata,
      };

      if (data.amount) {
        refundOptions.amount = data.amount;
      }

      if (data.reason) {
        refundOptions.reason = data.reason as Stripe.RefundCreateParams.Reason;
      }

      const refund = await this.stripe.refunds.create(refundOptions);

      return {
        success: true,
        refundId: refund.id,
        amount: refund.amount,
        status: PaymentStatus.REFUNDED,
        gatewayResponse: refund as any,
      };
    } catch (error: any) {
      logger.error("Stripe refund failed:", error);
      return {
        success: false,
        amount: 0,
        status: PaymentStatus.FAILED,
        error: error.message || "Failed to process refund",
        gatewayResponse: error as any,
      };
    }
  }

  async cancelPayment(gatewayTransactionId: string): Promise<PaymentResult> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.cancel(
        gatewayTransactionId
      );

      return {
        success: true,
        paymentId: paymentIntent.id,
        gatewayTransactionId: paymentIntent.id,
        status: PaymentStatus.CANCELLED,
        gatewayResponse: paymentIntent as any,
      };
    } catch (error: any) {
      logger.error("Stripe payment cancellation failed:", error);
      return {
        success: false,
        status: PaymentStatus.FAILED,
        error: error.message || "Failed to cancel payment",
        gatewayResponse: error as any,
      };
    }
  }

  private isCheckoutSessionId(id?: string): boolean {
    return typeof id === "string" && id.startsWith("cs_");
  }

  private extractPaymentIntentId(
    paymentIntent: string | Stripe.PaymentIntent | null | undefined
  ): string | null {
    if (!paymentIntent) {
      return null;
    }
    if (typeof paymentIntent === "string") {
      return paymentIntent;
    }
    return paymentIntent.id;
  }

  private buildLineItems(
    data: PaymentIntentData
  ): Stripe.Checkout.SessionCreateParams.LineItem[] {
    const fallbackItem: PaymentLineItem = {
      name: data.description || `Order ${data.orderId}`,
      amount: data.amount,
      currency: data.currency,
      quantity: 1,
    };

    const items: PaymentLineItem[] =
      data.lineItems && data.lineItems.length > 0
        ? data.lineItems
        : [fallbackItem];

    return items.map((item) => ({
      quantity: Math.max(1, item.quantity || 1),
      price_data: {
        currency: (item.currency || data.currency).toLowerCase(),
        product_data: {
          name: item.name,
          description: item.description,
        },
        unit_amount: Math.max(0, Math.round(item.amount)),
      },
    }));
  }

  private buildSuccessUrl(
    returnUrl: string | undefined,
    orderId: string,
    skipQueryParams: boolean = false
  ): string {
    const base = returnUrl || this.defaultSuccessUrl;
    // For membership payments, return clean URL without query params
    if (skipQueryParams) {
      return base;
    }
    return this.appendQueryParams(base, {
      orderId,
      session_id: "{CHECKOUT_SESSION_ID}",
    });
  }

  private buildCancelUrl(
    cancelUrl: string | undefined,
    orderId: string,
    skipQueryParams: boolean = false
  ): string {
    const base = cancelUrl || this.defaultCancelUrl;
    // For membership payments, return clean URL without query params
    if (skipQueryParams) {
      return base;
    }
    return this.appendQueryParams(base, {
      orderId,
      reason: "cancelled",
    });
  }

  private appendQueryParams(
    baseUrl: string,
    params: Record<string, string>
  ): string {
    try {
      const url = new URL(baseUrl);
      Object.entries(params).forEach(([key, value]) =>
        url.searchParams.set(key, value)
      );
      return url.toString();
    } catch (_error) {
      const hasQuery = baseUrl.includes("?");
      const serialized = Object.entries(params)
        .map(
          ([key, value]) =>
            `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
        )
        .join("&");
      return `${baseUrl}${hasQuery ? "&" : "?"}${serialized}`;
    }
  }

  /**
   * Map Stripe payment intent status to our PaymentStatus enum
   */
  private mapStripeStatusToPaymentStatus(stripeStatus: string): PaymentStatus {
    switch (stripeStatus) {
      case "succeeded":
        return PaymentStatus.COMPLETED;
      case "processing":
        return PaymentStatus.PROCESSING;
      case "requires_payment_method":
      case "requires_confirmation":
      case "requires_action":
        return PaymentStatus.PENDING;
      case "canceled":
        return PaymentStatus.CANCELLED;
      case "requires_capture":
        return PaymentStatus.PROCESSING;
      default:
        return PaymentStatus.FAILED;
    }
  }
}

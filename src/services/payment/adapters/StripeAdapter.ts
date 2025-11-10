import Stripe from "stripe";
import {
  IPaymentGateway,
  PaymentIntentData,
  PaymentResult,
  RefundData,
  RefundResult,
} from "../interfaces/IPaymentGateway";
import { PaymentMethod, PaymentStatus } from "../../../models/enums";
import { logger } from "../../../utils/logger";
import { AppError } from "../../../utils/AppError";

export class StripeAdapter implements IPaymentGateway {
  private stripe: Stripe;
  private webhookSecret: string;

  constructor() {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new AppError("STRIPE_SECRET_KEY is required", 500);
    }

    this.stripe = new Stripe(apiKey, {
      apiVersion: "2025-10-29.clover",
    });

    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

    logger.info("Stripe payment gateway initialized");
  }

  getPaymentMethod(): PaymentMethod {
    return PaymentMethod.STRIPE;
  }

  async createPaymentIntent(data: PaymentIntentData): Promise<PaymentResult> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: data.amount,
        currency: data.currency.toLowerCase(),
        description: data.description || `Order ${data.orderId}`,
        metadata: {
          orderId: data.orderId,
          userId: data.userId,
          ...data.metadata,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return {
        success: true,
        paymentId: paymentIntent.id,
        gatewayTransactionId: paymentIntent.id,
        status: this.mapStripeStatusToPaymentStatus(paymentIntent.status),
        clientSecret: paymentIntent.client_secret || undefined,
        gatewayResponse: paymentIntent as any,
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
      const paymentIntent = await this.stripe.paymentIntents.retrieve(
        gatewayTransactionId
      );

      return {
        success: paymentIntent.status === "succeeded",
        paymentId: paymentIntent.id,
        gatewayTransactionId: paymentIntent.id,
        status: this.mapStripeStatusToPaymentStatus(paymentIntent.status),
        gatewayResponse: paymentIntent as any,
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
    signature?: string
  ): Promise<PaymentResult> {
    try {
      let event: Stripe.Event;

      if (signature && this.webhookSecret) {
        // Verify webhook signature
        event = this.stripe.webhooks.constructEvent(
          payload,
          signature,
          this.webhookSecret
        );
      } else {
        // For testing without signature verification
        event = payload as Stripe.Event;
        logger.warn("Processing webhook without signature verification");
      }

      if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        return {
          success: true,
          paymentId: paymentIntent.id,
          gatewayTransactionId: paymentIntent.id,
          status: PaymentStatus.COMPLETED,
          gatewayResponse: paymentIntent as any,
        };
      } else if (event.type === "payment_intent.payment_failed") {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        return {
          success: false,
          paymentId: paymentIntent.id,
          gatewayTransactionId: paymentIntent.id,
          status: PaymentStatus.FAILED,
          error: paymentIntent.last_payment_error?.message || "Payment failed",
          gatewayResponse: paymentIntent as any,
        };
      } else if (event.type === "payment_intent.canceled") {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        return {
          success: false,
          paymentId: paymentIntent.id,
          gatewayTransactionId: paymentIntent.id,
          status: PaymentStatus.CANCELLED,
          gatewayResponse: paymentIntent as any,
        };
      }

      return {
        success: false,
        status: PaymentStatus.PENDING,
        error: `Unhandled event type: ${event.type}`,
      };
    } catch (error: any) {
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

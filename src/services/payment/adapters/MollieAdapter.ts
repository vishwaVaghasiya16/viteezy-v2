import {
  createMollieClient,
  Payment,
  PaymentStatus as MolliePaymentStatus,
} from "@mollie/api-client";
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

export class MollieAdapter implements IPaymentGateway {
  private mollieClient: ReturnType<typeof createMollieClient>;
  private baseUrl: string;

  constructor() {
    const apiKey = process.env.MOLLIE_API_KEY;
    if (!apiKey) {
      throw new AppError("MOLLIE_API_KEY is required", 500);
    }

    this.mollieClient = createMollieClient({ apiKey });
    this.baseUrl = process.env.APP_BASE_URL || "http://localhost:8080";

    logger.info("Mollie payment gateway initialized");
  }

  getPaymentMethod(): PaymentMethod {
    return PaymentMethod.MOLLIE;
  }

  async createPaymentIntent(data: PaymentIntentData): Promise<PaymentResult> {
    try {
      // Build payment data object
      const paymentData: any = {
        amount: {
          currency: data.currency,
          value: (data.amount / 100).toFixed(2), // Mollie expects amount in major currency units
        },
        description: data.description || `Order ${data.orderId}`,
        metadata: {
          orderId: data.orderId,
          userId: data.userId,
          ...data.metadata,
        },
      };

      // Build redirect URL with orderId and userId as query params
      // This helps identify the payment when Mollie redirects back
      // Mollie will append ?id=tr_xxxxx to this URL
      const baseReturnUrl =
        data.returnUrl || `${this.baseUrl}/api/v1/payments/return`;
      const returnUrlParams = new URLSearchParams();
      if (data.orderId) returnUrlParams.append("orderId", data.orderId);
      if (data.userId) returnUrlParams.append("userId", data.userId);
      paymentData.redirectUrl = returnUrlParams.toString()
        ? `${baseReturnUrl}?${returnUrlParams.toString()}`
        : baseReturnUrl;

      // Only include webhookUrl if provided (skip for local development)
      // Mollie validates webhook URLs and rejects localhost URLs
      if (data.webhookUrl) {
        paymentData.webhookUrl = data.webhookUrl;
      }

      const payment = await this.mollieClient.payments.create(paymentData);

      return {
        success: true,
        paymentId: payment.id,
        gatewayTransactionId: payment.id,
        status: this.mapMollieStatusToPaymentStatus(payment.status),
        redirectUrl: payment.getCheckoutUrl() || undefined,
        gatewayResponse: payment as any,
      };
    } catch (error: any) {
      logger.error("Mollie payment creation failed:", error);
      return {
        success: false,
        status: PaymentStatus.FAILED,
        error: error.message || "Failed to create payment",
        gatewayResponse: error as any,
      };
    }
  }

  async verifyPayment(gatewayTransactionId: string): Promise<PaymentResult> {
    try {
      const payment = await this.mollieClient.payments.get(
        gatewayTransactionId
      );

      return {
        success: payment.status === MolliePaymentStatus.paid,
        paymentId: payment.id,
        gatewayTransactionId: payment.id,
        status: this.mapMollieStatusToPaymentStatus(payment.status),
        gatewayResponse: payment as any,
      };
    } catch (error: any) {
      logger.error("Mollie payment verification failed:", error);
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
    _rawBody?: Buffer | string
  ): Promise<PaymentResult> {
    console.log("🟡 [MOLLIE ADAPTER] ========== Processing Webhook ==========");
    console.log(
      "🟡 [MOLLIE ADAPTER] Payload:",
      JSON.stringify(payload, null, 2)
    );

    try {
      // Check if this is a test webhook from Mollie
      // Mollie sends test webhooks as arrays with strings like ["Testing the webhook URL"]
      if (
        Array.isArray(payload) &&
        payload.length > 0 &&
        typeof payload[0] === "string"
      ) {
        console.log(
          "ℹ️ [MOLLIE ADAPTER] - Test webhook detected, acknowledging"
        );
        console.log("ℹ️ [MOLLIE ADAPTER] - Test message:", payload[0]);
        // Return success for test webhooks to acknowledge them
        return {
          success: true,
          status: PaymentStatus.PENDING,
          error: "Test webhook acknowledged",
          gatewayResponse: { test: true, message: payload[0] } as any,
        };
      }

      // Mollie sends payment ID in the payload
      // It can be in different formats: payload.id, payload.paymentId, or payload.id field
      let paymentId = payload.id || payload.paymentId;

      // Sometimes Mollie sends payment ID as a string in the payload
      if (!paymentId && typeof payload === "string") {
        paymentId = payload;
      }

      console.log("🟡 [MOLLIE ADAPTER] Step 1: Extracting payment ID");
      console.log("🟡 [MOLLIE ADAPTER] - Payment ID:", paymentId);
      console.log("🟡 [MOLLIE ADAPTER] - Payload type:", typeof payload);
      console.log("🟡 [MOLLIE ADAPTER] - Is Array:", Array.isArray(payload));

      if (!paymentId) {
        console.error(
          "❌ [MOLLIE ADAPTER] ERROR: Payment ID not found in webhook payload"
        );
        console.error("❌ [MOLLIE ADAPTER] - Payload structure:", {
          hasId: !!payload.id,
          hasPaymentId: !!payload.paymentId,
          payloadType: typeof payload,
          isArray: Array.isArray(payload),
        });
        // For Mollie, if no payment ID, return success to acknowledge but don't process
        // This prevents webhook retries
        return {
          success: true,
          status: PaymentStatus.PENDING,
          error: "Payment ID not found in webhook payload (acknowledged)",
          gatewayResponse: payload as any,
        };
      }

      console.log(
        "🟡 [MOLLIE ADAPTER] Step 2: Fetching payment from Mollie API"
      );
      const payment = await this.mollieClient.payments.get(paymentId);

      console.log("✅ [MOLLIE ADAPTER] Step 3: Payment fetched successfully");
      console.log("🟡 [MOLLIE ADAPTER] - Payment ID:", payment.id);
      console.log("🟡 [MOLLIE ADAPTER] - Payment Status:", payment.status);
      console.log("🟡 [MOLLIE ADAPTER] - Amount:", payment.amount);
      console.log(
        "🟡 [MOLLIE ADAPTER] - Is Paid:",
        payment.status === MolliePaymentStatus.paid
      );

      const mappedStatus = this.mapMollieStatusToPaymentStatus(payment.status);
      console.log("🟡 [MOLLIE ADAPTER] - Mapped Status:", mappedStatus);

      const result = {
        success: payment.status === MolliePaymentStatus.paid,
        paymentId: payment.id,
        gatewayTransactionId: payment.id,
        status: mappedStatus,
        gatewayResponse: payment as any,
      };

      console.log("✅ [MOLLIE ADAPTER] - Result Success:", result.success);
      console.log(
        "✅ [MOLLIE ADAPTER] ============================================"
      );

      return result;
    } catch (error: any) {
      console.error("❌ [MOLLIE ADAPTER] ========== ERROR ==========");
      console.error("❌ [MOLLIE ADAPTER] Error:", error.message);
      console.error("❌ [MOLLIE ADAPTER] Stack:", error.stack);
      console.error("❌ [MOLLIE ADAPTER] ===========================");

      logger.error("Mollie webhook processing failed:", error);
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
      // Get the payment first
      const payment = await this.mollieClient.payments.get(data.paymentId);

      if (!payment.amountRefunded) {
        throw new Error(
          "Payment does not support refunds or has no refundable amount"
        );
      }

      // Mollie refunds are created on the payment
      // Refund amount should be in the format: { currency: string, value: string }
      const refundAmount = data.amount
        ? {
            currency: payment.amount.currency,
            value: (data.amount / 100).toFixed(2),
          }
        : payment.amount; // Full refund if amount not specified

      const refund = await this.mollieClient.paymentRefunds.create({
        paymentId: data.paymentId,
        amount: refundAmount,
        description: data.reason,
        metadata: data.metadata,
      });

      return {
        success: true,
        refundId: refund.id,
        amount: Math.round(parseFloat(refund.amount.value) * 100), // Convert back to cents
        status: PaymentStatus.REFUNDED,
        gatewayResponse: refund as any,
      };
    } catch (error: any) {
      logger.error("Mollie refund failed:", error);
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
      // Mollie payments cannot be manually cancelled via API
      // Payments expire automatically if not paid within the expiry period
      // We can only check the status and mark as cancelled in our system if it's expired or open
      const payment = await this.mollieClient.payments.get(
        gatewayTransactionId
      );

      // Check if payment is in a cancellable state
      if (
        payment.status === MolliePaymentStatus.open ||
        payment.status === MolliePaymentStatus.expired ||
        payment.status === MolliePaymentStatus.canceled
      ) {
        // Payment is already cancelled/expired or can expire naturally
        // We'll return the current status
        return {
          success: true,
          paymentId: payment.id,
          gatewayTransactionId: payment.id,
          status: this.mapMollieStatusToPaymentStatus(payment.status),
          gatewayResponse: payment as any,
        };
      }

      // For other statuses, payment cannot be cancelled
      return {
        success: false,
        status: PaymentStatus.FAILED,
        error: `Payment cannot be cancelled. Current status: ${payment.status}`,
        gatewayResponse: payment as any,
      };
    } catch (error: any) {
      logger.error("Mollie payment cancellation failed:", error);
      return {
        success: false,
        status: PaymentStatus.FAILED,
        error: error.message || "Failed to cancel payment",
        gatewayResponse: error as any,
      };
    }
  }

  /**
   * Map Mollie payment status to our PaymentStatus enum
   */
  private mapMollieStatusToPaymentStatus(
    mollieStatus: MolliePaymentStatus
  ): PaymentStatus {
    switch (mollieStatus) {
      case MolliePaymentStatus.paid:
        return PaymentStatus.COMPLETED;
      case MolliePaymentStatus.pending:
        return PaymentStatus.PENDING;
      case MolliePaymentStatus.open:
        return PaymentStatus.PENDING;
      case MolliePaymentStatus.authorized:
        return PaymentStatus.PROCESSING;
      case MolliePaymentStatus.canceled:
        return PaymentStatus.CANCELLED;
      case MolliePaymentStatus.expired:
        return PaymentStatus.CANCELLED;
      case MolliePaymentStatus.failed:
        return PaymentStatus.FAILED;
      default:
        return PaymentStatus.PENDING;
    }
  }
}

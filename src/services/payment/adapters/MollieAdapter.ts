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
        redirectUrl: data.returnUrl || `${this.baseUrl}/api/v1/payments/return`,
      };

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
    signature?: string
  ): Promise<PaymentResult> {
    try {
      // Mollie sends payment ID in the payload
      const paymentId = payload.id || payload.paymentId;
      if (!paymentId) {
        throw new Error("Payment ID not found in webhook payload");
      }

      const payment = await this.mollieClient.payments.get(paymentId);

      return {
        success: payment.status === MolliePaymentStatus.paid,
        paymentId: payment.id,
        gatewayTransactionId: payment.id,
        status: this.mapMollieStatusToPaymentStatus(payment.status),
        gatewayResponse: payment as any,
      };
    } catch (error: any) {
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

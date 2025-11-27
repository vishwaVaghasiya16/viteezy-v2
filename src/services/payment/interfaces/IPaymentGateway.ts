import { PaymentMethod, PaymentStatus } from "../../../models/enums";
import { AddressSnapshotType } from "../../../models/common.model";

export interface PaymentLineItem {
  name: string;
  amount: number; // Amount per unit in smallest currency unit
  currency: string;
  quantity: number;
  description?: string;
}

/**
 * Payment Intent/Session Data
 */
export interface PaymentIntentData {
  amount: number; // Amount in smallest currency unit (cents/pence)
  currency: string; // ISO currency code (e.g., 'USD', 'EUR')
  orderId: string;
  userId: string;
  description?: string;
  metadata?: Record<string, string>;
  returnUrl?: string;
  cancelUrl?: string;
  webhookUrl?: string;
  customerEmail?: string;
  customerName?: string;
  shippingCountry?: string;
  shippingAddress?: AddressSnapshotType;
  billingAddress?: AddressSnapshotType;
  lineItems?: PaymentLineItem[];
}

/**
 * Payment Result
 */
export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  gatewayTransactionId?: string;
  sessionId?: string;
  status: PaymentStatus;
  redirectUrl?: string; // For redirect-based payments (Mollie)
  clientSecret?: string; // For Stripe client-side confirmation
  error?: string;
  gatewayResponse?: Record<string, any>;
}

/**
 * Refund Data
 */
export interface RefundData {
  paymentId: string;
  amount?: number; // Partial refund amount, if not provided, full refund
  reason?: string;
  metadata?: Record<string, string>;
}

/**
 * Refund Result
 */
export interface RefundResult {
  success: boolean;
  refundId?: string;
  amount: number;
  status: PaymentStatus;
  error?: string;
  gatewayResponse?: Record<string, any>;
}

/**
 * Payment Gateway Interface
 * All payment gateways must implement this interface
 */
export interface IPaymentGateway {
  /**
   * Get the payment method this gateway handles
   */
  getPaymentMethod(): PaymentMethod;

  /**
   * Create a payment intent
   */
  createPaymentIntent(data: PaymentIntentData): Promise<PaymentResult>;

  /**
   * Verify payment status from gateway
   */
  verifyPayment(gatewayTransactionId: string): Promise<PaymentResult>;

  /**
   * Process webhook from gateway
   */
  processWebhook(
    payload: any,
    signature?: string,
    rawBody?: Buffer | string
  ): Promise<PaymentResult>;

  /**
   * Refund a payment
   */
  refundPayment(data: RefundData): Promise<RefundResult>;

  /**
   * Cancel a payment
   */
  cancelPayment(gatewayTransactionId: string): Promise<PaymentResult>;
}

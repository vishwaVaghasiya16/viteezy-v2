// Model Enums - Centralized constants for all models

// Product Status
export enum ProductStatus {
  ACTIVE = 'ACTIVE',
  HIDDEN = 'HIDDEN',
  DRAFT = 'DRAFT'
}

// User Roles
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator'
}

// User Status
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended'
}

// Blog Status
export enum BlogStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived'
}

// Page Status
export enum PageStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DRAFT = 'draft'
}

// Page Types
export enum PageType {
  STATIC = 'static',
  DYNAMIC = 'dynamic',
  LANDING = 'landing'
}

// Order Status
export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}

// Payment Status
export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}

// Payment Methods
export enum PaymentMethod {
  STRIPE = 'stripe',
  MOLLIE = 'mollie',
  PAYPAL = 'paypal',
  BANK_TRANSFER = 'bank_transfer'
}

// Shipment Status
export enum ShipmentStatus {
  PENDING = 'pending',
  PICKED_UP = 'picked_up',
  IN_TRANSIT = 'in_transit',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  EXCEPTION = 'exception',
  RETURNED = 'returned'
}

// Campaign Types
export enum CampaignType {
  DISCOUNT = 'discount',
  BOGO = 'bogo',
  FREE_SHIPPING = 'free_shipping',
  GIFT = 'gift'
}

// Campaign Status
export enum CampaignStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  EXPIRED = 'expired'
}

// Discount Types
export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
  FREE = 'free'
}

// Coupon Types
export enum CouponType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
  FREE_SHIPPING = 'free_shipping'
}

// Ingredient Types
export enum IngredientType {
  VITAMIN = 'vitamin',
  MINERAL = 'mineral',
  HERB = 'herb',
  AMINO_ACID = 'amino_acid',
  FATTY_ACID = 'fatty_acid',
  OTHER = 'other'
}

// Consultation Status
export enum ConsultationStatus {
  BOOKED = 'BOOKED',
  RESCHEDULED = 'RESCHEDULED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED'
}

// Expert Slot Status
export enum ExpertSlotStatus {
  AVAILABLE = 'available',
  BOOKED = 'booked',
  BLOCKED = 'blocked'
}

// AI Conversation Status
export enum AIConversationStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived'
}

// AI Job Types
export enum AIJobType {
  GENERATE = 'generate',
  EDIT = 'edit',
  ENHANCE = 'enhance'
}

// AI Job Status
export enum AIJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// Address Types
export enum AddressType {
  HOME = 'home',
  WORK = 'work',
  OTHER = 'other'
}

// Review Status
export enum ReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

// Media Types
export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video'
}

// Frequency Types
export enum FrequencyType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly'
}

// Message Roles
export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system'
}

// Working Days (0-6, Sunday-Saturday)
export enum WorkingDay {
  SUNDAY = 0,
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6
}

// Currency Codes
export enum Currency {
  EUR = 'EUR',
  USD = 'USD',
  GBP = 'GBP',
  INR = 'INR'
}

// OTP Types
export enum OTPType {
  EMAIL_VERIFICATION = 'email_verification',
  PHONE_VERIFICATION = 'phone_verification',
  PASSWORD_RESET = 'password_reset',
  LOGIN_VERIFICATION = 'login_verification'
}

// OTP Status
export enum OTPStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  EXPIRED = 'expired',
  USED = 'used'
}

// Timezones
export enum Timezone {
  UTC = 'UTC',
  CET = 'CET',
  EST = 'EST',
  PST = 'PST',
  IST = 'IST'
}

// Export all enum values as arrays for Mongoose schemas
export const PRODUCT_STATUS_VALUES = Object.values(ProductStatus);
export const USER_ROLE_VALUES = Object.values(UserRole);
export const USER_STATUS_VALUES = Object.values(UserStatus);
export const BLOG_STATUS_VALUES = Object.values(BlogStatus);
export const PAGE_STATUS_VALUES = Object.values(PageStatus);
export const PAGE_TYPE_VALUES = Object.values(PageType);
export const ORDER_STATUS_VALUES = Object.values(OrderStatus);
export const PAYMENT_STATUS_VALUES = Object.values(PaymentStatus);
export const PAYMENT_METHOD_VALUES = Object.values(PaymentMethod);
export const SHIPMENT_STATUS_VALUES = Object.values(ShipmentStatus);
export const CAMPAIGN_TYPE_VALUES = Object.values(CampaignType);
export const CAMPAIGN_STATUS_VALUES = Object.values(CampaignStatus);
export const DISCOUNT_TYPE_VALUES = Object.values(DiscountType);
export const COUPON_TYPE_VALUES = Object.values(CouponType);
export const INGREDIENT_TYPE_VALUES = Object.values(IngredientType);
export const CONSULTATION_STATUS_VALUES = Object.values(ConsultationStatus);
export const EXPERT_SLOT_STATUS_VALUES = Object.values(ExpertSlotStatus);
export const AI_CONVERSATION_STATUS_VALUES = Object.values(AIConversationStatus);
export const AI_JOB_TYPE_VALUES = Object.values(AIJobType);
export const AI_JOB_STATUS_VALUES = Object.values(AIJobStatus);
export const ADDRESS_TYPE_VALUES = Object.values(AddressType);
export const REVIEW_STATUS_VALUES = Object.values(ReviewStatus);
export const MEDIA_TYPE_VALUES = Object.values(MediaType);
export const FREQUENCY_TYPE_VALUES = Object.values(FrequencyType);
export const MESSAGE_ROLE_VALUES = Object.values(MessageRole);
export const WORKING_DAY_VALUES = Object.values(WorkingDay);
export const CURRENCY_VALUES = Object.values(Currency);
export const TIMEZONE_VALUES = Object.values(Timezone);
export const OTP_TYPE_VALUES = Object.values(OTPType);
export const OTP_STATUS_VALUES = Object.values(OTPStatus);

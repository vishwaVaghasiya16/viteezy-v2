// Model Enums - Centralized constants for all models

// Product Status
export enum ProductStatus {
  ACTIVE = "Active",
  HIDDEN = "Hidden",
  DRAFT = "Draft",
}

export enum ProductVariant {
  SACHETS = "SACHETS",
  STAND_UP_POUCH = "STAND_UP_POUCH",
}

// User Roles
export enum UserRole {
  USER = "User",
  ADMIN = "Admin",
  MODERATOR = "Moderator",
}

// User Status
export enum UserStatus {
  ACTIVE = "Active",
  INACTIVE = "Inactive",
  SUSPENDED = "Suspended",
}

// Blog Status
export enum BlogStatus {
  DRAFT = "Draft",
  PUBLISHED = "Published",
  ARCHIVED = "Archived",
}

// FAQ Status
export enum FAQStatus {
  ACTIVE = "Active",
  INACTIVE = "Inactive",
}

// Page Status
export enum PageStatus {
  ACTIVE = "Active",
  INACTIVE = "Inactive",
  DRAFT = "Draft",
}

// Page Types
export enum PageType {
  STATIC = "Static",
  DYNAMIC = "Dynamic",
  LANDING = "Landing",
}

// Static Page Status
export enum StaticPageStatus {
  PUBLISHED = "Published",
  UNPUBLISHED = "Unpublished",
}

// Order Status
export enum OrderStatus {
  PENDING = "Pending",
  CONFIRMED = "Confirmed",
  PROCESSING = "Processing",
  SHIPPED = "Shipped",
  DELIVERED = "Delivered",
  CANCELLED = "Cancelled",
  REFUNDED = "Refunded",
}

// Payment Status
export enum PaymentStatus {
  PENDING = "Pending",
  PROCESSING = "Processing",
  COMPLETED = "Completed",
  FAILED = "Failed",
  CANCELLED = "Cancelled",
  REFUNDED = "Refunded",
}

// Payment Methods
export enum PaymentMethod {
  STRIPE = "Stripe",
  MOLLIE = "Mollie",
  PAYPAL = "Paypal",
  BANK_TRANSFER = "Bank Transfer",
}

// Order Plan Types
export enum OrderPlanType {
  ONE_TIME = "One-Time",
  SUBSCRIPTION = "Subscription",
}

// Shipment Status
export enum ShipmentStatus {
  PENDING = "Pending",
  PICKED_UP = "Picked Up",
  IN_TRANSIT = "In Transit",
  OUT_FOR_DELIVERY = "Out for Delivery",
  DELIVERED = "Delivered",
  EXCEPTION = "Exception",
  RETURNED = "Returned",
}

// Campaign Types
export enum CampaignType {
  DISCOUNT = "Discount",
  BOGO = "Buy One Get One",
  FREE_SHIPPING = "Free Shipping",
  GIFT = "Gift",
}

// Campaign Status
export enum CampaignStatus {
  DRAFT = "Draft",
  ACTIVE = "Active",
  PAUSED = "Paused",
  EXPIRED = "Expired",
}

// Discount Types
export enum DiscountType {
  PERCENTAGE = "Percentage",
  FIXED = "Fixed",
  FREE = "Free",
}

// Coupon Types
export enum CouponType {
  PERCENTAGE = "Percentage",
  FIXED = "Fixed",
  FREE_SHIPPING = "Free Shipping",
}

// Ingredient Types
export enum IngredientType {
  VITAMIN = "Vitamin",
  MINERAL = "Mineral",
  HERB = "Herb",
  AMINO_ACID = "Amino Acid",
  FATTY_ACID = "Fatty Acid",
  OTHER = "Other",
}

// Consultation Status
export enum ConsultationStatus {
  BOOKED = "Booked",
  RESCHEDULED = "Rescheduled",
  CANCELLED = "Cancelled",
  COMPLETED = "Completed",
}

// Expert Slot Status
export enum ExpertSlotStatus {
  AVAILABLE = "Available",
  BOOKED = "Booked",
  BLOCKED = "Blocked",
}

// AI Conversation Status
export enum AIConversationStatus {
  ACTIVE = "Active",
  COMPLETED = "Completed",
  ARCHIVED = "Archived",
}

// AI Job Types
export enum AIJobType {
  GENERATE = "Generate",
  EDIT = "Edit",
  ENHANCE = "Enhance",
}

// AI Job Status
export enum AIJobStatus {
  PENDING = "Pending",
  PROCESSING = "Processing",
  COMPLETED = "Completed",
  FAILED = "Failed",
}

// Address Types
export enum AddressType {
  HOME = "Home",
  WORK = "Work",
  OTHER = "Other",
}

// Review Status
export enum ReviewStatus {
  PENDING = "Pending",
  APPROVED = "Approved",
  REJECTED = "Rejected",
}

// Media Types
export enum MediaType {
  IMAGE = "Image",
  VIDEO = "Video",
}

// Frequency Types
export enum FrequencyType {
  DAILY = "Daily",
  WEEKLY = "Weekly",
  MONTHLY = "Monthly",
}

// Message Roles
export enum MessageRole {
  USER = "User",
  ASSISTANT = "Assistant",
  SYSTEM = "System",
}

// Working Days (0-6, Sunday-Saturday)
export enum WorkingDay {
  SUNDAY = 0,
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6,
}

// Currency Codes
export enum Currency {
  EUR = "EUR",
  USD = "USD",
  GBP = "GBP",
  INR = "INR",
}

// OTP Types
export enum OTPType {
  EMAIL_VERIFICATION = "Email Verification",
  PHONE_VERIFICATION = "Phone Verification",
  PASSWORD_RESET = "Password Reset",
  LOGIN_VERIFICATION = "Login Verification",
}

// OTP Status
export enum OTPStatus {
  PENDING = "Pending",
  VERIFIED = "Verified",
  EXPIRED = "Expired",
  USED = "Used",
}

// Timezones
export enum Timezone {
  UTC = "UTC",
  CET = "CET",
  EST = "EST",
  PST = "PST",
  IST = "IST",
}

// Gender
export enum Gender {
  MALE = "Male",
  FEMALE = "Female",
  GENDER_NEUTRAL = "Gender neutral",
}

// Delivery Postponement Status
export enum PostponementStatus {
  PENDING = "Pending",
  APPROVED = "Approved",
  REJECTED = "Rejected",
  CANCELLED = "Cancelled",
}

// Membership Status
export enum MembershipStatus {
  NONE = "None", // User hasn't purchased any membership yet
  PENDING = "Pending",
  ACTIVE = "Active",
  EXPIRED = "Expired",
  CANCELLED = "Cancelled",
}

// Membership Billing Interval
export enum MembershipInterval {
  MONTHLY = "Monthly",
  QUARTERLY = "Quarterly",
  YEARLY = "Yearly",
}

// Subscription Status
export enum SubscriptionStatus {
  ACTIVE = "Active",
  PAUSED = "Paused",
  CANCELLED = "Cancelled",
  EXPIRED = "Expired",
  SUSPENDED = "Suspended",
}

// Subscription Cycle Intervals (in days)
export enum SubscriptionCycle {
  DAYS_60 = 60,
  DAYS_90 = 90,
  DAYS_180 = 180,
}

// Export all enum values as arrays for Mongoose schemas
export const PRODUCT_STATUS_VALUES = Object.values(ProductStatus);
export const PRODUCT_VARIANT_VALUES = Object.values(ProductVariant);
export const USER_ROLE_VALUES = Object.values(UserRole);
export const USER_STATUS_VALUES = Object.values(UserStatus);
export const BLOG_STATUS_VALUES = Object.values(BlogStatus);
export const FAQ_STATUS_VALUES = Object.values(FAQStatus);
export const PAGE_STATUS_VALUES = Object.values(PageStatus);
export const PAGE_TYPE_VALUES = Object.values(PageType);
export const STATIC_PAGE_STATUS_VALUES = Object.values(StaticPageStatus);
export const ORDER_STATUS_VALUES = Object.values(OrderStatus);
export const PAYMENT_STATUS_VALUES = Object.values(PaymentStatus);
export const PAYMENT_METHOD_VALUES = Object.values(PaymentMethod);
export const ORDER_PLAN_TYPE_VALUES = Object.values(OrderPlanType);
export const SHIPMENT_STATUS_VALUES = Object.values(ShipmentStatus);
export const CAMPAIGN_TYPE_VALUES = Object.values(CampaignType);
export const CAMPAIGN_STATUS_VALUES = Object.values(CampaignStatus);
export const DISCOUNT_TYPE_VALUES = Object.values(DiscountType);
export const COUPON_TYPE_VALUES = Object.values(CouponType);
export const INGREDIENT_TYPE_VALUES = Object.values(IngredientType);
export const CONSULTATION_STATUS_VALUES = Object.values(ConsultationStatus);
export const EXPERT_SLOT_STATUS_VALUES = Object.values(ExpertSlotStatus);
export const AI_CONVERSATION_STATUS_VALUES =
  Object.values(AIConversationStatus);
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
export const GENDER_VALUES = Object.values(Gender);
export const POSTPONEMENT_STATUS_VALUES = Object.values(PostponementStatus);
export const MEMBERSHIP_STATUS_VALUES = Object.values(MembershipStatus);
export const MEMBERSHIP_INTERVAL_VALUES = Object.values(MembershipInterval);
export const SUBSCRIPTION_STATUS_VALUES = Object.values(SubscriptionStatus);
export const SUBSCRIPTION_CYCLE_VALUES = [
  SubscriptionCycle.DAYS_60,
  SubscriptionCycle.DAYS_90,
  SubscriptionCycle.DAYS_180,
];

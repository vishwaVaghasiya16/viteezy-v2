// Main Models Index - Export all models from all categories

// Common schemas and enums
export * from "./common.model";
export {
  // Re-export enums with explicit names to avoid conflicts
  ProductStatus,
  UserRole,
  UserStatus,
  BlogStatus,
  FAQStatus,
  PageStatus,
  PageType,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  OrderPlanType,
  ShipmentStatus,
  CampaignType,
  CampaignStatus,
  DiscountType,
  CouponType,
  IngredientType,
  ConsultationStatus,
  ExpertSlotStatus,
  AIConversationStatus,
  AIJobType,
  AIJobStatus,
  AddressType,
  ReviewStatus,
  FrequencyType,
  MessageRole,
  WorkingDay,
  Currency,
  Timezone,
  OTPType,
  OTPStatus,
  Gender,
  PostponementStatus,
  SubscriptionStatus,
  SubscriptionCycle,
  // Export enum values
  PRODUCT_STATUS_VALUES,
  USER_ROLE_VALUES,
  USER_STATUS_VALUES,
  BLOG_STATUS_VALUES,
  FAQ_STATUS_VALUES,
  PAGE_STATUS_VALUES,
  PAGE_TYPE_VALUES,
  ORDER_STATUS_VALUES,
  PAYMENT_STATUS_VALUES,
  PAYMENT_METHOD_VALUES,
  ORDER_PLAN_TYPE_VALUES,
  SHIPMENT_STATUS_VALUES,
  CAMPAIGN_TYPE_VALUES,
  CAMPAIGN_STATUS_VALUES,
  DISCOUNT_TYPE_VALUES,
  COUPON_TYPE_VALUES,
  INGREDIENT_TYPE_VALUES,
  CONSULTATION_STATUS_VALUES,
  EXPERT_SLOT_STATUS_VALUES,
  AI_CONVERSATION_STATUS_VALUES,
  AI_JOB_TYPE_VALUES,
  AI_JOB_STATUS_VALUES,
  ADDRESS_TYPE_VALUES,
  REVIEW_STATUS_VALUES,
  MEDIA_TYPE_VALUES,
  FREQUENCY_TYPE_VALUES,
  MESSAGE_ROLE_VALUES,
  WORKING_DAY_VALUES,
  CURRENCY_VALUES,
  TIMEZONE_VALUES,
  OTP_TYPE_VALUES,
  OTP_STATUS_VALUES,
  GENDER_VALUES,
  POSTPONEMENT_STATUS_VALUES,
  SUBSCRIPTION_STATUS_VALUES,
  SUBSCRIPTION_CYCLE_VALUES,
} from "./enums";

// AI Models
export * from "./ai";

// CMS Models
export * from "./cms";

// Commerce Models
export * from "./commerce";

// Consultation Models
export * from "./consultation";

// Core Models
export * from "./core";

// Settings Model (if needed)
// export * from './settings.model';

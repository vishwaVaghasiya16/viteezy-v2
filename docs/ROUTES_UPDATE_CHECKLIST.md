# Routes Update Checklist for Multilingual Support

This document lists all routes that need to be updated with translation middleware.

## Update Pattern

### For CREATE/UPDATE routes (POST, PUT, PATCH):
```typescript
import { autoTranslateMiddleware } from "@/middleware/translationMiddleware";

router.post(
  "/",
  // ... other middlewares
  autoTranslateMiddleware("modelName"), // Add this
  // ... validation
  controller.method
);
```

### For GET routes (GET):
```typescript
import { transformResponseMiddleware } from "@/middleware/responseTransformMiddleware";

router.get(
  "/",
  transformResponseMiddleware("modelName"), // Add this
  // ... validation
  controller.method
);
```

## Routes to Update

### 1. Blogs ✅ (Example - Already Updated)
- **File**: `src/routes/adminBlogRoutes.ts`
- **Model Name**: `blogs`
- **Routes**: POST, GET (list), GET (single), PUT

### 2. Blog Categories
- **File**: `src/routes/adminBlogCategoryRoutes.ts`
- **Model Name**: `blogCategories`
- **Routes**: POST, GET (list), GET (single), PUT, DELETE

### 3. FAQs
- **File**: `src/routes/adminFaqRoutes.ts`
- **Model Name**: `faqs`
- **Routes**: POST, GET (list), GET (single), PUT, DELETE

### 4. FAQ Categories
- **File**: `src/routes/adminFaqCategoryRoutes.ts`
- **Model Name**: `faqCategories`
- **Routes**: POST, GET (list), GET (single), PUT, DELETE

### 5. About Us
- **File**: `src/routes/adminAboutUsRoutes.ts`
- **Model Name**: `aboutUs`
- **Routes**: POST, GET, PUT

### 6. Landing Page
- **File**: `src/routes/adminLandingPageRoutes.ts`
- **Model Name**: `landingPage`
- **Routes**: POST, GET, PUT

### 7. Our Team Page
- **File**: `src/routes/adminOurTeamPageRoutes.ts`
- **Model Name**: `ourTeamPage`
- **Routes**: POST, GET, PUT

### 8. Pages
- **File**: `src/routes/adminPagesRoutes.ts` (if exists)
- **Model Name**: `pages`
- **Routes**: POST, GET (list), GET (single), PUT, DELETE

### 9. Reviews
- **File**: `src/routes/adminReviewsRoutes.ts` (if exists)
- **Model Name**: `reviews`
- **Routes**: POST, GET (list), GET (single), PUT, DELETE

### 10. Static Pages
- **File**: `src/routes/adminStaticPageRoutes.ts`
- **Model Name**: `staticPages`
- **Routes**: POST, GET (list), GET (single), PUT, DELETE

### 11. Team Members
- **File**: `src/routes/adminTeamMemberRoutes.ts`
- **Model Name**: `teamMembers`
- **Routes**: POST, GET (list), GET (single), PUT, DELETE

### 12. Campaigns
- **File**: `src/routes/adminCampaignRoutes.ts` (if exists)
- **Model Name**: `campaigns`
- **Routes**: POST, GET (list), GET (single), PUT, DELETE

### 13. Categories
- **File**: `src/routes/adminProductCategoryRoutes.ts`
- **Model Name**: `categories`
- **Routes**: POST, GET (list), GET (single), PUT, DELETE

### 14. Coupons
- **File**: `src/routes/adminCouponRoutes.ts`
- **Model Name**: `coupons`
- **Routes**: POST, GET (list), GET (single), PUT, DELETE

### 15. Membership Plans
- **File**: `src/routes/adminMembershipPlanRoutes.ts`
- **Model Name**: `membershipPlans`
- **Routes**: POST, GET (list), GET (single), PUT, DELETE

### 16. Product FAQs
- **File**: `src/routes/adminProductFaqRoutes.ts`
- **Model Name**: `productFaqs`
- **Routes**: POST, GET (list), GET (single), PUT, DELETE

### 17. Product Ingredients
- **File**: `src/routes/adminProductIngredientRoutes.ts`
- **Model Name**: `productIngredients`
- **Routes**: POST, GET (list), GET (single), PUT, DELETE

### 18. Product Variants
- **File**: `src/routes/adminProductVariantRoutes.ts` (if exists)
- **Model Name**: `productVariants`
- **Routes**: POST, GET (list), GET (single), PUT, DELETE

### 19. Products
- **File**: `src/routes/adminProductRoutes.ts` (if exists) or check product routes
- **Model Name**: `products`
- **Routes**: POST, GET (list), GET (single), PUT, DELETE

### 20. Avatar Jobs
- **File**: `src/routes/adminAvatarJobRoutes.ts` (if exists)
- **Model Name**: `avatarJobs`
- **Routes**: POST, GET (list), GET (single), PUT, DELETE
- **Note**: No I18n fields, but add for consistency

### 21. Experts
- **File**: `src/routes/adminExpertRoutes.ts` (if exists)
- **Model Name**: `experts`
- **Routes**: POST, GET (list), GET (single), PUT, DELETE

## Quick Update Script Pattern

For each route file:

1. Add imports:
```typescript
import { autoTranslateMiddleware } from "@/middleware/translationMiddleware";
import { transformResponseMiddleware } from "@/middleware/responseTransformMiddleware";
```

2. Add `autoTranslateMiddleware("modelName")` to POST/PUT/PATCH routes (before validation)

3. Add `transformResponseMiddleware("modelName")` to GET routes (before validation)

## Testing Checklist

After updating each route:

- [ ] Test CREATE with English text only
- [ ] Verify all 5 languages stored in database
- [ ] Test GET with user having different language preferences
- [ ] Verify response is in user's language
- [ ] Test UPDATE with English text only
- [ ] Verify translations are updated

## Notes

- Middleware order matters: Translation middleware should be after file upload but before validation
- Response transform middleware should be before validation
- If translation fails, English text is preserved
- If user language not found, falls back to English


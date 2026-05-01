# Multilingual Translation System Implementation Guide

## Overview

This guide explains how to implement automatic translation for all 21 multilingual models. The system:
- **Admin adds data in English only** (via form data or JSON body)
- **Auto-translates to 4 other languages** (nl, de, fr, es) using Google Translate API
- **Returns data in user's preferred language** based on user table language field

## Supported Languages

- **English (en)** - Source language (admin always uses this)
- **Dutch (nl)**
- **German (de)**
- **French (fr)**
- **Spanish (es)**

## Setup

### 1. Environment Variables

Add to `.env` file:

```env
# Google Translate API Configuration
TRANSLATION_ENABLED=true
GOOGLE_TRANSLATE_API_KEY=your_google_translate_api_key_here
```

### 2. Install Dependencies

No additional packages needed - `axios` is already installed.

## Architecture

### Components Created

1. **Translation Service** (`src/services/translationService.ts`)
   - Handles Google Translate API calls
   - Translates I18nString and I18nText objects
   - Supports batch translation

2. **Translation Utils** (`src/utils/translationUtils.ts`)
   - Helper functions for getting translated strings
   - User language code conversion
   - Response transformation utilities

3. **Translation Middleware** (`src/middleware/translationMiddleware.ts`)
   - Auto-translates data on create/update
   - Maps model names to I18n fields

4. **Response Transform Middleware** (`src/middleware/responseTransformMiddleware.ts`)
   - Transforms I18n objects to single language in responses
   - Uses user's language preference

## Implementation Steps for Each Model

### Step 1: Update Routes

Add translation middleware to routes file:

```typescript
import { autoTranslateMiddleware } from "@/middleware/translationMiddleware";
import { transformResponseMiddleware } from "@/middleware/responseTransformMiddleware";

// Add before route handlers
router.post(
  "/",
  autoTranslateMiddleware("blogs"), // Model name
  validateJoi(createBlogSchema),
  adminBlogController.createBlog
);

router.get(
  "/",
  transformResponseMiddleware("blogs"), // Model name
  validateQuery(paginationQuerySchema),
  adminBlogController.getBlogs
);
```

### Step 2: Update Controller (Optional - for manual transformation)

If you need manual control, use transform utilities:

```typescript
import { transformResponseData, getUserLanguageCode } from "@/utils/translationUtils";
import { User } from "@/models/core";

// In controller method
const user = await User.findById(req.user?._id).select("language").lean();
const lang = getUserLanguageCode(user?.language);

// Transform data before sending
const transformedData = transformI18nObject(data, lang, ["title"], ["description"]);
res.apiSuccess(transformedData);
```

## Models and Their I18n Fields

### CMS Models

#### 1. aboutUs
- **I18nString**: `banner_title`, `banner_button_text`, `founder_name`, `founder_position`, `meet_brains_title`, `timeline_section_title`, `title`, `subtitle`
- **I18nText**: `banner_description`, `founder_heading`, `founder_description`, `note`, `meet_brains_subtitle`, `description`, `timeline_section_description`

#### 2. blogs
- **I18nString**: `title`, `description`
- **I18nText**: None

#### 3. blogCategories
- **I18nString**: `title`
- **I18nText**: None

#### 4. faqs
- **I18nString**: `question`
- **I18nText**: `answer`

#### 5. faqCategories
- **I18nString**: `title`
- **I18nText**: None

#### 6. landingPage
- **I18nString**: `label`, `title`, `highlightedText`, `subTitle` (multiple sections)
- **I18nText**: `description` (multiple sections), `answer`

#### 7. ourTeamPage
- **I18nString**: `title`
- **I18nText**: `subtitle`

#### 8. pages
- **I18nString**: `title`
- **I18nText**: `content`

#### 9. reviews
- **I18nString**: `title`
- **I18nText**: `content`

#### 10. staticPages
- **I18nString**: `title`
- **I18nText**: `content`

#### 11. teamMembers
- **I18nString**: `name`, `designation`
- **I18nText**: `content`

### Commerce Models

#### 12. campaigns
- **I18nString**: `title`
- **I18nText**: `description`, `terms`

#### 13. categories
- **I18nString**: `name`
- **I18nText**: `description`

#### 14. coupons
- **I18nString**: `name`, `description`
- **I18nText**: None

#### 15. membershipPlans
- **I18nString**: `shortDescription`
- **I18nText**: `description`

#### 16. productFaqs
- **I18nString**: `question`
- **I18nText**: `answer`

#### 17. productIngredients
- **I18nString**: `name`
- **I18nText**: `description`

#### 18. productVariants
- **I18nString**: `name`
- **I18nText**: None

#### 19. products
- **I18nString**: `title`
- **I18nText**: `description`, `nutritionInfo`, `howToUse`

### Other Models

#### 20. avatarJobs
- **I18nString**: None
- **I18nText**: None

#### 21. experts
- **I18nString**: None
- **I18nText**: `bio`

## Example: Complete Implementation for Blogs

### Route File (`src/routes/adminBlogRoutes.ts`)

```typescript
import { autoTranslateMiddleware } from "@/middleware/translationMiddleware";
import { transformResponseMiddleware } from "@/middleware/responseTransformMiddleware";

// POST - Create (auto-translate)
router.post(
  "/",
  handleMulterError(upload.single("coverImage"), "cover image"),
  autoTranslateMiddleware("blogs"), // Add this
  validateJoi(createBlogSchema),
  adminBlogController.createBlog
);

// GET - List (transform response)
router.get(
  "/",
  transformResponseMiddleware("blogs"), // Add this
  validateQuery(paginationQuerySchema),
  adminBlogController.getBlogs
);

// GET - Single (transform response)
router.get(
  "/:id",
  transformResponseMiddleware("blogs"), // Add this
  validateParams(blogIdParamsSchema),
  adminBlogController.getBlogById
);

// PUT - Update (auto-translate)
router.put(
  "/:id",
  handleMulterError(upload.single("coverImage"), "cover image"),
  autoTranslateMiddleware("blogs"), // Add this
  validateParams(blogIdParamsSchema),
  validateJoi(updateBlogSchema),
  adminBlogController.updateBlog
);
```

### Controller File (No changes needed if using middleware)

The controller remains the same. The middleware handles translation automatically.

## Request/Response Examples

### Create Blog (Admin sends English only)

**Request:**
```json
POST /api/v1/admin/blogs
{
  "title": "Daily Health Tips",
  "description": "Essential vitamins for daily health"
}
```

**What happens:**
1. Middleware intercepts request
2. Translates to all languages
3. Stores in database:
```json
{
  "title": {
    "en": "Daily Health Tips",
    "nl": "Dagelijkse Gezondheidstips",
    "de": "Tägliche Gesundheitstipps",
    "fr": "Conseils de santé quotidiens",
    "es": "Consejos de salud diarios"
  },
  "description": {
    "en": "Essential vitamins for daily health",
    "nl": "Essentiële vitamines voor dagelijkse gezondheid",
    ...
  }
}
```

### Get Blog (User with Dutch language preference)

**Request:**
```json
GET /api/v1/admin/blogs/:id
```

**Response (User language: Dutch):**
```json
{
  "success": true,
  "data": {
    "title": "Dagelijkse Gezondheidstips",
    "description": "Essentiële vitamines voor dagelijkse gezondheid"
  }
}
```

## Testing

### 1. Test Translation

```bash
# Set environment variable
export TRANSLATION_ENABLED=true
export GOOGLE_TRANSLATE_API_KEY=your_key

# Create a blog with English text
curl -X POST http://localhost:8080/api/v1/admin/blogs \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Blog",
    "description": "This is a test blog"
  }'

# Check database - should have all 5 languages
```

### 2. Test Response Transformation

```bash
# Get blog (user with Dutch language)
curl -X GET http://localhost:8080/api/v1/admin/blogs/:id \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response should be in Dutch
```

## Error Handling

- **Translation fails**: Original English text is preserved
- **API key missing**: Placeholder text is used `[NL] Original Text`
- **User language not found**: Falls back to English
- **Translation disabled**: Returns English only

## Performance Considerations

- Translations are cached in database (no re-translation on reads)
- Translation happens only on create/update
- Batch translation is used when possible
- Timeout set to 10-15 seconds for API calls

## Migration Notes

For existing data:
1. Existing English data will work as-is
2. Translations will be added on next update
3. No migration script needed - translations happen automatically

## Troubleshooting

### Translation not working
- Check `TRANSLATION_ENABLED=true` in .env
- Verify `GOOGLE_TRANSLATE_API_KEY` is set
- Check API key has Translate API enabled in Google Cloud

### Response not in user language
- Verify user has `language` field set in database
- Check middleware is added to routes
- Verify model name matches in middleware

### Translation errors
- Check Google Translate API quota
- Verify network connectivity
- Check logs for specific error messages


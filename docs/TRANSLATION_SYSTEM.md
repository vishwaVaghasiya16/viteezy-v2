# Multilingual Content Translation System

## Overview

The backend translation system automatically translates dynamic CMS content into supported languages and serves the correct language version based on user-selected locale.

## Supported Languages

- **English (en)** - Default/Source language
- **Dutch (nl)**
- **German (de)**
- **French (fr)**
- **Spanish (es)**

## Architecture

### 1. Translation Service (`src/services/translationService.ts`)

Handles translation API integration. Supports multiple providers:

- **DeepL** (default)
- **Google Translate**
- **Microsoft Translator**

**Environment Variables:**

```env
TRANSLATION_ENABLED=true
TRANSLATION_API_KEY=your_api_key_here
TRANSLATION_API_URL=https://api-free.deepl.com/v2/translate  # For DeepL
TRANSLATION_PROVIDER=deepl  # deepl, google, or microsoft
```

**Usage:**

```typescript
import { translationService } from "@/services/translationService";

// Translate single text
const translated = await translationService.translateText("Hello", "nl", "en");

// Translate I18n object
const i18nString = { en: "Hello World" };
const translated = await translationService.translateI18nString(i18nString);
// Result: { en: "Hello World", nl: "Hallo Wereld", de: "Hallo Welt", ... }
```

### 2. Locale Middleware (`src/middleware/locale.ts`)

Detects language from URL query parameter `?lang=`

**Usage:**

```typescript
// Request: GET /api/v1/products?lang=nl
// req.locale will be set to "nl"
```

### 3. Response Transform Middleware (`src/middleware/responseTransform.ts`)

Automatically transforms I18n objects in API responses to single values based on locale.

**Example:**

```json
// Database stores:
{
  "title": {
    "en": "Product Name",
    "nl": "Productnaam",
    "de": "Produktname"
  }
}

// API Response with ?lang=nl:
{
  "title": "Productnaam"
}
```

## Data Models

### I18nStringType & I18nTextType

Extended to support all 5 languages:

```typescript
interface I18nStringType {
  en?: string;
  nl?: string;
  de?: string;
  fr?: string;
  es?: string;
}
```

## Translation Flow

### 1. Content Creation/Update

When creating or updating CMS content:

1. **Admin provides English content** (source language)
2. **Translation service automatically translates** to all supported languages
3. **All translations stored** in database as I18n objects
4. **Translation happens during create/update** (not during API requests)

**Example - Product Creation:**

```typescript
// Admin sends:
{
  "title": "Daily Essentials",
  "description": "Essential vitamins for daily health"
}

// System translates and stores:
{
  "title": {
    "en": "Daily Essentials",
    "nl": "Dagelijkse Essentials",
    "de": "Tägliche Essentials",
    "fr": "Essentiels Quotidiens",
    "es": "Esenciales Diarios"
  },
  "description": {
    "en": "Essential vitamins for daily health",
    "nl": "Essentiële vitamines voor dagelijkse gezondheid",
    ...
  }
}
```

### 2. Content Retrieval

When retrieving content:

1. **Locale detected** from `?lang=` query parameter
2. **Response transformed** to return single value for requested language
3. **Falls back to English** if translation not available

**Example - Product Retrieval:**

```bash
# Request: GET /api/v1/products/123?lang=nl
# Response:
{
  "title": "Dagelijkse Essentials",
  "description": "Essentiële vitamines voor dagelijkse gezondheid"
}
```

## Supported Entities

The translation system covers:

1. **Products**

   - `title` (I18nString)
   - `description` (I18nText)
   - `howToUse` (I18nText)
   - `nutritionInfo` (I18nText)

2. **Blogs**

   - `title` (I18nString)
   - `excerpt` (I18nText)
   - `content` (I18nText)

3. **FAQs**

   - `question` (I18nString)
   - `answer` (I18nText)

4. **Categories**

   - `name` (I18nString)
   - `description` (I18nText)

5. **Ingredients**

   - `name` (I18nString)
   - `description` (I18nText)
   - `benefits` (I18nText)

6. **Static Pages**
   - All translatable fields

## Manual Translation Override

Admins can manually update translations via CMS:

```typescript
// Update specific language translation
PUT /api/v1/admin/products/:id
{
  "title": {
    "en": "Daily Essentials",
    "nl": "Custom Dutch Translation",  // Manual override
    "de": "Custom German Translation"  // Manual override
  }
}
```

## API Usage Examples

### Get Products in Dutch

```bash
GET /api/v1/products?lang=nl
```

### Get Single Product in German

```bash
GET /api/v1/products/123?lang=de
```

### Create Product (Auto-translates)

```bash
POST /api/v1/admin/products
{
  "title": "New Product",
  "description": "Product description in English"
}
# System automatically translates to nl, de, fr, es
```

### Update Product Translation Manually

```bash
PUT /api/v1/admin/products/123
{
  "title": {
    "en": "Product Name",
    "nl": "Aangepaste Nederlandse Naam"  // Custom translation
  }
}
```

## Development Mode

When `TRANSLATION_ENABLED=false` or no API key:

- Translations return placeholder: `[NL] Original Text`
- No actual API calls made
- Useful for development/testing

## Best Practices

1. **Always provide English content** as source
2. **Review auto-translations** for marketing/sensitive content
3. **Use manual overrides** for brand-specific terminology
4. **Test translations** before publishing
5. **Monitor translation API usage** to avoid exceeding limits

## Error Handling

- Translation failures **don't break** create/update operations
- Original English text is **preserved** if translation fails
- Errors are **logged** for monitoring
- API responses **fallback** to English if requested language unavailable

# Language Centralization Summary

## Overview

All hardcoded language codes have been centralized and replaced with dynamic language management from `languageService`. This allows the system to work with any configured languages without code changes.

## Centralized Files

### 1. **Language Service** (`src/services/languageService.ts`)
- Main service for language management
- Methods: `getAllLanguages()`, `getActiveLanguages()`, `isValidLanguage()`, etc.
- Caching: 5 minutes TTL

### 2. **Language Constants** (`src/utils/languageConstants.ts`)
- Centralized language utilities and constants
- `DEFAULT_LANGUAGE_CODE`: "en"
- `getLanguageCodeFromName()`: Convert language name to code
- `normalizeLanguageCode()`: Normalize language codes
- `createJoiLanguageSchema()`: Joi validation helper

### 3. **I18n Validation Helper** (`src/utils/i18nValidationHelper.ts`)
- `getLanguageQuerySchema()`: Dynamic language validation for query parameters
- Validates against configured languages from `languageService`
- Fallback to common languages for backward compatibility

## Updated Files

### Validation Files (All use `getLanguageQuerySchema()`)
- ✅ `src/validation/blogValidation.ts`
- ✅ `src/validation/faqValidation.ts`
- ✅ `src/validation/teamMemberValidation.ts`
- ✅ `src/validation/aboutUsValidation.ts`
- ✅ `src/validation/membershipValidation.ts`
- ✅ `src/validation/ourTeamPageValidation.ts`
- ✅ `src/validation/productValidation.ts`

### Controller Files (All use centralized utilities)
- ✅ `src/controllers/landingPageController.ts`
- ✅ `src/controllers/aboutUsController.ts`
- ✅ `src/controllers/teamMemberController.ts`
- ✅ `src/controllers/ourTeamPageController.ts`
- ✅ `src/utils/translationUtils.ts` (getUserLanguageCode now async)

## Key Changes

### Before (Hardcoded):
```typescript
// Validation
lang: Joi.string().valid("en", "nl", "de", "fr", "es").optional()

// Controller
type SupportedLanguage = "en" | "nl" | "de" | "fr" | "es";
const supportedLanguages = ["en", "nl", "de", "fr", "es"];
```

### After (Dynamic):
```typescript
// Validation
import { getLanguageQuerySchema } from "@/utils/i18nValidationHelper";
lang: getLanguageQuerySchema().label("Language")

// Controller
import { SupportedLanguage, DEFAULT_LANGUAGE } from "@/models/common.model";
import { DEFAULT_LANGUAGE_CODE, normalizeLanguageCode } from "@/utils/languageConstants";
import { languageService } from "@/services/languageService";

const getLanguageFromQuery = async (lang?: string): Promise<SupportedLanguage> => {
  if (!lang) return DEFAULT_LANGUAGE_CODE;
  const normalized = normalizeLanguageCode(lang);
  const isValid = await languageService.isValidLanguage(normalized);
  return isValid ? normalized : DEFAULT_LANGUAGE_CODE;
};
```

## Benefits

1. **No Code Changes Needed**: Add/remove languages via admin panel
2. **Centralized Management**: All language logic in one place
3. **Dynamic Validation**: Validation schemas check against configured languages
4. **Backward Compatible**: Falls back to common languages if service unavailable
5. **Type Safe**: Uses `SupportedLanguage` type from common.model

## Usage Examples

### In Validation Schemas:
```typescript
import { getLanguageQuerySchema } from "@/utils/i18nValidationHelper";

export const mySchema = Joi.object({
  lang: getLanguageQuerySchema().label("Language"),
  // ... other fields
});
```

### In Controllers:
```typescript
import { DEFAULT_LANGUAGE_CODE, normalizeLanguageCode } from "@/utils/languageConstants";
import { languageService } from "@/services/languageService";

const getLanguage = async (lang?: string): Promise<string> => {
  if (!lang) return DEFAULT_LANGUAGE_CODE;
  const normalized = normalizeLanguageCode(lang);
  const isValid = await languageService.isValidLanguage(normalized);
  return isValid ? normalized : DEFAULT_LANGUAGE_CODE;
};
```

## Migration Notes

- All language validation now uses `getLanguageQuerySchema()`
- All controllers use `languageService` for validation
- `getUserLanguageCode()` in `translationUtils.ts` is now async
- Controllers that use `getUserLanguageCode()` need to await it

## Testing

After adding a new language:
1. Language appears in validation automatically
2. Controllers accept the new language code
3. Translation service translates to new language
4. No code changes required!


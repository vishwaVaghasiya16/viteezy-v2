# Enterprise-Level Multi-Language System

## Overview

Complete enterprise-grade multi-language system with centralized constants, dynamic language management, and MNC-level architecture.

## Architecture

### 1. **Constants Layer** (`src/constants/languageConstants.ts`)

**Enterprise-level constants file** with:
- ✅ **LANGUAGE_CODES**: All ISO 639-1 language codes (30+ languages)
- ✅ **LANGUAGE_NAMES**: Language display names mapping
- ✅ **DEFAULT_LANGUAGE**: Default language configuration
- ✅ **DEFAULT_LANGUAGE_CONFIG**: Default language setup array
- ✅ **LANGUAGE_VALIDATION**: Validation constants (patterns, min/max lengths)
- ✅ **LANGUAGE_CACHE**: Cache configuration
- ✅ **LANGUAGE_TRANSLATION**: Translation settings
- ✅ **Helper Functions**: `getLanguageName()`, `getLanguageCode()`, `isValidLanguageCode()`, etc.

### 2. **Service Layer** (`src/services/languageService.ts`)

**Dynamic language management service**:
- Gets languages from database (GeneralSettings)
- Caching with TTL
- Fallback to constants if DB unavailable
- All methods use constants from `@/constants/languageConstants`

### 3. **Utility Layer** (`src/utils/languageConstants.ts`)

**Backward compatibility layer**:
- Re-exports from `@/constants/languageConstants`
- Provides async helpers for languageService integration
- Maintains compatibility with existing code

### 4. **Validation Layer** (`src/utils/i18nValidationHelper.ts`)

**Dynamic validation helpers**:
- `getLanguageQuerySchema()`: Dynamic Joi validation
- Validates against configured languages
- Fallback to constants for backward compatibility

## Constants Structure

```typescript
// src/constants/languageConstants.ts

export const LANGUAGE_CODES = {
  ENGLISH: "en",
  DUTCH: "nl",
  GERMAN: "de",
  FRENCH: "fr",
  SPANISH: "es",
  ITALIAN: "it",
  PORTUGUESE: "pt",
  // ... 30+ languages
};

export const LANGUAGE_NAMES = {
  [LANGUAGE_CODES.ENGLISH]: "English",
  [LANGUAGE_CODES.DUTCH]: "Dutch",
  // ... all languages
};

export const DEFAULT_LANGUAGE = {
  CODE: LANGUAGE_CODES.ENGLISH,
  NAME: LANGUAGE_NAMES[LANGUAGE_CODES.ENGLISH],
};

export const LANGUAGE_VALIDATION = {
  CODE_PATTERN: /^[A-Z]{2}$/i,
  CODE_MIN_LENGTH: 2,
  CODE_MAX_LENGTH: 2,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
};

export const LANGUAGE_CACHE = {
  TTL: 5 * 60 * 1000, // 5 minutes
  KEY_PREFIX: "lang:",
};
```

## Import Pattern

### For Constants:
```typescript
import {
  LANGUAGE_CODES,
  LANGUAGE_NAMES,
  DEFAULT_LANGUAGE,
  LANGUAGE_VALIDATION,
  isValidLanguageCode,
  normalizeLanguageCode,
  getLanguageName,
} from "@/constants/languageConstants";
```

### For Services:
```typescript
import { languageService } from "@/services/languageService";
```

### For Validation:
```typescript
import { getLanguageQuerySchema } from "@/utils/i18nValidationHelper";
```

## Updated Files

### Constants (1 new file):
- ✅ `src/constants/languageConstants.ts` - **Enterprise constants file**

### Services (1 updated):
- ✅ `src/services/languageService.ts` - Uses constants

### Controllers (2 updated):
- ✅ `src/controllers/adminLanguageController.ts` - Uses constants
- ✅ `src/controllers/adminGeneralSettingsController.ts` - Uses constants

### Models (2 updated):
- ✅ `src/models/common.model.ts` - Uses constants
- ✅ `src/models/cms/generalSettings.model.ts` - Uses constants

### Validation (2 updated):
- ✅ `src/validation/adminLanguageValidation.ts` - Uses constants
- ✅ `src/validation/adminGeneralSettingsValidation.ts` - Uses constants

### Utils (2 updated):
- ✅ `src/utils/languageConstants.ts` - Re-exports from constants
- ✅ `src/utils/translationUtils.ts` - Uses constants

## Benefits

1. ✅ **Enterprise-Grade**: MNC-level architecture with proper constants
2. ✅ **Centralized**: All constants in one place (`src/constants/languageConstants.ts`)
3. ✅ **Scalable**: Supports 30+ languages out of the box
4. ✅ **Type-Safe**: Proper TypeScript types and interfaces
5. ✅ **Maintainable**: Easy to add/remove languages
6. ✅ **Consistent**: Same pattern across entire codebase
7. ✅ **Documented**: Comprehensive constants with helpers

## Usage Examples

### Using Constants:
```typescript
import { LANGUAGE_CODES, DEFAULT_LANGUAGE } from "@/constants/languageConstants";

const lang = LANGUAGE_CODES.ENGLISH; // "en"
const defaultLang = DEFAULT_LANGUAGE.CODE; // "en"
const defaultName = DEFAULT_LANGUAGE.NAME; // "English"
```

### Using Validation:
```typescript
import { LANGUAGE_VALIDATION } from "@/constants/languageConstants";

if (LANGUAGE_VALIDATION.CODE_PATTERN.test(code)) {
  // Valid language code
}
```

### Using Helpers:
```typescript
import { getLanguageName, normalizeLanguageCode } from "@/constants/languageConstants";

const name = getLanguageName("en"); // "English"
const normalized = normalizeLanguageCode("EN"); // "en"
```

## Language Management

### Add Language:
```bash
POST /api/v1/admin/languages
{
  "code": "IT",
  "name": "Italian",
  "isEnabled": true
}
```

### All Languages Available:
The system supports 30+ languages by default:
- en, nl, de, fr, es (default)
- it, pt, ru, zh, ja, ko, ar, hi, tr, pl, sv, no, da, fi, el, cs, ro, hu, bg, hr, sr, sk, sl

### Future Languages:
Add any ISO 639-1 2-letter code via admin panel!

## System Architecture

```
┌─────────────────────────────────────┐
│   Constants Layer                   │
│   @/constants/languageConstants    │
│   - LANGUAGE_CODES                 │
│   - LANGUAGE_NAMES                 │
│   - DEFAULT_LANGUAGE               │
│   - LANGUAGE_VALIDATION            │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Service Layer                     │
│   @/services/languageService        │
│   - Dynamic language management     │
│   - Database integration            │
│   - Caching                         │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Utility Layer                     │
│   @/utils/languageConstants         │
│   - Backward compatibility          │
│   - Helper functions                │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Application Layer                 │
│   - Controllers                     │
│   - Validation                      │
│   - Routes                          │
└─────────────────────────────────────┘
```

## Complete! ✅

The system is now enterprise-ready with:
- ✅ Centralized constants
- ✅ Dynamic language management
- ✅ MNC-level architecture
- ✅ Type-safe implementation
- ✅ Scalable and maintainable


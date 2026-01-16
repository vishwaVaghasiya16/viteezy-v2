# Dynamic Language Management System

## Overview

This system allows administrators to dynamically add, update, and remove languages from the application without code changes. Languages are managed through the admin panel and stored in `GeneralSettings`.

## Key Features

1. **Dynamic Language Configuration**: Languages are stored in database, not hardcoded
2. **Admin Panel Management**: Full CRUD operations for languages via `/api/v1/admin/languages`
3. **Automatic Translation**: New languages are automatically included in translation workflows
4. **Flexible I18n Schemas**: Mongoose schemas accept any language codes
5. **Backward Compatible**: Existing code continues to work with new languages

## Architecture

### 1. Language Service (`src/services/languageService.ts`)

Central service for language management:
- `getAllLanguages()`: Get all configured languages (enabled + disabled)
- `getActiveLanguages()`: Get only enabled languages
- `isValidLanguage(code)`: Check if language code exists
- `isLanguageActive(code)`: Check if language is enabled
- `getLanguageName(code)`: Get language name by code
- `clearCache()`: Clear language cache after updates

**Caching**: Active languages are cached for 5 minutes to improve performance.

### 2. Language Model (`src/models/cms/generalSettings.model.ts`)

Languages are stored in `GeneralSettings.languages` array:
```typescript
{
  code: "EN",        // ISO 639-1 code (2 letters, uppercase)
  name: "English",   // Display name
  isEnabled: true    // Enable/disable flag
}
```

**Validation**: Language codes must be valid 2-letter ISO 639-1 codes (e.g., EN, NL, DE, FR, ES, IT, PT, RU, etc.)

### 3. I18n Schemas (`src/models/common.model.ts`)

I18n schemas are now flexible:
- `I18nStringType` and `I18nTextType` accept any language codes
- Mongoose schemas use `strict: false` to allow additional language fields
- English (`en`) is always required/present

### 4. Admin Language Routes (`src/routes/adminLanguageRoutes.ts`)

**GET** `/api/v1/admin/languages`
- Get all languages with their status

**POST** `/api/v1/admin/languages`
- Add a new language
- Body: `{ code: "IT", name: "Italian", isEnabled: false }`

**PUT** `/api/v1/admin/languages/:code`
- Update language name or status
- Body: `{ name?: "Italian", isEnabled?: true }`

**PATCH** `/api/v1/admin/languages/:code/toggle`
- Toggle language enabled/disabled status

**DELETE** `/api/v1/admin/languages/:code`
- Delete a language (cannot delete English)

### 5. Translation Service (`src/services/translationService.ts`)

Automatically translates to all configured languages:
- Uses `languageService.getAllLanguages()` to get target languages
- Translates English content to all other languages
- Works with any number of languages

## Usage Examples

### Adding a New Language

```bash
# Add Italian language
POST /api/v1/admin/languages
{
  "code": "IT",
  "name": "Italian",
  "isEnabled": true
}
```

### Enabling/Disabling a Language

```bash
# Toggle language status
PATCH /api/v1/admin/languages/IT/toggle

# Or update directly
PUT /api/v1/admin/languages/IT
{
  "isEnabled": false
}
```

### Removing a Language

```bash
# Delete a language (cannot delete English)
DELETE /api/v1/admin/languages/IT
```

## Important Notes

1. **English is Protected**: 
   - English (EN) cannot be disabled or deleted
   - It's always the default/source language

2. **Language Code Format**:
   - Must be 2-letter ISO 639-1 code
   - Stored in uppercase (EN, NL, etc.)
   - Used in lowercase in I18n objects (en, nl, etc.)

3. **Cache Management**:
   - Language cache is cleared automatically after updates
   - Cache TTL: 5 minutes
   - Manual clear: `languageService.clearCache()`

4. **Backward Compatibility**:
   - Existing validation schemas still work
   - I18n objects accept additional language keys
   - Default languages (en, nl, de, fr, es) are still supported

## Migration Guide

### For Developers

1. **Validation Schemas**: 
   - Use `createStaticI18nStringSchema()` or `createStaticI18nTextSchema()` from `src/utils/i18nValidationHelper.ts`
   - Or keep existing schemas - they'll accept additional languages

2. **Language Queries**:
   - Use `languageService.getActiveLanguages()` instead of hardcoded arrays
   - Use `languageService.isValidLanguage(code)` for validation

3. **Translation**:
   - Translation service automatically uses all configured languages
   - No code changes needed

### For Admins

1. **Adding Languages**:
   - Go to Admin Panel → Languages
   - Click "Add Language"
   - Enter code (2 letters) and name
   - Enable if ready to use

2. **Managing Languages**:
   - Enable/disable languages as needed
   - Disabled languages won't appear in user-facing APIs
   - Can delete languages that are no longer needed

## Testing

After adding a new language:

1. **Verify Language Added**:
   ```bash
   GET /api/v1/admin/languages
   ```

2. **Test Translation**:
   - Create/update content in English
   - Verify it's translated to new language

3. **Test API Response**:
   - Request content with `?lang=it` (new language code)
   - Verify content is returned in Italian

## Future Enhancements

- Language-specific translation providers
- Language fallback chains
- Language-specific content validation
- Bulk language operations


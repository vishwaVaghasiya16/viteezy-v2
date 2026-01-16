# Language Migration & Database Management Guide

## Overview

When languages are added or removed from the system, existing database records need to be managed properly. This guide explains how the system handles language data in existing records.

## How It Works

### 1. **Adding a New Language**

When you add a new language (e.g., Italian "IT"):

✅ **What Happens:**
- Language is added to `GeneralSettings.languages`
- New records can immediately use the new language
- Existing records **don't need migration** - they simply don't have the new language yet
- When existing records are updated, the new language can be added

✅ **Example:**
```json
// Existing FAQ record (before adding Italian)
{
  "question": { "en": "How to reset password?", "nl": "Hoe wachtwoord resetten?" },
  "answer": { "en": "Click forgot password...", "nl": "Klik op wachtwoord vergeten..." }
}

// After adding Italian and updating the record
{
  "question": { 
    "en": "How to reset password?", 
    "nl": "Hoe wachtwoord resetten?",
    "it": "Come resettare la password?"  // New language added
  },
  "answer": { 
    "en": "Click forgot password...", 
    "nl": "Klik op wachtwoord vergeten...",
    "it": "Clicca password dimenticata..."  // New language added
  }
}
```

### 2. **Removing a Language**

When you remove a language (e.g., remove Dutch "NL"):

⚠️ **What Happens:**
- Language is removed from `GeneralSettings.languages`
- Language is no longer available for new records
- **Old language data in existing records is PRESERVED** (not deleted automatically)
- API responses will ignore the removed language and fallback to English
- You can optionally clean up old language data using the migration service

⚠️ **Example:**
```json
// Existing FAQ record (before removing Dutch)
{
  "question": { 
    "en": "How to reset password?", 
    "nl": "Hoe wachtwoord resetten?",
    "it": "Come resettare la password?"
  }
}

// After removing Dutch from GeneralSettings:
// - The "nl" field still exists in the database
// - API responses will ignore "nl" and return English or Italian
// - You can optionally clean it up using the cleanup endpoint
```

## API Endpoints

### 1. Check Language Usage Statistics

**GET** `/api/v1/admin/languages/:code/usage-stats`

Shows how many documents contain a specific language before deletion.

```bash
curl -X GET \
  http://localhost:3000/api/v1/admin/languages/IT/usage-stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "languageCode": "it",
    "collections": [
      {
        "name": "faqs",
        "documentCount": 100,
        "fieldsWithLanguage": 45
      },
      {
        "name": "blogs",
        "documentCount": 50,
        "fieldsWithLanguage": 30
      }
    ],
    "totalDocuments": 75
  }
}
```

### 2. Clean Up Language Data (Dry Run)

**POST** `/api/v1/admin/languages/:code/cleanup?dryRun=true`

Shows what would be changed without actually modifying data (default behavior).

```bash
curl -X POST \
  "http://localhost:3000/api/v1/admin/languages/IT/cleanup?dryRun=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "affectedCollections": ["faqs", "blogs"],
    "totalDocuments": 75,
    "dryRun": true,
    "message": "Dry run completed. No data was modified."
  }
}
```

### 3. Clean Up Language Data (Actual Cleanup)

**POST** `/api/v1/admin/languages/:code/cleanup?dryRun=false`

Actually removes the language data from all collections.

⚠️ **Warning:** This permanently deletes language data. Use dry-run first!

```bash
curl -X POST \
  "http://localhost:3000/api/v1/admin/languages/IT/cleanup?dryRun=false" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "affectedCollections": ["faqs", "blogs"],
    "totalDocuments": 75,
    "dryRun": false,
    "message": "Language data cleanup completed successfully."
  }
}
```

### 4. Clean Up Specific Collections

**POST** `/api/v1/admin/languages/:code/cleanup?dryRun=false&collections=faqs,blogs`

Clean up language data from specific collections only.

```bash
curl -X POST \
  "http://localhost:3000/api/v1/admin/languages/IT/cleanup?dryRun=false&collections=faqs,blogs" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Best Practices

### 1. **Before Removing a Language:**

1. ✅ Check usage statistics:
   ```bash
   GET /api/v1/admin/languages/:code/usage-stats
   ```

2. ✅ Run dry-run cleanup:
   ```bash
   POST /api/v1/admin/languages/:code/cleanup?dryRun=true
   ```

3. ✅ Review the results and decide if cleanup is needed

### 2. **When to Clean Up:**

✅ **Clean up if:**
- You're permanently removing a language
- You want to reduce database size
- You're sure the language won't be needed again

❌ **Don't clean up if:**
- You might re-enable the language later
- You want to preserve historical data
- The language data is valuable for future use

### 3. **After Removing a Language:**

- ✅ Old data won't cause errors (it's just ignored)
- ✅ API responses automatically fallback to English
- ✅ You can clean up later if needed
- ✅ No immediate action required

## How Response Transformation Works

The system automatically handles removed languages in API responses:

```typescript
// If user requests Dutch (nl) but it was removed:
// 1. System checks if "nl" exists in I18n object
// 2. If not found, falls back to English (en)
// 3. Returns English content

// Example:
{
  "question": { "en": "How to reset?", "nl": "Hoe resetten?" }  // Old data
}

// After removing Dutch:
// Request: GET /api/faqs?lang=nl
// Response: "How to reset?" (English fallback)
```

## Database Schema

I18n fields use `strict: false` in Mongoose schemas, which means:

✅ **Can store any language codes** (even if not configured)
✅ **Old language data won't cause errors**
✅ **Removed languages are simply ignored**

```typescript
// Schema definition
const I18nString = new Schema(
  {
    en: { type: String, trim: true },
    // Other languages are dynamically added
  },
  { _id: false, strict: false }  // Allows any language keys
);
```

## Migration Service

The `languageMigrationService` handles:

1. **Finding all documents** with a specific language
2. **Removing language fields** from I18n objects
3. **Supporting dry-run mode** for safety
4. **Handling nested objects** and arrays
5. **Working across all collections**

## Summary

| Action | Old Data Behavior | Cleanup Needed? |
|--------|------------------|-----------------|
| **Add Language** | No impact | ❌ No |
| **Remove Language** | Preserved, ignored in responses | ⚠️ Optional |
| **Re-enable Language** | Old data becomes available again | ❌ No |

## Important Notes

1. **Data Preservation**: Old language data is preserved by default for data integrity
2. **Automatic Fallback**: API responses automatically fallback to English if requested language doesn't exist
3. **No Errors**: Removed languages won't cause validation or runtime errors
4. **Optional Cleanup**: Cleanup is optional and can be done anytime
5. **Dry-Run First**: Always use dry-run mode before actual cleanup


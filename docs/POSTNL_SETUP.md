# PostNL API Setup Guide

## Overview

PostNL API is used for address validation for Netherlands (NL), Belgium (BE), and Luxembourg (LU) addresses. The API validates and normalizes addresses using postal codes and house numbers.

## Current Status

✅ **Good News:** The application handles PostNL API errors gracefully. Even if the API key is missing or invalid, addresses will still be saved successfully (without normalization).

⚠️ **Warning:** You'll see warnings in logs, but the application continues to work normally.

## How to Fix the 401 Error

### Option 1: Get a PostNL API Key (Recommended for Production)

1. **Sign up for PostNL API:**

   - Visit: https://developer.postnl.nl/
   - Create an account
   - Register your application
   - Get your API key

2. **Add to Environment Variables:**

   Add to your `.env` file:

   ```env
   POSTNL_API_KEY=your_postnl_api_key_here
   POSTNL_URL=https://api.postnl.nl/v2/address/benelux
   POSTNL_TIMEOUT_MS=5000
   ```

3. **Restart your application:**
   ```bash
   npm run dev
   # or
   pm2 restart viteezy-api
   ```

### Option 2: Disable PostNL Validation (For Development)

If you don't need PostNL validation in development:

1. **Remove or comment out the API key:**

   ```env
   # POSTNL_API_KEY=
   ```

2. **The application will automatically skip PostNL validation** and save addresses without normalization.

## How It Works

### With Valid API Key:

1. Address is validated with PostNL API
2. Address is normalized (corrected street names, postal codes, etc.)
3. Normalized address is saved to database

### Without API Key (Current State):

1. PostNL validation is skipped
2. Address is saved as provided by user
3. Warning is logged but operation succeeds

## Testing

### Test with Valid API Key:

```bash
curl -X POST http://localhost:3000/api/v1/addresses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "streetName": "Damrak",
    "houseNumber": "1",
    "postalCode": "1012LG",
    "address": "Damrak 1, 1012LG Amsterdam",
    "country": "NL",
    "city": "Amsterdam",
    "isDefault": true
  }'
```

### Expected Behavior:

- **With API Key:** Address validated and normalized by PostNL
- **Without API Key:** Address saved as-is (no validation)

## PostNL API Documentation

- **Official Docs:** https://developer.postnl.nl/
- **API Endpoint:** https://api.postnl.nl/v2/address/benelux (v2 API for Benelux countries)
- **Authentication:** API Key via `apikey` header or `Authorization: Bearer` header
- **Supported Countries:** Netherlands (NL), Belgium (BE), Luxembourg (LU)

## Troubleshooting

### Error: "PostNL responded with status 401"

- **Cause:** Invalid or missing API key
- **Solution:** Add valid `POSTNL_API_KEY` to `.env` file

### Error: "PostNL request timed out"

- **Cause:** Network issues or PostNL API is slow
- **Solution:** Increase `POSTNL_TIMEOUT_MS` in `.env` (default: 5000ms)

### Warning: "PostNL validation skipped"

- **Status:** This is normal if API key is not configured
- **Impact:** Addresses still save, just without normalization
- **Action:** Optional - configure API key if you need validation

## Important Notes

1. **PostNL API is Optional:** The application works fine without it
2. **Addresses Still Save:** Even without API key, addresses are saved successfully
3. **Only for NL/BE/LU:** PostNL validation only runs for these countries
4. **Production Recommendation:** Use PostNL API in production for better address quality

## Environment Variables

```env
# PostNL Configuration (Optional)
POSTNL_API_KEY=your_api_key_here
POSTNL_URL=https://api.postnl.nl/v2/address/benelux
POSTNL_TIMEOUT_MS=5000
```

## API v2 Changes

The integration now uses PostNL API v2 `/v2/address/benelux` endpoint which:

- Supports Benelux countries (NL, BE, LU)
- Uses updated payload structure
- Returns improved response format
- Better error handling

## Current Implementation

The code already handles PostNL errors gracefully:

```typescript
// In addressController.ts
catch (error: any) {
  // If auth error or not configured, log warning but continue
  if (isAuthError || isNotConfigured) {
    logger.warn("PostNL validation skipped...");
    return { success: true }; // Continue without normalization
  }
  // Other errors also continue without normalization
  return { success: true };
}
```

This means **your addresses are being saved successfully**, just without PostNL normalization.

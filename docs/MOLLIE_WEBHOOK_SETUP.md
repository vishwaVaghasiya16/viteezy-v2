# Mollie Webhook Setup Guide

## Overview

Mollie webhooks work differently than Stripe. Mollie **does not require a webhook secret** for validation. Instead, Mollie validates webhooks by:

1. Sending the payment ID in the webhook payload
2. Your server fetches the payment details from Mollie API using that payment ID
3. This ensures the webhook is authentic

## Webhook URL Configuration

### Production Setup

1. **Set your webhook URL in environment variables:**

   ```env
   APP_BASE_URL=https://yourdomain.com
   ```

2. **Register webhook in Mollie Dashboard:**
   - Go to: https://my.mollie.com/dashboard/settings/profiles
   - Select your profile
   - Navigate to "Webhooks" section
   - Add webhook URL: `https://yourdomain.com/api/v1/payments/webhook/mollie`
   - Save the configuration

### Local Development Setup

For local development, Mollie cannot reach `localhost` URLs. You have two options:

#### Option 1: Use ngrok (Recommended)

1. **Install ngrok:**

   ```bash
   npm install -g ngrok
   # or
   brew install ngrok
   ```

2. **Start your server:**

   ```bash
   npm run dev
   ```

3. **Expose localhost with ngrok:**

   ```bash
   ngrok http 8080
   ```

4. **Update environment variable:**

   ```env
   APP_BASE_URL=https://your-ngrok-url.ngrok-free.app
   ```

5. **Register webhook in Mollie Dashboard:**
   - Use the ngrok URL: `https://your-ngrok-url.ngrok-free.app/api/v1/payments/webhook/mollie`

#### Option 2: Skip Webhook (Development Only)

For development, webhooks are optional. The code automatically skips webhook URL in development mode:

```typescript
// In PaymentService.ts - webhook is undefined in development
const webhookUrl =
  process.env.NODE_ENV === "production"
    ? `${APP_BASE_URL}/api/v1/payments/webhook/${paymentMethod}`
    : undefined;
```

**Note:** Without webhooks, payment status won't update automatically. You'll need to manually verify payments.

## Webhook Endpoint

The webhook endpoint is already configured:

```
POST /api/v1/payments/webhook/mollie
```

This endpoint:

- Accepts Mollie webhook payloads
- Extracts payment ID from payload
- Fetches payment status from Mollie API
- Updates payment and order/membership status in database

## How It Works

1. **Payment Creation:**

   - When creating a payment, webhook URL is automatically set (if in production)
   - Format: `${APP_BASE_URL}/api/v1/payments/webhook/mollie`

2. **Webhook Processing:**

   - Mollie sends webhook to your endpoint
   - Controller receives the payload
   - PaymentService processes the webhook
   - MollieAdapter fetches payment details from Mollie API
   - Payment status is updated in database

3. **Status Updates:**
   - Payment status updated
   - Order status updated (if payment completed)
   - Membership status updated (if payment completed)

## Testing Webhooks

### Using Mollie Test Mode

1. Use test API key: `test_...`
2. Create test payments
3. Mollie will send webhooks to your registered URL

### Manual Webhook Testing

You can manually trigger webhook processing by calling:

```bash
curl -X POST http://localhost:8080/api/v1/payments/webhook/mollie \
  -H "Content-Type: application/json" \
  -d '{
    "id": "tr_xxxxxxxxxx"
  }'
```

Replace `tr_xxxxxxxxxx` with an actual Mollie payment ID.

## Important Notes

1. **No Webhook Secret Required:** Unlike Stripe, Mollie doesn't use webhook secrets
2. **Webhook URL Must Be Public:** Mollie must be able to reach your webhook URL
3. **HTTPS Required:** Production webhooks must use HTTPS
4. **Idempotency:** Webhooks may be sent multiple times - your code should handle this gracefully
5. **Webhook Registration:** You must register the webhook URL in Mollie Dashboard for it to work

## Troubleshooting

### Webhook Not Received

1. Check if webhook URL is registered in Mollie Dashboard
2. Verify `APP_BASE_URL` is set correctly
3. Ensure your server is publicly accessible
4. Check server logs for webhook errors

### Webhook Validation Error

- Mollie validates webhook URLs before accepting them
- If URL is unreachable, Mollie will reject it
- Use ngrok or similar tool for local development

### Payment Status Not Updating

1. Check webhook endpoint is receiving requests
2. Verify payment ID in webhook payload
3. Check database for payment record
4. Review server logs for errors

## Environment Variables

```env
# Required
MOLLIE_API_KEY=test_your_mollie_api_key_here

# Required for production webhooks
APP_BASE_URL=https://yourdomain.com

# Optional - for local development with ngrok
# APP_BASE_URL=https://your-ngrok-url.ngrok-free.app
```

## Code References

- **Webhook Endpoint:** `src/routes/paymentRoutes.ts` (line 110)
- **Webhook Controller:** `src/controllers/paymentController.ts` (line 246)
- **Webhook Service:** `src/services/payment/PaymentService.ts` (line 214)
- **Mollie Adapter:** `src/services/payment/adapters/MollieAdapter.ts` (line 105)

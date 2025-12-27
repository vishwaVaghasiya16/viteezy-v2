# Subscription Auto-Creation - Quick Reference

## TL;DR

Subscriptions are **automatically created** when:

1. ✅ Payment is completed (webhook or verification)
2. ✅ Order is a subscription order (`isOneTime = false`)
3. ✅ Order is for SACHETS variant
4. ✅ Order has valid plan days (30, 60, 90, or 180)

---

## Key Function

```typescript
// Location: src/services/payment/PaymentService.ts
async createSubscriptionFromOrder(order: any, payment: any): Promise<any | null>
```

**Returns**:

- Subscription object if created
- `null` if not eligible or already exists

---

## Eligibility Conditions

| Condition      | Check                    | Value                      |
| -------------- | ------------------------ | -------------------------- |
| Order Type     | `order.isOneTime`        | `false`                    |
| **OR**         | `order.planType`         | `"SUBSCRIPTION"`           |
| Variant        | `order.variantType`      | `"SACHETS"`                |
| Plan Days      | `order.selectedPlanDays` | `30`, `60`, `90`, or `180` |
| Payment Status | `payment.status`         | `"completed"`              |
| Order Status   | `order.paymentStatus`    | `"completed"`              |

---

## Auto-Generated Fields

```typescript
{
  subscriptionStartDate: new Date(),           // Current date
  subscriptionEndDate: undefined,              // Ongoing
  lastBilledDate: new Date(),                  // Current date
  initialDeliveryDate: new Date() + 1 day,     // Tomorrow
  nextDeliveryDate: new Date() + cycleDays,    // Based on plan
  nextBillingDate: new Date() + cycleDays,     // Based on plan
  status: "active"                             // Active by default
}
```

---

## Webhook Flow

### Stripe

```
checkout.session.completed
  → Verify signature
  → Update payment status
  → Update order status
  → Create subscription (if eligible)
```

### Mollie

```
payment.status === "paid"
  → Fetch payment
  → Update payment status
  → Update order status
  → Create subscription (if eligible)
```

---

## Safety Features

✅ **Duplicate Prevention**: Checks for existing subscription before creation  
✅ **Transaction Support**: All operations wrapped in database transaction  
✅ **Error Handling**: Errors logged but don't break payment flow  
✅ **Idempotency**: Multiple webhook calls won't create duplicates

---

## Testing Commands

### Create Test Order (Subscription)

```bash
curl -X POST http://localhost:8080/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "isOneTime": false,
    "variantType": "SACHETS",
    "selectedPlanDays": 60,
    "items": [...]
  }'
```

### Trigger Webhook (Stripe)

```bash
stripe trigger checkout.session.completed
```

### Check Subscription Created

```bash
curl -X GET http://localhost:8080/api/v1/subscriptions \
  -H "Authorization: Bearer <token>"
```

---

## Common Issues

### Subscription Not Created?

1. Check order type: `isOneTime` should be `false`
2. Check variant: Must be `"SACHETS"`
3. Check plan days: Must be 30, 60, 90, or 180
4. Check payment status: Must be `"completed"`
5. Check logs: Look for `[SUBSCRIPTION]` logs

### Duplicate Subscriptions?

- Should not happen (duplicate prevention)
- If it does, check transaction support
- Check database indexes on `orderId`

---

## Manual Creation (If Needed)

```typescript
import { paymentService } from "@/services/payment/PaymentService";

const order = await Orders.findById(orderId).lean();
const payment = await Payments.findById(paymentId).lean();

const subscription = await paymentService.createSubscriptionFromOrder(
  order,
  payment
);
```

---

## Log Patterns

```bash
# Success
✅ [SUBSCRIPTION] Subscription SUB-xxx created for order ORD-xxx

# Skip (not eligible)
ℹ️ [SUBSCRIPTION] Order ORD-xxx is one-time purchase, skipping

# Skip (duplicate)
⚠️ [SUBSCRIPTION] Subscription already exists for order ORD-xxx

# Error
❌ [SUBSCRIPTION] Failed to create subscription: <error>
```

---

## Files Modified

- `src/services/payment/PaymentService.ts` - Main logic
- `src/models/commerce/subscriptions.model.ts` - Schema
- `src/controllers/subscriptionController.ts` - API endpoints

---

## Related Documentation

- [Full Implementation Guide](./SUBSCRIPTION_AUTO_CREATION.md)
- [Database Schema](./DATABASE_SCHEMA.dbml)
- [API Documentation](./API_DOCUMENTATION.md)

---

**Quick Help**: Search logs for `[SUBSCRIPTION]` to debug issues

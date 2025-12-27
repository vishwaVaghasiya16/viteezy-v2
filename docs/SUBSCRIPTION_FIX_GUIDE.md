# 🔧 Subscription Auto-Creation Fix Guide

## 🔴 समस्या क्या थी?

आपने देखा कि दूसरे order के लिए subscription नहीं बन रहा था।

### कारण:

1. **30 Days Plan Disabled था** ❌

   - Subscription model में सिर्फ 60, 90, 180 days allowed थे
   - 30 days के orders के लिए subscription नहीं बन सकता था

2. **Server Restart नहीं किया** ❌

   - Code changes किए लेकिन server old code से चल रहा था
   - Build किया लेकिन server restart नहीं किया

3. **Webhook Timing Issue** ⚠️
   - Stripe multiple events भेजता है
   - `charge.updated` event आ रहा था जब payment पहले से ही complete था
   - Subscription सिर्फ तब बनता है जब status पहली बार `Pending` → `Completed` हो

---

## ✅ समाधान (Step by Step)

### Step 1: 30 Days Plan Enable करें (✅ Done)

```typescript
// src/models/enums.ts
export const SUBSCRIPTION_CYCLE_VALUES = [
  SubscriptionCycle.DAYS_30, // ✅ Added
  SubscriptionCycle.DAYS_60,
  SubscriptionCycle.DAYS_90,
  SubscriptionCycle.DAYS_180,
];
```

```typescript
// src/models/commerce/subscriptions.model.ts
validate: {
  validator: function (value: number) {
    return [30, 60, 90, 180].includes(value);  // ✅ Updated
  },
  message: "Cycle days must be 30, 60, 90, or 180",  // ✅ Updated
}
```

### Step 2: Build करें (✅ Done)

```bash
npm run build
```

### Step 3: Server Restart करें (⚠️ IMPORTANT!)

```bash
# Terminal 1 में जाएं
Ctrl + C  # Server stop करें

# फिर start करें
npm run dev
```

**यह सबसे important step है!** बिना restart के नया code load नहीं होगा।

---

## 🧪 Testing

### Test 1: नया Order Create करें

1. नया order create करें:

   - ✅ Subscription plan चुनें (30, 60, 90, या 180 days)
   - ✅ SACHETS variant चुनें
   - ✅ Payment complete करें

2. Logs में check करें:

```bash
# Success logs
✅ [SUBSCRIPTION] - Order is eligible for subscription
✅ [SUBSCRIPTION] - No duplicate found, proceeding...
✅ [SUBSCRIPTION] - Valid cycleDays: 30
✅ [SUBSCRIPTION] - Subscription created successfully!
✅ [SUBSCRIPTION] - Subscription Number: SUB-xxx
```

3. Database में verify करें:

```bash
mongosh viteezy --quiet --eval "db.subscriptions.find().sort({createdAt: -1}).limit(1).pretty()"
```

### Test 2: Existing Orders के लिए

अगर पहले के orders के लिए subscription बनाना है:

```bash
# सभी eligible orders के लिए subscriptions बनाएं
npx ts-node scripts/fix-existing-orders.ts
```

या किसी specific order के लिए:

```bash
# Single order के लिए
npx ts-node scripts/create-subscription.ts <orderId>
```

---

## 📊 Verification Checklist

### ✅ Server Running है?

```bash
# Terminal में check करें
# यह दिखना चाहिए:
✅ Server running on port 8080
✅ MongoDB connected
✅ Stripe payment gateway registered
✅ Mollie payment gateway registered
```

### ✅ Build Updated है?

```bash
# dist folder में latest files हैं?
ls -la dist/models/enums.js | head -1

# Recent timestamp होना चाहिए
```

### ✅ Database में Subscriptions हैं?

```bash
mongosh viteezy --quiet --eval "db.subscriptions.countDocuments()"

# 0 से ज्यादा होना चाहिए
```

### ✅ Logs में Subscription Creation दिख रहा है?

```bash
grep "SUBSCRIPTION.*created" logs/combined.log | tail -5

# Recent entries होनी चाहिए
```

---

## 🐛 Troubleshooting

### Issue 1: Subscription नहीं बन रहा

**Check करें**:

```bash
# Order details
mongosh viteezy --quiet --eval "db.orders.findOne({orderNumber: 'VTZ-xxx'}, {isOneTime: 1, variantType: 1, selectedPlanDays: 1, paymentStatus: 1})"
```

**Expected**:

- `isOneTime`: `false`
- `variantType`: `"SACHETS"`
- `selectedPlanDays`: 30, 60, 90, or 180
- `paymentStatus`: `"Completed"`

**Fix**:

```bash
# Manual script से बनाएं
npx ts-node scripts/create-subscription.ts <orderId>
```

### Issue 2: "Cycle days must be 60, 90, or 180" Error

**Reason**: Server old code से चल रहा है

**Fix**:

```bash
# Server restart करें
Ctrl + C
npm run dev
```

### Issue 3: Webhook में "Status Changed: false"

**Reason**: यह `charge.updated` event है, पहला event miss हो गया

**Fix**:

```bash
# Manual script से subscription बनाएं
npx ts-node scripts/create-subscription.ts <orderId>
```

### Issue 4: Multiple Webhooks आ रहे हैं

**Reason**: Stripe multiple events भेजता है:

- `payment_intent.succeeded`
- `charge.succeeded`
- `charge.updated`

**Solution**: यह normal है। Code में duplicate prevention है:

```typescript
// Check for existing subscription
const existingSubscription = await Subscriptions.findOne({
  orderId: order._id,
  isDeleted: false,
});

if (existingSubscription) {
  return null; // Skip creation
}
```

---

## 📝 Important Commands

### Development

```bash
# Build
npm run build

# Start server
npm run dev

# Check logs
tail -f logs/combined.log | grep SUBSCRIPTION
```

### Database

```bash
# Count subscriptions
mongosh viteezy --quiet --eval "db.subscriptions.countDocuments()"

# Latest subscription
mongosh viteezy --quiet --eval "db.subscriptions.find().sort({createdAt: -1}).limit(1).pretty()"

# Find order
mongosh viteezy --quiet --eval "db.orders.findOne({orderNumber: 'VTZ-xxx'})"
```

### Scripts

```bash
# Create subscription for single order
npx ts-node scripts/create-subscription.ts <orderId>

# Fix all existing orders
npx ts-node scripts/fix-existing-orders.ts
```

---

## 🎯 Expected Behavior

### When Payment Completes:

1. **Webhook Received**

   ```
   🔵 [WEBHOOK] Stripe Webhook Received
   ```

2. **Payment Updated**

   ```
   ✅ [PAYMENT SERVICE] Payment marked as COMPLETED
   ```

3. **Order Updated**

   ```
   ✅ [PAYMENT SERVICE] Order status updated to CONFIRMED
   ```

4. **Subscription Created**
   ```
   🟢 [SUBSCRIPTION] Create Subscription From Order
   ✅ [SUBSCRIPTION] Order is eligible for subscription
   ✅ [SUBSCRIPTION] Valid cycleDays: 30
   ✅ [SUBSCRIPTION] Subscription created successfully!
   ```

### Database State:

```javascript
// Order
{
  orderNumber: "VTZ-xxx",
  isOneTime: false,
  variantType: "SACHETS",
  selectedPlanDays: 30,
  paymentStatus: "Completed",
  status: "Confirmed"
}

// Payment
{
  status: "Completed",
  paymentMethod: "Stripe"
}

// Subscription
{
  subscriptionNumber: "SUB-xxx",
  status: "Active",
  cycleDays: 30,
  nextBillingDate: "2026-01-26",
  nextDeliveryDate: "2026-01-26"
}
```

---

## ✅ Final Checklist

Before testing:

- [x] 30 days enabled in enums.ts
- [x] Validation updated in subscriptions.model.ts
- [x] Build completed (`npm run build`)
- [ ] **Server restarted** (`npm run dev`) ⚠️ **DO THIS!**

After testing:

- [ ] New order creates subscription automatically
- [ ] Logs show subscription creation
- [ ] Database has subscription entry
- [ ] No duplicate subscriptions created

---

## 🚀 Next Steps

1. **Restart Server** (if not done)
2. **Test with new order**
3. **Monitor logs**
4. **Verify in database**
5. **Fix existing orders** (if needed)

---

**सबसे Important**: Server को restart करना न भूलें! 🔄

बिना restart के कोई भी code change apply नहीं होगा।

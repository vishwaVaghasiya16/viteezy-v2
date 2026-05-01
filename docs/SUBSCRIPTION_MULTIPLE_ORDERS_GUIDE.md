# 🔄 Multiple Orders के लिए Subscription Guide

## ✅ Current Behavior (Correct!)

**हर order के लिए अलग subscription बनता है:**

```
User → Order 1 (30 days) → Payment → Subscription 1 ✅
User → Order 2 (60 days) → Payment → Subscription 2 ✅
User → Order 3 (90 days) → Payment → Subscription 3 ✅
```

**एक user के पास multiple subscriptions हो सकते हैं!**

---

## 🔍 Code Logic

### Duplicate Check (Line 1516-1536 in PaymentService.ts)

```typescript
// यह orderId के base पर check करता है, userId के base पर नहीं
const existingSubscription = await Subscriptions.findOne({
  orderId: order._id, // ✅ Same ORDER के लिए duplicate नहीं
  isDeleted: false,
});

if (existingSubscription) {
  // Skip - इस ORDER के लिए पहले से subscription है
  return null;
}
```

**यह सही है!** क्योंकि:

- ✅ Same order के लिए duplicate subscription नहीं बनेगा
- ✅ Different orders के लिए अलग-अलग subscriptions बनेंगे
- ✅ एक user के पास multiple active subscriptions हो सकते हैं

---

## 🧪 Testing Steps

### Step 1: Check Current Status

```bash
# Run status check script
npx ts-node scripts/check-subscription-status.ts
```

यह दिखाएगा:

- कितने subscriptions हैं
- कौन से orders के subscriptions हैं
- कौन से orders के subscriptions missing हैं

### Step 2: Create Test Orders

**Order 1:**

```json
{
  "isOneTime": false,
  "variantType": "SACHETS",
  "selectedPlanDays": 30,
  "items": [...]
}
```

**Order 2:**

```json
{
  "isOneTime": false,
  "variantType": "SACHETS",
  "selectedPlanDays": 60,
  "items": [...]
}
```

**Order 3:**

```json
{
  "isOneTime": false,
  "variantType": "SACHETS",
  "selectedPlanDays": 90,
  "items": [...]
}
```

### Step 3: Complete Payments

हर order के लिए payment complete करें। Webhook आने पर:

```
✅ [SUBSCRIPTION] - Subscription created successfully!
✅ [SUBSCRIPTION] - Subscription Number: SUB-xxx-1
```

```
✅ [SUBSCRIPTION] - Subscription created successfully!
✅ [SUBSCRIPTION] - Subscription Number: SUB-xxx-2
```

```
✅ [SUBSCRIPTION] - Subscription created successfully!
✅ [SUBSCRIPTION] - Subscription Number: SUB-xxx-3
```

### Step 4: Verify in Database

```bash
npx ts-node scripts/check-subscription-status.ts
```

**Expected Output:**

```
📊 Total Subscriptions: 3

📋 Recent Subscriptions (Last 5):
1. Subscription: SUB-xxx-3
   Order ID: order_3_id
   Status: Active
   Cycle Days: 90

2. Subscription: SUB-xxx-2
   Order ID: order_2_id
   Status: Active
   Cycle Days: 60

3. Subscription: SUB-xxx-1
   Order ID: order_1_id
   Status: Active
   Cycle Days: 30
```

---

## 🐛 Troubleshooting

### Issue 1: Second Order का Subscription नहीं बन रहा

**Possible Reasons:**

#### Reason 1: Server Old Code से चल रहा है

**Check:**

```bash
# Server logs में देखें
tail -50 /path/to/terminals/1.txt | grep "Server running"
```

**Fix:**

```bash
# Server restart करें
Ctrl + C
npm run dev
```

#### Reason 2: Webhook में Status Change नहीं हो रहा

**Check Logs:**

```
🟢 [PAYMENT SERVICE] - Status Changed: false
ℹ️ [PAYMENT SERVICE] - Order update skipped
```

**Reason:** यह `charge.updated` event है, पहला event miss हो गया

**Fix:**

```bash
# Manual script से subscription बनाएं
npx ts-node scripts/create-subscription.ts <orderId>
```

#### Reason 3: Order Eligibility Issue

**Check:**

```bash
npx ts-node scripts/check-subscription-status.ts
```

**Look for:**

```
❌ Order: VTZ-xxx
   Has Subscription: NO
```

**Fix:**

```bash
# Individual order fix
npx ts-node scripts/create-subscription.ts <orderId>

# Or fix all orders
npx ts-node scripts/fix-existing-orders.ts
```

---

## 📊 Database Queries

### Check User's Subscriptions

```javascript
// MongoDB Shell
db.subscriptions
  .find({
    userId: ObjectId("user_id"),
    isDeleted: false,
  })
  .sort({ createdAt: -1 });
```

**Expected:** Multiple subscriptions for same user with different orderIds

### Check Order's Subscription

```javascript
// MongoDB Shell
db.subscriptions.findOne({
  orderId: ObjectId("order_id"),
  isDeleted: false,
});
```

**Expected:** One subscription per order

### Find Orders Without Subscriptions

```javascript
// MongoDB Shell
db.orders.aggregate([
  {
    $match: {
      paymentStatus: "Completed",
      isOneTime: false,
      variantType: "SACHETS",
      isDeleted: false,
    },
  },
  {
    $lookup: {
      from: "subscriptions",
      localField: "_id",
      foreignField: "orderId",
      as: "subscription",
    },
  },
  {
    $match: {
      subscription: { $size: 0 },
    },
  },
  {
    $project: {
      orderNumber: 1,
      selectedPlanDays: 1,
      createdAt: 1,
    },
  },
]);
```

---

## 🔧 Manual Fix Commands

### Fix Single Order

```bash
# Get order ID from logs or database
npx ts-node scripts/create-subscription.ts 694f6196de6c27827ee53d90
```

### Fix All Missing Subscriptions

```bash
# This will find all eligible orders without subscriptions
# and create subscriptions for them
npx ts-node scripts/fix-existing-orders.ts
```

### Check Status After Fix

```bash
npx ts-node scripts/check-subscription-status.ts
```

---

## 📝 Expected Logs

### When Subscription is Created

```
🟢 [SUBSCRIPTION] ========== Create Subscription From Order ==========
🟢 [SUBSCRIPTION] Order Number: VTZ-xxx
🟢 [SUBSCRIPTION] Order ID: 694f6196de6c27827ee53d90
🟢 [SUBSCRIPTION] Payment ID: 694f61a0de6c27827ee53dcb

🟢 [SUBSCRIPTION] Step 1: Validating order eligibility...
🟢 [SUBSCRIPTION] - isOneTime: false
🟢 [SUBSCRIPTION] - planType: Subscription
🟢 [SUBSCRIPTION] - variantType: SACHETS
🟢 [SUBSCRIPTION] - selectedPlanDays: 60
✅ [SUBSCRIPTION] - Order is eligible for subscription

🟢 [SUBSCRIPTION] Step 2: Checking for duplicate subscription...
✅ [SUBSCRIPTION] - No duplicate found, proceeding...

🟢 [SUBSCRIPTION] Step 3: Validating plan duration...
✅ [SUBSCRIPTION] - Valid cycleDays: 60

🟢 [SUBSCRIPTION] Step 4: Calculating subscription dates...
✅ [SUBSCRIPTION] - Dates calculated

🟢 [SUBSCRIPTION] Step 5: Mapping order items...
✅ [SUBSCRIPTION] - Items mapped: 1

🟢 [SUBSCRIPTION] Step 6: Creating subscription in database...
✅ [SUBSCRIPTION] - Subscription created successfully!
✅ [SUBSCRIPTION] - Subscription Number: SUB-xxx
✅ [SUBSCRIPTION] - Status: Active
```

### When Subscription Already Exists (Duplicate Prevention)

```
🟢 [SUBSCRIPTION] Step 2: Checking for duplicate subscription...
⚠️ [SUBSCRIPTION] - Subscription already exists, skipping creation
⚠️ [SUBSCRIPTION] - Existing Subscription ID: 694f608d7e46b95c82599840
```

### When Order is Not Eligible

```
🟢 [SUBSCRIPTION] Step 1: Validating order eligibility...
⚠️ [SUBSCRIPTION] - Order is one-time purchase
```

---

## ✅ Verification Checklist

### For Each New Order:

- [ ] Order created successfully
- [ ] Payment completed
- [ ] Webhook received and processed
- [ ] Subscription created (check logs)
- [ ] Subscription visible in database
- [ ] Subscription has correct cycleDays
- [ ] Subscription status is "Active"

### For Multiple Orders:

- [ ] User can have multiple active subscriptions
- [ ] Each order has its own subscription
- [ ] No duplicate subscriptions for same order
- [ ] Different orders have different subscription numbers

---

## 🚀 Production Checklist

Before deploying:

- [ ] Server is running latest code
- [ ] 30 days plan is enabled
- [ ] Build is up to date (`npm run build`)
- [ ] Logs show subscription creation
- [ ] Database has subscriptions
- [ ] Manual scripts work correctly
- [ ] Status check script works
- [ ] Fix scripts work for missing subscriptions

---

## 📞 Support Commands

### Quick Status Check

```bash
npx ts-node scripts/check-subscription-status.ts
```

### Quick Fix

```bash
# Fix all missing subscriptions
npx ts-node scripts/fix-existing-orders.ts
```

### Monitor Logs

```bash
# Watch for subscription creation
tail -f logs/combined.log | grep SUBSCRIPTION
```

---

## 🎯 Summary

**Current Implementation:**

- ✅ हर order के लिए अलग subscription बनता है
- ✅ एक user के पास multiple subscriptions हो सकते हैं
- ✅ Same order के लिए duplicate नहीं बनता
- ✅ Different orders के लिए अलग-अलग बनते हैं

**यह सही behavior है!**

अगर second order का subscription नहीं बन रहा तो:

1. Server restart करें
2. Logs check करें
3. Manual script से बनाएं
4. Status check script run करें

---

**अब Test करें!** 🚀

1. नया order create करें
2. Payment complete करें
3. Logs में subscription creation देखें
4. Database में verify करें

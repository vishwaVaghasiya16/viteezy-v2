# 🚨 Server Restart करने के निर्देश

## समस्या

आपने 30 days plan को enable किया है, लेकिन server old code से चल रहा है।

## समाधान: Server Restart करें

### Step 1: Server Stop करें

Terminal 1 में जाएं (जहां `npm run dev` चल रहा है):

```bash
# Press Ctrl + C to stop the server
```

### Step 2: Build करें (Already Done ✅)

```bash
npm run build
```

यह already हो चुका है, लेकिन अगर फिर से करना हो तो:

```bash
cd /Users/dreamworld/Documents/server-backup/vishwa/viteezy-phase-2
npm run build
```

### Step 3: Server Start करें

```bash
npm run dev
```

---

## Verification: Check करें कि सब ठीक है

### 1. Server Logs देखें

Server start होने के बाद, logs में यह दिखना चाहिए:

```
✅ Server running on port 8080
✅ MongoDB connected
✅ Stripe payment gateway registered
✅ Mollie payment gateway registered
```

### 2. Test Order Create करें

एक नया test order create करें:

- ✅ Subscription plan चुनें (30, 60, 90, या 180 days)
- ✅ SACHETS variant चुनें
- ✅ Payment complete करें
- ✅ Webhook आने का wait करें

### 3. Logs में Check करें

Logs में यह दिखना चाहिए:

```
🟢 [SUBSCRIPTION] ========== Create Subscription From Order ==========
🟢 [SUBSCRIPTION] Order Number: VTZ-xxx
✅ [SUBSCRIPTION] - Order is eligible for subscription
✅ [SUBSCRIPTION] - No duplicate found, proceeding...
✅ [SUBSCRIPTION] - Valid cycleDays: 30 (या 60, 90, 180)
✅ [SUBSCRIPTION] - Subscription created successfully!
✅ [SUBSCRIPTION] - Subscription Number: SUB-xxx
```

### 4. Database में Verify करें

```bash
mongosh viteezy --quiet --eval "db.subscriptions.find().sort({createdAt: -1}).limit(1).pretty()"
```

---

## अगर फिर भी Subscription नहीं बन रहा

### Option 1: Manual Script से बनाएं

```bash
npx ts-node scripts/create-subscription.ts <orderId>
```

### Option 2: Logs Check करें

```bash
# Subscription related logs देखें
grep "SUBSCRIPTION" logs/combined.log | tail -50

# Error logs देखें
grep "SUBSCRIPTION.*ERROR" logs/error.log | tail -20
```

### Option 3: Order Details Check करें

```bash
mongosh viteezy --quiet --eval "db.orders.findOne({orderNumber: 'VTZ-xxx'}, {isOneTime: 1, variantType: 1, selectedPlanDays: 1, planType: 1, paymentStatus: 1, status: 1})"
```

**Check करें**:

- ✅ `isOneTime` should be `false`
- ✅ `variantType` should be `"SACHETS"`
- ✅ `selectedPlanDays` should be 30, 60, 90, or 180
- ✅ `paymentStatus` should be `"Completed"`
- ✅ `status` should be `"Confirmed"`

---

## Important Notes

### 🔴 हमेशा याद रखें:

1. **Code change के बाद हमेशा server restart करें**
2. **Build करना न भूलें** (`npm run build`)
3. **Logs monitor करें** subscription creation के लिए
4. **Database में verify करें** कि subscription बना या नहीं

### ✅ अब क्या होगा:

- 30, 60, 90, और 180 days सभी plans work करेंगे
- Subscription automatically बनेगा payment complete होने पर
- Webhook में proper logs दिखेंगे
- Duplicate prevention काम करेगा

---

## Troubleshooting

### Issue: Server start नहीं हो रहा

```bash
# Port already in use error आ रहा है?
lsof -ti:8080 | xargs kill -9

# फिर start करें
npm run dev
```

### Issue: Build fail हो रहा है

```bash
# Clean build
npm run clean
npm run build
```

### Issue: MongoDB connection error

```bash
# MongoDB running है check करें
mongosh viteezy --eval "db.stats()"
```

---

**अब Server Restart करें और Test करें!** 🚀

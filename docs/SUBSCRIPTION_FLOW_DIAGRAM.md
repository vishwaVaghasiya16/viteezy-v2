# Subscription Auto-Creation - Flow Diagrams

## Overview Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER CHECKOUT FLOW                          │
└─────────────────────────────────────────────────────────────────────┘

User Selects Product
    ↓
User Chooses Plan Type
    ├─→ One-Time Purchase (isOneTime = true)
    │       ↓
    │   No Subscription Created ❌
    │
    └─→ Subscription (isOneTime = false)
            ↓
        User Selects Variant
            ├─→ STAND_UP_POUCH
            │       ↓
            │   No Subscription Created ❌
            │
            └─→ SACHETS
                    ↓
                User Selects Plan Days
                    ├─→ Invalid (not 30, 60, 90, 180)
                    │       ↓
                    │   No Subscription Created ❌
                    │
                    └─→ Valid (30, 60, 90, or 180)
                            ↓
                        Order Created
                            ↓
                        User Completes Payment
                            ↓
                        Subscription Created ✅
```

---

## Detailed Payment Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      PAYMENT COMPLETION FLOW                        │
└─────────────────────────────────────────────────────────────────────┘

                        Payment Completed
                              ↓
                    ┌─────────┴─────────┐
                    │                   │
              Stripe Webhook      Mollie Webhook
                    │                   │
                    └─────────┬─────────┘
                              ↓
                    Verify Webhook Signature
                              ↓
                    Update Payment Status
                    (status = "completed")
                              ↓
                    Update Order Status
                    (status = "confirmed")
                              ↓
                    Track Coupon Usage
                    (if coupon applied)
                              ↓
                    Send Order Confirmation Email
                              ↓
                    ┌─────────────────────┐
                    │ Check Subscription  │
                    │    Eligibility      │
                    └─────────────────────┘
                              ↓
                    ┌─────────┴─────────┐
                    │                   │
            Eligible ✅          Not Eligible ❌
                    │                   │
                    │                   └─→ Skip Creation
                    │
                    ↓
        Create Subscription
                    ↓
        Return Success
```

---

## Subscription Creation Logic

```
┌─────────────────────────────────────────────────────────────────────┐
│              createSubscriptionFromOrder() FUNCTION                 │
└─────────────────────────────────────────────────────────────────────┘

Start Transaction
    ↓
┌───────────────────────────────────────┐
│ STEP 1: Validate Order Eligibility   │
└───────────────────────────────────────┘
    ↓
Check: isOneTime === false?
    ├─→ NO → Abort Transaction → Return null
    └─→ YES
            ↓
Check: variantType === "SACHETS"?
    ├─→ NO → Abort Transaction → Return null
    └─→ YES
            ↓
Check: selectedPlanDays valid?
    ├─→ NO → Abort Transaction → Return null
    └─→ YES
            ↓
┌───────────────────────────────────────┐
│ STEP 2: Check for Duplicates         │
└───────────────────────────────────────┘
    ↓
Query: Subscription exists for orderId?
    ├─→ YES → Abort Transaction → Return null
    └─→ NO
            ↓
┌───────────────────────────────────────┐
│ STEP 3: Calculate Dates               │
└───────────────────────────────────────┘
    ↓
subscriptionStartDate = now
lastBilledDate = now
initialDeliveryDate = now + 1 day
nextDeliveryDate = now + cycleDays
nextBillingDate = now + cycleDays
    ↓
┌───────────────────────────────────────┐
│ STEP 4: Map Order Items               │
└───────────────────────────────────────┘
    ↓
Map order.items to subscription.items
    ↓
┌───────────────────────────────────────┐
│ STEP 5: Create Subscription          │
└───────────────────────────────────────┘
    ↓
Insert into subscriptions collection
    ↓
Commit Transaction
    ↓
Return Subscription ✅
```

---

## Webhook Processing Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    WEBHOOK PROCESSING FLOW                          │
└─────────────────────────────────────────────────────────────────────┘

Webhook Received
    ↓
┌─────────────────────────────────────┐
│  Extract Event Data                 │
│  - Event Type                       │
│  - Payment ID                       │
│  - Transaction ID                   │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Verify Signature                   │
│  (Stripe/Mollie specific)           │
└─────────────────────────────────────┘
    ↓
Signature Valid?
    ├─→ NO → Return 400 Error
    └─→ YES
            ↓
┌─────────────────────────────────────┐
│  Find Payment in Database           │
│  (by gatewayTransactionId)          │
└─────────────────────────────────────┘
    ↓
Payment Found?
    ├─→ NO → Return 404 Error
    └─→ YES
            ↓
┌─────────────────────────────────────┐
│  Check Payment Status               │
└─────────────────────────────────────┘
    ↓
Status = "completed"?
    ├─→ NO → Update Payment → Return
    └─→ YES
            ↓
Already Completed?
    ├─→ YES → Skip Update → Return
    └─→ NO
            ↓
┌─────────────────────────────────────┐
│  Update Payment Status              │
│  (status = "completed")             │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Find Order                         │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Update Order Status                │
│  (status = "confirmed")             │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Track Coupon Usage                 │
│  (if applicable)                    │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Send Confirmation Email            │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Create Subscription                │
│  (if eligible)                      │
└─────────────────────────────────────┘
    ↓
Return 200 OK
```

---

## Duplicate Prevention Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DUPLICATE PREVENTION FLOW                        │
└─────────────────────────────────────────────────────────────────────┘

First Webhook Received
    ↓
Start Transaction
    ↓
Query: Subscription exists?
    ├─→ YES → Abort → Return null
    └─→ NO
            ↓
        Create Subscription
            ↓
        Commit Transaction
            ↓
        Return Subscription ✅

Second Webhook Received (Duplicate)
    ↓
Start Transaction
    ↓
Query: Subscription exists?
    ├─→ YES → Abort → Return null ✅
    └─→ NO
            ↓
        (This branch won't execute)

Result: Only ONE subscription created ✅
```

---

## Transaction Rollback Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TRANSACTION ROLLBACK FLOW                        │
└─────────────────────────────────────────────────────────────────────┘

Start Transaction
    ↓
Validate Eligibility
    ↓
Check Duplicates
    ↓
Calculate Dates
    ↓
Map Items
    ↓
Create Subscription
    ↓
Database Error Occurs ❌
    ↓
Catch Error
    ↓
Rollback Transaction
    ↓
Log Error
    ↓
Return null

Result: No partial data created ✅
        Payment flow continues ✅
```

---

## Date Calculation Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DATE CALCULATION FLOW                            │
└─────────────────────────────────────────────────────────────────────┘

Payment Completed: Jan 1, 2025
Plan Days: 60

┌─────────────────────────────────────┐
│  subscriptionStartDate              │
│  = Payment Completion Date          │
│  = Jan 1, 2025                      │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  lastBilledDate                     │
│  = Payment Completion Date          │
│  = Jan 1, 2025                      │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  initialDeliveryDate                │
│  = subscriptionStartDate + 1 day    │
│  = Jan 2, 2025                      │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  nextDeliveryDate                   │
│  = subscriptionStartDate + 60 days  │
│  = Mar 2, 2025                      │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  nextBillingDate                    │
│  = subscriptionStartDate + 60 days  │
│  = Mar 2, 2025                      │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  subscriptionEndDate                │
│  = undefined (ongoing)              │
└─────────────────────────────────────┘
```

---

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ERROR HANDLING FLOW                              │
└─────────────────────────────────────────────────────────────────────┘

Subscription Creation Attempt
    ↓
Try Block
    ↓
Error Occurs ❌
    ↓
Catch Block
    ↓
┌─────────────────────────────────────┐
│  Rollback Transaction               │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Log Error                          │
│  - Error message                    │
│  - Stack trace                      │
│  - Order number                     │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Return null                        │
│  (Don't throw error)                │
└─────────────────────────────────────┘
    ↓
Payment Flow Continues ✅
Order Status = "confirmed" ✅
User Not Affected ✅
```

---

## Multi-Item Order Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MULTI-ITEM ORDER FLOW                            │
└─────────────────────────────────────────────────────────────────────┘

Order with Multiple Items
    ↓
┌─────────────────────────────────────┐
│  Item 1: Product A                  │
│  - planDays: 60                     │
│  - capsuleCount: 30                 │
│  - amount: 49.99                    │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Item 2: Product B                  │
│  - planDays: 60                     │
│  - capsuleCount: 60                 │
│  - amount: 89.99                    │
└─────────────────────────────────────┘
    ↓
Map to Subscription Items
    ↓
┌─────────────────────────────────────┐
│  Subscription Created               │
│  - cycleDays: 60 (from order)       │
│  - items: [Item 1, Item 2]          │
│  - nextBillingDate: +60 days        │
└─────────────────────────────────────┘
    ↓
Result: Single subscription with
        multiple items ✅
```

---

## Status Transition Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SUBSCRIPTION STATUS FLOW                         │
└─────────────────────────────────────────────────────────────────────┘

        ┌─────────────┐
        │   ACTIVE    │ ← Created on payment completion
        └─────────────┘
              │
              ├─────────────────┐
              │                 │
              ↓                 ↓
        ┌─────────────┐   ┌─────────────┐
        │   PAUSED    │   │  CANCELLED  │
        └─────────────┘   └─────────────┘
              │                 ↑
              └─────────────────┘
                    (Resume)

Status Transitions:
- ACTIVE → PAUSED (User pauses subscription)
- PAUSED → ACTIVE (User resumes subscription)
- ACTIVE → CANCELLED (User cancels subscription)
- PAUSED → CANCELLED (User cancels paused subscription)
- ACTIVE → EXPIRED (Subscription end date reached)
```

---

## Complete End-to-End Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    COMPLETE END-TO-END FLOW                         │
└─────────────────────────────────────────────────────────────────────┘

1. User Checkout
   ├─→ Select Product
   ├─→ Choose Subscription Plan
   ├─→ Select SACHETS Variant
   ├─→ Select Plan Days (60)
   └─→ Create Order

2. Payment Processing
   ├─→ User Completes Payment
   ├─→ Payment Gateway Processes
   └─→ Payment Status = "completed"

3. Webhook Received
   ├─→ Verify Signature
   ├─→ Update Payment Status
   └─→ Update Order Status

4. Subscription Creation
   ├─→ Check Eligibility ✅
   ├─→ Check Duplicates ✅
   ├─→ Calculate Dates
   ├─→ Map Items
   └─→ Create Subscription ✅

5. Post-Creation
   ├─→ Send Confirmation Email
   ├─→ Log Success
   └─→ Return Success Response

6. User Dashboard
   ├─→ View Subscription
   ├─→ See Next Billing Date
   ├─→ Manage Subscription
   └─→ Cancel/Pause if needed

Result: Complete subscription lifecycle ✅
```

---

## Legend

```
✅ = Success / Positive outcome
❌ = Failure / Negative outcome
→  = Flow direction
├─→ = Branch in flow
└─→ = Last branch in flow
↓  = Continues to next step
```

---

**Last Updated**: December 27, 2025

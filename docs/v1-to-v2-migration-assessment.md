# Viteezy V1 → V2 Data Migration Assessment

## Objective

Evaluate the feasibility, effort, and risks involved in migrating production data from Viteezy V1 (MySQL) into the new V2 platform (Node.js + MongoDB). This document summarizes key findings, schema differences, migration strategy, and recommended next steps.

---

## 1. Source & Target Overview

| Aspect               | V1 (Source)                                                | V2 (Target)                                                      |
| -------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| Database             | MySQL 5.7+ (single large schema)                           | MongoDB (Mongoose models under `src/models`)                     |
| Auth                 | `users`, `login`, `tokens`, `customers` tables             | `src/models/core/users.model.ts` (JWT + bcrypt)                  |
| Orders & Payments    | `orders`, `payment_plans`, `payments`, `pharmacist_orders` | `orders.model.ts`, `payments.model.ts`, `subscriptions.model.ts` |
| Products & CMS       | `products`, `blends`, `ingredient_*`, `website_content`    | `src/models/commerce/products.model.ts`, CMS models (i18n)       |
| Quiz/Personalization | Hundreds of tables ending with `_answers`                  | Not yet defined in V2; likely consolidated services              |
| Coupons              | `coupons`, `coupons_discount`, `coupons_used`              | `src/models/commerce/coupons.model.ts`                           |

> **Note:** The V2 platform standardizes on MongoDB only—MySQL is no longer part of the runtime data layer.

---

## 2. Major V1 Domains (from `v1/stage_db_backup_1.sql`)

| Domain                     | Representative Tables                                                                   | Notes                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Authentication & Users     | `users`, `customers`, `login`, `tokens`                                                 | Contains personal data + quiz attributes; passwords hashed via bcrypt. |
| Orders & Fulfillment       | `orders`, `order_items?` (inline), `pharmacist_orders`                                  | Order rows include UUID, status, created/updated timestamps.           |
| Payments & Plans           | `payment_plans` (~42K rows), `payments`, `payment_plans_history`                        | Most recurring billing logic here; statuses `ACTIVE/STOPPED/CANCELED`. |
| Subscriptions & Membership | Payment plan records double as subscriptions; no separate membership tables identified. |
| Products & Ingredients     | `products`, `ingredient_*`, `blends`, `ingredient_articles`                             | Highly normalized; ties into personalization engine.                   |
| Coupons & Promotions       | `coupons`, `coupons_discount`, `coupons_used`                                           | Similar concept to V2 but requires schema conversion.                  |
| CMS & Content              | `website_content`, `ingredient_content`, `notes`, `referrals`                           | Need to map to V2's multilingual documents.                            |
| Quiz / Intake              | Numerous `*_answers` and base tables (`sleep_qualitys`, `vitamin_intake_answers`, etc.) | Heavy relational footprint; may not be migrated initially.             |

---

## 3. Detailed Schema Comparison & Mapping

### Users & Auth

- **V1 structure**: `users`, `login`, `tokens`, `customers` plus health-profile tables. Mostly scalar columns (id, email, names, role, timestamps) with bcrypt hashes.
- **V2 target**: `src/models/core/users.model.ts` adds phone, gender enums, membership metadata, session tracking, audit options, and password pre-save hooks.
- **Migration effort**: Medium (2–3 days) to merge datasets, normalize enums, populate missing optional fields, and convert numeric IDs to ObjectIds. Password hashes appear bcrypt-compatible but cost factors should be verified.

### Products & Catalog

- **V1 structure**: Flat `products` table (`name`, `category`, `description`, `code`, `is_vegan`, `is_active`) plus separate ingredient/blend tables.
- **V2 target**: `src/models/commerce/products.model.ts` expects multilingual strings (`I18nString`/`I18nText`), media arrays, ingredient link subdocuments, SEO metadata, tags, and audit info.
- **Migration effort**: High (1–2 weeks). Requires aggregating normalized ingredient tables into nested arrays, seeding `title.en`/`description.en`, generating slugs/SKU roots, duplicating text into `nl` until translations exist, and mapping activation flags to `ProductStatus`.

### Orders & Delivery

- **V1 structure**: `orders` rows hold payment IDs, status, shipping fields inline; items inferred via `blend_id`/`payment_plan_id`. Delivery postponements aren’t tracked.
- **V2 target**: `src/models/commerce/orders.model.ts` with nested `items[]`, `PriceSchema` breakdowns, address snapshots, coupon/membership metadata, audit data, and separate logistics collections (`shipments`, `deliveryPostponements`).
- **Migration effort**: High (~1 week). Need to reconstruct `items[]`, compute price/tax/shipping values, convert addresses into snapshots, and seed shipment schedules. Postponement history cannot be rebuilt from V1.

### Payments & Subscriptions

- **V1 structure**: `payments` + `payment_plans` represent billing cycles; Mollie IDs stored sparsely; payment plans act as subscriptions.
- **V2 target**: `commerce/payments`, `subscriptions`, and memberships models separate payments from recurring agreements, capturing gateway metadata, pause/cancel info, and audit history.
- **Migration effort**: Very High (1–2 weeks). Convert `recurring_months` to allowed `cycleDays` (60/90/180), calculate `nextBillingDate`/`nextDeliveryDate`, set `SubscriptionStatus` (likely `PAUSED` pending re-authorization), wrap amounts in `PriceSchema`, and manage missing gateway IDs.

### CMS & Localization

- **V1 structure**: `website_content`, `notes`, `reviews`, `referrals` store single-language strings and activation booleans.
- **V2 target**: CMS models (pages, blogs, FAQs, reviews) rely on `I18nString/I18nText`, SEO, media arrays, and status enums.
- **Migration effort**: Medium (3–4 days). Map each record to a V2 model, populate `en` locales, mark `nl` empty or translate later, and set `PageStatus`/`PageType` plus SEO defaults.

### Coupons & Promotions

- **V1 structure**: `coupons`, `coupon_discounts`, `coupon_used`.
- **V2 target**: `commerce/coupons` with explicit enums for discount type, coupon type, and status.
- **Migration effort**: Medium (2–3 days). Translate enums, build discount metadata, deduplicate usage, and attach ObjectId references.

### Quiz / Intake Data

- **V1 structure**: Hundreds of tables (`sleep_qualitys`, `sleep_quality_answers`, `vitamin_intakes`, etc.) capturing questionnaire masters and responses.
- **V2 target**: No equivalent models; personalization likely reimplemented via AI/consultation services.
- **Migration effort**: Very High / optional. Recommend archiving raw responses (JSON export per user) until V2 defines usage.

### Consultation & Expert Booking

- **V1 structure**: None.
- **V2 target**: `consultations`, `experts`, `expertSlots`.
- **Migration effort**: None; launch with empty datasets.

### Logistics (addresses, shipments, postponements)

- **V1 structure**: Address fields embedded in `orders`; delivery dates inside `payment_plans`.
- **V2 target**: Dedicated `addresses`, `shipments`, `deliveryPostponements` models with status enums and audit metadata.
- **Migration effort**: Medium (2–3 days) to deduplicate addresses per user, create historical shipments, and accept that postponements start fresh.

#### Summary Table

| V2 Model / Feature                                | V1 Source Tables                                   | Estimated Effort      | Key Notes                                                                               |
| ------------------------------------------------- | -------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------- |
| Users (`core/users.model.ts`)                     | `users`, `customers`, `login`, `tokens`            | Medium (2–3 days)     | Merge datasets, normalize enums, hydrate membership/session defaults.                   |
| Addresses (`core/addresses.model.ts`)             | Address fields inside `orders`                     | Medium (2–3 days)     | Deduplicate per user; fall back to order snapshots.                                     |
| Products (`commerce/products.model.ts`)           | `products`, `ingredient_*`, `blends`               | High (1–2 weeks)      | Build multilingual payloads, ingredient links, slugs.                                   |
| Orders (`commerce/orders.model.ts`)               | `orders`, `pharmacist_orders`                      | High (~1 week)        | Reconstruct `items[]`, price components, address snapshots, coupon metadata.            |
| Payments (`commerce/payments.model.ts`)           | `payments`, `payment_plans`                        | High (~1 week)        | Wrap in `PriceSchema`, attach gateway metadata, separate membership vs. order payments. |
| Subscriptions (`commerce/subscriptions.model.ts`) | `payment_plans`, `orders`                          | Very High (1–2 weeks) | Normalize cycles, compute next billing/delivery, handle missing gateway IDs.            |
| Memberships                                       | `payment_plans` (if reused)                        | TBD                   | Depends on final membership requirements.                                               |
| Coupons (`commerce/coupons.model.ts`)             | `coupons`, `coupon_discounts`, `coupon_used`       | Medium (2–3 days)     | Convert enums, dedupe usage history.                                                    |
| CMS (`cms/pages`, `blogs`, `reviews`)             | `website_content`, `notes`, `reviews`, `referrals` | Medium (3–4 days)     | Create i18n structures, map statuses, attach SEO/media.                                 |
| Quiz / Intake                                     | Numerous `*_answers` tables                        | Very High / Optional  | Consider archived JSON export until V2 flow defined.                                    |

---

## 4. Impact on Key V2 Flows

- **Subscription rules**: V1 `recurring_months` values may not match V2’s allowed `cycleDays` (60/90/180). Unsupported cadences must be paused or manually recalculated. Pause/cancel histories will be incomplete after migration because V1 did not track them explicitly.
- **Payment structures**: V2 separates payments from subscriptions/memberships and expects gateway responses, refunds, and saved payment methods. V1 lacks structured gateway payloads, so migrated records may miss refund status; saved cards/tokens cannot move for PCI reasons, requiring re-tokenization.
- **Delivery scheduling**: Delivery data lives inline on V1 `orders`/`payment_plans`. V2 uses `shipments` and `deliveryPostponements`, so migration must synthesize shipment snapshots and seed `nextDeliveryDate`/`nextBillingDate`. Historical postponements cannot be recreated.
- **Expert booking**: There is no V1 consultation data, so V2’s consultations/experts launch empty. Low risk technically, but reporting dashboards need expectation setting.
- **CMS multi-language**: V2 `I18nString`/`I18nText` fields require per-locale content. Copy English text into `en` and leave `nl` blank until translations are ready to avoid blank content in the UI.
- **AI / personalization**: Questionnaire answers stored across many V1 tables are not modeled in V2. Either prompt users to refill forms or archive raw answers for later ingestion.

---

## 5. Risks & Blockers

1. **Schema mismatch**: V2 uses nested Mongo documents; V1 relational data requires complex reshaping and ID remapping.
2. **Payment metadata**: V1 lacks Stripe/Mollie subscription IDs; migrating subscriptions may be lossy unless gateway data can be recovered.
3. **Large data volume**: Tables like `payment_plans` have 42k+ rows—scripts must be incremental and idempotent.
4. **Business rule drift**: V2 introduces new rules (subscription cycles, delivery postponement, membership program) not represented in V1.
5. **CMS internationalization**: V2 expects multilingual content; V1 data may only exist in English/Dutch.
6. **Quiz complexity**: Hundreds of domain-specific tables will take significant effort and may not be necessary at launch.
7. **Security considerations**: Ensure exported data (PII, health information) is handled securely during migration.
8. **Localization gaps**: V1 CMS data is single-language; V2 i18n structures require at least two locales, risking blank fields.
9. **Data integrity gaps**: MySQL enforced foreign keys that Mongo will not, so ETL must detect orphan records (e.g., orders referencing deleted users).

---

## 6. Recommended Migration Strategy

1. **Prioritize Core Domains**

   - Phase 1: Users, addresses, products, coupons, CMS essentials.
   - Phase 2: Orders + basic payment history.
   - Phase 3: Subscriptions/memberships (if gateway data supports it).
   - Phase 4: Optional quiz/personalization data.

2. **Build ETL Pipeline**

   - Use Node.js or Python scripts to connect to MySQL (or parse the dump) and insert into Mongo via Mongoose models.
   - Maintain mapping dictionaries (old ID ➜ new ObjectId) for cross-references.
   - Implement data validation (Joi/Mongoose) to catch issues early.

3. **Handle Payments & Subscriptions Carefully**

   - Without gateway subscription IDs, consider migrating status/history but requiring users to re-confirm payment methods.
   - For active subscriptions, mark as `PAUSED` in V2 until payment tokens are re-established.

4. **CMS & i18n**

   - Map `website_content` and related tables to V2 CMS models, generating translation dictionaries as needed.

5. **Testing & Verification**

   - Load data into a staging Mongo database.
   - Run V2 APIs (orders, memberships, CMS endpoints) against migrated data.
   - Validate counts, sample records, and business flows (checkout, membership purchase, etc.).

6. **Documentation**
   - For each ETL script, document assumptions, fields dropped, and manual steps required.
   - Keep a migration runbook for production cutover.

---

## 7. Summary: What Can vs. Cannot Be Migrated

| Category                         | Status                     | Notes                                                        |
| -------------------------------- | -------------------------- | ------------------------------------------------------------ |
| Users & Addresses                | **Migratable**             | Requires merging tables and hashing validation.              |
| Products & Inventory             | **Migratable**             | Needs restructuring but data exists.                         |
| Orders & Payment History         | **Migratable with effort** | Must reconstruct nested objects and convert enums/statuses.  |
| Active Subscriptions/Memberships | **Partially migratable**   | Payment gateway IDs missing; may need user re-authorization. |
| Coupons & Promotions             | **Migratable**             | Straightforward transformation.                              |
| CMS Content                      | **Migratable**             | Need i18n conversion.                                        |
| Quiz / Intake Data               | **Questionable**           | High effort; evaluate business need before migrating.        |
| Saved Cards / Gateway Tokens     | **Cannot migrate**         | PCI constraints; must re-tokenize via Stripe/Mollie.         |

---

## 8. Next Steps

1. Confirm which V1 domains are required for V2 launch.
2. Spin up MySQL read replica (or load the dump) and connect ETL scripts.
3. Design data mapping sheets per domain (fields, transformations, enums).
4. Implement ETL scripts iteratively with validation + logging.
5. Execute trial migrations in staging; validate via APIs/UI.
6. Plan production cutover window with rollback strategy.

---

_Prepared for Viteezy Phase 2 migration planning._

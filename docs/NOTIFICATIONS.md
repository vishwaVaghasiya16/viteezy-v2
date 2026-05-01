## Notification System – Technical Documentation

### 1. Overview

The notification system is a **centralized service layer** that:

- **Stores notifications** in MongoDB (collection: `notifications`)
- **Sends push notifications** via providers:
  - **Mobile**: OneSignal (`OneSignalProvider`)
  - **Web (future)**: Firebase FCM (`FirebaseProvider`)
- **Manages device tokens** per user
- **Exposes APIs** to create, read, mark as read, delete, and retry notifications

---

### 2. Notification Types & Categories

#### 2.1 Categories – `NotificationCategory`

Logical grouping of notifications (exact enum values are in `NotificationCategory`):

- **Delivery** – order / shipment status
- **Payment** – payment success, failure, refunds
- **Subscription / Membership** – renewal, expiry, upgrades
- **System** – system / platform messages
- **Marketing / Promotion** – offers, campaigns, reminders

Every notification **must** belong to a `NotificationCategory`.

#### 2.2 Types – `NotificationType`

Describes interaction behavior on the client:

- **`NORMAL`**
  - Informational notification
  - Optional navigation
- **`REDIRECTION`**
  - Requires a navigation target (web or mobile)
  - Client should redirect when user taps/clicks

If omitted, `type` defaults to **`NORMAL`** in `notificationService`.

---

### 3. Data Model – `INotification`

Key fields (simplified):

- **Routing**
  - `userId: ObjectId` – owner of the notification

- **Content**
  - `category: NotificationCategory`
  - `type: NotificationType` (default: `NORMAL`)
  - `title: string`
  - `message: string`
  - `data: Record<string, any>` – extra payload for client

- **Navigation**
  - `redirectUrl?: string` – web redirection URL
  - `appRoute?: string` – mobile route (e.g. `/order-detail`)
  - `query?: Record<string, any>` – route params  
    - Validated by `getValidQueryKeysForRoute(appRoute)`  
    - If `appRoute` is not `/dashboard`, then `query` must contain valid keys

- **Read state**
  - `isRead: boolean` (default `false`)
  - `readAt?: Date`

- **Push state**
  - `pushSent: boolean` (default `false`)
  - `pushSentAt?: Date`
  - `pushError?: string` – last push error message (if any)

- **Soft delete**
  - `isDeleted: boolean`
  - `deletedAt?: Date`

- **Audit**
  - `createdBy?: ObjectId`
  - `updatedBy?: ObjectId`
  - `createdAt: Date`
  - `updatedAt: Date`

---

### 4. Device Tokens & Providers

#### 4.1 Device Token Storage (`User` model)

- **Legacy tokens**
  - `deviceTokens: string[]` – simple string list (not provider-aware)

- **New token metadata**
  - `deviceTokenMetadata: { token, platform, provider, addedAt }[]`
    - `token: string`
    - `platform: "mobile" | "web"`
    - `provider: "onesignal" | "firebase"`
    - `addedAt: Date`

Notification sending uses **`deviceTokenMetadata` first**, then falls back to `deviceTokens`.

#### 4.2 Device Token Registration API

Route: `POST /api/v1/users/device-token`  

**Request (JSON):**

```json
{
  "deviceToken": "<token>",
  "platform": "mobile" | "web",
  "provider": "onesignal" | "firebase"
}
```

**Behavior:**

- Requires authenticated user (`authenticate` middleware).
- `platform` default: `"mobile"`.
- If `provider` is not provided:
  - `platform === "web"` → `provider = "firebase"`
  - else → `provider = "onesignal"`

**Validation:**

- `platform` must be `"mobile"` or `"web"`.
- `provider` must be `"onesignal"` or `"firebase"`.
- `platform === "mobile"` → `provider` must be `"onesignal"`.
- `platform === "web"` → `provider` must be `"firebase"`.

**Token format:**

- `provider === "onesignal"`:
  - OneSignal **player ID** (UUID v4): `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
  - If not UUID:
    - If looks like FCM token (contains `:` and long) → specific error about mixing FCM with OneSignal.
    - Else → generic “Invalid OneSignal player ID format” error.
- `provider === "firebase"`:
  - Must **not** be UUID (to avoid confusing OneSignal IDs)
  - Length check (`>= 20`)

**Persistence:**

- Adds/updates entry in `user.deviceTokenMetadata`.
- Ensures `deviceTokens` (legacy list) also contains the token.

---

### 5. Notification Creation & Push Flow

#### 5.1 Public API – Creating a Notification

Controller: `notificationController`  
Service: `notificationService.createNotification(payload)`

**Payload type** (`NotificationService.NotificationPayload`):

```ts
interface NotificationPayload {
  userId: string | ObjectId;
  category: NotificationCategory;
  type?: NotificationType;     // NORMAL / REDIRECTION
  title: string;
  message: string;
  data?: Record<string, any>;
  redirectUrl?: string;        // web
  appRoute?: string;           // mobile path
  query?: Record<string, string>;
  createdBy?: string | ObjectId;
}
```

Typical HTTP body:

```json
{
  "userId": "<user_id>",
  "category": "Delivery",
  "type": "Normal",
  "title": "Order Shipped",
  "message": "Your order #123 has been shipped.",
  "data": { "orderId": "123" },
  "appRoute": "/order-detail",
  "query": { "orderId": "123" }
}
```

#### 5.2 Internal Steps (`NotificationService`)

1. **Validate payload** (`validatePayload`):
   - `userId`, `category`, `title`, `message` required.
   - `category` must be a valid `NotificationCategory`.
   - `title` length ≤ 200; `message` length ≤ 1000.
   - If `type === REDIRECTION` → `redirectUrl` required and must be a valid URL.

2. **Ensure user exists**:
   - `User.findById(payload.userId)`
   - Throws `AppError("User not found", 404)` if missing.

3. **Create DB record**:
   - Build `notificationData` with:
     - `userId`, `category`, `type`, `title`, `message`, `data`,
       `redirectUrl`, `appRoute`, `query`, `pushSent = false`, `isRead = false`, etc.
   - `Notification.create(notificationData)`
   - At this point, notification exists in DB **even if push later fails**.

4. **Fetch user device tokens** (`getUserDeviceTokens`):
   - Reads `deviceTokenMetadata` (preferred).
   - Fallback: use `deviceTokens` as `platform = mobile`, `provider = onesignal`.
   - Returns `DeviceTokenInfo[]`:
     ```ts
     interface DeviceTokenInfo {
       token: string;
       platform: DevicePlatform;   // "mobile" | "web"
       provider: PushProvider;     // "onesignal" | "firebase"
     }
     ```

5. **If no tokens**:
   - Logs “No device tokens found…”.
   - Sets `notification.pushSent = false`, `pushError = "No device tokens available"`.
   - Saves notification and returns.

6. **Build push payload** (`PushNotificationOptions`):
   - `title: payload.title`
   - `body: payload.message`
   - `data`:
     - `notificationId` (DB `_id`)
     - `category`, `type`, `title`, `message`
     - `appRoute`, `query` (JSON string)
     - all `payload.data`
     - `redirectUrl` (for web)
     - `timestamp` (ISO string)
   - `clickAction = payload.redirectUrl`
   - `priority = "high"`
   - `sound = "default"`

7. **Send push via `pushProviderManager`**:

   ```ts
   const pushResult = await pushProviderManager.sendPushNotification(deviceTokens, pushOptions);
   ```

8. **Handle push result**:
   - If `pushResult.invalidTokens` present → `removeInvalidDeviceTokens(userId, invalidTokens)`.
   - Update notification:
     - `pushSent = pushResult.success`
     - `pushSentAt = new Date()`
     - `pushError = pushResult.error` (or cleared when success)
   - Save updated notification.

9. **Return**:
   - Final `Notification` document (with correct `pushSent` / `pushError`).

---

### 6. Push Provider Manager

Responsibilities:

1. **Group tokens by provider:**

   ```ts
   Map<PushProvider, string[]>  // e.g. { onesignal: [...], firebase: [...] }
   ```

2. **Send for each provider**:
   - Get provider instance:
     - `PushProvider.ONESIGNAL` → `OneSignalProvider`
     - `PushProvider.FIREBASE` → `FirebaseProvider`
   - Verify `isInitialized()`.
   - Call `provider.sendPushNotification(tokens, payload)`.

3. **Aggregate results**:

   - `totalSuccessCount`
   - `totalFailureCount`
   - `allInvalidTokens`
   - `errors[]` (per provider)

4. **Return unified result** (`PushNotificationResult`):

   ```ts
   {
     success: totalSuccessCount > 0,
     error?: "onesignal: ...; firebase: ...",
     invalidTokens?: string[],
     successCount?: number,
     failureCount?: number
   }
   ```

---

### 7. OneSignal Provider – Mobile Push

#### 7.1 Initialization

- Reads env vars:
  - `ONESIGNAL_APP_ID`
  - `ONESIGNAL_REST_API_KEY`
- If missing → logs warning & `initialized = false`.

#### 7.2 Token Validation

- `isValidOneSignalPlayerId(token: string)`:
  - Regex for UUID v4.
  - Invalid tokens logged and excluded.
  - If **all** tokens invalid → returns error explaining mismatch (likely FCM vs OneSignal).

#### 7.3 Sending Notification

- Builds `OneSignalNotification`:

  ```ts
  {
    headings: { en: payload.title },
    contents: { en: payload.body },
    include_player_ids: validTokens,
    data: payload.data,
    ios_badgeType, ios_badgeCount,
    android_sound, ios_sound,
    big_picture, large_icon,
    buttons: [{ id: "action", text: "View", url: payload.clickAction }]
  }
  ```

- Adds `app_id` from env.
- Sends to `https://onesignal.com/api/v1/notifications` with:

  ```http
  Authorization: Basic <base64(REST_API_KEY:)>
  Content-Type: application/json
  ```

- On **HTTP error**:
  - Logs full error body.
  - Returns `success: false`, `error: "OneSignal API error: ..."`, and counts.

- On **HTTP success (2xx)**:
  - Parses JSON result.
  - Logs full response.
  - Calculates:
    - `successCount = result.recipients || 0`
    - `failureCount = (validTokens.length - successCount) + invalidTokens.length`
  - **Key behavior (latest logic):**
    - If `response.ok === true` → **treat as `success: true`**, even if `successCount === 0`.
      - Reason: API accepted the request; 0 recipients is usually user preference (unsubscribed, disabled).
    - Returns:

      ```ts
      {
        success: true,
        invalidTokens: allInvalidTokens.length ? allInvalidTokens : undefined,
        successCount,
        failureCount
      }
      ```

- On **exceptions** (network etc.):
  - Logs error.
  - Returns `success: false` with failure message.

---

### 8. Firebase Provider – Web Push (Future Scope)

- Uses Firebase Admin SDK (`admin.messaging()`).
- Converts `payload.data` to string values.
- Builds `MulticastMessage` with web push configuration.
- Sends via `sendEachForMulticast`.
- Aggregates:
  - Successful sends
  - Invalid tokens for cleanup

Return shape is the same `PushNotificationResult`.

---

### 9. In-App Notification APIs

Controller: `notificationController`

#### 9.1 Get Notifications

- Route: `GET /api/v1/notifications`
- Query params:
  - `page`, `limit`
  - `category` (optional)
  - `isRead` (`true`/`false`/`1`/`0`)

Response:

```json
{
  "success": true,
  "message": "Notifications retrieved successfully",
  "data": [...notifications],
  "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

#### 9.2 Get Unread Count

- Route: `GET /api/v1/notifications/unread-count`

Response:

```json
{
  "success": true,
  "data": { "unreadCount": 5 }
}
```

#### 9.3 Mark Single Notification as Read

- Route: `PATCH /api/v1/notifications/:notificationId/read`
- Checks ownership (`userId` matches).
- Sets `isRead = true`, `readAt = now`.

#### 9.4 Mark All as Read

- Route: `PATCH /api/v1/notifications/read-all`
- Updates all non-deleted notifications for the user.

#### 9.5 Delete (Soft Delete)

- Route: `DELETE /api/v1/notifications/:notificationId`
- Sets `isDeleted = true`, `deletedAt = now`.

---

### 10. End-to-End Example (Mobile OneSignal Push)

1. **User logs into mobile app**  
   Mobile obtains OneSignal **player ID**.

2. **Frontend registers device token**:

   ```http
   POST /api/v1/users/device-token
   Authorization: Bearer <accessToken>
   Content-Type: application/json

   {
     "deviceToken": "<onesignal_player_id>",
     "platform": "mobile",
     "provider": "onesignal"
   }
   ```

3. **Some event happens** (e.g. order shipped)  
   Backend calls:

   ```ts
   await notificationService.createNotification({
     userId,
     category: NotificationCategory.DELIVERY,
     type: NotificationType.NORMAL,
     title: "Order shipped",
     message: "Your order #123 has been shipped.",
     data: { orderId: "123" },
     appRoute: "/order-detail",
     query: { orderId: "123" }
   });
   ```

4. **Service saves notification to DB** and **sends push** via OneSignal.

5. **Mobile receives push** via OneSignal SDK  
   Notification list screen calls:
   - `GET /api/v1/notifications`
   - `GET /api/v1/notifications/unread-count`
   - `PATCH /api/v1/notifications/:id/read` on open

6. **If push failed**, `pushError` explains why, and you can call:

   ```ts
   await notificationService.retryFailedPushNotifications(notificationId);
   ```

---

### 11. Key Design Notes

- **DB is source of truth**: notifications are always saved, regardless of push success.
- **Push is best-effort**: failures are logged and stored but do not rollback DB writes.
- **Multi-provider ready**: system is abstracted to support multiple push providers.
- **Backward compatible**: supports both legacy `deviceTokens` and new `deviceTokenMetadata`.
- **User preference aware**: OneSignal responses with `recipients = 0` are treated as API success, not system error.



# FAQ Category API - cURL Commands

**Base URL**: `http://localhost:3000/api/v1/admin/faq-categories`

**Authentication**: All endpoints require Bearer token authentication with Admin role.

**Note**: Replace `YOUR_AUTH_TOKEN` with your actual JWT token and `http://localhost:3000` with your server URL if different.

---

## 1. Create FAQ Category (POST)

Creates a new FAQ category with 5 language titles and optional icon file.

```bash
curl -X POST "http://localhost:3000/api/v1/admin/faq-categories" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: multipart/form-data" \
  -F "title[en]=General Questions" \
  -F "title[nl]=Algemene Vragen" \
  -F "title[de]=Allgemeine Fragen" \
  -F "title[fr]=Questions Générales" \
  -F "title[es]=Preguntas Generales" \
  -F "slug=general-questions" \
  -F "icon=@/path/to/icon.png" \
  -F "sortOrder=1" \
  -F "isActive=true"
```

**Without icon file** (icon is optional):

```bash
curl -X POST "http://localhost:3000/api/v1/admin/faq-categories" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": {
      "en": "General Questions",
      "nl": "Algemene Vragen",
      "de": "Allgemeine Fragen",
      "fr": "Questions Générales",
      "es": "Preguntas Generales"
    },
    "slug": "general-questions",
    "sortOrder": 1,
    "isActive": true
  }'
```

---

## 2. Get All FAQ Categories (GET)

Retrieves a paginated list of FAQ categories.

```bash
curl -X GET "http://localhost:3000/api/v1/admin/faq-categories?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

**With optional query parameters**:

```bash
curl -X GET "http://localhost:3000/api/v1/admin/faq-categories?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

---

## 3. Get FAQ Category by ID (GET)

Retrieves a specific FAQ category by its ID.

```bash
curl -X GET "http://localhost:3000/api/v1/admin/faq-categories/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

**Note**: Replace `507f1f77bcf86cd799439011` with the actual category ID (MongoDB ObjectId).

---

## 4. Update FAQ Category (PUT)

Updates an existing FAQ category. You can update all fields including all 5 language titles.

**With icon file upload**:

```bash
curl -X PUT "http://localhost:3000/api/v1/admin/faq-categories/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: multipart/form-data" \
  -F "title[en]=Updated General Questions" \
  -F "title[nl]=Bijgewerkte Algemene Vragen" \
  -F "title[de]=Aktualisierte Allgemeine Fragen" \
  -F "title[fr]=Questions Générales Mises à Jour" \
  -F "title[es]=Preguntas Generales Actualizadas" \
  -F "slug=updated-general-questions" \
  -F "icon=@/path/to/new-icon.png" \
  -F "sortOrder=2" \
  -F "isActive=true"
```

**Without icon file** (JSON format):

```bash
curl -X PUT "http://localhost:3000/api/v1/admin/faq-categories/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": {
      "en": "Updated General Questions",
      "nl": "Bijgewerkte Algemene Vragen",
      "de": "Aktualisierte Allgemeine Fragen",
      "fr": "Questions Générales Mises à Jour",
      "es": "Preguntas Generales Actualizadas"
    },
    "slug": "updated-general-questions",
    "sortOrder": 2,
    "isActive": true
  }'
```

**Partial update** (only update specific fields):

```bash
curl -X PUT "http://localhost:3000/api/v1/admin/faq-categories/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": {
      "en": "Only English Updated",
      "nl": "Algemene Vragen",
      "de": "Allgemeine Fragen",
      "fr": "Questions Générales",
      "es": "Preguntas Generales"
    },
    "isActive": false
  }'
```

---

## 5. Delete FAQ Category (DELETE)

Soft deletes an FAQ category by ID.

```bash
curl -X DELETE "http://localhost:3000/api/v1/admin/faq-categories/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

**Note**: Replace `507f1f77bcf86cd799439011` with the actual category ID (MongoDB ObjectId).

---

## Example Workflow

### Step 1: Create a new FAQ category
```bash
curl -X POST "http://localhost:3000/api/v1/admin/faq-categories" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": {
      "en": "Shipping & Delivery",
      "nl": "Verzending & Levering",
      "de": "Versand & Lieferung",
      "fr": "Livraison & Expédition",
      "es": "Envío y Entrega"
    },
    "slug": "shipping-delivery",
    "sortOrder": 2,
    "isActive": true
  }'
```

### Step 2: Get all categories to find the ID
```bash
curl -X GET "http://localhost:3000/api/v1/admin/faq-categories?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### Step 3: Get specific category by ID
```bash
curl -X GET "http://localhost:3000/api/v1/admin/faq-categories/YOUR_CATEGORY_ID" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### Step 4: Update the category
```bash
curl -X PUT "http://localhost:3000/api/v1/admin/faq-categories/YOUR_CATEGORY_ID" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": {
      "en": "Updated Shipping & Delivery",
      "nl": "Bijgewerkte Verzending & Levering",
      "de": "Aktualisierte Versand & Lieferung",
      "fr": "Livraison & Expédition Mises à Jour",
      "es": "Envío y Entrega Actualizados"
    },
    "sortOrder": 3
  }'
```

### Step 5: Delete the category
```bash
curl -X DELETE "http://localhost:3000/api/v1/admin/faq-categories/YOUR_CATEGORY_ID" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

---

## Field Descriptions

- **title**: I18n object with language keys
  - `en` (required): English title
  - `nl` (optional): Dutch title
  - `de` (optional): German title
  - `fr` (optional): French title
  - `es` (optional): Spanish title
- **slug**: URL-friendly identifier (auto-generated from title if not provided)
- **icon**: Icon image file (multipart/form-data) or icon URL
- **sortOrder**: Numeric order for sorting (default: 0)
- **isActive**: Boolean flag for active status (default: true)

---

## Important Notes

1. **Authentication**: All endpoints require a valid JWT token with Admin role
2. **English title is required**: The `en` field in the title object is mandatory
3. **Icon upload**: When uploading icon files, use `multipart/form-data` and `-F` flag
4. **Icon URL**: When providing icon as URL, use JSON format with `icon` field as string
5. **MongoDB ObjectId**: Category IDs must be valid 24-character hexadecimal strings
6. **Slug format**: Must contain only lowercase letters, numbers, and hyphens
7. **Soft delete**: DELETE endpoint performs soft delete (marks as deleted, doesn't remove from database)


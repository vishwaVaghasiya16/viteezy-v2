# Admin Blog API - cURL Commands

Base URL: `http://localhost:8080/api/v1`

**Note:** Replace `YOUR_AUTH_TOKEN` with your actual JWT token obtained from login.

---

## Blog Categories API

### 1. Create Blog Category

```bash
curl -X POST http://localhost:8080/api/v1/admin/blog-categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "title": {
      "en": "Health & Wellness",
      "nl": "Gezondheid & Welzijn"
    },
    "slug": "health-wellness",
    "sortOrder": 1,
    "isActive": true
  }'
```

### 2. Get All Blog Categories (Paginated)

```bash
# Basic request
curl -X GET "http://localhost:8080/api/v1/admin/blog-categories?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# With search
curl -X GET "http://localhost:8080/api/v1/admin/blog-categories?page=1&limit=10&search=health" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# Filter by status
curl -X GET "http://localhost:8080/api/v1/admin/blog-categories?page=1&limit=10&status=active" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### 3. Get Blog Category by ID

```bash
curl -X GET http://localhost:8080/api/v1/admin/blog-categories/64f0a1b2c3d4e5f601000001 \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### 4. Update Blog Category

```bash
curl -X PUT http://localhost:8080/api/v1/admin/blog-categories/64f0a1b2c3d4e5f601000001 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "title": {
      "en": "Health & Wellness Updated",
      "nl": "Gezondheid & Welzijn Bijgewerkt"
    },
    "sortOrder": 2,
    "isActive": true
  }'
```

### 5. Delete Blog Category

```bash
curl -X DELETE http://localhost:8080/api/v1/admin/blog-categories/64f0a1b2c3d4e5f601000001 \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

---

## Blogs API

### 1. Create Blog Post

```bash
# Without cover image
curl -X POST http://localhost:8080/api/v1/admin/blogs \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": {
      "en": "10 Essential Vitamins for Daily Health",
      "nl": "10 Essentiële Vitamines voor Dagelijkse Gezondheid"
    },
    "excerpt": {
      "en": "Discover the most important vitamins your body needs every day.",
      "nl": "Ontdek de belangrijkste vitamines die je lichaam dagelijks nodig heeft."
    },
    "content": {
      "en": "Full blog content in English...",
      "nl": "Volledige bloginhoud in het Nederlands..."
    },
    "authorId": "64f0f0f0f0f0f0f0f0000001",
    "categoryId": "64f0a1b2c3d4e5f601000001",
    "tags": ["vitamins", "health", "wellness"],
    "seo": {
      "title": "Essential Vitamins Guide",
      "description": "Learn about essential vitamins for daily health",
      "keywords": ["vitamins", "health", "nutrition"],
      "tags": ["health", "wellness"]
    },
    "status": "Published",
    "publishedAt": "2024-12-01T10:00:00.000Z"
  }'
```

```bash
# With cover image (multipart/form-data)
# Note: JSON fields should be passed without extra quotes, and keywords should be a string, not an array
curl -X POST http://localhost:8080/api/v1/admin/blogs \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -F 'title={"en":"10 Essential Vitamins for Daily Health","nl":"10 Essentiële Vitamines voor Dagelijkse Gezondheid"}' \
  -F 'excerpt={"en":"Discover the most important vitamins your body needs every day.","nl":"Ontdek de belangrijkste vitamines die je lichaam dagelijks nodig heeft."}' \
  -F 'content={"en":"Full blog content in English...","nl":"Volledige bloginhoud in het Nederlands..."}' \
  -F "authorId=64f0f0f0f0f0f0f0f0000001" \
  -F "categoryId=64f0a1b2c3d4e5f601000001" \
  -F 'tags=["vitamins","health","wellness"]' \
  -F 'seo={"title":"Essential Vitamins Guide","description":"Learn about essential vitamins for daily health","keywords":"vitamins, health, wellness"}' \
  -F "status=Published" \
  -F "coverImage=@/path/to/your/image.jpg"
```

### 2. Get All Blogs (Paginated)

```bash
# Basic request
curl -X GET "http://localhost:8080/api/v1/admin/blogs?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# With search
curl -X GET "http://localhost:8080/api/v1/admin/blogs?page=1&limit=10&search=vitamins" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# Filter by status
curl -X GET "http://localhost:8080/api/v1/admin/blogs?page=1&limit=10&status=Published" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# Filter by category
curl -X GET "http://localhost:8080/api/v1/admin/blogs?page=1&limit=10&categoryId=64f0a1b2c3d4e5f601000001" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# Combined filters
curl -X GET "http://localhost:8080/api/v1/admin/blogs?page=1&limit=10&status=Published&search=health&categoryId=64f0a1b2c3d4e5f601000001" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### 3. Get Blog by ID

```bash
curl -X GET http://localhost:8080/api/v1/admin/blogs/74f1a1b2c3d4e5f601000001 \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### 4. Update Blog Post

```bash
# Without cover image update
curl -X PUT http://localhost:8080/api/v1/admin/blogs/74f1a1b2c3d4e5f601000001 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "title": {
      "en": "10 Essential Vitamins for Daily Health - Updated",
      "nl": "10 Essentiële Vitamines voor Dagelijkse Gezondheid - Bijgewerkt"
    },
    "excerpt": {
      "en": "Updated excerpt...",
      "nl": "Bijgewerkte samenvatting..."
    },
    "tags": ["vitamins", "health", "wellness", "nutrition"],
    "status": "Published"
  }'
```

```bash
# With cover image update (multipart/form-data)
curl -X PUT http://localhost:8080/api/v1/admin/blogs/74f1a1b2c3d4e5f601000001 \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -F 'title={"en":"Updated Title","nl":"Bijgewerkte Titel"}' \
  -F 'excerpt={"en":"Updated excerpt...","nl":"Bijgewerkte samenvatting..."}' \
  -F 'tags=["vitamins","health","wellness"]' \
  -F 'seo={"title":"Updated SEO Title","description":"Updated description","keywords":"vitamins, health"}' \
  -F "status=Published" \
  -F "coverImage=@/path/to/new/image.jpg"
```

### 5. Update Blog Status

```bash
# Publish blog
curl -X PATCH http://localhost:8080/api/v1/admin/blogs/74f1a1b2c3d4e5f601000001/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "status": "Published",
    "publishedAt": "2024-12-01T10:00:00.000Z"
  }'
```

```bash
# Unpublish blog (set to Draft)
curl -X PATCH http://localhost:8080/api/v1/admin/blogs/74f1a1b2c3d4e5f601000001/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "status": "Draft"
  }'
```

### 6. Delete Blog Post

```bash
curl -X DELETE http://localhost:8080/api/v1/admin/blogs/74f1a1b2c3d4e5f601000001 \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

---

## Notes

1. **Authentication**: All endpoints require Admin role. Include JWT token in `Authorization` header.
2. **File Upload**: For cover image uploads, use `multipart/form-data` and pass the file with field name `coverImage`.
3. **I18n Fields**: Title, excerpt, and content support both English (`en`) and Dutch (`nl`) translations.
4. **JSON in Form Data**: When using multipart/form-data, complex fields like `title`, `excerpt`, `content`, `tags`, `gallery`, and `seo` should be passed as JSON strings **without extra quotes**.
5. **SEO Field**: The `seo` object expects:
   - `title`: string (optional)
   - `description`: string (optional)
   - `keywords`: **string** (comma-separated, NOT an array)
6. **Tags Field**: Should be a JSON array of strings: `["tag1","tag2"]`
7. **Gallery Field**: Should be a JSON array of media objects. Each object must have:

   - `type`: "image" or "video" (default: "image")
   - `url`: Valid URL (required)
   - `alt`: Optional object with `en` and `nl` strings
   - `sortOrder`: Optional number

   **Format**: `'gallery=[{"type":"image","url":"https://...","alt":{"en":"...","nl":"..."}}]'`

   ❌ **Wrong**: `'gallery="[\"type\": \"image\", \"url\": \"...\"]"'` (missing object braces)  
   ✅ **Correct**: `'gallery=[{"type":"image","url":"https://...","alt":{"en":"...","nl":"..."}}]'`

8. **Slug Generation**: If slug is not provided, it will be auto-generated from the English title.
9. **Status Values**:
   - Blog status: `"Draft"` or `"Published"`
   - Category status filter: `"active"`, `"inactive"`, or `"all"`

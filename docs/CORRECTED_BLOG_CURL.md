# Corrected Blog Creation cURL Command

## Issue Found:

1. **SEO keywords**: Must be a **string** (comma-separated), NOT an array
2. **JSON in form data**: Should use single quotes around JSON strings, not double quotes with escaped quotes

## Corrected cURL Command:

```bash
curl --location 'http://localhost:8080/api/v1/admin/blogs' \
--header 'Authorization: Bearer YOUR_AUTH_TOKEN' \
--form 'title={"en":"10 Essential Vitamins for Daily Health","nl":"10 Essentiële Vitamines voor Dagelijkse Gezondheid"}' \
--form 'excerpt={"en":"Discover the most important vitamins your body needs every day.","nl":"Ontdek de belangrijkste vitamines die je lichaam dagelijks nodig heeft."}' \
--form 'content={"en":"Full blog content in English...","nl":"Volledige bloginhoud in het Nederlands..."}' \
--form 'authorId=64f0f0f0f0f0f0f0f0000001' \
--form 'categoryId=64f0a1b2c3d4e5f601000001' \
--form 'tags=["vitamins","health","wellness"]' \
--form 'seo={"title":"Essential Vitamins Guide","description":"Learn about essential vitamins for daily health","keywords":"vitamins, health, wellness"}' \
--form 'status=Published' \
--form 'coverImage=@"/Users/dreamworld/Desktop/Screen Shot 2025-10-17 at 11.56.00 AM.png"'
```

## Key Changes:

1. ✅ **SEO keywords**: Changed from `"keywords":["vitamins","health"]` to `"keywords":"vitamins, health, wellness"` (string, not array)
2. ✅ **JSON formatting**: Removed extra quotes - use single quotes around the entire JSON string
3. ✅ **File path**: Keep the quotes around the file path for the `coverImage` field

## Alternative: Without Cover Image

```bash
curl --location 'http://localhost:8080/api/v1/admin/blogs' \
--header 'Authorization: Bearer YOUR_AUTH_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
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
    "keywords": "vitamins, health, wellness"
  },
  "status": "Published"
}'
```

## SEO Field Format:

```json
{
  "title": "string (optional)",
  "description": "string (optional)",
  "keywords": "string (comma-separated, NOT array)"
}
```

❌ **Wrong**: `"keywords": ["vitamins", "health"]`  
✅ **Correct**: `"keywords": "vitamins, health, wellness"`

## Gallery Field Format:

The gallery is an **array of media objects**. Each object must have:

- `type`: "image" or "video" (default: "image")
- `url`: Valid URL (required)
- `alt`: Optional object with `en` and `nl` strings
- `sortOrder`: Optional number

```json
[
  {
    "type": "image",
    "url": "https://example.com/image1.jpg",
    "alt": {
      "en": "Image description in English",
      "nl": "Afbeelding beschrijving in het Nederlands"
    },
    "sortOrder": 0
  },
  {
    "type": "image",
    "url": "https://example.com/image2.jpg",
    "alt": {
      "en": "Second image",
      "nl": "Tweede afbeelding"
    }
  }
]
```

❌ **Wrong**: `'gallery="[\"type\": \"image\", \"url\": \"...\"]"'` (missing object braces)  
✅ **Correct**: `'gallery="[{\"type\": \"image\", \"url\": \"https://...\", \"alt\": {\"en\": \"en\", \"nl\": \"nl\"}}]"'`

## Example with Gallery:

```bash
curl --location 'http://localhost:8080/api/v1/admin/blogs' \
--header 'Authorization: Bearer YOUR_AUTH_TOKEN' \
--form 'title={"en":"10 Essential Vitamins for Daily Health","nl":"10 Essentiële Vitamines voor Dagelijkse Gezondheid"}' \
--form 'excerpt={"en":"Discover the most important vitamins your body needs every day.","nl":"Ontdek de belangrijkste vitamines die je lichaam dagelijks nodig heeft."}' \
--form 'content={"en":"Full blog content in English...","nl":"Volledige bloginhoud in het Nederlands..."}' \
--form 'authorId=6926d2032da715f862a6f45f' \
--form 'categoryId=64f0a1b2c3d4e5f601000001' \
--form 'tags=["vitamins","health","wellness"]' \
--form 'seo={"title":"Essential Vitamins Guide","description":"Learn about essential vitamins for daily health","keywords":"vitamins, health, wellness"}' \
--form 'status=Published' \
--form 'coverImage=@"/Users/dreamworld/Desktop/Screen Shot 2025-10-30 at 6.04.27 PM.png"' \
--form 'gallery=[{"type":"image","url":"https://guardianshot.blr1.digitaloceanspaces.com/viteezy-phase-2/blogs/2025-11-28/bf4a96f5-aaae-482a-8b71-701305366889.png","alt":{"en":"Image description","nl":"Afbeelding beschrijving"}}]'
```

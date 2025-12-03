# Admin Product Testimonial API

Base URL: `http://localhost:8080/api/v1`

**Note:** Replace `YOUR_AUTH_TOKEN` with your actual JWT token obtained from login.

---

## Product Testimonial Management

### Create Product Testimonial

```bash
curl -X POST http://localhost:8080/api/v1/admin/product-testimonials \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -F "video=@/path/to/video.mp4" \
  -F "products=[\"64f0a1b2c3d4e5f601000001\",\"64f0a1b2c3d4e5f601000002\"]" \
  -F "isVisibleOnHomepage=true" \
  -F "displayOrder=1"
```

**Request Body (Multipart Form Data):**

- `video` (required): Video file (MP4, MPEG, MOV, AVI, WEBM, OGG) - Max 50MB
- `products` (required): JSON array of product IDs (e.g., `["64f0a1b2c3d4e5f601000001"]`)
- `isVisibleOnHomepage` (optional): Boolean - Show on homepage (default: false)
- `displayOrder` (optional): Number - Display order (default: 0)
- `metadata` (optional): JSON string for additional metadata

**Response:**

```json
{
  "success": true,
  "message": "Product testimonial created successfully",
  "data": {
    "testimonial": {
      "_id": "64f0a1b2c3d4e5f601000003",
      "videoUrl": "https://example.com/videos/testimonial.mp4",
      "videoThumbnail": null,
      "products": [
        {
          "_id": "64f0a1b2c3d4e5f601000001",
          "title": "Product Name",
          "slug": "product-slug",
          "productImage": "https://example.com/image.jpg"
        }
      ],
      "isVisibleOnHomepage": true,
      "isActive": true,
      "displayOrder": 1,
      "metadata": {},
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    }
  }
}
```

---

### Get All Product Testimonials

```bash
curl -X GET "http://localhost:8080/api/v1/admin/product-testimonials?page=1&limit=10&isVisibleOnHomepage=true" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)
- `search` (optional): Search term
- `isVisibleOnHomepage` (optional): Filter by homepage visibility (true/false)
- `isActive` (optional): Filter by active status (true/false)

**Response:**

```json
{
  "success": true,
  "message": "Product testimonials retrieved successfully",
  "data": {
    "testimonials": [
      {
        "_id": "64f0a1b2c3d4e5f601000003",
        "videoUrl": "https://example.com/videos/testimonial.mp4",
        "products": [...],
        "isVisibleOnHomepage": true,
        "isActive": true,
        "displayOrder": 1
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "pages": 3
    }
  }
}
```

---

### Get Testimonial by ID

```bash
curl -X GET http://localhost:8080/api/v1/admin/product-testimonials/64f0a1b2c3d4e5f601000003 \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

**Response:**

```json
{
  "success": true,
  "message": "Product testimonial retrieved successfully",
  "data": {
    "testimonial": {
      "_id": "64f0a1b2c3d4e5f601000003",
      "videoUrl": "https://example.com/videos/testimonial.mp4",
      "products": [...],
      "isVisibleOnHomepage": true,
      "isActive": true
    }
  }
}
```

---

### Update Product Testimonial

```bash
curl -X PUT http://localhost:8080/api/v1/admin/product-testimonials/64f0a1b2c3d4e5f601000003 \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -F "products=[\"64f0a1b2c3d4e5f601000001\"]" \
  -F "isVisibleOnHomepage=false" \
  -F "displayOrder=2"
```

**Request Body (Multipart Form Data):**

- `video` (optional): New video file to replace existing one
- `products` (optional): JSON array of product IDs
- `isVisibleOnHomepage` (optional): Boolean
- `displayOrder` (optional): Number
- `metadata` (optional): JSON string

**Response:**

```json
{
  "success": true,
  "message": "Product testimonial updated successfully",
  "data": {
    "testimonial": {...}
  }
}
```

---

### Toggle Testimonial Status

```bash
curl -X PATCH http://localhost:8080/api/v1/admin/product-testimonials/64f0a1b2c3d4e5f601000003/status \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

**Response:**

```json
{
  "success": true,
  "message": "Testimonial activated successfully",
  "data": {
    "testimonial": {
      "_id": "64f0a1b2c3d4e5f601000003",
      "isActive": true
    }
  }
}
```

---

### Delete Product Testimonial

```bash
curl -X DELETE http://localhost:8080/api/v1/admin/product-testimonials/64f0a1b2c3d4e5f601000003 \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

**Response:**

```json
{
  "success": true,
  "message": "Product testimonial deleted successfully",
  "data": null
}
```

---

## Notes

1. **Video Upload**:

   - Supported formats: MP4, MPEG, MOV, AVI, WEBM, OGG
   - Maximum file size: 50MB
   - Videos are uploaded to DigitalOcean Spaces

2. **Products**:

   - At least one product is required
   - Products must exist and not be deleted

3. **Homepage Visibility**:

   - Set `isVisibleOnHomepage=true` to show testimonial on homepage
   - Use `displayOrder` to control the order of testimonials

4. **Soft Delete**:

   - Testimonials are soft deleted (not permanently removed)
   - Deleted testimonials won't appear in listings

5. **Authentication**:
   - All endpoints require Admin role
   - Include JWT token in `Authorization` header

---

## Example cURL Commands

### Create Testimonial with Multiple Products

```bash
curl -X POST http://localhost:8080/api/v1/admin/product-testimonials \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -F "video=@/Users/dreamworld/Desktop/testimonial.mp4" \
  -F "products=[\"64f0a1b2c3d4e5f601000001\",\"64f0a1b2c3d4e5f601000002\"]" \
  -F "isVisibleOnHomepage=true" \
  -F "displayOrder=1" \
  -F "metadata={\"source\":\"customer\",\"rating\":5}"
```

### Update Testimonial (Change Products)

```bash
curl -X PUT http://localhost:8080/api/v1/admin/product-testimonials/64f0a1b2c3d4e5f601000003 \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -F "products=[\"64f0a1b2c3d4e5f601000003\"]" \
  -F "isVisibleOnHomepage=false"
```

### Get Homepage Testimonials

```bash
curl -X GET "http://localhost:8080/api/v1/admin/product-testimonials?isVisibleOnHomepage=true&isActive=true" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

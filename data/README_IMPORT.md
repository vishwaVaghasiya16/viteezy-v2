# MongoDB Data Import Guide

यह guide आपको MongoDB में blog categories और blogs data import करने में मदद करेगी।

## Files

- `blog_categories.json` - Blog categories data
- `blogs.json` - Blogs data

## Import Steps

### Option 1: Using mongoimport (Command Line)

#### 1. Blog Categories Import

```bash
mongoimport --uri="mongodb://localhost:27017/your_database_name" \
  --collection=blog_categories \
  --file=data/blog_categories.json \
  --jsonArray
```

#### 2. Blogs Import

```bash
mongoimport --uri="mongodb://localhost:27017/your_database_name" \
  --collection=blogs \
  --file=data/blogs.json \
  --jsonArray
```

### Option 2: Using MongoDB Compass

1. Open MongoDB Compass
2. Connect to your database
3. Select your database
4. Click on the collection name (e.g., `blog_categories`)
5. Click "Add Data" → "Import File"
6. Select the JSON file
7. Click "Import"

### Option 3: Using MongoDB Shell (mongosh)

```javascript
// Connect to your database
use your_database_name

// Import blog categories
db.blog_categories.insertMany([
  // Copy content from blog_categories.json here
])

// Import blogs
db.blogs.insertMany([
  // Copy content from blogs.json here
])
```

## Important Notes

### ObjectId References

- Blog categories के ObjectIds को blogs में `categoryId` के रूप में use किया गया है
- `authorId` के लिए आपको अपने users collection से valid ObjectId use करनी होगी

### AuthorId Update

Blogs में `authorId` field है जो users collection को reference करती है। आपको यह करना होगा:

```javascript
// अपने users collection से एक valid user ID लें
const userId = ObjectId("507f1f77bcf86cd799439020"); // Replace with actual user ID

// सभी blogs में authorId update करें
db.blogs.updateMany(
  { authorId: ObjectId("507f1f77bcf86cd799439020") },
  { $set: { authorId: userId } }
);
```

या आप JSON files में directly अपने actual user IDs use कर सकते हैं।

### Date Format

JSON files में dates MongoDB extended JSON format में हैं (`$date` और `$oid`). यह format mongoimport के साथ automatically handle हो जाता है।

## Verification

Import के बाद verify करें:

```javascript
// Check blog categories count
db.blog_categories.countDocuments();

// Check blogs count
db.blogs.countDocuments();

// Check published blogs
db.blogs.countDocuments({ status: "published" });

// View a sample blog
db.blogs.findOne({ status: "published" });
```

## API Testing

Import के बाद आप इन APIs को test कर सकते हैं:

### Blog APIs

1. **Get Blog Categories**: `GET /api/blogs/categories/list`
2. **Get Blogs List**: `GET /api/blogs?page=1&limit=10`
3. **Get Blog Details**: `GET /api/blogs/10-essential-vitamins-for-daily-health`
4. **Get Popular Blogs**: `GET /api/blogs/popular/list?type=popular&limit=5`
5. **Increment Views**: `POST /api/blogs/10-essential-vitamins-for-daily-health/increment-views`

### Coupon APIs

1. **Validate Coupon**: `POST /api/coupons/validate`
   ```json
   {
     "couponCode": "WELCOME10",
     "orderAmount": 100,
     "productIds": [],
     "categoryIds": []
   }
   ```

## Troubleshooting

### Error: Invalid ObjectId

अगर आपको ObjectId error आती है, तो:

- सुनिश्चित करें कि JSON format सही है
- MongoDB extended JSON format (`$oid`, `$date`) use करें

### Error: Duplicate Key

अगर duplicate key error आती है:

- पहले existing data delete करें:
  ```javascript
  db.blog_categories.deleteMany({});
  db.blogs.deleteMany({});
  db.coupons.deleteMany({});
  ```

### AuthorId Not Found

अगर authorId reference error आती है:

- पहले users collection में कम से कम एक user create करें
- फिर blogs में उस user का ID use करें

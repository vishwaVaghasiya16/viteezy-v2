# MongoDB Data Import Guide

यह guide आपको MongoDB में blog categories और blogs data import करने में मदद करेगी।

## Files

- `blog_categories.json` - Blog categories data
- `blogs.json` - Blogs data
- `membership_plans.json` - Membership plans data
- `memberships.json` - User memberships data

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

#### 3. Membership Plans Import

```bash
mongoimport --uri="mongodb://localhost:27017/your_database_name" \
  --collection=membership_plans \
  --file=data/membership_plans.json \
  --jsonArray
```

#### 4. Memberships Import

```bash
mongoimport --uri="mongodb://localhost:27017/your_database_name" \
  --collection=memberships \
  --file=data/memberships.json \
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

// Import membership plans
db.membership_plans.insertMany([
  // Copy content from membership_plans.json here
])

// Import memberships
db.memberships.insertMany([
  // Copy content from memberships.json here
])
```

## Important Notes

### ObjectId References

- Blog categories के ObjectIds को blogs में `categoryId` के रूप में use किया गया है
- `authorId` के लिए आपको अपने users collection से valid ObjectId use करनी होगी
- Membership plans के ObjectIds को memberships में `planId` के रूप में use किया गया है
- Memberships में `userId` और `paymentId` के लिए आपको अपने users और payments collections से valid ObjectIds use करनी होंगी

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

### Membership Data Update

Memberships में `userId` और `paymentId` fields हैं जो users और payments collections को reference करती हैं। आपको यह करना होगा:

```javascript
// अपने users collection से valid user IDs लें
const userIds = db.users.find({}, { _id: 1 }).toArray();

// अपने payments collection से valid payment IDs लें (optional, अगर payment records exist करते हैं)
const paymentIds = db.payments.find({}, { _id: 1 }).toArray();

// Memberships में userId और paymentId update करें
// Note: JSON files में sample ObjectIds हैं, आपको actual IDs से replace करना होगा
```

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

// Check membership plans count
db.membership_plans.countDocuments();

// Check active membership plans
db.membership_plans.countDocuments({ isActive: true });

// Check memberships count
db.memberships.countDocuments();

// Check active memberships
db.memberships.countDocuments({ status: "Active" });

// View a sample membership plan
db.membership_plans.findOne({ isActive: true });

// View a sample membership
db.memberships.findOne({ status: "Active" });
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

### Membership APIs

1. **Buy Membership**: `POST /api/v1/memberships/buy`

   ```json
   {
     "planId": "75a1b2c3d4e5f601000001",
     "paymentMethod": "Stripe"
   }
   ```

2. **Get Membership History**: `GET /api/v1/memberships?page=1&limit=10`

3. **Get Membership Details**: `GET /api/v1/memberships/:membershipId`

4. **Cancel Membership**: `POST /api/v1/memberships/:membershipId/cancel`

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
  db.membership_plans.deleteMany({});
  db.memberships.deleteMany({});
  ```

### AuthorId Not Found

अगर authorId reference error आती है:

- पहले users collection में कम से कम एक user create करें
- फिर blogs में उस user का ID use करें

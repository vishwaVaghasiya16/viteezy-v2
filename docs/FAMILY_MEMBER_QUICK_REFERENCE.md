# Family Member Registration - Quick Reference Card

## 🚀 Quick Start

### Register Family Member (with email)

```bash
POST /api/auth/register-family-member
Authorization: Bearer YOUR_TOKEN

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "password123",
  "relationshipToParent": "Child"
}
```

### Register Family Member (without email)

```bash
POST /api/auth/register-family-member
Authorization: Bearer YOUR_TOKEN

{
  "firstName": "Jane",
  "lastName": "Doe",
  "password": "password123",
  "relationshipToParent": "Child"
}
```

### Get All Family Members

```bash
GET /api/auth/family-members
Authorization: Bearer YOUR_TOKEN
```

---

## 📋 Required Fields

| Field                  | Type   | Required | Description                           |
| ---------------------- | ------ | -------- | ------------------------------------- |
| `firstName`            | String | ✅ Yes   | 1-50 characters                       |
| `lastName`             | String | ✅ Yes   | 1-50 characters                       |
| `password`             | String | ✅ Yes   | Min 6 characters                      |
| `relationshipToParent` | String | ✅ Yes   | Child, Spouse, Parent, Sibling, Other |

---

## 🔧 Optional Fields

| Field         | Type   | Description                       |
| ------------- | ------ | --------------------------------- |
| `email`       | String | Valid email format                |
| `phone`       | String | E.164 format (e.g., +31612345678) |
| `countryCode` | String | 2-char uppercase (e.g., NL, US)   |
| `gender`      | String | Male, Female, Gender neutral      |
| `age`         | Number | 1-150                             |

---

## 🔗 Relationship Types

- **Child** - Children of the main member
- **Spouse** - Husband/Wife
- **Parent** - Elderly parents
- **Sibling** - Brothers/Sisters
- **Other** - Any other relationship

---

## ✅ Response Examples

### Success (201 Created)

```json
{
  "success": true,
  "message": "Family member registered successfully.",
  "data": {
    "user": {
      "_id": "60d5ec49f1b2c8b1f8e4e1a1",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "memberId": "MEM-A9XK72QD",
      "isSubMember": true,
      "parentMemberId": "60d5ec49f1b2c8b1f8e4e1a0",
      "relationshipToParent": "Child"
    }
  }
}
```

### Get Family Members (200 OK)

```json
{
  "success": true,
  "message": "Family members retrieved successfully",
  "data": {
    "familyMembers": [...],
    "count": 3
  }
}
```

---

## ❌ Common Errors

| Status | Message                 | Solution                     |
| ------ | ----------------------- | ---------------------------- |
| 401    | User not authenticated  | Include valid Bearer token   |
| 404    | Parent member not found | Verify parent account exists |
| 400    | Email already in use    | Use different email or omit  |
| 400    | Validation error        | Check required fields        |

---

## 🔐 Authentication

All family member endpoints require authentication:

```bash
Authorization: Bearer YOUR_ACCESS_TOKEN
```

Get token from login:

```bash
POST /api/auth/login
{
  "email": "parent@example.com",
  "password": "password123",
  "deviceInfo": "Web"
}
```

---

## 📊 User Profile Response

When getting profile, family member fields are included:

```json
{
  "user": {
    "_id": "...",
    "firstName": "John",
    "lastName": "Doe",
    // ... other fields ...
    "isSubMember": true,
    "parentMemberId": "60d5ec49f1b2c8b1f8e4e1a0",
    "relationshipToParent": "Child"
  }
}
```

---

## 💡 Tips

1. **Email is Optional** - Family members can be registered without email
2. **Unique Member IDs** - Each family member gets a unique ID (MEM-XXXXXXXX)
3. **Same User Panel** - Family members access the same interface as main members
4. **OTP Verification** - If email provided, OTP is sent for verification
5. **Password Required** - All family members need a password for login

---

## 🧪 Test Flow

1. Register main member → `/register`
2. Verify OTP → `/verify-otp`
3. Login → `/login` (get access token)
4. Register family member → `/register-family-member`
5. Get family members → `/family-members`
6. Get profile → `/profile` (see family member fields)

---

## 📞 Support

For detailed documentation, see:

- `FAMILY_MEMBER_API.md` - Complete API documentation
- `FAMILY_MEMBER_TEST_COMMANDS.sh` - Test commands
- `FAMILY_MEMBER_IMPLEMENTATION_SUMMARY.md` - Technical details

---

**Last Updated:** December 25, 2025

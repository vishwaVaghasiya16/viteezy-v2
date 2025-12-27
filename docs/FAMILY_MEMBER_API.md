# Family Member Registration API Documentation

## Overview

This API allows parent/main members to register family members (sub-members) under their account. Family members share the same user panel but are identified as sub-members. Email is **optional** for family member registration.

## Features

- Register family members without requiring email
- Support for multiple relationship types (Child, Spouse, Parent, Sibling, Other)
- Family members get unique member IDs
- Family members can access the same user panel
- Parent members can view all their registered family members
- Optional email verification for family members

---

## API Endpoints

### 1. Register Family Member

**Endpoint:** `POST /api/auth/register-family-member`

**Authentication:** Required (Bearer Token)

**Description:** Allows an authenticated parent/main member to register a family member.

#### Request Headers

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

#### Request Body

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com", // OPTIONAL
  "password": "SecurePassword123",
  "phone": "+31612345678", // OPTIONAL
  "countryCode": "NL", // OPTIONAL
  "gender": "Male", // OPTIONAL - Values: "Male", "Female", "Gender neutral"
  "age": 25, // OPTIONAL - Min: 1, Max: 150
  "relationshipToParent": "Child" // REQUIRED - Values: "Child", "Spouse", "Parent", "Sibling", "Other"
}
```

#### Required Fields

- `firstName` (string, 1-50 characters)
- `lastName` (string, 1-50 characters)
- `password` (string, 6+ characters)
- `relationshipToParent` (string, enum: "Child", "Spouse", "Parent", "Sibling", "Other")

#### Optional Fields

- `email` (string, valid email format)
- `phone` (string, E.164 format)
- `countryCode` (string, 2-character uppercase)
- `gender` (string, enum: "Male", "Female", "Gender neutral")
- `age` (number, 1-150)

#### Success Response (201 Created)

```json
{
  "success": true,
  "message": "Family member registered successfully. Please verify email with the OTP sent.",
  "data": {
    "user": {
      "_id": "60d5ec49f1b2c8b1f8e4e1a1",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "phone": "+31612345678",
      "countryCode": "NL",
      "gender": "Male",
      "age": 25,
      "memberId": "MEM-A9XK72QD",
      "isSubMember": true,
      "parentMemberId": "60d5ec49f1b2c8b1f8e4e1a0",
      "relationshipToParent": "Child",
      "isEmailVerified": false,
      "registeredAt": "2024-12-25T10:30:00.000Z"
    }
  }
}
```

#### Success Response Without Email (201 Created)

```json
{
  "success": true,
  "message": "Family member registered successfully.",
  "data": {
    "user": {
      "_id": "60d5ec49f1b2c8b1f8e4e1a1",
      "firstName": "John",
      "lastName": "Doe",
      "email": null,
      "phone": "+31612345678",
      "countryCode": "NL",
      "gender": "Male",
      "age": 25,
      "memberId": "MEM-A9XK72QD",
      "isSubMember": true,
      "parentMemberId": "60d5ec49f1b2c8b1f8e4e1a0",
      "relationshipToParent": "Child",
      "isEmailVerified": false,
      "registeredAt": "2024-12-25T10:30:00.000Z"
    }
  }
}
```

#### Error Responses

**401 Unauthorized** - User not authenticated

```json
{
  "success": false,
  "message": "User not authenticated"
}
```

**400 Bad Request** - Validation error

```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "firstName",
      "message": "First name is required"
    }
  ]
}
```

**404 Not Found** - Parent member not found

```json
{
  "success": false,
  "message": "Parent member not found"
}
```

**400 Bad Request** - Email already in use

```json
{
  "success": false,
  "message": "Email already in use by another user"
}
```

---

### 2. Get Family Members

**Endpoint:** `GET /api/auth/family-members`

**Authentication:** Required (Bearer Token)

**Description:** Retrieves all family members registered under the authenticated parent member.

#### Request Headers

```
Authorization: Bearer <access_token>
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Family members retrieved successfully",
  "data": {
    "familyMembers": [
      {
        "_id": "60d5ec49f1b2c8b1f8e4e1a1",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.doe@example.com",
        "phone": "+31612345678",
        "countryCode": "NL",
        "gender": "Male",
        "age": 25,
        "memberId": "MEM-A9XK72QD",
        "isSubMember": true,
        "relationshipToParent": "Child",
        "isEmailVerified": false,
        "isActive": true,
        "registeredAt": "2024-12-25T10:30:00.000Z",
        "createdAt": "2024-12-25T10:30:00.000Z"
      },
      {
        "_id": "60d5ec49f1b2c8b1f8e4e1a2",
        "firstName": "Jane",
        "lastName": "Doe",
        "email": null,
        "phone": "+31612345679",
        "countryCode": "NL",
        "gender": "Female",
        "age": 22,
        "memberId": "MEM-B8YL63PE",
        "isSubMember": true,
        "relationshipToParent": "Child",
        "isEmailVerified": false,
        "isActive": true,
        "registeredAt": "2024-12-25T11:00:00.000Z",
        "createdAt": "2024-12-25T11:00:00.000Z"
      }
    ],
    "count": 2
  }
}
```

#### Error Responses

**401 Unauthorized** - User not authenticated

```json
{
  "success": false,
  "message": "User not authenticated"
}
```

**404 Not Found** - Parent member not found

```json
{
  "success": false,
  "message": "Parent member not found"
}
```

---

## CURL Examples

### Register Family Member with Email

```bash
curl -X POST http://localhost:5000/api/auth/register-family-member \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "password": "SecurePassword123",
    "phone": "+31612345678",
    "countryCode": "NL",
    "gender": "Male",
    "age": 25,
    "relationshipToParent": "Child"
  }'
```

### Register Family Member without Email

```bash
curl -X POST http://localhost:5000/api/auth/register-family-member \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "firstName": "Jane",
    "lastName": "Doe",
    "password": "SecurePassword123",
    "phone": "+31612345679",
    "countryCode": "NL",
    "gender": "Female",
    "age": 22,
    "relationshipToParent": "Child"
  }'
```

### Register Spouse

```bash
curl -X POST http://localhost:5000/api/auth/register-family-member \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "firstName": "Sarah",
    "lastName": "Smith",
    "password": "SecurePassword123",
    "relationshipToParent": "Spouse"
  }'
```

### Get All Family Members

```bash
curl -X GET http://localhost:5000/api/auth/family-members \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## Database Schema Changes

### User Model Updates

The User model has been extended with the following fields:

```typescript
{
  // Existing fields...

  // New family member fields
  isSubMember: {
    type: Boolean,
    default: false
  },
  parentMemberId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  relationshipToParent: {
    type: String,
    enum: ["Child", "Spouse", "Parent", "Sibling", "Other"],
    default: null
  }
}
```

### Email Field Update

The `email` field is now conditionally required:

- Required for main members (`isSubMember: false`)
- Optional for sub-members (`isSubMember: true`)

---

## Key Features

### 1. Optional Email

- Family members can be registered without an email address
- If email is provided, OTP verification is sent
- If no email, registration completes without verification

### 2. Unique Member IDs

- Each family member gets a unique member ID (e.g., MEM-A9XK72QD)
- Member IDs follow the same format as main members

### 3. Relationship Types

- **Child**: For children of the main member
- **Spouse**: For husband/wife
- **Parent**: For elderly parents
- **Sibling**: For brothers/sisters
- **Other**: For any other relationship

### 4. User Panel Access

- Family members have access to the same user panel
- They are identified as sub-members (`isSubMember: true`)
- They can log in using their credentials

### 5. Parent-Child Relationship

- Each family member is linked to their parent member via `parentMemberId`
- Parent members can retrieve all their family members
- Family members inherit certain privileges from parent members

---

## Login for Family Members

Family members can log in using the standard login endpoint:

**Endpoint:** `POST /api/auth/login`

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "SecurePassword123",
    "deviceInfo": "Web"
  }'
```

**Note:** If the family member was registered without an email, they cannot use the standard login. Alternative authentication methods should be implemented (e.g., phone-based login, or login through parent account).

---

## Security Considerations

1. **Authentication Required**: Only authenticated users can register family members
2. **Parent Verification**: The system verifies that the parent member exists and is active
3. **Email Uniqueness**: If email is provided, it must be unique across all users
4. **Password Security**: Passwords are hashed using bcrypt with salt rounds of 12
5. **Member ID Uniqueness**: Each family member gets a unique member ID

---

## Use Cases

### Use Case 1: Parent Registering Children

A parent can register their children without email addresses, using only their names and basic information.

### Use Case 2: Registering Spouse

A main member can register their spouse with an email for independent access.

### Use Case 3: Managing Elderly Parents

Adult children can register their elderly parents who may not have email addresses.

### Use Case 4: Family Membership Plans

All family members can benefit from the parent's membership plan while maintaining individual profiles.

---

## Future Enhancements

1. **Phone-Based Login**: Allow family members without email to login using phone number
2. **Parent Dashboard**: Enhanced dashboard for managing family members
3. **Permission Management**: Control what family members can access
4. **Shared Membership Benefits**: Extend membership benefits to family members
5. **Family Member Invitations**: Send invitation links to family members
6. **Bulk Registration**: Register multiple family members at once

---

## Support

For any issues or questions regarding the Family Member Registration API, please contact the development team or refer to the main API documentation.

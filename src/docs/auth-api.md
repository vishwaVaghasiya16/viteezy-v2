# Authentication API Documentation

## Overview
Complete authentication system with OTP verification, password management, and session handling.

## Endpoints

### 1. Register User
**POST** `/api/auth/register`

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "phone": "+1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registration successful. Please verify your email with the OTP sent.",
  "data": {
    "user": {
      "id": "user_id",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "isEmailVerified": false
    }
  }
}
```

### 2. Send OTP
**POST** `/api/auth/send-otp`

**Request Body:**
```json
{
  "email": "john@example.com",
  "type": "email_verification",
  "phone": "+1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent to john@example.com"
}
```

### 3. Verify OTP
**POST** `/api/auth/verify-otp`

**Request Body:**
```json
{
  "email": "john@example.com",
  "otp": "123456",
  "type": "email_verification"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "user": {
      "id": "user_id",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "isEmailVerified": true
    },
    "token": "jwt_token_here"
  }
}
```

### 4. Login
**POST** `/api/auth/login`

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user_id",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "isEmailVerified": true,
      "lastLogin": "2024-01-01T00:00:00.000Z"
    },
    "token": "jwt_token_here"
  }
}
```

### 5. Resend OTP
**POST** `/api/auth/resend-otp`

**Request Body:**
```json
{
  "email": "john@example.com",
  "type": "email_verification"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent to john@example.com"
}
```

### 6. Forgot Password
**POST** `/api/auth/forgot-password`

**Request Body:**
```json
{
  "email": "john@example.com",
  "deviceInfo": "Web",
  "client": "user"
}
```

**Response:**
```json
{
  "success": true,
  "message": "If an account exists with this email, a password reset instruction has been sent."
}
```

### 7. Reset Password
**POST** `/api/auth/reset-password`

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "newpassword123",
  "confirmPassword": "newpassword123",
  "token": "reset_token_from_email_link_optional_for_app_flow"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successfully. Please login with your new password."
}
```

### 8. Change Password (Protected)
**POST** `/api/auth/change-password`

**Headers:**
```
Authorization: Bearer jwt_token_here
```

**Request Body:**
```json
{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

### 9. Logout (Protected)
**POST** `/api/auth/logout`

**Headers:**
```
Authorization: Bearer jwt_token_here
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### 10. Logout All Devices (Protected)
**POST** `/api/auth/logout-all-devices`

**Headers:**
```
Authorization: Bearer jwt_token_here
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out from all devices successfully"
}
```

### 11. Get Profile (Protected)
**GET** `/api/auth/profile`

**Headers:**
```
Authorization: Bearer jwt_token_here
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "isEmailVerified": true,
      "role": "user",
      "isActive": true,
      "lastLogin": "2024-01-01T00:00:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

### 12. Update Profile (Protected)
**PUT** `/api/auth/profile`

**Headers:**
```
Authorization: Bearer jwt_token_here
```

**Request Body:**
```json
{
  "name": "John Smith",
  "phone": "+9876543210"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully"
}
```

## OTP Types
- `email_verification` - For email verification during registration
- `phone_verification` - For phone verification
- `password_reset` - For password reset
- `login_verification` - For 2FA login

## Error Responses
All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error message",
  "errors": "Detailed error information"
}
```

## Security Features
- Password hashing with bcrypt
- JWT tokens with expiration
- Session management
- OTP rate limiting
- Account lockout after max attempts
- Secure password validation
- Email/phone verification

## Environment Variables
```env
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
OTP_EXPIRES_IN=10
```

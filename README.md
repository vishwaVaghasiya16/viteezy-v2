# Viteezy Phase 2 - Node.js TypeScript Backend

एक advanced और scalable Node.js TypeScript backend project MongoDB के साथ।

## 🚀 Features

- **TypeScript** - Type safety और better development experience
- **Express.js** - Fast और flexible web framework
- **MongoDB** - NoSQL database with Mongoose ODM
- **JWT Authentication** - Secure authentication system
- **Input Validation** - Request validation with express-validator
- **Error Handling** - Centralized error handling
- **Logging** - Winston logger with file rotation
- **Rate Limiting** - API rate limiting
- **Security** - Helmet, CORS, and other security middleware
- **Testing** - Jest testing framework
- **ESLint** - Code linting and formatting

## 📁 Project Structure

```
src/
├── config/           # Configuration files
│   ├── database.ts   # MongoDB connection
│   └── index.ts      # App configuration
├── controllers/      # Route controllers
│   └── authController.ts
├── middleware/       # Custom middleware
│   ├── auth.ts       # Authentication middleware
│   ├── errorHandler.ts
│   ├── notFoundHandler.ts
│   └── validation.ts
├── models/           # Database models
│   ├── User.ts
│   └── index.ts
├── routes/           # API routes
│   ├── authRoutes.ts
│   └── index.ts
├── services/         # Business logic
│   └── authService.ts
├── types/            # TypeScript type definitions
│   └── index.ts
├── utils/            # Utility functions
│   ├── AppError.ts
│   ├── logger.ts
│   └── index.ts
├── constants/        # Application constants
│   └── index.ts
└── index.ts          # Application entry point
```

## 🛠️ Installation

1. **Dependencies install करें:**
```bash
npm install
```

2. **Environment variables setup करें:**
```bash
cp env.example .env
```

3. **Environment variables को edit करें:**
```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/viteezy-phase-2
JWT_SECRET=your-super-secret-jwt-key-here
```

## 🚀 Development

**Development server start करें:**
```bash
npm run dev
```

**Production build:**
```bash
npm run build
npm start
```

## 🧪 Testing

**Tests run करें:**
```bash
npm test
```

**Test coverage:**
```bash
npm run test:coverage
```

## 📝 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh-token` - Refresh access token
- `GET /api/v1/auth/profile` - Get user profile
- `PUT /api/v1/auth/profile` - Update user profile
- `POST /api/v1/auth/logout` - User logout

### User Management
- `GET /api/v1/users` - Get all users (with pagination)
- `GET /api/v1/users/stats` - Get user statistics
- `GET /api/v1/users/:id` - Get user by ID
- `PATCH /api/v1/users/:id/status` - Update user status
- `DELETE /api/v1/users/:id` - Delete user

### Examples (API Response Demo)
- `GET /api/v1/examples/simple` - Simple success response
- `GET /api/v1/examples/paginated` - Paginated response
- `POST /api/v1/examples/create` - Created response
- `GET /api/v1/examples/error?type=notfound` - Error responses
- `GET /api/v1/examples/complex` - Complex response with metadata
- `DELETE /api/v1/examples/:id` - No content response

### Health Check & Documentation
- `GET /health` - Server health check
- `GET /api-docs` - API documentation (Swagger UI)

## 🔧 Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run clean` - Clean build directory

## 🗄️ Database

MongoDB database के साथ Mongoose ODM का use किया गया है। Models को `src/models/` directory में define किया गया है।

## 🔐 Security

- JWT authentication
- Password hashing with bcrypt
- Rate limiting
- CORS protection
- Helmet security headers
- Input validation

## 📊 API Response System

यह project में एक comprehensive API response system है जो consistent और scalable responses provide करता है:

### Response Structure
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "pages": 10,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Response Methods
- `res.apiSuccess(data, message)` - Success response
- `res.apiCreated(data, message)` - Created response (201)
- `res.apiNoContent(message)` - No content response (204)
- `res.apiPaginated(data, pagination, message)` - Paginated response
- `res.apiError(message, statusCode, error)` - Error response
- `res.apiNotFound(message)` - Not found response (404)
- `res.apiUnauthorized(message)` - Unauthorized response (401)
- `res.apiForbidden(message)` - Forbidden response (403)
- `res.apiConflict(message)` - Conflict response (409)
- `res.apiBadRequest(message, errors)` - Bad request response (400)
- `res.apiValidationError(message, errors)` - Validation error (422)

### Usage Examples
```typescript
// Success response
res.apiSuccess({ user }, 'User retrieved successfully');

// Paginated response
res.apiPaginated(users, pagination, 'Users retrieved successfully');

// Error response
res.apiNotFound('User not found');

// Validation error
res.apiValidationError('Validation failed', [
  { field: 'email', message: 'Email is required' }
]);
```

### Async Handler
```typescript
import { asyncHandler } from '@/utils';

export const getUsers = asyncHandler(async (req, res) => {
  const users = await userService.getAllUsers();
  res.apiSuccess(users, 'Users retrieved successfully');
});
```

## 📊 Logging

Winston logger का use किया गया है जो logs को files में store करता है:
- `logs/error.log` - Error logs
- `logs/combined.log` - All logs

## 🧪 Testing

Jest testing framework का use किया गया है। Tests को `tests/` directory में organize किया गया है।

## 📦 Dependencies

### Production
- express
- mongoose
- cors
- helmet
- morgan
- dotenv
- bcryptjs
- jsonwebtoken
- joi
- express-rate-limit
- compression
- express-validator
- multer
- nodemailer
- winston
- swagger-jsdoc
- swagger-ui-express

### Development
- typescript
- nodemon
- ts-node
- jest
- ts-jest
- supertest
- eslint
- @typescript-eslint/eslint-plugin
- @typescript-eslint/parser
- rimraf

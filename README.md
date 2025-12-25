# Viteezy Supplement Chatbot API

Production-ready FastAPI application for a session-based supplement recommendation chatbot. The backend manages session history in MongoDB and uses OpenAI for intelligent product recommendations based on user health profiles.

## 🚀 Features

- **Session-based chat system** with persistent conversation history
- **Intelligent product recommendations** based on user health profiles
- **Onboarding flow** with personalized health assessment questions
- **User authentication** and session management
- **Medical treatment awareness** with appropriate disclaimers
- **RESTful API** with comprehensive error handling
- **Production-ready** logging, error handling, and health checks

## 📋 Prerequisites

- **Python 3.10** (required - other versions may not be compatible)
- **MongoDB** database (local or cloud instance)
- **OpenAI API** account with API key
- **pip** package manager

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Viteezy-Bot
```

### 2. Create Virtual Environment (Python 3.10)

```bash
# Using Python 3.10 specifically
python3.10 -m venv venv

# On macOS/Linux
source venv/bin/activate

# On Windows
venv\Scripts\activate
```

**Important:** Ensure you're using Python 3.10. Verify with:

```bash
python --version  # Should show Python 3.10.x
```

### 3. Install Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Environment Configuration

Create a `.env` file in the root directory:

```bash
cp .env.example .env  # If .env.example exists
# OR create .env manually
```

Add the following environment variables to `.env`:

```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017
# OR for MongoDB Atlas:
# MONGODB_URI=

MONGODB_DB=

# OpenAI Configuration
OPENAI_API_KEY=

```

**Security Note:**

- Never commit `.env` file to version control
- Use environment-specific secrets management in production
- Rotate API keys regularly
- Use MongoDB connection strings with proper authentication

### 5. Verify Installation

```bash
python -c "import fastapi, motor, openai; print('All dependencies installed successfully')"
```

## 🏃 Running the Server

### Development Mode

```bash
# Activate virtual environment first
source venv/bin/activate  # On macOS/Linux
# OR
venv\Scripts\activate  # On Windows

# Run with auto-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:

- **API Base URL:** `http://localhost:8000/api/v1`
- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`

### Production Mode

For production, use a production ASGI server with multiple workers:

```bash
# Using Uvicorn with workers
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4

# OR using Gunicorn with Uvicorn workers
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

**Production Recommendations:**

- Use a process manager (systemd, supervisor, PM2)
- Set up reverse proxy (Nginx, Traefik)
- Enable HTTPS/TLS termination
- Configure proper logging and monitoring
- Set up health check endpoints for load balancers

## 📚 API Documentation

### Base URL

```
http://localhost:8000/api/v1
```

### Core Endpoints

#### Health Check

```http
GET /api/v1/health
```

Returns service health status including MongoDB and OpenAI connectivity.

#### Create Session

```http
POST /api/v1/sessions
Content-Type: application/json

{
  "user_id": "optional_user_id",
  "metadata": {
    "quiz_version": "v2.0"
  }
}
```

#### Send Chat Message

```http
POST /api/v1/chat
Content-Type: application/json

{
  "session_id": "session_id_here",
  "message": "user message",
  "context": {}
}
```

#### User Login Verification

```http
POST /api/v1/useridLogin
Content-Type: application/json

{
  "user_id": "user_id_here",
  "session_id": "session_id_here"
}
```

#### Get Session Information

```http
GET /api/v1/sessions/{session_id}
```

#### Get Current Question State

```http
GET /api/v1/sessions/{session_id}/question
```

#### Delete Session

```http
DELETE /api/v1/sessions/{session_id}?user_id={user_id}
```

## ⚙️ Configuration

Configuration is managed through environment variables and `app/config/settings.py`. Key settings:

### MongoDB Collections

- `ai_conversations` - Session and message storage
- `quiz_sessions` - Quiz session tracking
- `temp_product` - Product catalog

### OpenAI Settings

- Model: `gpt-4o-mini` (configurable)
- Temperature: `0.7`
- Max Tokens: `600`
- Max History Turns: `8`

### Application Settings

- Product Context Limit: `3`
- Log Level: `INFO` (set via `LOG_LEVEL` env var)

To modify settings, update environment variables or edit `app/config/settings.py`.

## 🔒 Security Considerations

1. **API Keys**: Never expose API keys in code or logs
2. **MongoDB**: Use authenticated connections with SSL/TLS
3. **CORS**: Configure `allow_origins` in production (currently set to `["*"]` for development)
4. **Input Validation**: All inputs are validated and sanitized
5. **Error Handling**: Sensitive information is not exposed in error messages
6. **Environment Variables**: Use secure secret management in production

## 📊 Logging

Logs are written to:

- Console (stdout)
- File: `logs/app.log`

Log levels: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`

Set log level via `LOG_LEVEL` environment variable.

## 🧪 Testing

### Manual Testing

Use the Swagger UI at `http://localhost:8000/docs` for interactive API testing.

### Health Check

```bash
curl http://localhost:8000/api/v1/health
```

### Create Session

```bash
curl -X POST http://localhost:8000/api/v1/sessions \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 🚢 Production Deployment

### Recommended Setup

1. **Process Manager**: Use systemd, supervisor, or PM2
2. **Reverse Proxy**: Nginx or Traefik for SSL termination
3. **Database**: MongoDB Atlas or managed MongoDB service
4. **Monitoring**: Set up application monitoring and alerting
5. **Logging**: Centralized logging (ELK, CloudWatch, etc.)

### Environment Variables for Production

```env
ENVIRONMENT=production
LOG_LEVEL=WARNING
MONGODB_URI=<production_mongodb_uri>
OPENAI_API_KEY=<production_openai_key>
```

### Docker Deployment (Optional)

Create a `Dockerfile`:

```dockerfile
FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

## 🐛 Troubleshooting

### Common Issues

1. **Python Version Mismatch**

   - Ensure Python 3.10 is installed and used
   - Verify with `python --version`

2. **MongoDB Connection Failed**

   - Check `MONGODB_URI` in `.env`
   - Verify MongoDB is running and accessible
   - Check network connectivity and firewall rules

3. **OpenAI API Errors**

   - Verify `OPENAI_API_KEY` is set correctly
   - Check API key validity and quota
   - Review OpenAI API status

4. **Import Errors**

   - Ensure virtual environment is activated
   - Reinstall dependencies: `pip install -r requirements.txt`

5. **Port Already in Use**
   - Change port in `.env` or use different port: `--port 8001`


---

**Note:** This is a production-ready application. Ensure all security best practices are followed before deploying to production environments.

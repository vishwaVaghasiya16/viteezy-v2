# Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Variables

Ensure all required environment variables are set in your staging/production environment:

- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - JWT secret key
- `POSTNL_API_KEY` - PostNL API key (optional, for address validation)
- Other required environment variables from `env.example`

### 2. Database Setup

#### Step 1: Seed Countries

```bash
npm run seed:countries
```

This will:

- Download the countries CSV from GitHub (if not exists)
- Import all countries with ISO codes (alpha-2, alpha-3, numeric)
- Create indexes for efficient queries

#### Step 2: Seed States

```bash
npm run seed:states
```

This will:

- Load states from `data/states.json` or use built-in common states
- Link states to countries
- Create indexes for efficient queries

#### Step 3: Seed All (Countries + States)

```bash
npm run seed
```

### 3. Build Application

```bash
npm run build
```

### 4. Run Tests

```bash
npm test
```

### 5. Deploy to Staging

#### Using PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start dist/index.js --name viteezy-api

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
```

#### Using Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 3000

CMD ["node", "-r", "module-alias/register", "dist/index.js"]
```

#### Using Systemd (Linux)

Create `/etc/systemd/system/viteezy-api.service`:

```ini
[Unit]
Description=Viteezy API Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/viteezy-phase-2
ExecStart=/usr/bin/node -r module-alias/register dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable viteezy-api
sudo systemctl start viteezy-api
```

## Post-Deployment Verification

### 1. Health Check

```bash
curl http://your-staging-server/health
```

### 2. Test Countries API

```bash
# Get all countries
curl http://your-staging-server/api/v1/countries

# Get country by code
curl http://your-staging-server/api/v1/countries/US

# Get countries by region
curl http://your-staging-server/api/v1/countries/region/Europe
```

### 3. Test States API

```bash
# Get all states
curl http://your-staging-server/api/v1/states

# Get states by country
curl http://your-staging-server/api/v1/states/country/US

# Get state by code
curl http://your-staging-server/api/v1/states/CA?countryCode=US
```

## Database Migration Script

Create a migration script for existing databases:

```bash
#!/bin/bash
# migrate.sh

echo "Starting database migration..."

# Connect to staging database
export MONGODB_URI="your-staging-mongodb-uri"

# Run seeders
npm run seed:countries
npm run seed:states

echo "Migration completed!"
```

## Rollback Plan

If deployment fails:

1. **Database Rollback:**

   ```bash
   # Connect to MongoDB and drop collections
   mongosh your-database-name
   db.countries.drop()
   db.states.drop()
   ```

2. **Application Rollback:**

   ```bash
   # PM2
   pm2 restart viteezy-api

   # Systemd
   sudo systemctl restart viteezy-api
   ```

## Monitoring

### Logs

```bash
# PM2 logs
pm2 logs viteezy-api

# Systemd logs
sudo journalctl -u viteezy-api -f
```

### Health Monitoring

Set up monitoring for:

- API response times
- Database connection status
- Error rates
- Memory usage

## Troubleshooting

### Common Issues

1. **Seeder fails with network error:**

   - Check internet connection
   - Verify GitHub URL is accessible
   - Manually download CSV and place in `data/` directory

2. **Duplicate key errors:**

   - Seeders are idempotent - safe to run multiple times
   - If needed, clear collections before seeding

3. **Database connection issues:**
   - Verify `MONGODB_URI` is correct
   - Check network connectivity
   - Verify database user permissions

## Production Deployment

Follow the same steps as staging, but:

1. Use production MongoDB URI
2. Set `NODE_ENV=production`
3. Enable SSL/TLS
4. Configure reverse proxy (nginx/Apache)
5. Set up monitoring and alerting
6. Configure backup strategy

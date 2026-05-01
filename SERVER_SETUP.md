# Server Setup Commands - Python FastAPI

## Step 1: Python Installation (Linux Server)

```bash
# Update system packages
sudo apt update
sudo apt upgrade -y

# Install Python 3.10 and required dependencies
sudo apt install -y python3.10 python3.10-venv python3.10-dev python3-pip

# Verify Python installation
python3.10 --version
# Should show: Python 3.10.x

# Install build essentials (required for some Python packages)
sudo apt install -y build-essential
```

## Step 2: Navigate to Project Directory

```bash
# Go to your project directory
cd /path/to/viteezy-v2
# OR if you need to clone:
# git clone <your-repo-url>
# cd viteezy-v2
```

## Step 3: Create Virtual Environment

```bash
# Create virtual environment with Python 3.10
python3.10 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Verify you're using the correct Python
which python
# Should show: /path/to/viteezy-v2/venv/bin/python

python --version
# Should show: Python 3.10.x
```

## Step 4: Install Python Dependencies

```bash
# Make sure virtual environment is activated
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install all dependencies from requirements.txt
pip install -r requirements.txt

# Verify installation
python -c "import fastapi, motor, openai; print('All dependencies installed successfully')"
```

## Step 5: Environment Variables Setup

```bash
# Create .env file (if not exists)
nano .env
# OR
vi .env
```

Add these variables to `.env`:

```env
# MongoDB Configuration (same as Node.js)
MONGODB_URI=mongodb+srv://your-connection-string
MONGODB_DB=viteezy-phase-2-staging

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here

# Logging
LOG_LEVEL=INFO
```

## Step 6: Test Python Server

```bash
# Make sure virtual environment is activated
source venv/bin/activate

# Test run (temporary, to verify it works)
uvicorn app.main:app --host 0.0.0.0 --port 8000

# If it works, press Ctrl+C to stop
```

## Step 7: Setup PM2 for Python Server (Recommended)

```bash
# Install PM2 globally (if not already installed)
sudo npm install -g pm2

# Create PM2 ecosystem file for Python
nano ecosystem.config.js
```

Add this to `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'viteezy-node',
      script: 'dist/index.js',
      cwd: '/path/to/viteezy-v2',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 8050
      },
      error_file: './logs/node-error.log',
      out_file: './logs/node-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    },
    {
      name: 'viteezy-python',
      script: 'venv/bin/uvicorn',
      args: 'app.main:app --host 0.0.0.0 --port 8000',
      cwd: '/path/to/viteezy-v2',
      interpreter: 'venv/bin/python',
      instances: 1,
      exec_mode: 'fork',
      env: {
        PYTHONUNBUFFERED: '1'
      },
      error_file: './logs/python-error.log',
      out_file: './logs/python-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    }
  ]
};
```

**Important:** Replace `/path/to/viteezy-v2` with your actual project path.

## Step 8: Start Both Servers with PM2

```bash
# Start both servers
pm2 start ecosystem.config.js

# Check status
pm2 status

# View logs
pm2 logs viteezy-node
pm2 logs viteezy-python

# View all logs together
pm2 logs

# Save PM2 configuration (so it auto-starts on server reboot)
pm2 save
pm2 startup
# Follow the instructions shown by pm2 startup
```

## Alternative: Using systemd (If you prefer systemd over PM2)

### Create Python Service File

```bash
sudo nano /etc/systemd/system/viteezy-python.service
```

Add this content:

```ini
[Unit]
Description=Viteezy Python FastAPI Server
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/viteezy-v2
Environment="PATH=/path/to/viteezy-v2/venv/bin"
Environment="PYTHONUNBUFFERED=1"
ExecStart=/path/to/viteezy-v2/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Important:** Replace:
- `your-username` with your server username
- `/path/to/viteezy-v2` with your actual project path

### Enable and Start Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service (auto-start on boot)
sudo systemctl enable viteezy-python

# Start service
sudo systemctl start viteezy-python

# Check status
sudo systemctl status viteezy-python

# View logs
sudo journalctl -u viteezy-python -f
```

## Step 9: Verify Both Servers are Running

```bash
# Check if Node.js server is running (port 8050)
curl http://localhost:8050/api/v1/health

# Check if Python server is running (port 8000)
curl http://localhost:8000/api/v1/health

# Check from Node.js proxy (should proxy to Python)
curl http://localhost:8050/api/v1/sessions
```

## Step 10: Firewall Configuration (if needed)

```bash
# Allow ports 8050 (Node.js) and 8000 (Python)
sudo ufw allow 8050/tcp
sudo ufw allow 8000/tcp

# If using Nginx reverse proxy, only allow 80 and 443
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

## Quick Reference Commands

```bash
# Activate virtual environment
source venv/bin/activate

# Deactivate virtual environment
deactivate

# Install/update dependencies
pip install -r requirements.txt

# Run Python server manually (for testing)
uvicorn app.main:app --host 0.0.0.0 --port 8000

# PM2 Commands
pm2 status                    # Check status
pm2 restart viteezy-python   # Restart Python server
pm2 stop viteezy-python      # Stop Python server
pm2 logs viteezy-python      # View logs
pm2 delete viteezy-python    # Remove from PM2

# systemd Commands (if using systemd)
sudo systemctl status viteezy-python
sudo systemctl restart viteezy-python
sudo systemctl stop viteezy-python
sudo systemctl start viteezy-python
```

## Troubleshooting

### Python not found
```bash
# Check Python installation
which python3.10
python3.10 --version

# If not found, install Python 3.10
sudo apt install python3.10 python3.10-venv
```

### Virtual environment issues
```bash
# Recreate virtual environment
rm -rf venv
python3.10 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Port already in use
```bash
# Check what's using port 8000
sudo lsof -i :8000
# OR
sudo netstat -tulpn | grep 8000

# Kill the process if needed
sudo kill -9 <PID>
```

### Permission errors
```bash
# Make sure you have proper permissions
sudo chown -R $USER:$USER /path/to/viteezy-v2
```

## Production Recommendations

1. **Use Nginx as reverse proxy** - Forward requests to Node.js (port 8050)
2. **Enable HTTPS** - Use Let's Encrypt SSL certificates
3. **Set up monitoring** - Use PM2 monitoring or other tools
4. **Configure logging** - Centralize logs
5. **Set up backups** - Regular database and code backups
6. **Use environment-specific .env files** - Separate dev/staging/production configs


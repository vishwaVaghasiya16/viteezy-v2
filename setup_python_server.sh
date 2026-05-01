#!/bin/bash

# Viteezy Python Server Setup Script
# Run this script on your Linux server to set up Python FastAPI

set -e  # Exit on error

echo "=========================================="
echo "Viteezy Python Server Setup"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get project directory
PROJECT_DIR=$(pwd)
echo -e "${GREEN}Project Directory: ${PROJECT_DIR}${NC}"

# Step 1: Check Python 3.10
echo -e "\n${YELLOW}Step 1: Checking Python 3.10...${NC}"
if command -v python3.10 &> /dev/null; then
    PYTHON_VERSION=$(python3.10 --version)
    echo -e "${GREEN}✓ Python 3.10 found: ${PYTHON_VERSION}${NC}"
else
    echo -e "${RED}✗ Python 3.10 not found. Installing...${NC}"
    sudo apt update
    sudo apt install -y python3.10 python3.10-venv python3.10-dev python3-pip build-essential
    echo -e "${GREEN}✓ Python 3.10 installed${NC}"
fi

# Step 2: Create virtual environment
echo -e "\n${YELLOW}Step 2: Creating virtual environment...${NC}"
if [ -d "venv" ]; then
    echo -e "${YELLOW}Virtual environment already exists. Removing old one...${NC}"
    rm -rf venv
fi

python3.10 -m venv venv
echo -e "${GREEN}✓ Virtual environment created${NC}"

# Step 3: Activate virtual environment and upgrade pip
echo -e "\n${YELLOW}Step 3: Installing dependencies...${NC}"
source venv/bin/activate
pip install --upgrade pip
echo -e "${GREEN}✓ pip upgraded${NC}"

# Step 4: Install requirements
if [ -f "requirements.txt" ]; then
    echo -e "${YELLOW}Installing Python packages from requirements.txt...${NC}"
    pip install -r requirements.txt
    echo -e "${GREEN}✓ All dependencies installed${NC}"
else
    echo -e "${RED}✗ requirements.txt not found!${NC}"
    exit 1
fi

# Step 5: Verify installation
echo -e "\n${YELLOW}Step 4: Verifying installation...${NC}"
python -c "import fastapi, motor, openai; print('✓ All dependencies verified')" || {
    echo -e "${RED}✗ Installation verification failed${NC}"
    exit 1
}

# Step 6: Check .env file
echo -e "\n${YELLOW}Step 5: Checking environment variables...${NC}"
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠ .env file not found. Creating from env.example...${NC}"
    if [ -f "env.example" ]; then
        cp env.example .env
        echo -e "${YELLOW}⚠ Please edit .env file and add required variables:${NC}"
        echo -e "  - MONGODB_URI"
        echo -e "  - MONGODB_DB"
        echo -e "  - OPENAI_API_KEY"
    else
        echo -e "${YELLOW}⚠ Please create .env file with required variables${NC}"
    fi
else
    echo -e "${GREEN}✓ .env file exists${NC}"
fi

# Step 7: Create logs directory
echo -e "\n${YELLOW}Step 6: Creating logs directory...${NC}"
mkdir -p logs
echo -e "${GREEN}✓ Logs directory created${NC}"

# Step 8: Test server (optional)
echo -e "\n${GREEN}=========================================="
echo "Setup Complete!"
echo "==========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration:"
echo "   nano .env"
echo ""
echo "2. Test the server:"
echo "   source venv/bin/activate"
echo "   uvicorn app.main:app --host 0.0.0.0 --port 8000"
echo ""
echo "3. Setup PM2 (recommended for production):"
echo "   See SERVER_SETUP.md for PM2 configuration"
echo ""
echo "4. Or use systemd:"
echo "   See SERVER_SETUP.md for systemd configuration"
echo ""


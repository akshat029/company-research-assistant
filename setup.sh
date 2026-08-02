#!/bin/bash
# ============================================================
# Company Research Assistant — One-Click Setup Script
# ============================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════╗"
echo "║   AI Company Research Assistant — Setup     ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}✗ Python 3 not found. Install from https://python.org${NC}"
    exit 1
fi
PY_VERSION=$(python3 --version 2>&1)
echo -e "${GREEN}✓ $PY_VERSION found${NC}"

# Check Node
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found. Install from https://nodejs.org${NC}"
    exit 1
fi
NODE_VERSION=$(node --version 2>&1)
echo -e "${GREEN}✓ Node $NODE_VERSION found${NC}"

echo ""
echo -e "${BLUE}━━━ Step 1: Setting up Backend ━━━━━━━━━━━━━━━━━━━━━━${NC}"

cd backend

# Create .env if it doesn't exist
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo -e "${YELLOW}⚠ Created backend/.env    from .env.example"
    echo -e "  Please edit backend/.env and add your API keys!${NC}"
else
    echo -e "${GREEN}✓ backend/.env already exists${NC}"
fi

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate and install
echo "Installing Python dependencies..."
source venv/bin/activate 2>/dev/null || . venv/Scripts/activate 2>/dev/null || true
pip install -q --upgrade pip
pip install -q -r requirements.txt
echo -e "${GREEN}✓ Backend dependencies installed${NC}"

cd ..

echo ""
echo -e "${BLUE}━━━ Step 2: Setting up Frontend ━━━━━━━━━━━━━━━━━━━━━${NC}"

cd frontend

if [ ! -f ".env.local" ]; then
    cp .env.example .env.local
fi

echo "Installing Node.js dependencies..."
npm install --silent
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"

cd ..

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Setup Complete! ✓              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Before starting, make sure to add your API keys to backend/.env:${NC}"
echo "  OPENAI_API_KEY=sk-...   (or GROQ_API_KEY for free)"
echo "  TAVILY_API_KEY=tvly-..."
echo ""
echo -e "${BLUE}To start the application:${NC}"
echo ""
echo -e "  Terminal 1 (Backend):"
echo -e "  ${GREEN}cd backend && source venv/bin/activate && uvicorn app.main:app --reload${NC}"
echo ""
echo -e "  Terminal 2 (Frontend):"
echo -e "  ${GREEN}cd frontend && npm run dev${NC}"
echo ""
echo -e "  Then open: ${BLUE}http://localhost:5173${NC}"
echo -e "  API Docs:  ${BLUE}http://localhost:8000/docs${NC}"
echo ""

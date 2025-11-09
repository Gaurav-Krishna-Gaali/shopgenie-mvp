#!/bin/bash

echo "========================================"
echo "AI Product Launch Kit - Setup Script"
echo "========================================"
echo ""

echo "[1/5] Setting up Backend..."
cd backend

if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << EOF
SHOPIFY_API_KEY=your_shopify_api_key_here
SHOPIFY_API_SECRET=your_shopify_api_secret_here
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
CLAUDE_API_KEY=your_claude_api_key_here
SESSION_SECRET=some-random-secret-string-change-in-production
EOF
    echo ".env file created!"
else
    echo ".env file already exists, skipping..."
fi

echo "Installing Python dependencies..."
pip install -r requirements.txt
cd ..

echo ""
echo "[2/5] Setting up Frontend..."
cd frontend

if [ ! -f .env.local ]; then
    echo "Creating .env.local file..."
    echo "NEXT_PUBLIC_APP_URL=http://localhost:8000" > .env.local
    echo ".env.local file created!"
else
    echo ".env.local file already exists, skipping..."
fi

echo "Installing Node dependencies..."
npm install
cd ..

echo ""
echo "[3/5] Setup complete!"
echo ""
echo "========================================"
echo "Next Steps:"
echo "========================================"
echo ""
echo "1. Start ngrok (in a NEW terminal):"
echo "   ngrok http 8000"
echo ""
echo "2. Copy the ngrok URL (e.g., https://abc123.ngrok.io)"
echo "   and update backend/.env:"
echo "   APP_URL=https://abc123.ngrok.io"
echo ""
echo "3. Update Shopify app redirect URL to:"
echo "   https://abc123.ngrok.io/auth/callback"
echo ""
echo "4. Start Backend (Terminal 1):"
echo "   cd backend"
echo "   python main.py"
echo ""
echo "5. Start Frontend (Terminal 2):"
echo "   cd frontend"
echo "   npm run dev"
echo ""
echo "6. Open http://localhost:3000"
echo ""


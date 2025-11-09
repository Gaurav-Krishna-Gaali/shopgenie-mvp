# ShopGenie MVP 🛍️✨

AI-powered product launch optimization tool for Shopify stores. Automatically generates optimized product titles, descriptions, SEO metadata, discount codes, and launch copy using Claude AI.

![ShopGenie](https://img.shields.io/badge/ShopGenie-AI%20Powered-blue)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-green)
![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-black)

## 🚀 Features

- ✅ **Shopify OAuth Integration** - Secure connection to your Shopify store
- ✅ **AI-Powered Content Generation** - Uses Claude 3.5 Sonnet for intelligent content
- ✅ **Product Optimization** - Automatically optimizes titles, descriptions, and SEO
- ✅ **Bundle Creation** - Create product bundles with AI-generated descriptions
- ✅ **Discount Code Generation** - Automatically creates discount codes for launches
- ✅ **Launch Copy** - Generates announcement bar copy and marketing text
- ✅ **One-Click Apply** - Push all changes to your Shopify store instantly
- ✅ **Modern UI** - Beautiful, responsive interface built with Next.js and Tailwind CSS

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **Python** (v3.11 or higher) - [Download](https://www.python.org/downloads/)
- **Git** - [Download](https://git-scm.com/downloads)
- **ngrok** (for local development) - [Download](https://ngrok.com/download)
- **Shopify Partner Account** - [Sign up](https://partners.shopify.com/)
- **Anthropic API Key** - [Get one](https://console.anthropic.com/)

## 🔑 Getting Your API Keys

### 1. Shopify App Credentials

1. Go to [Shopify Partner Dashboard](https://partners.shopify.com/)
2. Click **Apps** → **Create app**
3. Choose **Create app manually**
4. Fill in app details:
   - **App name**: ShopGenie (or your preferred name)
   - **App URL**: Will be set after ngrok setup
   - **Allowed redirection URL(s)**: `https://your-ngrok-url/auth/callback` (update after ngrok)
5. After creating, go to **API credentials** tab
6. Copy your **Client ID** (API Key) and **Client secret** (API Secret)

**Required Scopes:**
- `read_products` - View products
- `write_products` - Edit products
- `read_content` - View content
- `write_content` - Edit content
- `write_discounts` - Create discount codes
- `read_themes` - View themes
- `write_themes` - Edit themes

### 2. Anthropic (Claude) API Key

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to **API Keys**
4. Click **Create Key**
5. Copy the API key (starts with `sk-ant-`)

## 🛠️ Installation

### Option 1: Automated Setup (Recommended)

**Windows:**
```bash
setup.bat
```

**Linux/Mac:**
```bash
chmod +x setup.sh
./setup.sh
```

This script will:
- Install Python dependencies
- Install Node.js dependencies
- Create `.env` files with placeholders
- Set up the project structure

### Option 2: Manual Setup

#### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Create `.env` file:**
   ```bash
   # Windows
   copy .env.example .env
   
   # Linux/Mac
   cp .env.example .env
   ```

4. **Edit `.env` file with your credentials:**
   ```env
   SHOPIFY_API_KEY=your_shopify_api_key_here
   SHOPIFY_API_SECRET=your_shopify_api_secret_here
   APP_URL=http://localhost:8000
   FRONTEND_URL=http://localhost:3000
   CLAUDE_API_KEY=your_claude_api_key_here
   ```

#### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

3. **Create `.env.local` file:**
   ```bash
   # Windows
   echo NEXT_PUBLIC_APP_URL=http://localhost:8000 > .env.local
   
   # Linux/Mac
   echo "NEXT_PUBLIC_APP_URL=http://localhost:8000" > .env.local
   ```

## 🚀 Running the Application

You need **3 terminals** running simultaneously:

### Terminal 1: ngrok (Required for OAuth)

**Why ngrok?** Shopify OAuth requires a public HTTPS URL. ngrok creates a secure tunnel to your local server.

1. **Start ngrok:**
   ```bash
   # Windows
   start-ngrok.bat
   
   # Or manually
   ngrok http 8000
   ```

2. **Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)

3. **Update `backend/.env`:**
   ```env
   APP_URL=https://abc123.ngrok.io
   ```

4. **Update Shopify App Settings:**
   - Go to Shopify Partner Dashboard → Your App → App setup
   - **Application URL**: `https://abc123.ngrok.io` (base URL only, no path)
   - **Allowed redirection URL(s)**: `https://abc123.ngrok.io/auth/callback`
   - ⚠️ **IMPORTANT**: Both URLs must have the same host!

### Terminal 2: Backend Server

```bash
# Windows
start-backend.bat

# Or manually
cd backend
python main.py
```

Backend will run on `http://localhost:8000`

**Verify it's working:**
- Open `http://localhost:8000/docs` - Should show FastAPI documentation
- Open `http://localhost:8000/api/test-claude` - Should test Claude API connection

### Terminal 3: Frontend Server

```bash
# Windows
start-frontend.bat

# Or manually
cd frontend
npm run dev
```

Frontend will run on `http://localhost:3000`

## 🎯 Usage

1. **Open the app**: Navigate to `http://localhost:3000`

2. **Connect your store**:
   - Enter your Shopify store domain (e.g., `your-store.myshopify.com`)
   - Click "Connect Store"
   - Complete OAuth authorization in the popup

3. **Load products**:
   - After connection, ask the AI: "Load my products" or "Show me products"
   - Products will be displayed in a grid

4. **Optimize a product**:
   - Ask: "I want to optimize a product" or "Generate launch assets"
   - Select a product from the grid
   - Review the AI-generated content (title, description, SEO, discount code)
   - Click "Apply to Store" to push changes

5. **Create a bundle**:
   - Ask: "I want to create a bundle" or "Bundle products"
   - Select Product A, then Product B
   - Review the bundle details
   - Click "Create Bundle in Store"

## 📁 Project Structure

```
shopgenie-mvp/
├── backend/                 # FastAPI backend
│   ├── main.py             # Main application file
│   ├── requirements.txt    # Python dependencies
│   ├── app.db             # SQLite database
│   ├── Dockerfile         # Docker configuration
│   └── .env              # Environment variables (not in git)
│
├── frontend/              # Next.js frontend
│   ├── app/              # Next.js app directory
│   ├── components/       # React components
│   ├── lib/             # Utility functions
│   ├── package.json     # Node.js dependencies
│   └── .env.local       # Environment variables (not in git)
│
├── setup.bat            # Windows setup script
├── docker-compose.yml   # Docker Compose configuration
└── README.md           # This file
```

## 🐳 Docker Deployment

### Using Docker Compose

1. **Create `.env` file in root** (or set environment variables):
   ```env
   SHOPIFY_API_KEY=your_key
   SHOPIFY_API_SECRET=your_secret
   CLAUDE_API_KEY=your_key
   ```

2. **Build and run:**
   ```bash
   docker-compose up --build
   ```

3. **Access:**
   - Frontend: `http://localhost:3000`
   - Backend: `http://localhost:8000`

### Individual Dockerfiles

See `DEPLOYMENT.md` for detailed Docker deployment instructions.

## ☁️ Production Deployment

### Recommended: Vercel (Frontend) + Railway (Backend)

See `QUICK_DEPLOY.md` for step-by-step deployment instructions.

**Quick Overview:**
1. Deploy backend to Railway
2. Deploy frontend to Vercel
3. Set environment variables
4. Update Shopify app URLs
5. Done! 🎉

For detailed deployment options, see `DEPLOYMENT.md`.

## 🐛 Troubleshooting

### OAuth Errors

**Error: "redirect_uri and application url must have matching hosts"**
- Ensure `APP_URL` in `backend/.env` matches your ngrok URL exactly
- Update Shopify Partner Dashboard → App setup:
  - **Application URL**: `https://your-ngrok-url` (no path)
  - **Allowed redirection URL(s)**: `https://your-ngrok-url/auth/callback`

**Error: "Invalid redirect_uri"**
- Check that the redirect URL in Shopify matches exactly: `https://your-ngrok-url/auth/callback`
- Make sure there are no trailing slashes

### CORS Errors

**Error: "Access to fetch blocked by CORS policy"**
- Verify `NEXT_PUBLIC_APP_URL` in `frontend/.env.local` points to your backend
- Check that backend is running on the correct port
- Ensure `FRONTEND_URL` in `backend/.env` matches your frontend URL

### Claude API Errors

**Error: "Invalid Claude API key"**
- Verify your API key in `backend/.env` is correct
- Check that you have credits in your Anthropic account
- Ensure the key starts with `sk-ant-`

**Error: "Rate limit exceeded"**
- You've hit the API rate limit
- Wait a few minutes and try again
- Consider upgrading your Anthropic plan

### Shopify API Errors

**Error: "Scope approval required"**
- Some scopes require merchant approval
- Uninstall and reinstall the app
- Make sure to approve ALL permissions during OAuth

**Error: "403 Forbidden"**
- Check that your app has the required scopes enabled
- Verify your API credentials are correct
- Ensure the store has granted necessary permissions

### Port Already in Use

**Windows:**
```bash
# Find process using port 8000
netstat -ano | findstr :8000
# Kill process (replace PID with actual process ID)
taskkill /PID <PID> /F

# Find process using port 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

**Linux/Mac:**
```bash
# Find and kill process on port 8000
lsof -ti:8000 | xargs kill -9

# Find and kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Database Issues

**SQLite locked errors:**
- Make sure only one instance of the backend is running
- Close any database viewers that might have the DB open

## 🔒 Security Notes

- ⚠️ **Never commit `.env` files** - They're in `.gitignore`
- ⚠️ **Rotate API keys** if they're ever exposed
- ⚠️ **Use environment variables** in production, never hardcode secrets
- ⚠️ **Restrict CORS** in production to your frontend domain only

## 📚 Additional Documentation

- **Quick Start**: `QUICKSTART.md`
- **Commands Reference**: `COMMANDS.md`
- **Deployment Guide**: `DEPLOYMENT.md`
- **Quick Deploy**: `QUICK_DEPLOY.md`
- **Setup Checklist**: `SETUP_CHECKLIST.md`

## 🛠️ Tech Stack

- **Backend**: FastAPI, Python 3.11+, SQLite
- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **AI**: Claude 3.5 Sonnet (Anthropic)
- **APIs**: Shopify Admin API, Anthropic API
- **Database**: SQLite (can be upgraded to PostgreSQL)

## 📝 License

This project is an MVP. See LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

For issues and questions:
- Check `TROUBLESHOOTING.md` (if exists)
- Review `COMMANDS.md` for common commands
- Open an issue on GitHub

## 🎉 Acknowledgments

- Built with [FastAPI](https://fastapi.tiangolo.com/)
- Frontend powered by [Next.js](https://nextjs.org/)
- AI powered by [Claude](https://www.anthropic.com/)
- Integrated with [Shopify](https://www.shopify.com/)

---

**Made with ❤️ for Shopify merchants**

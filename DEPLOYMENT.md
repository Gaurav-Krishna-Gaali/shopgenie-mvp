# Deployment Guide for ShopGenie MVP

This guide covers the best deployment options for your FastAPI + Next.js application.

## 🚀 Recommended Deployment Options

### Option 1: Vercel (Frontend) + Railway (Backend) ⭐ **RECOMMENDED**

**Best for**: Quick deployment, great developer experience, free tier available

#### Frontend (Vercel)
1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Set root directory to `frontend`
4. Add environment variable:
   - `NEXT_PUBLIC_APP_URL` = Your Railway backend URL (e.g., `https://your-app.railway.app`)
5. Deploy!

#### Backend (Railway)
1. Go to [railway.app](https://railway.app) and create a new project
2. Add a new service → "Deploy from GitHub repo"
3. Select your repository
4. Set root directory to `backend`
5. Add environment variables:
   ```
   APP_URL=https://your-app.railway.app
   FRONTEND_URL=https://your-vercel-app.vercel.app
   SHOPIFY_API_KEY=your_key
   SHOPIFY_API_SECRET=your_secret
   CLAUDE_API_KEY=your_key
   ```
6. Railway will auto-detect Python and install dependencies
7. Add a start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

**Pros**: 
- Free tier available
- Automatic HTTPS
- Easy environment variable management
- Auto-deploys on git push

---

### Option 2: Vercel (Frontend) + Render (Backend)

**Best for**: Free tier with more resources

#### Frontend (Vercel)
Same as Option 1

#### Backend (Render)
1. Go to [render.com](https://render.com) and create account
2. New → Web Service → Connect GitHub repo
3. Configure:
   - **Name**: shopgenie-backend
   - **Root Directory**: `backend`
   - **Environment**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add environment variables (same as Railway)
5. Deploy!

**Pros**: 
- Generous free tier
- Automatic SSL
- Auto-deploys

---

### Option 3: Docker + Single Platform (Railway/Render/Fly.io)

**Best for**: Deploying both services together, easier management

#### Create Dockerfile for Backend

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### Create Dockerfile for Frontend

```dockerfile
# frontend/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

#### Update next.config.js for standalone output

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
}

module.exports = nextConfig
```

#### Deploy to Railway
1. Create a new Railway project
2. Add two services:
   - Backend service (from `backend/Dockerfile`)
   - Frontend service (from `frontend/Dockerfile`)
3. Set environment variables for each service
4. Connect services via internal networking

---

### Option 4: Fly.io (Both Services)

**Best for**: Global edge deployment, great performance

#### Setup
1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Login: `fly auth login`
3. Initialize backend: `cd backend && fly launch`
4. Initialize frontend: `cd frontend && fly launch`
5. Configure environment variables via `fly secrets set`

**Pros**:
- Global edge network
- Great performance worldwide
- Simple pricing

---

## 🔧 Pre-Deployment Checklist

### Backend Changes Needed

1. **Update CORS settings** in `main.py`:
   ```python
   app.add_middleware(
       CORSMiddleware,
       allow_origins=[FRONTEND_URL],  # Change from ["*"] to your frontend URL
       allow_credentials=True,
       allow_methods=["*"],
       allow_headers=["*"],
   )
   ```

2. **Database**: SQLite works for MVP, but consider PostgreSQL for production:
   - Railway/Render offer free PostgreSQL
   - Update `db()` function to use PostgreSQL connection

3. **Environment Variables**: Ensure all are set in your hosting platform

### Frontend Changes Needed

1. **Environment Variables**: 
   - Set `NEXT_PUBLIC_APP_URL` to your backend URL
   - Update in Vercel dashboard or via `.env.production`

2. **Build Configuration**: Already configured in `package.json`

---

## 📝 Step-by-Step: Vercel + Railway (Recommended)

### Step 1: Deploy Backend to Railway

1. **Prepare your backend**:
   ```bash
   cd backend
   # Ensure requirements.txt is up to date
   ```

2. **Create Railway project**:
   - Go to railway.app → New Project
   - Deploy from GitHub repo
   - Select your repo, set root directory to `backend`

3. **Configure Railway**:
   - Settings → Generate Domain (e.g., `shopgenie-backend.railway.app`)
   - Variables → Add all environment variables
   - Settings → Add start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

4. **Test backend**: Visit `https://your-backend.railway.app/docs` (FastAPI docs)

### Step 2: Deploy Frontend to Vercel

1. **Prepare frontend**:
   ```bash
   cd frontend
   # Create .env.production (optional, can set in Vercel dashboard)
   echo "NEXT_PUBLIC_APP_URL=https://your-backend.railway.app" > .env.production
   ```

2. **Deploy to Vercel**:
   - Go to vercel.com → New Project
   - Import GitHub repository
   - Root Directory: `frontend`
   - Environment Variables:
     - `NEXT_PUBLIC_APP_URL` = `https://your-backend.railway.app`
   - Deploy!

3. **Update backend CORS**:
   - In Railway, add environment variable:
     - `FRONTEND_URL` = `https://your-frontend.vercel.app`
   - Update `main.py` CORS to use `FRONTEND_URL`

### Step 3: Update Shopify App Settings

1. Go to Shopify Partner Dashboard
2. Update your app's redirect URL:
   - `https://your-backend.railway.app/auth/callback`
3. Update allowed domains if needed

---

## 🐳 Docker Alternative (If you prefer containers)

### docker-compose.yml (for local testing)

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - APP_URL=http://localhost:8000
      - FRONTEND_URL=http://localhost:3000
      - SHOPIFY_API_KEY=${SHOPIFY_API_KEY}
      - SHOPIFY_API_SECRET=${SHOPIFY_API_SECRET}
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
    volumes:
      - ./backend/app.db:/app/app.db

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_APP_URL=http://localhost:8000
    depends_on:
      - backend
```

---

## 💰 Cost Comparison

| Platform | Free Tier | Paid Tier |
|----------|-----------|-----------|
| **Vercel** | ✅ 100GB bandwidth | $20/mo (Pro) |
| **Railway** | ✅ $5 credit/month | $5-20/mo |
| **Render** | ✅ 750 hours/month | $7-25/mo |
| **Fly.io** | ✅ 3 shared VMs | $1.94-5/mo per VM |

**Recommended**: Vercel (free) + Railway (free tier) = **$0/month** for MVP

---

## 🔒 Security Considerations

1. **CORS**: Restrict to your frontend domain (not `["*"]`)
2. **Environment Variables**: Never commit `.env` files
3. **Database**: Consider PostgreSQL for production (SQLite is fine for MVP)
4. **HTTPS**: All platforms provide automatic SSL
5. **API Keys**: Store securely in platform environment variables

---

## 🚨 Troubleshooting

### Backend not accessible
- Check Railway/Render logs
- Verify `PORT` environment variable is used (some platforms set this automatically)
- Ensure CORS allows your frontend domain

### Frontend can't connect to backend
- Verify `NEXT_PUBLIC_APP_URL` is set correctly
- Check browser console for CORS errors
- Ensure backend is running and accessible

### Database issues
- SQLite file persistence: Use volumes in Docker, or upgrade to PostgreSQL
- Railway/Render: Consider using their PostgreSQL service

---

## 📚 Additional Resources

- [Vercel Deployment Docs](https://vercel.com/docs)
- [Railway Docs](https://docs.railway.app)
- [Render Docs](https://render.com/docs)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

---

## ✅ Quick Start (Recommended Path)

1. **Backend**: Deploy to Railway (5 minutes)
2. **Frontend**: Deploy to Vercel (5 minutes)
3. **Configure**: Set environment variables
4. **Test**: Visit your Vercel URL
5. **Done!** 🎉



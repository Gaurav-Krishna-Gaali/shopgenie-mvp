# Quick Deployment Guide

## 🚀 Fastest Path: Vercel + Railway (15 minutes)

### Step 1: Deploy Backend to Railway

1. **Push code to GitHub** (if not already)
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Go to Railway**: https://railway.app
   - Sign up/login with GitHub
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Set **Root Directory** to `backend`

3. **Configure Environment Variables** in Railway:
   - Go to your service → Variables tab
   - Add these variables:
     ```
     APP_URL=https://your-app.railway.app (update after getting domain)
     FRONTEND_URL=https://your-frontend.vercel.app (update after deploying frontend)
     SHOPIFY_API_KEY=your_key
     SHOPIFY_API_SECRET=your_secret
     CLAUDE_API_KEY=your_key
     ```

4. **Get your domain**:
   - Railway → Settings → Generate Domain
   - Copy the domain (e.g., `shopgenie-backend.railway.app`)
   - Update `APP_URL` in environment variables

5. **Set start command** (if not auto-detected):
   - Settings → Deploy → Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

6. **Test**: Visit `https://your-backend.railway.app/docs` (should show FastAPI docs)

---

### Step 2: Deploy Frontend to Vercel

1. **Go to Vercel**: https://vercel.com
   - Sign up/login with GitHub
   - Click "Add New Project"
   - Import your GitHub repository

2. **Configure Project**:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Next.js (auto-detected)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `.next` (auto-detected)

3. **Add Environment Variable**:
   - `NEXT_PUBLIC_APP_URL` = `https://your-backend.railway.app` (from Step 1)

4. **Deploy**: Click "Deploy"

5. **Get your frontend URL**:
   - After deployment, copy your Vercel URL (e.g., `shopgenie.vercel.app`)

---

### Step 3: Update Backend CORS

1. **Go back to Railway**
2. **Update environment variable**:
   - `FRONTEND_URL` = `https://your-frontend.vercel.app`
3. **Redeploy** (Railway auto-redeploys on env var changes)

---

### Step 4: Update Shopify App Settings

1. **Go to Shopify Partner Dashboard**: https://partners.shopify.com
2. **Select your app**
3. **Update App URL**: `https://your-backend.railway.app`
4. **Update Redirect URL**: `https://your-backend.railway.app/auth/callback`
5. **Save**

---

### Step 5: Test Your Deployment

1. Visit your Vercel frontend URL
2. Try connecting a Shopify store
3. Check Railway logs if there are any issues

---

## ✅ Deployment Checklist

- [ ] Backend deployed to Railway
- [ ] Backend domain obtained and working (`/docs` endpoint accessible)
- [ ] Frontend deployed to Vercel
- [ ] Environment variables set in both platforms
- [ ] CORS updated with frontend URL
- [ ] Shopify app settings updated
- [ ] Tested end-to-end flow

---

## 🐛 Troubleshooting

### Backend not accessible
- Check Railway logs: Railway → Deployments → View Logs
- Verify `PORT` environment variable (Railway sets this automatically)
- Ensure start command is correct

### Frontend can't connect to backend
- Verify `NEXT_PUBLIC_APP_URL` is set correctly in Vercel
- Check browser console for CORS errors
- Ensure backend is running (check Railway logs)

### CORS errors
- Verify `FRONTEND_URL` in Railway matches your Vercel URL exactly
- Check that backend CORS middleware is using `FRONTEND_URL`
- Clear browser cache

---

## 📝 Environment Variables Reference

### Railway (Backend)
```
APP_URL=https://your-backend.railway.app
FRONTEND_URL=https://your-frontend.vercel.app
SHOPIFY_API_KEY=sk_...
SHOPIFY_API_SECRET=...
CLAUDE_API_KEY=sk-ant-...
```

### Vercel (Frontend)
```
NEXT_PUBLIC_APP_URL=https://your-backend.railway.app
```

---

## 🎉 You're Done!

Your app should now be live and accessible at your Vercel URL!



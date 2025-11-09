# Commands to Run the App

## Quick Setup (One-Time)

Run the setup script to install dependencies and create config files:

```bash
setup.bat
```

Or manually:

### 1. Backend Setup
```bash
cd backend
pip install -r requirements.txt
```

Create `backend/.env` file with:
```
SHOPIFY_API_KEY=your_shopify_api_key_here
SHOPIFY_API_SECRET=your_shopify_api_secret_here
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
CLAUDE_API_KEY=your_claude_api_key_here
SESSION_SECRET=some-random-secret-string-change-in-production
```

### 2. Frontend Setup
```bash
cd frontend
npm install
```

Create `frontend/.env.local` file with:
```
NEXT_PUBLIC_APP_URL=http://localhost:8000
```

---

## Running the App (Every Time)

You need **3 terminals** running simultaneously:

### Terminal 1: ngrok (Required for OAuth)
```bash
start-ngrok.bat
```
OR
```bash
ngrok http 8000
```

**After starting ngrok:**
1. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
2. Update `backend/.env`: Change `APP_URL` to your ngrok URL (e.g., `APP_URL=https://abc123.ngrok.io`)

   3. **In Shopify Partner Dashboard**, update your app settings:
   - **Application URL**: `https://abc123.ngrok.io` (base URL only, no path)
   - **Allowed redirection URL(s)**: `https://abc123.ngrok.io/auth/callback`
   ⚠️ **IMPORTANT**: The Application URL host must match the redirect_uri host!

### Terminal 2: Backend Server
```bash
start-backend.bat
```
OR
```bash
cd backend
python main.py
```

Backend will run on `http://localhost:8000`

### Terminal 3: Frontend Server
```bash
start-frontend.bat
```
OR
```bash
cd frontend
npm run dev
```

Frontend will run on `http://localhost:3000`

---

## All-in-One Commands

### Setup Everything
```bash
setup.bat
```

### Start Everything (after setup)
1. **Terminal 1**: `start-ngrok.bat` (then update .env with ngrok URL)
2. **Terminal 2**: `start-backend.bat`
3. **Terminal 3**: `start-frontend.bat`

---

## Manual Step-by-Step

### Step 1: Install Dependencies
```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

### Step 2: Configure Environment
Create `backend/.env` and `frontend/.env.local` (see above)

### Step 3: Start ngrok
```bash
ngrok http 8000
```
Copy the HTTPS URL and update `backend/.env`

### Step 4: Update Shopify App
In Shopify Partner Dashboard:
- **Application URL**: `https://your-ngrok-url` (base URL only, no path)
- **Allowed redirection URL(s)**: `https://your-ngrok-url/auth/callback`
  
  ⚠️ **IMPORTANT**: Both URLs must have the same host!

### Step 5: Start Backend
```bash
cd backend
python main.py
```

### Step 6: Start Frontend
```bash
cd frontend
npm run dev
```

### Step 7: Open App
Open browser: `http://localhost:3000`

---

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 8000
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Kill process on port 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### OAuth Error: "redirect_uri and application url must have matching hosts"
This error means the **Application URL** in Shopify Partner Dashboard doesn't match your `APP_URL` host.

**Fix:**
1. Check your `backend/.env` file - what is your `APP_URL`? (e.g., `https://abc123.ngrok.io`)
2. Go to Shopify Partner Dashboard → Your App → App setup
3. Set **Application URL** to: `https://abc123.ngrok.io` (same host as `APP_URL`, no path)
4. Set **Allowed redirection URL(s)** to: `https://abc123.ngrok.io/auth/callback`
5. Save and try again

**Note:** If you restart ngrok and get a new URL, you must update BOTH:
- `APP_URL` in `backend/.env`
- Application URL in Shopify Partner Dashboard

### ngrok Not Found
```bash
npm install -g ngrok
```

### Python Not Found
Make sure Python is installed and in PATH:
```bash
python --version
```

### Node Not Found
Make sure Node.js is installed:
```bash
node --version
npm --version
```


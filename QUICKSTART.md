# Quick Start Guide

## 1. Get Your API Keys

### Shopify App Setup
1. Go to [Shopify Partner Dashboard](https://partners.shopify.com/)
2. Create a new app
3. Note your **API Key** and **API Secret Key**
4. Set redirect URL to: `https://your-ngrok-url/auth/callback` (you'll get this after starting ngrok)

### Claude API Key
1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Create an API key
3. Copy the key

## 2. Start Backend

```bash
cd backend
pip install -r requirements.txt
```

Create `.env`:
```env
SHOPIFY_API_KEY=your_key_here
SHOPIFY_API_SECRET=your_secret_here
APP_URL=https://your-ngrok-url
FRONTEND_URL=http://localhost:3000
CLAUDE_API_KEY=your_claude_key
```

Start ngrok in a separate terminal:
```bash
ngrok http 8000
```

Copy the ngrok URL (e.g., `https://abc123.ngrok.io`) and update `APP_URL` in `.env`

Start backend:
```bash
python main.py
```

## 3. Start Frontend

```bash
cd frontend
npm install
```

Create `.env.local`:
```env
NEXT_PUBLIC_APP_URL=http://localhost:8000
```

Start frontend:
```bash
npm run dev
```

## 4. Test It!

1. Open http://localhost:3000
2. Enter your test store: `your-store.myshopify.com`
3. Click "Connect Store"
4. Complete OAuth
5. Load products → Select → Generate → Apply!

## Troubleshooting

- **OAuth fails**: Make sure `APP_URL` in backend matches your ngrok URL exactly
- **CORS errors**: Check that `NEXT_PUBLIC_APP_URL` points to your backend
- **Claude API errors**: Verify your API key is correct and has credits
- **Shopify API errors**: Check that your app has the required scopes enabled



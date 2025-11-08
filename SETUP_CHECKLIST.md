# Setup Checklist

## Pre-requisites
- [ ] Python 3.8+ installed
- [ ] Node.js 18+ installed
- [ ] Shopify Partner account (free)
- [ ] Anthropic API key
- [ ] ngrok installed (for local dev)

## Backend Setup
- [ ] Navigate to `backend/` directory
- [ ] Run `pip install -r requirements.txt`
- [ ] Create `.env` file with:
  - [ ] `SHOPIFY_API_KEY` (from Shopify Partner Dashboard)
  - [ ] `SHOPIFY_API_SECRET` (from Shopify Partner Dashboard)
  - [ ] `APP_URL` (your ngrok URL, e.g., `https://abc123.ngrok.io`)
  - [ ] `FRONTEND_URL` (default: `http://localhost:3000`)
  - [ ] `CLAUDE_API_KEY` (from Anthropic Console)
- [ ] Start ngrok: `ngrok http 8000`
- [ ] Update Shopify app redirect URL to: `{APP_URL}/auth/callback`
- [ ] Run backend: `python main.py` (should start on port 8000)

## Frontend Setup
- [ ] Navigate to `frontend/` directory
- [ ] Run `npm install`
- [ ] Create `.env.local` with:
  - [ ] `NEXT_PUBLIC_APP_URL=http://localhost:8000` (or your backend URL)
- [ ] Run frontend: `npm run dev` (should start on port 3000)

## Testing
- [ ] Open http://localhost:3000
- [ ] Enter a test store domain (e.g., `your-test-store.myshopify.com`)
- [ ] Click "Connect Store" and complete OAuth
- [ ] Verify connection status shows "✓ Connected"
- [ ] Click "Load Products"
- [ ] Select a product
- [ ] Click "Generate Launch Assets"
- [ ] Review the generated content
- [ ] Click "Apply to Store"
- [ ] Verify in Shopify Admin that product was updated and discount code was created

## Demo Preparation
- [ ] Have a test Shopify store ready
- [ ] Have at least one product in the store
- [ ] Rehearse the demo flow (60-90 seconds)
- [ ] Prepare to show:
  1. OAuth connection
  2. Product selection
  3. AI generation preview
  4. Apply to store
  5. Shopify Admin showing updated product and discount


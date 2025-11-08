# AI Product Launch Kit - MVP

One-click product launch optimization for Shopify stores. Automatically generates optimized titles, descriptions, SEO metadata, discount codes, and launch copy using Claude AI.

## Quick Start

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

4. Fill in your credentials in `.env`:
- `SHOPIFY_API_KEY` - From your Shopify Partner Dashboard (create a new app)
- `SHOPIFY_API_SECRET` - From your Shopify Partner Dashboard
- `APP_URL` - Your public backend URL (use ngrok for local dev: `ngrok http 8000`)
- `FRONTEND_URL` - Your frontend URL (default: `http://localhost:3000`)
- `CLAUDE_API_KEY` - From Anthropic Console (https://console.anthropic.com/)

**Important**: For local development:
1. Start ngrok: `ngrok http 8000`
2. Copy the ngrok URL (e.g., `https://abc123.ngrok.io`)
3. Set `APP_URL=https://abc123.ngrok.io` in backend `.env`
4. In Shopify Partner Dashboard, set the app's redirect URL to: `https://abc123.ngrok.io/auth/callback`

5. Run the backend:
```bash
python main.py
# or
uvicorn main:app --reload --port 8000
```

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env.local` file:
```bash
NEXT_PUBLIC_APP_URL=http://localhost:8000
```

4. Run the frontend:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Usage

1. **Connect Store**: Enter your Shopify store domain (e.g., `your-store.myshopify.com`) and click "Connect Store"
2. **Load Products**: After OAuth completes, click "Load Products" to fetch your products
3. **Select Product**: Choose a product from the dropdown
4. **Generate**: Click "Generate Launch Assets" to create optimized content
5. **Review**: Preview the generated title, description, SEO tags, discount code, and banner copy
6. **Apply**: Click "Apply to Store" to update your Shopify product and create the discount code

## Features

- ✅ Shopify OAuth integration
- ✅ Product listing and selection
- ✅ AI-powered content generation (Claude 3.5 Sonnet)
- ✅ Product title, description, and tags optimization
- ✅ SEO meta title and description
- ✅ Automatic discount code creation
- ✅ Launch banner copy generation
- ✅ One-click apply to Shopify store

## Demo Script (60-90 seconds)

1. Type store domain → **Connect Store** (OAuth finishes)
2. **Load Products** → choose your sample product
3. Click **Generate Launch Assets** → show preview (title/desc/SEO/discount/banner)
4. Hit **Apply to Store** → confirm success toast
5. Open Shopify Admin → show updated product + Discounts → show the new code

## Tech Stack

- **Backend**: FastAPI, SQLite, Claude API, Shopify Admin API
- **Frontend**: Next.js 14, React, Tailwind CSS
- **Database**: SQLite (stores shop connections and run history)

## Notes

- For local development, use ngrok to expose your backend: `ngrok http 8000`
- Update `APP_URL` in backend `.env` to your ngrok URL
- The app requires Shopify app scopes: `write_products`, `write_discounts`, `write_content`, `read_products`

"# shopgenie-mvp" 

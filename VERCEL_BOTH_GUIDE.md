# Using Vercel for Both Frontend and Backend

## ⚠️ Important Considerations

Converting your FastAPI backend to Vercel serverless functions requires significant refactoring:

### Challenges:
1. **SQLite won't work** - Serverless functions are stateless, need external database (PostgreSQL, MongoDB, etc.)
2. **File structure changes** - Need to convert FastAPI routes to individual serverless functions
3. **Cold starts** - First request after inactivity may be slower
4. **Function size limits** - Each function has size/time limits
5. **State management** - Can't maintain in-memory state between requests

### Benefits:
- ✅ Single platform (Vercel)
- ✅ Automatic scaling
- ✅ Global edge network
- ✅ Free tier available

---

## 📁 Required Project Structure

```
frontend/
  api/                    # Vercel serverless functions
    auth/
      install.ts          # /auth/install
      callback.ts         # /auth/callback
    shops/
      me.ts              # /api/shops/me
      logout.ts          # /api/shops/logout
    products/
      index.ts           # /api/products
    generate.ts          # /api/generate
    apply.ts             # /api/apply
    generate-bundle.ts   # /api/generate-bundle
    create-bundle.ts    # /api/create-bundle
    agent-intent.ts     # /api/agent-intent
    # ... etc
  app/
  components/
  ...
```

---

## 🔄 Migration Steps

### Step 1: Set up Database
You'll need to replace SQLite with a serverless-compatible database:

**Option A: Vercel Postgres** (Recommended)
- Built into Vercel
- Free tier: 256MB storage
- Easy integration

**Option B: External Database**
- Supabase (free tier)
- PlanetScale (free tier)
- MongoDB Atlas (free tier)

### Step 2: Convert FastAPI Routes to Serverless Functions

Example conversion:

**Before (FastAPI):**
```python
@app.get("/api/products")
async def list_products(shop: str, limit: int = 10):
    # ... logic
    return r.json()
```

**After (Vercel Serverless - TypeScript):**
```typescript
// api/products.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../lib/db'; // Your database connection

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { shop, limit = 10 } = req.query;
  
  // Database query
  const row = await db.query('SELECT * FROM shops WHERE shop = ?', [shop]);
  if (!row) {
    return res.status(401).json({ error: 'Not connected' });
  }

  // Shopify API call
  const response = await fetch(
    `https://${shop}/admin/api/2024-01/products.json?limit=${limit}`,
    { headers: shopifyHeaders(row.access_token) }
  );

  const data = await response.json();
  return res.json(data);
}
```

### Step 3: Update Database Functions

Replace SQLite with your chosen database:

```typescript
// lib/db.ts
import { sql } from '@vercel/postgres'; // If using Vercel Postgres

export async function getShop(shop: string) {
  const result = await sql`
    SELECT * FROM shops WHERE shop = ${shop}
  `;
  return result.rows[0];
}

export async function saveShop(shop: string, accessToken: string) {
  await sql`
    INSERT INTO shops (shop, access_token)
    VALUES (${shop}, ${accessToken})
    ON CONFLICT (shop) DO UPDATE SET access_token = ${accessToken}
  `;
}
```

### Step 4: Convert Python Dependencies

You'll need to rewrite Python code in TypeScript/JavaScript:
- `httpx` → `fetch` or `axios`
- `hmac` → Node.js `crypto`
- `sqlite3` → Your chosen database client
- Claude API calls → Same (just use fetch)

---

## 📦 Package.json Updates

```json
{
  "dependencies": {
    "@vercel/node": "^3.0.0",
    "@vercel/postgres": "^0.5.0",  // If using Vercel Postgres
    // ... other deps
  }
}
```

---

## ⚡ Quick Start (If You Want to Try)

### 1. Set up Vercel Postgres
```bash
vercel postgres create shopgenie-db
```

### 2. Create Database Schema
```sql
CREATE TABLE shops (
  id SERIAL PRIMARY KEY,
  shop TEXT UNIQUE NOT NULL,
  access_token TEXT NOT NULL
);

CREATE TABLE runs (
  id SERIAL PRIMARY KEY,
  shop TEXT NOT NULL,
  product_id TEXT NOT NULL,
  cost_tokens INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3. Start Converting Routes
- Begin with simple routes (e.g., `/api/shops/me`)
- Test each one
- Gradually convert all 14 endpoints

---

## 🎯 Recommendation

**For MVP/Quick Launch**: Stick with **Vercel (frontend) + Railway (backend)**

**Why?**
- ✅ No code changes needed
- ✅ Deploy in 15 minutes
- ✅ SQLite works fine for MVP
- ✅ Can migrate to serverless later if needed

**When to Consider Vercel for Both:**
- You need global edge performance
- You're ready to migrate to PostgreSQL
- You want everything on one platform
- You have time for refactoring

---

## 📚 Resources

- [Vercel Serverless Functions](https://vercel.com/docs/functions)
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
- [Vercel TypeScript Example](https://github.com/vercel/examples/tree/main/python)

---

## 💡 Alternative: Keep FastAPI, Use Vercel Edge Functions

You could also:
1. Keep FastAPI backend on Railway/Render
2. Use Vercel Edge Functions for simple proxy/caching
3. Best of both worlds

---

**Bottom Line**: Using Vercel for both is possible but requires significant refactoring. For your MVP, I'd recommend Vercel (frontend) + Railway (backend) to get deployed quickly.



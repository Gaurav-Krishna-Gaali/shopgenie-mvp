import os, json, time, hmac, base64, hashlib, sqlite3
from urllib.parse import urlencode
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
import httpx

# Load environment variables from .env file
load_dotenv()

APP_URL = os.getenv("APP_URL")
FRONTEND_URL = os.getenv("FRONTEND_URL")
SHOPIFY_API_KEY = os.getenv("SHOPIFY_API_KEY")
SHOPIFY_API_SECRET = os.getenv("SHOPIFY_API_SECRET")
CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

def db():
    conn = sqlite3.connect("app.db")
    conn.row_factory = sqlite3.Row
    conn.execute("""CREATE TABLE IF NOT EXISTS shops(
      id INTEGER PRIMARY KEY, shop TEXT UNIQUE, access_token TEXT
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS runs(
      id INTEGER PRIMARY KEY, shop TEXT, product_id TEXT, cost_tokens INTEGER, created_at INTEGER
    )""")
    return conn

def hmac_valid(params: dict, hmac_val: str) -> bool:
    sorted_params = "&".join([f"{k}={v}" for k,v in sorted(params.items()) if k != "hmac"])
    digest = hmac.new(SHOPIFY_API_SECRET.encode(), sorted_params.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, hmac_val)

@app.get("/auth/install")
async def install(shop: str):
    # Request all scopes needed for product launch optimization
    # Note: Merchant must approve these scopes during OAuth installation
    # If you get "requires merchant approval" errors, re-install the app to get fresh approval
    # Required scopes: read_products (view products), write_products (edit products), 
    # read_content, write_content, write_discounts
    scopes = "read_products,write_products,read_content,write_content,write_discounts"
    redirect_uri = f"{APP_URL}/auth/callback"
    state = "nonce123"  # add a real nonce in production
    q = urlencode({
        "client_id": SHOPIFY_API_KEY, "scope": scopes,
        "redirect_uri": redirect_uri, "state": state
    })
    return {"install_url": f"https://{shop}/admin/oauth/authorize?{q}"}

@app.get("/auth/callback")
async def callback(shop: str, code: str, state: str, hmac: str, request: Request):
    params = dict(request.query_params)
    if not hmac_valid(params, hmac): raise HTTPException(400, "Invalid HMAC")
    async with httpx.AsyncClient() as client:
        r = await client.post(f"https://{shop}/admin/oauth/access_token.json", json={
            "client_id": SHOPIFY_API_KEY, "client_secret": SHOPIFY_API_SECRET, "code": code
        })
    if r.status_code != 200: raise HTTPException(400, "Token exchange failed")
    token = r.json()["access_token"]
    c = db()
    c.execute("INSERT OR REPLACE INTO shops(shop, access_token) VALUES(?,?)", (shop, token))
    c.commit()
    # Redirect back to frontend with success
    return RedirectResponse(url=f"{FRONTEND_URL}?shop={shop}&connected=true")

def shopify_headers(token: str):
    return {"X-Shopify-Access-Token": token, "Content-Type": "application/json", "Accept": "application/json"}

@app.get("/api/shops/me")
def me(shop: str):
    c = db()
    row = c.execute("SELECT * FROM shops WHERE shop = ?", (shop,)).fetchone()
    return {"connected": bool(row)}

@app.delete("/api/shops/logout")
def logout(shop: str):
    c = db()
    c.execute("DELETE FROM shops WHERE shop = ?", (shop,))
    c.commit()
    return {"ok": True, "message": "Logged out successfully"}

@app.get("/api/products")
async def list_products(shop: str, limit: int = 10):
    c = db()
    row = c.execute("SELECT * FROM shops WHERE shop = ?", (shop,)).fetchone()
    if not row: raise HTTPException(401, "Not connected")
    async with httpx.AsyncClient() as client:
        r = await client.get(f"https://{shop}/admin/api/2024-01/products.json?limit={limit}", headers=shopify_headers(row["access_token"]))
    if r.status_code != 200:
        error_msg = r.text
        print(f"Shopify API Error ({r.status_code}): {error_msg}")  # Log to console
        # Check for scope approval error
        if r.status_code == 403 and "merchant approval" in error_msg.lower():
            raise HTTPException(403, {
                "error": "scope_approval_required",
                "message": "The read_products scope requires merchant approval.",
                "instructions": [
                    f"1. Go to your Shopify Admin: https://{shop}/admin/settings/apps",
                    "2. Find this app and click 'Uninstall'",
                    "3. Come back here and click 'Logout' (if connected), then 'Connect Store' again",
                    "4. During OAuth, you'll see a permission screen - make sure to approve ALL permissions",
                    "5. Try loading products again"
                ]
            })
        raise HTTPException(400, f"Failed to fetch products (Status {r.status_code}): {error_msg}")
    return r.json()

CLAUDE_PROMPT = """You are an ecommerce launch assistant.

Given raw product JSON, produce a JSON object with these exact fields:

- title: Optimized product title
- description_html: Concise, persuasive HTML description with bullet points
- bullets: Array of exactly 5 key selling points
- tags: Comma-separated string of 5-10 relevant tags
- seo_title: SEO-optimized title (max 60 characters)
- seo_description: SEO meta description (max 155 characters)
- discount_code: A slug-like discount code (e.g., "LAUNCH20", "NEWPRODUCT15")
- discount_percent: Integer between 5 and 30
- banner_copy: Short announcement bar copy for the launch

Return ONLY valid JSON, no markdown code blocks, no explanations.

Product JSON:

```json
{product_json}
```"""

async def call_claude(product_json: dict):
    if not CLAUDE_API_KEY:
        raise ValueError("CLAUDE_API_KEY is not set in environment variables")
    
    prompt = CLAUDE_PROMPT.replace("{product_json}", json.dumps(product_json)[:8000])
    headers = {
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    payload = {
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 2000,
        "messages": [{"role": "user", "content": prompt}]
    }
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)
            r.raise_for_status()
            response_data = r.json()
    except httpx.HTTPStatusError as e:
        error_detail = f"Claude API error: {e.response.status_code}"
        if e.response.status_code == 401:
            error_detail = "Invalid Claude API key. Please check your CLAUDE_API_KEY in .env file."
        elif e.response.status_code == 404:
            error_detail = "Claude API endpoint not found (404). Please verify your API key and endpoint are correct."
        elif e.response.status_code == 429:
            error_detail = "Claude API rate limit exceeded. Please try again later."
        try:
            error_data = e.response.json()
            if "error" in error_data:
                error_detail = error_data["error"].get("message", error_detail)
        except:
            error_detail = f"{error_detail} - Response: {e.response.text[:200]}"
        raise HTTPException(500, f"AI generation failed: {error_detail}") from e
    except httpx.RequestError as e:
        raise HTTPException(500, f"Network error connecting to Claude API: {str(e)}") from e
    
    # Claude response format: content is an array of text blocks
    content_blocks = response_data.get("content", [])
    if not content_blocks or len(content_blocks) == 0:
        raise HTTPException(500, "Claude API returned empty response")
    
    text = content_blocks[0].get("text", "").strip()
    if not text:
        raise HTTPException(500, "Claude API returned empty text content")
    
    # be resilient if model returns code fences
    text = text.strip().strip("`")
    if text.startswith("json"): 
        text = text[4:].strip()
    
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise HTTPException(500, f"Claude returned invalid JSON: {str(e)}. Response: {text[:200]}")

@app.get("/api/test-claude")
async def test_claude():
    """Test endpoint to verify Claude API connection"""
    print("Test Claude endpoint called")  # Debug log
    if not CLAUDE_API_KEY:
        return {"success": False, "error": "CLAUDE_API_KEY is not set in environment variables"}
    
    # Simple test prompt
    test_prompt = "Say 'Hello, Claude API is working!' and nothing else."
    headers = {
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    payload = {
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 100,
        "messages": [{"role": "user", "content": test_prompt}]
    }
    
    print(f"Testing Claude API with endpoint: https://api.anthropic.com/v1/messages")
    print(f"Headers: {list(headers.keys())}")
    print(f"Model: {payload['model']}")
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)
            print(f"Claude API Response Status: {r.status_code}")
            if r.status_code != 200:
                print(f"Claude API Response: {r.text[:500]}")
            r.raise_for_status()
            response_data = r.json()
    except httpx.HTTPStatusError as e:
        error_detail = f"Claude API error: {e.response.status_code}"
        if e.response.status_code == 401:
            error_detail = "Invalid Claude API key. Please check your CLAUDE_API_KEY in .env file."
        elif e.response.status_code == 404:
            error_detail = "Claude API endpoint not found (404). Please verify your API key and endpoint are correct."
        elif e.response.status_code == 429:
            error_detail = "Claude API rate limit exceeded. Please try again later."
        try:
            error_data = e.response.json()
            if "error" in error_data:
                error_detail = error_data["error"].get("message", error_detail)
        except:
            error_detail = f"{error_detail} - Response: {e.response.text[:200]}"
        return {"success": False, "error": error_detail}
    except httpx.RequestError as e:
        return {"success": False, "error": f"Network error connecting to Claude API: {str(e)}"}
    
    # Parse response
    content_blocks = response_data.get("content", [])
    if not content_blocks or len(content_blocks) == 0:
        return {"success": False, "error": "Claude API returned empty response"}
    
    text = content_blocks[0].get("text", "").strip()
    return {
        "success": True,
        "message": text,
        "model": response_data.get("model", "unknown"),
        "usage": response_data.get("usage", {})
    }

@app.post("/api/generate")
async def generate(data: dict):
    shop = data["shop"]
    product_id = data["product_id"]
    c = db()
    row = c.execute("SELECT * FROM shops WHERE shop = ?", (shop,)).fetchone()
    if not row: raise HTTPException(401, "Not connected")
    async with httpx.AsyncClient() as client:
        p = await client.get(f"https://{shop}/admin/api/2024-01/products/{product_id}.json", headers=shopify_headers(row["access_token"]))
    if p.status_code != 200:
        error_msg = p.text
        print(f"Shopify API Error ({p.status_code}): {error_msg}")
        raise HTTPException(400, f"Failed to fetch product (Status {p.status_code}): {error_msg}")
    product = p.json()["product"]
    try:
        result = await call_claude(product)
    except Exception as e:
        raise HTTPException(500, f"AI generation failed: {str(e)}")
    return {"product": product, "suggestion": result}

@app.post("/api/apply")
async def apply_changes(data: dict):
    shop = data["shop"]
    product_id = data["product_id"]
    s = data["suggestion"]
    c = db()
    row = c.execute("SELECT * FROM shops WHERE shop = ?", (shop,)).fetchone()
    if not row: raise HTTPException(401, "Not connected")
    token = row["access_token"]
    
    # 1) Update product fields
    # Handle tags - convert array to comma-separated string if needed
    tags = s["tags"]
    if isinstance(tags, list):
        tags = ", ".join(tags)
    
    payload = {
        "product": {
            "id": product_id,
            "title": s["title"],
            "body_html": s["description_html"],
            "tags": tags
        }
    }
    async with httpx.AsyncClient() as client:
        up = await client.put(f"https://{shop}/admin/api/2024-01/products/{product_id}.json",
                              headers=shopify_headers(token), json=payload)
        if up.status_code not in (200, 201):
            error_msg = up.text
            print(f"Shopify API Error ({up.status_code}): {error_msg}")
            raise HTTPException(400, f"Product update failed (Status {up.status_code}): {error_msg}")
    
    # 2) Update SEO (metafields product.* or use SEO fields via GraphQL – for MVP, store as metafields)
    # Note: Metafields require owner_resource, owner_id, and type. For MVP, we'll skip this or use GraphQL
    # Skipping metafields for now to keep MVP simple - can be added later
    
    # 3) Create a discount code (price rule + code)
    price_rule = {
      "price_rule": {
        "title": f"Launch Discount: {s['discount_code']}",
        "target_type": "line_item", 
        "target_selection": "all",
        "allocation_method": "across",
        "value_type": "percentage",
        "value": f"-{int(s['discount_percent'])}",  # Negative for discount
        "customer_selection": "all",
        "starts_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
      }
    }
    async with httpx.AsyncClient() as client:
        pr = await client.post(f"https://{shop}/admin/api/2024-01/price_rules.json",
                               headers=shopify_headers(token), json=price_rule)
        if pr.status_code not in (200, 201):
            error_msg = pr.text
            print(f"Shopify API Error ({pr.status_code}): {error_msg}")
            raise HTTPException(400, f"Price rule creation failed (Status {pr.status_code}): {error_msg}")
        pr_id = pr.json()["price_rule"]["id"]
        dc = await client.post(f"https://{shop}/admin/api/2024-01/price_rules/{pr_id}/discount_codes.json",
                               headers=shopify_headers(token), json={"discount_code":{"code": s["discount_code"]}})
        if dc.status_code not in (200, 201):
            error_msg = dc.text
            print(f"Shopify API Error ({dc.status_code}): {error_msg}")
            raise HTTPException(400, f"Discount code creation failed (Status {dc.status_code}): {error_msg}")
    
    c.execute("INSERT INTO runs(shop, product_id, cost_tokens, created_at) VALUES(?,?,?,?)",
              (shop, str(product_id), 0, int(time.time())))
    c.commit()
    return {"ok": True}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


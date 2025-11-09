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

@app.post("/api/generate-bundle")
async def generate_bundle(data: dict):
    shop = data["shop"]
    product_a_id = data["product_a_id"]
    product_b_id = data["product_b_id"]

    c = db()
    row = c.execute("SELECT * FROM shops WHERE shop = ?", (shop,)).fetchone()
    if not row:
        raise HTTPException(401, "Not connected")
    token = row["access_token"]

    async with httpx.AsyncClient() as client:
        pa = await client.get(
            f"https://{shop}/admin/api/2024-10/products/{product_a_id}.json",
            headers=shopify_headers(token)
        )
        pb = await client.get(
            f"https://{shop}/admin/api/2024-10/products/{product_b_id}.json",
            headers=shopify_headers(token)
        )

    if pa.status_code != 200:
        error_msg = pa.text
        print(f"Shopify API Error ({pa.status_code}): {error_msg}")
        raise HTTPException(400, f"Failed to fetch product A (Status {pa.status_code}): {error_msg}")
    if pb.status_code != 200:
        error_msg = pb.text
        print(f"Shopify API Error ({pb.status_code}): {error_msg}")
        raise HTTPException(400, f"Failed to fetch product B (Status {pb.status_code}): {error_msg}")

    product_a = pa.json()["product"]
    product_b = pb.json()["product"]

    # Build prompt
    PROMPT = f"""
You are a Shopify ecommerce expert.

Here are two products in JSON:

Product A:
{json.dumps(product_a)[:6000]}

Product B:
{json.dumps(product_b)[:6000]}

Create a NEW Shopify bundle product.

Return ONLY valid JSON with no explanation:
{{
  "title": "...",
  "description_html": "...",
  "tags": "...",
  "bundle_price_percent_off": 10,
  "bundle_notes": "..."
}}
    """

    headers = {
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }

    payload = {
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 800,
        "messages": [{"role": "user", "content": PROMPT}]
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=payload
            )
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
    if text.startswith("```json"):
        text = text[7:].strip()
    if text.endswith("```"):
        text = text[:-3].strip()

    try:
        bundle_data = json.loads(text)
    except json.JSONDecodeError as e:
        raise HTTPException(500, f"Claude returned invalid JSON: {str(e)}. Response: {text[:200]}")
    return {
        "product_a": product_a,
        "product_b": product_b,
        "bundle": bundle_data
    }

@app.post("/api/agent-intent")
async def agent_intent(data: dict):
    """Understand user intent from natural language prompt"""
    user_prompt = data.get("prompt", "").lower()
    
    # Simple intent detection (can be enhanced with Claude if needed)
    intent = {
        "action": "unknown",
        "show_section": None,
        "message": "I'm here to help! What would you like to do?"
    }
    
    if any(word in user_prompt for word in ["bundle", "combine", "pair", "group products"]):
        intent = {
            "action": "bundle",
            "show_section": "bundle",
            "message": "Great! I'll help you create a bundle. Select two products below to get started."
        }
    elif any(word in user_prompt for word in ["description", "desc", "launch", "optimize", "generate", "assets", "title", "seo"]):
        intent = {
            "action": "optimize",
            "show_section": "optimize",
            "message": "Perfect! I'll help you optimize your product descriptions and launch assets. Select a product below to generate optimized content."
        }
    elif any(word in user_prompt for word in ["product", "list", "show", "view", "see"]):
        intent = {
            "action": "list",
            "show_section": "products",
            "message": "I'll load your products for you."
        }
    elif any(word in user_prompt for word in ["help", "what can", "how", "guide"]):
        intent = {
            "action": "help",
            "show_section": None,
            "message": "I can help you with:\n• Creating product bundles - just say 'I want to bundle something'\n• Optimizing product descriptions - say 'I want to change descriptions'\n• Generating launch assets - select a product and I'll create optimized content\n\nWhat would you like to do?"
        }
    
    return intent

@app.post("/api/create-bundle")
async def create_bundle(data: dict):
    shop = data["shop"]
    product_a = data["product_a"]
    product_b = data["product_b"]
    bundle = data["bundle"]

    c = db()
    row = c.execute("SELECT * FROM shops WHERE shop = ?", (shop,)).fetchone()
    if not row:
        raise HTTPException(401, "Not connected")
    token = row["access_token"]

    # Calculate bundle price
    price_a = float(product_a["variants"][0]["price"])
    price_b = float(product_b["variants"][0]["price"])
    discount = bundle["bundle_price_percent_off"] / 100
    bundle_price = round((price_a + price_b) * (1 - discount), 2)

    # Collect images from both products
    images = []
    # Add first image from Product A if available
    if product_a.get("images") and len(product_a["images"]) > 0:
        images.append({"src": product_a["images"][0]["src"]})
    # Add first image from Product B if available
    if product_b.get("images") and len(product_b["images"]) > 0:
        images.append({"src": product_b["images"][0]["src"]})

    # Create product payload without metafields (they'll be added separately)
    payload = {
        "product": {
            "title": bundle["title"],
            "body_html": bundle["description_html"],
            "tags": bundle["tags"],
            "product_type": "Bundle",
            "variants": [
                {
                    "title": "Bundle Default",
                    "price": str(bundle_price)
                }
            ],
            "images": images
        }
    }
    
    # Prepare metafield data for separate creation
    metafield_data = {
        "namespace": "bundle",
        "key": "components",
        "type": "json",
        "value": json.dumps({
            "product_a_id": product_a["id"],
            "product_b_id": product_b["id"],
            "notes": bundle["bundle_notes"]
        })
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(
                f"https://{shop}/admin/api/2024-10/products.json",
                headers=shopify_headers(token),
                json=payload
            )
            if r.status_code not in (200, 201):
                error_msg = r.text
                print(f"Shopify API Error ({r.status_code}): {error_msg}")
                raise HTTPException(400, f"Bundle creation failed (Status {r.status_code}): {error_msg}")
            
            created_product = r.json()
            
            # Create metafields separately after product creation
            if created_product.get("product"):
                product_id = created_product["product"]["id"]
                
                try:
                    metafield_payload = {
                        "metafield": {
                            "namespace": metafield_data["namespace"],
                            "key": metafield_data["key"],
                            "type": metafield_data["type"],
                            "value": metafield_data["value"],
                            "owner_resource": "product",
                            "owner_id": product_id
                        }
                    }
                    async with httpx.AsyncClient(timeout=60.0) as metafield_client:
                        mf_r = await metafield_client.post(
                            f"https://{shop}/admin/api/2024-10/metafields.json",
                            headers=shopify_headers(token),
                            json=metafield_payload
                        )
                        if mf_r.status_code not in (200, 201):
                            print(f"Warning: Metafield creation failed ({mf_r.status_code}): {mf_r.text}")
                            # Don't fail the whole request if metafield creation fails
                except Exception as e:
                    print(f"Warning: Could not create metafield: {str(e)}")
                    # Don't fail the whole request if metafield creation fails
            
            return {"created_product": created_product}
    except httpx.ReadTimeout:
        raise HTTPException(504, "Request to Shopify API timed out. The bundle may have been created. Please check your Shopify admin.")
    except httpx.RequestError as e:
        raise HTTPException(500, f"Network error connecting to Shopify API: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


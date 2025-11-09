import os, json, time, hmac, base64, hashlib, sqlite3
from urllib.parse import urlencode, quote
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

# CORS configuration - use FRONTEND_URL in production, allow all in development
cors_origins = [FRONTEND_URL] if FRONTEND_URL and FRONTEND_URL != "http://localhost:3000" and FRONTEND_URL != "http://127.0.0.1:3000" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
    scopes = "read_products,write_products,read_content,write_content,write_discounts,read_themes,write_themes"
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

@app.post("/api/generate-announcement")
async def generate_announcement(data: dict):
    """Generate an announcement bar snippet using Claude AI"""
    shop = data["shop"]
    prompt = data["prompt"]
    
    c = db()
    row = c.execute("SELECT * FROM shops WHERE shop = ?", (shop,)).fetchone()
    if not row:
        raise HTTPException(401, "Not connected")
    
    AI_PROMPT = f"""You are a Shopify Theme UI expert.

Generate an announcement bar snippet based on this request:

"{prompt}"

Return ONLY valid JSON (no markdown, no code fences, no explanations):

{{
  "filename": "ai-announcement-bar.liquid",
  "content": "<div style='background: #000; color: #fff; padding: 12px; text-align: center;'>Your message here</div>",
  "preview_html": "<!DOCTYPE html><html><head><meta charset='utf-8'></head><body><div style='background: #000; color: #fff; padding: 12px; text-align: center;'>Your message here</div></body></html>"
}}

CRITICAL RULES:
- Return ONLY the JSON object, nothing else
- Properly escape all quotes in HTML strings using backslashes
- Keep the content field concise but complete
- The preview_html should be a complete standalone HTML document
- Ensure all strings are properly closed
- Do not use markdown code blocks
"""
    
    headers = {
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    
    payload = {
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 2000,
        "messages": [{"role": "user", "content": AI_PROMPT}]
    }
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            res = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=payload
            )
            res.raise_for_status()
            response_data = res.json()
    except httpx.HTTPStatusError as e:
        error_detail = f"Claude API error: {e.response.status_code}"
        if e.response.status_code == 401:
            error_detail = "Invalid Claude API key. Please check your CLAUDE_API_KEY in .env file."
        try:
            error_data = e.response.json()
            if "error" in error_data:
                error_detail = error_data["error"].get("message", error_detail)
        except:
            error_detail = f"{error_detail} - Response: {e.response.text[:200]}"
        raise HTTPException(500, f"AI generation failed: {error_detail}") from e
    except httpx.RequestError as e:
        raise HTTPException(500, f"Network error connecting to Claude API: {str(e)}")
    
    content_blocks = response_data.get("content", [])
    if not content_blocks or len(content_blocks) == 0:
        raise HTTPException(500, "Claude API returned empty response")
    
    text = content_blocks[0].get("text", "").strip()
    if not text:
        raise HTTPException(500, "Claude API returned empty text content")
    
    # Check if response was truncated
    stop_reason = response_data.get("stop_reason", "")
    if stop_reason == "max_tokens":
        raise HTTPException(500, "Response was truncated. Please try a shorter prompt or simpler design.")
    
    # Clean up code fences and markdown
    text = text.strip()
    # Remove markdown code blocks
    if text.startswith("```"):
        # Find the first newline after ```
        first_newline = text.find("\n")
        if first_newline != -1:
            text = text[first_newline:].strip()
        if text.endswith("```"):
            text = text[:-3].strip()
    # Remove any leading "json" keyword
    if text.lower().startswith("json"):
        text = text[4:].strip()
    
    # Try to extract JSON if there's extra text
    # Look for the first { and last }
    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        text = text[first_brace:last_brace + 1]
    
    try:
        announcement = json.loads(text)
        # Validate required fields
        if "filename" not in announcement or "content" not in announcement or "preview_html" not in announcement:
            raise ValueError("Missing required fields: filename, content, or preview_html")
        return announcement
    except json.JSONDecodeError as e:
        # Try to provide more helpful error message
        error_pos = getattr(e, 'pos', None)
        if error_pos:
            context_start = max(0, error_pos - 100)
            context_end = min(len(text), error_pos + 100)
            context = text[context_start:context_end]
            raise HTTPException(500, f"Claude returned invalid JSON at position {error_pos}: {str(e)}. Context: ...{context}...")
        raise HTTPException(500, f"Claude returned invalid JSON: {str(e)}. Response preview: {text[:500]}")
    except ValueError as e:
        raise HTTPException(500, f"Invalid response format: {str(e)}")

@app.post("/api/publish-announcement")
async def publish_announcement(data: dict):
    """Publish the announcement bar snippet to Shopify"""
    shop = data["shop"]
    filename = data["filename"]
    content = data["content"]
    
    c = db()
    row = c.execute("SELECT * FROM shops WHERE shop = ?", (shop,)).fetchone()
    if not row:
        raise HTTPException(401, "Not connected")
    token = row["access_token"]
    
    # Find main theme - try older API versions that allow asset modifications
    # Try 2022-10 first (more permissive), fallback to 2023-01
    api_versions = ["2022-10", "2023-01"]
    themes_data = None
    working_version = None
    
    async with httpx.AsyncClient() as client:
        for api_version in api_versions:
            themes = await client.get(
                f"https://{shop}/admin/api/{api_version}/themes.json",
                headers=shopify_headers(token)
            )
            if themes.status_code == 200:
                themes_data = themes.json()
                working_version = api_version
                break
        if themes_data is None:
            raise HTTPException(400, f"Failed to fetch themes with any API version. Tried: {', '.join(api_versions)}")
    
    theme_id = next((t for t in themes_data["themes"] if t["role"] == "main"), None)
    if not theme_id:
        raise HTTPException(400, "Main theme not found")
    theme_id = theme_id["id"]
    
    payload = {
        "asset": {
            "key": f"snippets/{filename}",
            "value": content
        }
    }
    
    async with httpx.AsyncClient() as client:
        up = await client.put(
            f"https://{shop}/admin/api/{working_version}/themes/{theme_id}/assets.json",
            headers=shopify_headers(token),
            json=payload
        )
        if up.status_code not in (200, 201):
            error_msg = up.text
            raise HTTPException(400, f"Failed to publish snippet (Status {up.status_code}): {error_msg}")
    
    return {"ok": True, "theme_id": theme_id}

@app.post("/api/inject-announcement")
async def inject_announcement(data: dict):
    """Inject the announcement bar snippet into theme.liquid"""
    shop = data["shop"]
    filename = data["filename"]  # ai-announcement-bar.liquid
    
    c = db()
    row = c.execute("SELECT * FROM shops WHERE shop = ?", (shop,)).fetchone()
    if not row:
        raise HTTPException(401, "Not connected")
    token = row["access_token"]
    
    # Fetch theme list - try older API versions that allow asset modifications
    api_versions = ["2022-10", "2023-01"]
    themes_data = None
    working_version = None
    
    async with httpx.AsyncClient() as client:
        for api_version in api_versions:
            themes = await client.get(
                f"https://{shop}/admin/api/{api_version}/themes.json",
                headers=shopify_headers(token)
            )
            if themes.status_code == 200:
                themes_data = themes.json()
                working_version = api_version
                break
        
        if themes_data is None:
            raise HTTPException(400, f"Failed to fetch themes with any API version. Tried: {', '.join(api_versions)}")
    
    theme_id = next((t for t in themes_data["themes"] if t["role"] == "main"), None)
    if not theme_id:
        raise HTTPException(400, "Main theme not found")
    theme_id = theme_id["id"]
    
    # Fetch theme.liquid - try common layout file names
    layout_candidates = ["layout/theme.liquid", "layout/theme", "templates/theme.liquid", "templates/theme", "theme.liquid", "theme"]
    layout_key = None
    content = None
    
    async with httpx.AsyncClient() as client:
        # First, try direct lookup for each candidate
        for candidate in layout_candidates:
            query_params = urlencode({"asset[key]": candidate})
            tl = await client.get(
                f"https://{shop}/admin/api/{working_version}/themes/{theme_id}/assets.json?{query_params}",
                headers=shopify_headers(token)
            )
            if tl.status_code == 200:
                asset_data = tl.json()
                # Verify we got the asset with the right key
                if "asset" in asset_data:
                    asset_key = asset_data["asset"].get("key")
                    if asset_key == candidate or asset_key.endswith("/theme.liquid") or asset_key.endswith("/theme"):
                        content = asset_data["asset"]["value"]
                        layout_key = asset_key  # Use the exact key from response
                        break
        
        # If not found, try listing all assets to find the main layout
        if layout_key is None:
            all_assets = await client.get(
                f"https://{shop}/admin/api/{working_version}/themes/{theme_id}/assets.json",
                headers=shopify_headers(token)
            )
            if all_assets.status_code == 200:
                assets_data = all_assets.json()
                # Look for theme.liquid in layout or templates folder
                for asset in assets_data.get("assets", []):
                    key = asset.get("key", "")
                    if key in ["layout/theme.liquid", "layout/theme", "templates/theme.liquid", "templates/theme"]:
                        # Fetch the full content
                        query_params = urlencode({"asset[key]": key})
                        asset_resp = await client.get(
                            f"https://{shop}/admin/api/{working_version}/themes/{theme_id}/assets.json?{query_params}",
                            headers=shopify_headers(token)
                        )
                        if asset_resp.status_code == 200:
                            asset_data = asset_resp.json()
                            content = asset_data["asset"]["value"]
                            layout_key = key
                            break
        
        if layout_key is None or content is None:
            raise HTTPException(404, f"Could not find theme layout file. Please ensure your theme has a layout/theme.liquid file.")
    
    # Remove .liquid extension for render tag
    snippet_name = filename.replace(".liquid", "")
    render_snippet = f"{{% render '{snippet_name}' %}}"
    
    if render_snippet in content:
        return {"ok": True, "message": "Already injected"}
    
    # Inject after <body> tag
    if "<body" in content:
        before, rest = content.split("<body", 1)
        pos = rest.find(">") + 1
        new_content = (
            before + "<body" + rest[:pos] + "\n  " + render_snippet + "\n" + rest[pos:]
        )
    else:
        new_content = render_snippet + "\n" + content
    
    payload = {
        "asset": {
            "key": layout_key,
            "value": new_content
        }
    }
    
    # Debug: log what we're trying to update
    print(f"Attempting to update theme asset: theme_id={theme_id}, key={layout_key}")
    
    async with httpx.AsyncClient() as client:
        up = await client.put(
            f"https://{shop}/admin/api/{working_version}/themes/{theme_id}/assets.json",
            headers=shopify_headers(token),
            json=payload
        )
        if up.status_code not in (200, 201):
            error_msg = up.text
            print(f"PUT request failed: Status {up.status_code}, Response: {error_msg}")
            print(f"Payload key: {layout_key}, Theme ID: {theme_id}, API Version: {working_version}")
            
            # Provide helpful error message
            if up.status_code == 404:
                detailed_error = f"""Theme asset modification failed (404). 

This may be due to Shopify's restrictions on modifying theme assets via API.

SOLUTIONS:
1. The snippet has been created successfully. You can manually add this line to your theme.liquid file:
   {render_snippet}
   Add it right after the <body> tag.

2. Or request a theme modification exemption from Shopify (takes ~15 days).

3. Try using a development theme instead of the published theme.

Snippet location: snippets/{filename}
Layout file: {layout_key}"""
                raise HTTPException(400, detailed_error)
            else:
                raise HTTPException(400, f"Failed to inject into theme (Status {up.status_code}): {error_msg}")
    
    return {"ok": True}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


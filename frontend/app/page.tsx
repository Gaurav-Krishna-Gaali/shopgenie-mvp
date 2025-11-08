"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [shop, setShop] = useState("");
  const [connected, setConnected] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [suggestion, setSuggestion] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [testingClaude, setTestingClaude] = useState(false);
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:8000";

  // Check for OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shopParam = params.get("shop");
    const connectedParam = params.get("connected");
    if (shopParam && connectedParam === "true") {
      setShop(shopParam);
      setConnected(true);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const connect = async () => {
    const r = await fetch(`${base}/auth/install?shop=${shop}`);
    const j = await r.json();
    window.location.href = j.install_url;
  };

  const check = async () => {
    if (!shop) return;
    try {
      const r = await fetch(`${base}/api/shops/me?shop=${shop}`);
      const j = await r.json();
      setConnected(j.connected);
    } catch (e) {
      setConnected(false);
    }
  };

  const logout = async () => {
    if (!shop) return;
    try {
      await fetch(`${base}/api/shops/logout?shop=${shop}`, { method: "DELETE" });
      setConnected(false);
      setProducts([]);
      setSelected("");
      setSuggestion(null);
      setShop("");
    } catch (e) {
      alert("Failed to logout");
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${base}/api/products?shop=${shop}&limit=10`);
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({ detail: r.statusText }));
        // FastAPI wraps error details in "detail" field
        const detail = errorData.detail || errorData;
        if (r.status === 403 && detail.error === "scope_approval_required") {
          const instructions = detail.instructions || [];
          alert(`⚠️ Scope Approval Required\n\n${detail.message}\n\n${instructions.join("\n")}`);
        } else {
          alert(`Failed to load products: ${typeof detail === "string" ? detail : detail.message || detail.detail || r.statusText}`);
        }
        return;
      }
      const j = await r.json();
      setProducts(j.products || []);
    } catch (e: any) {
      alert("Failed to load products: " + (e.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const generate = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${base}/api/generate`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ shop, product_id: selected })
      });
      if (!r.ok) throw new Error("Generation failed");
      const j = await r.json();
      setSuggestion(j.suggestion);
    } catch (e: any) {
      alert("Failed to generate: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    setApplying(true);
    try {
      const r = await fetch(`${base}/api/apply`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ shop, product_id: selected, suggestion })
      });
      if (!r.ok) throw new Error("Apply failed");
      alert("Applied successfully! Check your Shopify store.");
    } catch (e: any) {
      alert("Failed to apply: " + e.message);
    } finally {
      setApplying(false);
    }
  };

  const testClaude = async () => {
    setTestingClaude(true);
    try {
      const r = await fetch(`${base}/api/test-claude`);
      const j = await r.json();
      if (!r.ok) {
        // Handle FastAPI error format
        const errorMsg = j.detail || j.error || `HTTP ${r.status}: ${r.statusText}`;
        alert(`❌ Claude API Test Failed:\n\n${errorMsg}\n\nMake sure your backend server is running and has been restarted after adding the test endpoint.`);
        return;
      }
      if (j.success) {
        alert(`✅ Claude API Test Successful!\n\nResponse: ${j.message}\nModel: ${j.model}\nTokens used: ${j.usage?.output_tokens || 'N/A'}`);
      } else {
        alert(`❌ Claude API Test Failed:\n\n${j.error}`);
      }
    } catch (e: any) {
      alert("Failed to test Claude API: " + (e.message || "Unknown error"));
    } finally {
      setTestingClaude(false);
    }
  };

  useEffect(() => { check(); }, [shop]);

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="border-b pb-4">
        <h1 className="text-3xl font-bold">AI Product Launch Kit</h1>
        <p className="text-gray-600 mt-2">One-click product launch optimization for Shopify</p>
        <button 
          className="mt-3 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 disabled:opacity-50 text-sm"
          onClick={testClaude}
          disabled={testingClaude}
        >
          {testingClaude ? "Testing..." : "Test Claude API"}
        </button>
      </div>

      <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
        <div className="space-y-2">
          <label className="block text-sm font-medium">Shopify Store Domain</label>
          <input 
            className="border p-2 w-full rounded" 
            placeholder="your-store.myshopify.com"
            value={shop} 
            onChange={(e)=>setShop(e.target.value)}
          />
        </div>
        {!connected ? (
          <button 
            className="bg-black text-white px-6 py-2 rounded hover:bg-gray-800 disabled:opacity-50" 
            onClick={connect}
            disabled={!shop}
          >
            Connect Store
          </button>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-green-600 font-medium">✓ Connected</span>
            <button 
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50" 
              onClick={loadProducts}
              disabled={loading}
            >
              {loading ? "Loading..." : "Load Products"}
            </button>
            <button 
              className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700" 
              onClick={logout}
            >
              Logout
            </button>
          </div>
        )}
      </div>

      {products.length > 0 && (
        <div className="space-y-4 bg-white border rounded-lg p-4">
          <h2 className="text-xl font-semibold">Select Product</h2>
          <select 
            className="border p-2 w-full rounded" 
            value={selected} 
            onChange={e=>setSelected(e.target.value)}
          >
            <option value="">Select a product</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
          <button 
            disabled={!selected || loading} 
            className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700 disabled:opacity-50 w-full"
            onClick={generate}
          >
            {loading ? "Generating..." : "Generate Launch Assets"}
          </button>
        </div>
      )}

      {suggestion && (
        <div className="border rounded-lg p-6 space-y-4 bg-white">
          <h2 className="text-2xl font-semibold">Preview</h2>
          
          <div className="space-y-3">
            <div>
              <b className="text-sm text-gray-600">Title:</b>
              <div className="text-lg font-medium mt-1">{suggestion.title}</div>
            </div>
            
            <div>
              <b className="text-sm text-gray-600">Description:</b>
              <div className="mt-1 prose prose-sm max-w-none" dangerouslySetInnerHTML={{__html: suggestion.description_html}} />
            </div>
            
            {suggestion.bullets && (
              <div>
                <b className="text-sm text-gray-600">Key Points:</b>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  {suggestion.bullets.map((b: string, i: number) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div>
              <b className="text-sm text-gray-600">Tags:</b>
              <div className="mt-1">{suggestion.tags}</div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-2 border-t">
              <div>
                <b className="text-sm text-gray-600">SEO Title:</b>
                <div className="mt-1 text-sm">{suggestion.seo_title}</div>
              </div>
              <div>
                <b className="text-sm text-gray-600">SEO Description:</b>
                <div className="mt-1 text-sm">{suggestion.seo_description}</div>
              </div>
            </div>
            
            <div className="bg-purple-50 p-3 rounded">
              <b className="text-sm text-gray-600">Discount Code:</b>
              <div className="mt-1 font-mono font-semibold">{suggestion.discount_code} ({suggestion.discount_percent}% off)</div>
            </div>
            
            <div className="bg-yellow-50 p-3 rounded">
              <b className="text-sm text-gray-600">Banner Copy:</b>
              <div className="mt-1">{suggestion.banner_copy}</div>
            </div>
          </div>
          
          <button 
            className="bg-green-600 text-white px-6 py-3 rounded hover:bg-green-700 disabled:opacity-50 w-full font-semibold"
            onClick={apply}
            disabled={applying}
          >
            {applying ? "Applying..." : "Apply to Store"}
          </button>
        </div>
      )}
    </main>
  );
}


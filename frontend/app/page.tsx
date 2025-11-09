"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function Home() {
  const [shop, setShop] = useState("");
  const [connected, setConnected] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [suggestion, setSuggestion] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [testingClaude, setTestingClaude] = useState(false);
  const [pA, setPA] = useState("");
  const [pB, setPB] = useState("");
  const [bundle, setBundle] = useState<any | null>(null);
  const [prodA, setProdA] = useState<any | null>(null);
  const [prodB, setProdB] = useState<any | null>(null);
  const [generatingBundle, setGeneratingBundle] = useState(false);
  const [creatingBundle, setCreatingBundle] = useState(false);
  const [agentPrompt, setAgentPrompt] = useState("");
  const [agentMessage, setAgentMessage] = useState("Hi! I'm your AI assistant. Tell me what you'd like to do - for example, 'I want to bundle something' or 'I want to change descriptions of my products'.");
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<Array<{role: "user" | "assistant", content: string}>>([]);
  const [processingIntent, setProcessingIntent] = useState(false);
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

  const generateBundle = async () => {
    setGeneratingBundle(true);
    try {
      const r = await fetch(`${base}/api/generate-bundle`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ shop, product_a_id: pA, product_b_id: pB })
      });
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({ detail: r.statusText }));
        const errorMsg = errorData.detail || errorData.message || r.statusText;
        alert(`Failed to generate bundle: ${errorMsg}`);
        return;
      }
      const j = await r.json();
      setProdA(j.product_a);
      setProdB(j.product_b);
      setBundle(j.bundle);
    } catch (e: any) {
      alert("Failed to generate bundle: " + (e.message || "Unknown error"));
    } finally {
      setGeneratingBundle(false);
    }
  };

  const createBundle = async () => {
    setCreatingBundle(true);
    try {
      const r = await fetch(`${base}/api/create-bundle`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          shop,
          product_a: prodA,
          product_b: prodB,
          bundle
        })
      });
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({ detail: r.statusText }));
        const errorMsg = errorData.detail || errorData.message || r.statusText;
        alert(`Failed to create bundle: ${errorMsg}`);
        return;
      }
      alert("Bundle Created!");
      // Reset bundle state
      setBundle(null);
      setProdA(null);
      setProdB(null);
      setPA("");
      setPB("");
    } catch (e: any) {
      alert("Failed to create bundle: " + (e.message || "Unknown error"));
    } finally {
      setCreatingBundle(false);
    }
  };

  const handleAgentPrompt = async () => {
    if (!agentPrompt.trim() || processingIntent) return;
    
    const userMessage = agentPrompt.trim();
    setChatHistory(prev => [...prev, { role: "user", content: userMessage }]);
    setAgentPrompt("");
    setProcessingIntent(true);
    
    try {
      const r = await fetch(`${base}/api/agent-intent`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ prompt: userMessage })
      });
      
      if (!r.ok) throw new Error("Failed to process intent");
      
      const intent = await r.json();
      setAgentMessage(intent.message);
      setChatHistory(prev => [...prev, { role: "assistant", content: intent.message }]);
      
      // Show the relevant section
      if (intent.show_section === "bundle") {
        setActiveSection("bundle");
        if (products.length === 0 && connected) {
          await loadProducts();
        }
      } else if (intent.show_section === "optimize") {
        setActiveSection("optimize");
        if (products.length === 0 && connected) {
          await loadProducts();
        }
      } else if (intent.show_section === "products") {
        setActiveSection("products");
        if (products.length === 0 && connected) {
          await loadProducts();
        }
      } else {
        setActiveSection(null);
      }
    } catch (e: any) {
      setAgentMessage("Sorry, I encountered an error. Please try again.");
      setChatHistory(prev => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setProcessingIntent(false);
    }
  };

  useEffect(() => { check(); }, [shop]);

  return (
    <main className="min-h-screen bg-background p-6 max-w-6xl mx-auto space-y-6">
      <div className="border-b border-border pb-6">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-purple-400 to-blue-400 bg-clip-text text-transparent">
          AI Product Launch Agent
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">Your intelligent assistant for Shopify product optimization</p>
      </div>

      {/* Agent Chat Interface */}
      {connected && (
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary via-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                AI
              </div>
              <div className="flex-1">
                <CardTitle className="text-xl mb-2">AI Assistant</CardTitle>
                <CardDescription className="text-base whitespace-pre-line text-foreground/90">
                  {agentMessage}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="text"
                value={agentPrompt}
                onChange={(e) => setAgentPrompt(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleAgentPrompt()}
                placeholder="Tell me what you'd like to do... (e.g., 'I want to bundle something')"
                disabled={processingIntent}
                className="flex-1"
              />
              <Button
                onClick={handleAgentPrompt}
                disabled={!agentPrompt.trim() || processingIntent}
                className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg"
              >
                {processingIntent ? "..." : "Send"}
              </Button>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAgentPrompt("I want to bundle something");
                  handleAgentPrompt();
                }}
                className="text-xs"
              >
                Create Bundle
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAgentPrompt("I want to change descriptions of my products");
                  handleAgentPrompt();
                }}
                className="text-xs"
              >
                Optimize Descriptions
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAgentPrompt("Show me my products");
                  handleAgentPrompt();
                }}
                className="text-xs"
              >
                View Products
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Store Connection</CardTitle>
          <CardDescription>Connect your Shopify store to get started</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">Shopify Store Domain</label>
            <Input 
              placeholder="your-store.myshopify.com"
              value={shop} 
              onChange={(e)=>setShop(e.target.value)}
            />
          </div>
          {!connected ? (
            <Button 
              onClick={connect}
              disabled={!shop}
              className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
            >
              Connect Store
            </Button>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-green-400 font-medium flex items-center gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                Connected
              </span>
              <Button 
                variant="secondary"
                onClick={loadProducts}
                disabled={loading}
              >
                {loading ? "Loading..." : "Load Products"}
              </Button>
              <Button 
                variant="destructive"
                onClick={logout}
              >
                Logout
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Optimization Section */}
      {products.length > 0 && activeSection !== "bundle" && (
        <Card>
          <CardHeader>
            <CardTitle>Product Optimization</CardTitle>
            <CardDescription>Select a product to generate optimized launch assets</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <select 
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" 
              value={selected} 
              onChange={e=>setSelected(e.target.value)}
            >
              <option value="">Select a product</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
            <Button 
              disabled={!selected || loading} 
              className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
              onClick={generate}
            >
              {loading ? "Generating..." : "Generate Launch Assets"}
            </Button>
          </CardContent>
        </Card>
      )}

      {suggestion && (
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="text-2xl">Preview</CardTitle>
            <CardDescription>Review the generated content before applying</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div>
                <b className="text-sm text-muted-foreground">Title:</b>
                <div className="text-lg font-medium mt-1 text-foreground">{suggestion.title}</div>
              </div>
              
              <div>
                <b className="text-sm text-muted-foreground">Description:</b>
                <div className="mt-1 prose prose-sm max-w-none prose-invert" dangerouslySetInnerHTML={{__html: suggestion.description_html}} />
              </div>
              
              {suggestion.bullets && (
                <div>
                  <b className="text-sm text-muted-foreground">Key Points:</b>
                  <ul className="list-disc list-inside mt-1 space-y-1 text-foreground">
                    {suggestion.bullets.map((b: string, i: number) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div>
                <b className="text-sm text-muted-foreground">Tags:</b>
                <div className="mt-1 text-foreground">{suggestion.tags}</div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                <div>
                  <b className="text-sm text-muted-foreground">SEO Title:</b>
                  <div className="mt-1 text-sm text-foreground">{suggestion.seo_title}</div>
                </div>
                <div>
                  <b className="text-sm text-muted-foreground">SEO Description:</b>
                  <div className="mt-1 text-sm text-foreground">{suggestion.seo_description}</div>
                </div>
              </div>
              
              <div className="bg-primary/10 border border-primary/20 p-3 rounded-md">
                <b className="text-sm text-muted-foreground">Discount Code:</b>
                <div className="mt-1 font-mono font-semibold text-primary">{suggestion.discount_code} ({suggestion.discount_percent}% off)</div>
              </div>
              
              <div className="bg-accent/50 border border-accent p-3 rounded-md">
                <b className="text-sm text-muted-foreground">Banner Copy:</b>
                <div className="mt-1 text-foreground">{suggestion.banner_copy}</div>
              </div>
            </div>
            
            <Button 
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              onClick={apply}
              disabled={applying}
            >
              {applying ? "Applying..." : "Apply to Store"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Bundle Section */}
      {products.length > 0 && activeSection !== "optimize" && (
        <Card>
          <CardHeader>
            <CardTitle>AI Product Bundler</CardTitle>
            <CardDescription>Select two products to create an intelligent bundle</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Selected Products Preview - Side by Side */}
            {(pA || pB) && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs font-semibold text-blue-400 mb-2">Product A</p>
                  <div 
                    className={`border-2 rounded-lg p-3 cursor-pointer transition-all ${
                      pA ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/20' : 'border-border bg-muted/50'
                    }`}
                    onClick={() => {
                      if (pA) setPA("");
                    }}
                  >
                    {pA ? (
                      <>
                        {(() => {
                          const product = products.find(p => p.id.toString() === pA);
                          const imageUrl = product?.images?.[0]?.src || '/placeholder.png';
                          return (
                            <>
                              <img 
                                src={imageUrl} 
                                alt={product?.title || 'Product A'} 
                                className="w-full h-32 object-cover rounded mb-2"
                              />
                              <p className="text-sm font-medium text-center text-foreground">{product?.title}</p>
                              <p className="text-xs text-muted-foreground text-center mt-1">Click to remove</p>
                            </>
                          );
                        })()}
                      </>
                    ) : (
                      <div className="h-32 flex items-center justify-center text-muted-foreground">
                        <p className="text-sm text-center">Click a product below</p>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <p className="text-xs font-semibold text-green-400 mb-2">Product B</p>
                  <div 
                    className={`border-2 rounded-lg p-3 cursor-pointer transition-all ${
                      pB ? 'border-green-500 bg-green-500/10 ring-2 ring-green-500/20' : 'border-border bg-muted/50'
                    }`}
                    onClick={() => {
                      if (pB) setPB("");
                    }}
                  >
                    {pB ? (
                      <>
                        {(() => {
                          const product = products.find(p => p.id.toString() === pB);
                          const imageUrl = product?.images?.[0]?.src || '/placeholder.png';
                          return (
                            <>
                              <img 
                                src={imageUrl} 
                                alt={product?.title || 'Product B'} 
                                className="w-full h-32 object-cover rounded mb-2"
                              />
                              <p className="text-sm font-medium text-center text-foreground">{product?.title}</p>
                              <p className="text-xs text-muted-foreground text-center mt-1">Click to remove</p>
                            </>
                          );
                        })()}
                      </>
                    ) : (
                      <div className="h-32 flex items-center justify-center text-muted-foreground">
                        <p className="text-sm text-center">Click a product below</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Product Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
              {products.map(p => {
                const isSelectedA = pA === p.id.toString();
                const isSelectedB = pB === p.id.toString();
                const imageUrl = p.images?.[0]?.src || '/placeholder.png';
                
                return (
                  <div
                    key={p.id}
                    className={`border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
                      isSelectedA 
                        ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/30' 
                        : isSelectedB
                        ? 'border-green-500 bg-green-500/10 ring-2 ring-green-500/30'
                        : 'border-border bg-card hover:border-primary/50 hover:shadow-lg'
                    }`}
                    onClick={() => {
                      if (isSelectedA) {
                        setPA("");
                      } else if (isSelectedB) {
                        setPB("");
                      } else if (!pA) {
                        setPA(p.id.toString());
                      } else if (!pB) {
                        setPB(p.id.toString());
                      }
                    }}
                  >
                    <img 
                      src={imageUrl} 
                      alt={p.title} 
                      className="w-full h-24 object-cover"
                    />
                    <div className="p-2">
                      <p className="text-xs font-medium text-center line-clamp-2 text-foreground">{p.title}</p>
                      {isSelectedA && (
                        <p className="text-xs text-blue-400 font-semibold text-center mt-1">Product A</p>
                      )}
                      {isSelectedB && (
                        <p className="text-xs text-green-400 font-semibold text-center mt-1">Product B</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <Button
              onClick={generateBundle}
              className="w-full bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90"
              disabled={!pA || !pB || generatingBundle}
            >
              {generatingBundle ? "Generating..." : "Generate Bundle"}
            </Button>
          </CardContent>
        </Card>
      )}

      {bundle && prodA && prodB && (
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="text-2xl">{bundle.title}</CardTitle>
            <CardDescription>Review your bundle before creating it in your store</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Product Images Side by Side */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-border rounded-lg overflow-hidden bg-card">
                <img 
                  src={prodA.images?.[0]?.src || '/placeholder.png'} 
                  alt={prodA.title} 
                  className="w-full h-48 object-cover"
                />
                <div className="p-3 bg-muted/50">
                  <p className="text-sm font-medium text-foreground">{prodA.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">${prodA.variants?.[0]?.price || '0.00'}</p>
                </div>
              </div>
              <div className="border border-border rounded-lg overflow-hidden bg-card">
                <img 
                  src={prodB.images?.[0]?.src || '/placeholder.png'} 
                  alt={prodB.title} 
                  className="w-full h-48 object-cover"
                />
                <div className="p-3 bg-muted/50">
                  <p className="text-sm font-medium text-foreground">{prodB.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">${prodB.variants?.[0]?.price || '0.00'}</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-3 pt-4 border-t border-border">
              <div className="prose prose-sm max-w-none prose-invert" dangerouslySetInnerHTML={{__html: bundle.description_html}} />
              <p className="text-foreground"><b className="text-muted-foreground">Tags:</b> {bundle.tags}</p>
              <p className="text-foreground"><b className="text-muted-foreground">Discount:</b> {bundle.bundle_price_percent_off}% off</p>
              <p className="text-foreground"><b className="text-muted-foreground">Notes:</b> {bundle.bundle_notes}</p>
            </div>

            <Button
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              onClick={createBundle}
              disabled={creatingBundle}
            >
              {creatingBundle ? "Creating..." : "Create Bundle in Store"}
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  );
}


"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";

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
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<Array<{
    role: "user" | "assistant";
    content: string;
    type?: "text" | "product_selection" | "bundle_preview";
    products?: any[];
    selectedProducts?: string[];
    bundleData?: any;
  }>>([
    {
      role: "assistant",
      content: "Hi! I'm your AI assistant. What would you like to do today?",
      type: "text"
    }
  ]);
  const [processingIntent, setProcessingIntent] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [currentStep, setCurrentStep] = useState<"initial" | "bundle_select_a" | "bundle_select_b" | "optimize_select" | "complete">("initial");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:8000";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isTyping]);

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

  const simulateTyping = (callback: () => void, delay: number = 1000) => {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      callback();
    }, delay);
  };

  const handleAgentPrompt = async () => {
    if (!agentPrompt.trim() || processingIntent) return;
    
    const userMessage = agentPrompt.trim();
    setChatHistory(prev => [...prev, { role: "user", content: userMessage, type: "text" }]);
    setAgentPrompt("");
    setProcessingIntent(true);
    
    // Simulate thinking
    setIsTyping(true);
    
    try {
      const r = await fetch(`${base}/api/agent-intent`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ prompt: userMessage })
      });
      
      if (!r.ok) throw new Error("Failed to process intent");
      
      const intent = await r.json();
      
      // Simulate typing delay
      await new Promise(resolve => setTimeout(resolve, 800));
      setIsTyping(false);
      
      // Load products if needed
      let currentProducts = products;
      if (products.length === 0 && connected && (intent.show_section === "bundle" || intent.show_section === "optimize")) {
        await loadProducts();
        // Wait a bit for state to update
        await new Promise(resolve => setTimeout(resolve, 100));
        // Get fresh products from state
        const r = await fetch(`${base}/api/products?shop=${shop}&limit=50`);
        if (r.ok) {
          const j = await r.json();
          currentProducts = j.products || [];
        }
      }
      
      // Handle different intents with chain questions
      if (intent.show_section === "bundle") {
        setCurrentStep("bundle_select_a");
        setActiveSection("bundle");
        simulateTyping(() => {
          setChatHistory(prev => [...prev, {
            role: "assistant",
            content: "Great! I'll help you create a bundle. First, select Product A:",
            type: "product_selection",
            products: currentProducts,
            selectedProducts: []
          }]);
        }, 1200);
      } else if (intent.show_section === "optimize") {
        setCurrentStep("optimize_select");
        setActiveSection("optimize");
        simulateTyping(() => {
          setChatHistory(prev => [...prev, {
            role: "assistant",
            content: "Perfect! Which product would you like to optimize?",
            type: "product_selection",
            products: currentProducts,
            selectedProducts: []
          }]);
        }, 1200);
      } else {
        simulateTyping(() => {
          setChatHistory(prev => [...prev, {
            role: "assistant",
            content: intent.message,
            type: "text"
          }]);
        }, 800);
      }
    } catch (e: any) {
      setIsTyping(false);
      setChatHistory(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        type: "text"
      }]);
    } finally {
      setProcessingIntent(false);
    }
  };

  const handleProductClick = async (productId: string, product: any) => {
    if (currentStep === "bundle_select_a") {
      setPA(productId);
      setChatHistory(prev => [...prev, {
        role: "user",
        content: product.title,
        type: "text"
      }]);
      
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setCurrentStep("bundle_select_b");
        setChatHistory(prev => [...prev, {
          role: "assistant",
          content: `Great choice! Now select Product B to bundle with "${product.title}":`,
          type: "product_selection",
          products: products.filter(p => p.id.toString() !== productId),
          selectedProducts: [productId]
        }]);
      }, 1000);
    } else if (currentStep === "bundle_select_b") {
      setPB(productId);
      setChatHistory(prev => [...prev, {
        role: "user",
        content: product.title,
        type: "text"
      }]);
      
      setIsTyping(true);
      setTimeout(async () => {
        setIsTyping(false);
        setCurrentStep("complete");
        // Generate bundle
        setGeneratingBundle(true);
        try {
          const r = await fetch(`${base}/api/generate-bundle`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ shop, product_a_id: pA, product_b_id: productId })
          });
          if (r.ok) {
            const j = await r.json();
            setProdA(j.product_a);
            setProdB(j.product_b);
            setBundle(j.bundle);
            
            setChatHistory(prev => [...prev, {
              role: "assistant",
              content: "Perfect! I've generated your bundle. Here's what I created:",
              type: "bundle_preview",
              bundleData: {
                bundle: j.bundle,
                product_a: j.product_a,
                product_b: j.product_b
              }
            }]);
          }
        } catch (e) {
          setChatHistory(prev => [...prev, {
            role: "assistant",
            content: "Sorry, I couldn't generate the bundle. Please try again.",
            type: "text"
          }]);
        } finally {
          setGeneratingBundle(false);
        }
      }, 1500);
    } else if (currentStep === "optimize_select") {
      setSelected(productId);
      setChatHistory(prev => [...prev, {
        role: "user",
        content: product.title,
        type: "text"
      }]);
      
      setIsTyping(true);
      setTimeout(async () => {
        setIsTyping(false);
        setCurrentStep("complete");
        setLoading(true);
        try {
          const r = await fetch(`${base}/api/generate`, {
            method: "POST",
            headers: {"Content-Type":"application/json"},
            body: JSON.stringify({ shop, product_id: productId })
          });
          if (r.ok) {
            const j = await r.json();
            setSuggestion(j.suggestion);
            setChatHistory(prev => [...prev, {
              role: "assistant",
              content: "I've generated optimized launch assets for your product! Check the preview below.",
              type: "text"
            }]);
          }
        } catch (e) {
          setChatHistory(prev => [...prev, {
            role: "assistant",
            content: "Sorry, I couldn't generate the assets. Please try again.",
            type: "text"
          }]);
        } finally {
          setLoading(false);
        }
      }, 1500);
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

      {/* Chat Interface */}
      {connected && (
        <Card className="border-2 border-primary/20 h-[600px] flex flex-col">
          <CardHeader className="border-b border-border">
            <div className="flex items-center gap-3">
              <Avatar className="bg-gradient-to-br from-primary via-purple-500 to-blue-500">
                <span className="text-white font-bold">AI</span>
              </Avatar>
              <div>
                <CardTitle className="text-lg">AI Assistant</CardTitle>
                <CardDescription>Always here to help</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatHistory.map((message, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" && (
                  <Avatar className="bg-gradient-to-br from-primary via-purple-500 to-blue-500 shrink-0">
                    <span className="text-white font-bold text-xs">AI</span>
                  </Avatar>
                )}
                <div className={`flex flex-col gap-2 max-w-[75%] ${message.role === "user" ? "items-end" : "items-start"}`}>
                  <div
                    className={`rounded-2xl px-4 py-2 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                  
                  {/* Product Selection UI */}
                  {message.type === "product_selection" && message.products && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full mt-2">
                      {message.products.map((p: any) => {
                        const imageUrl = p.images?.[0]?.src || '/placeholder.png';
                        const isSelected = message.selectedProducts?.includes(p.id.toString());
                        return (
                          <div
                            key={p.id}
                            onClick={() => !isSelected && handleProductClick(p.id.toString(), p)}
                            className={`border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
                              isSelected
                                ? 'border-primary bg-primary/10 opacity-50 cursor-not-allowed'
                                : 'border-border bg-card hover:border-primary/50 hover:shadow-lg'
                            }`}
                          >
                            <img
                              src={imageUrl}
                              alt={p.title}
                              className="w-full h-20 object-cover"
                            />
                            <div className="p-2">
                              <p className="text-xs font-medium text-center line-clamp-2 text-foreground">{p.title}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Bundle Preview */}
                  {message.type === "bundle_preview" && message.bundleData && (
                    <Card className="w-full mt-2 border-primary/20">
                      <CardHeader>
                        <CardTitle className="text-lg">{message.bundleData.bundle.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="prose prose-sm max-w-none prose-invert" dangerouslySetInnerHTML={{__html: message.bundleData.bundle.description_html}} />
                        <div className="space-y-1 text-sm">
                          <p><b className="text-muted-foreground">Tags:</b> {message.bundleData.bundle.tags}</p>
                          <p><b className="text-muted-foreground">Discount:</b> {message.bundleData.bundle.bundle_price_percent_off}% off</p>
                          <p><b className="text-muted-foreground">Notes:</b> {message.bundleData.bundle.bundle_notes}</p>
                        </div>
                        <Button
                          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 mt-3"
                          onClick={async () => {
                            setCreatingBundle(true);
                            try {
                              const r = await fetch(`${base}/api/create-bundle`, {
                                method: "POST",
                                headers: {"Content-Type":"application/json"},
                                body: JSON.stringify({
                                  shop,
                                  product_a: message.bundleData.product_a,
                                  product_b: message.bundleData.product_b,
                                  bundle: message.bundleData.bundle
                                })
                              });
                              if (r.ok) {
                                setChatHistory(prev => [...prev, {
                                  role: "assistant",
                                  content: "✅ Bundle created successfully in your store! You can view it in your Shopify admin.",
                                  type: "text"
                                }]);
                                // Reset bundle state
                                setBundle(null);
                                setProdA(null);
                                setProdB(null);
                                setPA("");
                                setPB("");
                                setCurrentStep("initial");
                              } else {
                                const errorData = await r.json().catch(() => ({ detail: r.statusText }));
                                const errorMsg = errorData.detail || errorData.message || r.statusText;
                                setChatHistory(prev => [...prev, {
                                  role: "assistant",
                                  content: `❌ Failed to create bundle: ${errorMsg}`,
                                  type: "text"
                                }]);
                              }
                            } catch (e: any) {
                              setChatHistory(prev => [...prev, {
                                role: "assistant",
                                content: `❌ Failed to create bundle: ${e.message || "Unknown error"}`,
                                type: "text"
                              }]);
                            } finally {
                              setCreatingBundle(false);
                            }
                          }}
                          disabled={creatingBundle}
                        >
                          {creatingBundle ? "Creating..." : "Create Bundle in Store"}
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
                {message.role === "user" && (
                  <Avatar className="bg-secondary shrink-0">
                    <span className="text-secondary-foreground font-bold text-xs">You</span>
                  </Avatar>
                )}
              </div>
            ))}
            
            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex gap-3 justify-start animate-in fade-in slide-in-from-left-2 duration-300">
                <Avatar className="bg-gradient-to-br from-primary via-purple-500 to-blue-500 shrink-0 relative">
                  <span className="text-white font-bold text-xs relative z-10">AI</span>
                  <div className="absolute inset-0 bg-gradient-to-br from-primary via-purple-500 to-blue-500 rounded-full animate-ping opacity-20"></div>
                </Avatar>
                <div className="bg-muted/80 backdrop-blur-sm rounded-2xl rounded-bl-sm px-5 py-3 shadow-lg border border-primary/20 relative overflow-hidden">
                  {/* Animated background gradient */}
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-purple-500/5 to-blue-500/5 animate-pulse"></div>
                  
                  <div className="flex items-center gap-3 relative z-10">
                    <span className="text-xs text-muted-foreground font-medium">AI is thinking</span>
                    <div className="flex gap-1.5 items-center">
                      <div className="w-2.5 h-2.5 bg-gradient-to-br from-primary to-purple-500 rounded-full typing-dot shadow-sm"></div>
                      <div className="w-2.5 h-2.5 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full typing-dot shadow-sm"></div>
                      <div className="w-2.5 h-2.5 bg-gradient-to-br from-blue-500 to-primary rounded-full typing-dot shadow-sm"></div>
                    </div>
                    {/* Sparkle effect */}
                    <div className="flex gap-1">
                      <svg className="w-3 h-3 text-primary animate-pulse" style={{ animationDelay: '0ms' }} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <svg className="w-2.5 h-2.5 text-purple-500 animate-pulse" style={{ animationDelay: '300ms' }} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </CardContent>
          <div className="border-t border-border p-4">
            <div className="flex gap-2">
              <Input
                type="text"
                value={agentPrompt}
                onChange={(e) => setAgentPrompt(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && !processingIntent && handleAgentPrompt()}
                placeholder="Type your message..."
                disabled={processingIntent || isTyping}
                className="flex-1"
              />
              <Button
                onClick={handleAgentPrompt}
                disabled={!agentPrompt.trim() || processingIntent || isTyping}
                className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
              >
                {processingIntent ? "..." : "Send"}
              </Button>
            </div>
          </div>
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

      {/* Hide separate bundle preview when bundle is shown in chat */}
      {bundle && prodA && prodB && !chatHistory.some(m => m.type === "bundle_preview") && (
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


"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { DottedGlowBackground } from "@/components/ui/dotted-glow-background";
import { Navbar } from "@/components/navbar";

export default function Home() {
  const [shop, setShop] = useState("");
  const [connected, setConnected] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [suggestion, setSuggestion] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [pA, setPA] = useState("");
  const [pB, setPB] = useState("");
  const [bundle, setBundle] = useState<any | null>(null);
  const [prodA, setProdA] = useState<any | null>(null);
  const [prodB, setProdB] = useState<any | null>(null);
  const [generatingBundle, setGeneratingBundle] = useState(false);
  const [creatingBundle, setCreatingBundle] = useState(false);
  const [agentPrompt, setAgentPrompt] = useState("");
  const [currentStep, setCurrentStep] = useState<"initial" | "bundle_select_a" | "bundle_select_b" | "optimize_select" | "complete">("initial");
  const [chatHistory, setChatHistory] = useState<Array<{
    role: "user" | "assistant";
    content: string;
    type?: "text" | "product_selection" | "bundle_preview";
    products?: any[];
    selectedProducts?: string[];
    bundleData?: any;
    streaming?: boolean;
  }>>([
    {
      role: "assistant",
      content: "Hi! I'm your AI assistant. Please connect your Shopify store first to get started. Once connected, I can help you with tasks like optimizing products, creating bundles, and more!",
      type: "text"
    }
  ]);
  const [processingIntent, setProcessingIntent] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:8000";

  const scrollToBottom = () => {
    // Use a small delay to prevent jumping during state transitions
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }, 50);
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isTyping, streamingMessage]);

  // Check for OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shopParam = params.get("shop");
    const connectedParam = params.get("connected");
    if (shopParam && connectedParam === "true") {
      setShop(shopParam);
      setConnected(true);
      window.history.replaceState({}, document.title, window.location.pathname);
      addMessage("assistant", `Great! I've connected to ${shopParam}. What would you like to do?`);
    }
  }, []);

  const addMessage = (role: "user" | "assistant", content: string, type: "text" | "product_selection" | "bundle_preview" = "text", extra?: any) => {
    setChatHistory(prev => [...prev, {
      role,
      content,
      type,
      ...extra
    }]);
  };

  const streamMessage = (content: string, delay: number = 30) => {
    setStreamingMessage("");
    let index = 0;
    const interval = setInterval(() => {
      if (index < content.length) {
        setStreamingMessage(content.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
        setStreamingMessage("");
        addMessage("assistant", content);
      }
    }, delay);
  };

  const connect = async (shopUrl?: string) => {
    const shopToConnect = shopUrl || shop;
    if (!shopToConnect) return;
    
    let shopDomain = shopToConnect.trim();
    if (!shopDomain.includes(".")) {
      shopDomain = `${shopDomain}.myshopify.com`;
    } else if (!shopDomain.includes("myshopify.com")) {
      if (!shopDomain.endsWith(".myshopify.com")) {
        shopDomain = shopDomain.replace(/\.(com|net|org)$/, "") + ".myshopify.com";
      }
    }
    
    setShop(shopDomain);
    addMessage("user", `Connect to ${shopDomain}`);
    addMessage("assistant", "Redirecting you to Shopify to authorize...");
    const r = await fetch(`${base}/auth/install?shop=${encodeURIComponent(shopDomain)}`);
    const j = await r.json();
    window.location.href = j.install_url;
  };

  const handleConnectFromNavbar = async (shopUrl: string) => {
    await connect(shopUrl);
  };

  const handleConnectClick = async () => {
    await connect();
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
      addMessage("assistant", "Disconnected from your store. Connect again anytime!");
    } catch (e) {
      addMessage("assistant", "Failed to disconnect. Please try again.");
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    addMessage("assistant", "Loading your products...");
    try {
      const r = await fetch(`${base}/api/products?shop=${shop}&limit=50`);
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({ detail: r.statusText }));
        const detail = errorData.detail || errorData;
        if (r.status === 403 && detail.error === "scope_approval_required") {
          const instructions = detail.instructions || [];
          streamMessage(`⚠️ Scope Approval Required\n\n${detail.message}\n\n${instructions.join("\n")}`);
        } else {
          streamMessage(`Failed to load products: ${typeof detail === "string" ? detail : detail.message || detail.detail || r.statusText}`);
        }
        return;
      }
      const j = await r.json();
      setProducts(j.products || []);
      streamMessage(`Great! I found ${j.products?.length || 0} products. What would you like to do with them?`);
    } catch (e: any) {
      streamMessage("Failed to load products: " + (e.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const generate = async (productId: string) => {
    if (!connected || !shop) {
      streamMessage("Please connect your Shopify store first to use this feature.");
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`${base}/api/generate`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ shop, product_id: productId })
      });
      if (!r.ok) throw new Error("Generation failed");
      const j = await r.json();
      setSuggestion(j.suggestion);
      streamMessage(`I've generated optimized launch assets for "${j.product.title}"! Here's what I created:\n\n📝 Title: ${j.suggestion.title}\n\n📄 Description: ${j.suggestion.description_html.replace(/<[^>]*>/g, "").substring(0, 200)}...\n\n🏷️ Tags: ${j.suggestion.tags}\n\n💰 Discount: ${j.suggestion.discount_code} (${j.suggestion.discount_percent}% off)\n\nWould you like me to apply these changes to your store?`);
    } catch (e: any) {
      streamMessage("Failed to generate: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    if (!connected || !shop) {
      streamMessage("Please connect your Shopify store first to use this feature.");
      return;
    }
    setLoading(true);
    addMessage("assistant", "Applying changes to your store...");
    try {
      const r = await fetch(`${base}/api/apply`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ shop, product_id: selected, suggestion })
      });
      if (!r.ok) throw new Error("Apply failed");
      streamMessage("✅ Successfully applied all changes to your store! Check your Shopify admin to see the updates.");
      setSuggestion(null);
    } catch (e: any) {
      streamMessage("Failed to apply: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const generateBundle = async (productAId: string, productBId: string) => {
    if (!connected || !shop) {
      streamMessage("Please connect your Shopify store first to use this feature.");
      return;
    }
    setGeneratingBundle(true);
    addMessage("assistant", "Creating an amazing bundle for you...");
    try {
      const r = await fetch(`${base}/api/generate-bundle`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ shop, product_a_id: productAId, product_b_id: productBId })
      });
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({ detail: r.statusText }));
        const errorMsg = errorData.detail || errorData.message || r.statusText;
        streamMessage(`Failed to generate bundle: ${errorMsg}`);
        return;
      }
      const j = await r.json();
      setProdA(j.product_a);
      setProdB(j.product_b);
      setBundle(j.bundle);
      addMessage("assistant", `Perfect! I've created a bundle: "${j.bundle.title}"`, "bundle_preview", {
        bundleData: {
          bundle: j.bundle,
          product_a: j.product_a,
          product_b: j.product_b
        }
      });
    } catch (e: any) {
      streamMessage("Failed to generate bundle: " + (e.message || "Unknown error"));
    } finally {
      setGeneratingBundle(false);
    }
  };

  const createBundle = async (bundleData: any) => {
    if (!connected || !shop) {
      streamMessage("Please connect your Shopify store first to use this feature.");
      return;
    }
    setCreatingBundle(true);
    addMessage("assistant", "Creating bundle in your store...");
    try {
      const r = await fetch(`${base}/api/create-bundle`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          shop,
          product_a: bundleData.product_a,
          product_b: bundleData.product_b,
          bundle: bundleData.bundle
        })
      });
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({ detail: r.statusText }));
        const errorMsg = errorData.detail || errorData.message || r.statusText;
        streamMessage(`❌ Failed to create bundle: ${errorMsg}`);
        return;
      }
      streamMessage("✅ Bundle created successfully in your store! You can view it in your Shopify admin.");
      setBundle(null);
      setProdA(null);
      setProdB(null);
      setPA("");
      setPB("");
      setCurrentStep("initial");
    } catch (e: any) {
      streamMessage(`❌ Failed to create bundle: ${e.message || "Unknown error"}`);
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
    
    // Check if user is connected before processing tasks
    if (!connected || !shop) {
      addMessage("user", userMessage);
      setAgentPrompt("");
      simulateTyping(() => {
        streamMessage("Please connect your Shopify store first to use this feature. You can connect by entering your store domain in the connection field below and clicking 'Connect'.");
      }, 500);
      return;
    }
    
    addMessage("user", userMessage);
    setAgentPrompt("");
    setProcessingIntent(true);
    
    setIsTyping(true);
    
    try {
      const r = await fetch(`${base}/api/agent-intent`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ prompt: userMessage })
      });
      
      if (!r.ok) throw new Error("Failed to process intent");
      
      const intent = await r.json();
      
      await new Promise(resolve => setTimeout(resolve, 800));
      setIsTyping(false);
      
      let currentProducts = products;
      if (products.length === 0 && connected && (intent.show_section === "bundle" || intent.show_section === "optimize")) {
        await loadProducts();
        await new Promise(resolve => setTimeout(resolve, 100));
        const r = await fetch(`${base}/api/products?shop=${shop}&limit=50`);
        if (r.ok) {
          const j = await r.json();
          currentProducts = j.products || [];
        }
      }
      
      if (intent.show_section === "bundle") {
        setCurrentStep("bundle_select_a");
        simulateTyping(() => {
          addMessage("assistant", "Great! I'll help you create a bundle. First, select Product A:", "product_selection", {
            products: currentProducts,
            selectedProducts: []
          });
        }, 1200);
      } else if (intent.show_section === "optimize") {
        setCurrentStep("optimize_select");
        simulateTyping(() => {
          addMessage("assistant", "Perfect! Which product would you like to optimize?", "product_selection", {
            products: currentProducts,
            selectedProducts: []
          });
        }, 1200);
      } else {
        simulateTyping(() => {
          streamMessage(intent.message);
        }, 800);
      }
    } catch (e: any) {
      setIsTyping(false);
      streamMessage("Sorry, I encountered an error. Please try again.");
    } finally {
      setProcessingIntent(false);
    }
  };

  const handleProductClick = async (productId: string, product: any) => {
    if (currentStep === "bundle_select_a") {
      setPA(productId);
      addMessage("user", product.title);
      
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setCurrentStep("bundle_select_b");
        addMessage("assistant", `Great choice! Now select Product B to bundle with "${product.title}":`, "product_selection", {
          products: products.filter(p => p.id.toString() !== productId),
          selectedProducts: [productId]
        });
      }, 1000);
    } else if (currentStep === "bundle_select_b") {
      setPB(productId);
      addMessage("user", product.title);
      
      setIsTyping(true);
      setTimeout(async () => {
        setIsTyping(false);
        setCurrentStep("complete");
        await generateBundle(pA, productId);
      }, 1500);
    } else if (currentStep === "optimize_select") {
      setSelected(productId);
      addMessage("user", product.title);
      
      setIsTyping(true);
      setTimeout(async () => {
        setIsTyping(false);
        setCurrentStep("complete");
        await generate(productId);
      }, 1500);
    }
  };

  useEffect(() => { check(); }, [shop]);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Navbar */}
      <Navbar 
        onConnect={handleConnectFromNavbar}
        connected={connected}
        shop={shop}
        onDisconnect={logout}
      />

      {/* Main Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="max-w-4xl mx-auto space-y-6 min-h-full">
          {/* Initial Welcome State */}
          {chatHistory.length === 1 && !streamingMessage && !isTyping && (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)] space-y-8 py-8">
              {/* Dotted Glow Background with ShopGenie */}
              <div className="relative flex size-60 md:size-80 items-center justify-center overflow-hidden rounded-md rounded-tl-3xl rounded-br-3xl rounded-bl-3xl border border-transparent px-4 shadow ring-1 shadow-black/10 ring-black/5 dark:shadow-white/10 dark:ring-white/5">
                <DottedGlowBackground
                  className="pointer-events-none absolute inset-0"
                  opacity={1}
                  gap={10}
                  radius={2}
                  color="rgb(115, 115, 115)"
                  darkColor="rgb(200, 200, 200)"
                  glowColor="rgb(82, 82, 82)"
                  darkGlowColor="rgb(56, 189, 248)"
                  backgroundOpacity={0}
                  speedMin={0.3}
                  speedMax={1.6}
                  speedScale={1}
                />
                <div className="relative z-20 flex items-center justify-center w-full h-full">
                  <h1 className="text-3xl md:text-4xl font-bold text-foreground">ShopGenie</h1>
                </div>
              </div>
              <h2 className="text-2xl font-semibold text-foreground">Where should we begin?</h2>
              <div className="w-full max-w-2xl">
                <div className="relative flex items-center gap-3 bg-muted border border-border rounded-2xl px-4 py-4 shadow-sm">
                  <Input
                    type="text"
                    value={agentPrompt}
                    onChange={(e) => setAgentPrompt(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && !processingIntent && handleAgentPrompt()}
                    placeholder="Ask anything"
                    disabled={processingIntent || isTyping}
                    className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-base py-0 h-auto"
                  />
                  <button
                    onClick={handleAgentPrompt}
                    disabled={!agentPrompt.trim() || processingIntent || isTyping}
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {chatHistory.map((message, idx) => {
            // Hide the first welcome message when showing initial state
            if (idx === 0 && chatHistory.length === 1 && !streamingMessage && !isTyping) {
              return null;
            }
            return (
            <div
              key={idx}
              className={`flex gap-4 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.role === "assistant" && (
                <Avatar className="bg-primary shrink-0 w-10 h-10 flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">AI</span>
                </Avatar>
              )}
              <div className={`flex flex-col gap-2 max-w-[80%] ${message.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`rounded-lg px-5 py-3 shadow-sm ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm border border-border"
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">
                    {message.content}
                  </p>
                </div>
                
                {/* Product Selection UI */}
                {message.type === "product_selection" && message.products && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full mt-2">
                    {message.products.map((p: any) => {
                      const imageUrl = p.images?.[0]?.src || '/placeholder.png';
                      const isSelected = message.selectedProducts?.includes(p.id.toString());
                      return (
                        <div
                          key={p.id}
                          onClick={() => !isSelected && handleProductClick(p.id.toString(), p)}
                          className={`border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
                            isSelected
                              ? 'border-primary/50 bg-primary/10 opacity-50 cursor-not-allowed'
                              : 'border-border bg-card hover:border-primary/50 hover:bg-accent hover:scale-105'
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
                  <div className="w-full mt-2 bg-card border border-border rounded-lg p-4 space-y-3">
                    <h3 className="text-lg font-semibold text-foreground">{message.bundleData.bundle.title}</h3>
                    <div className="prose prose-sm max-w-none text-muted-foreground" dangerouslySetInnerHTML={{__html: message.bundleData.bundle.description_html}} />
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p><b>Tags:</b> {message.bundleData.bundle.tags}</p>
                      <p><b>Discount:</b> {message.bundleData.bundle.bundle_price_percent_off}% off</p>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => createBundle(message.bundleData)}
                      disabled={creatingBundle}
                    >
                      {creatingBundle ? "Creating..." : "Create Bundle in Store"}
                    </Button>
                  </div>
                )}

                {/* Suggestion Preview */}
                {suggestion && message.content.includes("optimized launch assets") && (
                  <div className="w-full mt-2 bg-card border border-border rounded-lg p-4 space-y-3">
                    <Button
                      className="w-full"
                      onClick={apply}
                      disabled={loading}
                    >
                      {loading ? "Applying..." : "Apply to Store"}
                    </Button>
                  </div>
                )}
              </div>
              {message.role === "user" && (
                <Avatar className="bg-secondary shrink-0 w-10 h-10 flex items-center justify-center">
                  <span className="text-secondary-foreground font-bold text-sm">You</span>
                </Avatar>
              )}
            </div>
            );
          })}
          
          {/* Streaming Message */}
          {streamingMessage && (
            <div className="flex gap-4 justify-start">
              <Avatar className="bg-primary shrink-0 w-10 h-10 flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">AI</span>
              </Avatar>
              <div className="flex flex-col gap-2 max-w-[80%] items-start">
                <div className="rounded-lg rounded-bl-sm px-5 py-3 shadow-sm bg-muted text-foreground border border-border">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">
                    {streamingMessage}
                    <span className="animate-pulse">▊</span>
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex gap-4 justify-start">
              <Avatar className="bg-primary shrink-0 w-10 h-10 flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">AI</span>
              </Avatar>
              <div className="rounded-lg rounded-bl-sm px-5 py-3 shadow-sm bg-muted border border-border">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Footer with Input and Connection */}
      <div className="border-t border-border bg-card/50 backdrop-blur-sm shrink-0">
        <div className="max-w-4xl mx-auto p-4">
          {/* Chat Input - Smooth transition to prevent layout shifts */}
          <div className={`flex gap-2 transition-all duration-300 ease-in-out ${chatHistory.length > 1 ? 'opacity-100 max-h-20 mb-0' : 'opacity-0 max-h-0 mb-0 overflow-hidden'}`}>
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
            >
              {processingIntent ? "..." : "Send"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

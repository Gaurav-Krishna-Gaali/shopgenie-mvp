"use client";

import React, { useState, useRef, useEffect } from "react";
import { StatefulButton } from "@/components/ui/stateful-button";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent } from "@/components/ui/popover";

interface NavbarProps {
  onConnect: (shopUrl: string) => Promise<void>;
  connected: boolean;
  shop?: string;
  onDisconnect?: () => void;
}

export function Navbar({ onConnect, connected, shop, onDisconnect }: NavbarProps) {
  const [showForm, setShowForm] = useState(false);
  const [shopUrl, setShopUrl] = useState("");
  const [showLoginMessage, setShowLoginMessage] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const handleConnectClick = async () => {
    // First show the AI message
    setShowLoginMessage(true);
    
    // Wait a bit to simulate AI response
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    // Then show the form
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopUrl.trim()) return;
    
    await onConnect(shopUrl.trim());
    setShowForm(false);
    setShopUrl("");
    setShowLoginMessage(false);
  };

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowForm(false);
        setShowLoginMessage(false);
      }
    };

    if (showForm || showLoginMessage) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showForm, showLoginMessage]);

  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">ShopGenie</h1>
            <p className="text-sm text-muted-foreground hidden sm:inline">AI-powered Shopify assistant</p>
          </div>
          
          <div className="flex items-center gap-3 relative">
            {connected ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                  <span className="hidden sm:inline">Connected to {shop}</span>
                  <span className="sm:hidden">{shop}</span>
                </div>
                {onDisconnect && (
                  <Button variant="destructive" size="sm" onClick={onDisconnect}>
                    Disconnect
                  </Button>
                )}
              </div>
            ) : (
              <>
                <StatefulButton onClick={handleConnectClick}>
                  Connect to Shopify
                </StatefulButton>
                
                {(showLoginMessage || showForm) && (
                  <div
                    ref={popoverRef}
                    className="absolute right-0 top-full mt-2 w-[90vw] max-w-sm rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg z-50 animate-in fade-in-0 zoom-in-95"
                  >
                    {showLoginMessage && !showForm && (
                      <div className="space-y-3">
                        <p className="text-sm text-foreground">
                          Please login to your account
                        </p>
                      </div>
                    )}
                    
                    {showForm && (
                      <form onSubmit={handleSubmit} className="space-y-3">
                        <div>
                          <label htmlFor="shop-url" className="text-sm font-medium text-foreground mb-2 block">
                            Enter your Shopify store URL
                          </label>
                          <Input
                            id="shop-url"
                            type="text"
                            placeholder="your-store.myshopify.com"
                            value={shopUrl}
                            onChange={(e) => setShopUrl(e.target.value)}
                            className="w-full"
                            autoFocus
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowForm(false);
                              setShowLoginMessage(false);
                              setShopUrl("");
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            size="sm"
                            disabled={!shopUrl.trim()}
                          >
                            Connect
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}


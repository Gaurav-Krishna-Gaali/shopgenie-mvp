"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StatefulButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onClick?: () => Promise<void> | void;
  children: React.ReactNode;
}

export function StatefulButton({ onClick, children, className, ...props }: StatefulButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!onClick) return;
    
    setLoading(true);
    try {
      await onClick();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      className={cn(className)}
      {...props}
    >
      {loading ? (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>Connecting...</span>
        </div>
      ) : (
        children
      )}
    </Button>
  );
}



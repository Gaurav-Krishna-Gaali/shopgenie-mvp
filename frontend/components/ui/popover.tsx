"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface PopoverProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

const Popover = React.forwardRef<HTMLDivElement, PopoverProps>(
  ({ open, onOpenChange, children, className, ...props }, ref) => {
    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (ref && 'current' in ref && ref.current && !ref.current.contains(event.target as Node)) {
          onOpenChange?.(false);
        }
      };

      if (open) {
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
      }
    }, [open, onOpenChange, ref]);

    if (!open) return null;

    return (
      <div className="fixed inset-0 z-50" onClick={() => onOpenChange?.(false)}>
        <div className="absolute inset-0 bg-black/50" />
        <div
          ref={ref}
          className={cn(
            "absolute z-50 w-[90vw] max-w-sm rounded-lg border bg-popover p-4 text-popover-foreground shadow-md",
            className
          )}
          onClick={(e) => e.stopPropagation()}
          {...props}
        >
          {children}
        </div>
      </div>
    );
  }
);
Popover.displayName = "Popover";

interface PopoverTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

const PopoverTrigger = React.forwardRef<HTMLButtonElement, PopoverTriggerProps>(
  ({ children, asChild, ...props }, ref) => {
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, { ref, ...props } as any);
    }
    return (
      <button ref={ref} {...props}>
        {children}
      </button>
    );
  }
);
PopoverTrigger.displayName = "PopoverTrigger";

interface PopoverContentProps {
  children: React.ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
}

const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(
  ({ children, className, align = "center", side = "bottom", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "z-50 w-[90vw] max-w-sm rounded-lg border bg-popover p-4 text-popover-foreground shadow-md",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
PopoverContent.displayName = "PopoverContent";

export { Popover, PopoverTrigger, PopoverContent };



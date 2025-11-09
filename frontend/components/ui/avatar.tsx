import * as React from "react"

const Avatar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { src?: string; alt?: string }
>(({ className = "", src, alt, children, ...props }, ref) => (
  <div
    ref={ref}
    className={`relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full ${className}`}
    {...props}
  >
    {src ? (
      <img src={src} alt={alt} className="aspect-square h-full w-full" />
    ) : (
      <div className="flex h-full w-full items-center justify-center bg-primary text-primary-foreground">
        {children}
      </div>
    )}
  </div>
))
Avatar.displayName = "Avatar"

export { Avatar }


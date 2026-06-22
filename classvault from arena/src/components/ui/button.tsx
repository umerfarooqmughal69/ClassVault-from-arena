import * as React from "react";
import { cn } from "@/utils/cn";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "accent";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer active:scale-[0.98] duration-150",
          {
            "bg-primary text-background hover:bg-primary/90 shadow-md shadow-primary/20 font-semibold":
              variant === "default",
            "bg-destructive text-white hover:bg-destructive/90 shadow-md shadow-destructive/10":
              variant === "destructive",
            "border border-border bg-transparent hover:bg-muted text-foreground":
              variant === "outline",
            "bg-muted text-foreground hover:bg-muted/80":
              variant === "secondary",
            "hover:bg-muted hover:text-foreground text-muted-foreground":
              variant === "ghost",
            "underline-offset-4 hover:underline text-primary":
              variant === "link",
            "bg-accent text-background hover:bg-accent/90 shadow-md shadow-accent/20 font-semibold":
              variant === "accent",
          },
          {
            "h-10 px-4 py-2": size === "default",
            "h-8 rounded-md px-3 text-xs": size === "sm",
            "h-12 rounded-md px-8 text-base": size === "lg",
            "h-10 w-10": size === "icon",
          },
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };

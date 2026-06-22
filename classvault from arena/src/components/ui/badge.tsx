import * as React from "react";
import { cn } from "@/utils/cn";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "primary" | "accent";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        {
          "border-transparent bg-primary text-background": variant === "default",
          "border-transparent bg-muted text-foreground": variant === "secondary",
          "border-transparent bg-destructive/20 text-destructive border-destructive/30": variant === "destructive",
          "text-foreground border-border": variant === "outline",
          "border-transparent bg-success/20 text-success border-success/30": variant === "success",
          "border-transparent bg-warning/20 text-warning border-warning/30": variant === "warning",
          "border-transparent bg-primary/20 text-primary border-primary/30": variant === "primary",
          "border-transparent bg-accent/20 text-accent border-accent/30": variant === "accent",
        },
        className
      )}
      {...props}
    />
  );
}

export { Badge };

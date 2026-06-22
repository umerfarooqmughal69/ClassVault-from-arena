import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/utils/cn";

export interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

const DialogContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
} | null>(null);

export function Dialog({ open = false, onOpenChange, children }: DialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(open);
  
  React.useEffect(() => {
    setInternalOpen(open);
  }, [open]);

  const setOpen = React.useCallback((value: boolean) => {
    setInternalOpen(value);
    onOpenChange?.(value);
  }, [onOpenChange]);

  return (
    <DialogContext.Provider value={{ open: internalOpen, setOpen }}>
      {children}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error("Dialog components must be rendered within a <Dialog />");
  }
  return context;
}

export function DialogTrigger({ children, ...props }: { children: React.ReactElement<any> }) {
  const { setOpen } = useDialog();
  
  return React.cloneElement(children, {
    onClick: (e: React.MouseEvent) => {
      if (children.props && typeof children.props.onClick === "function") {
        children.props.onClick(e);
      }
      setOpen(true);
    },
    ...props
  } as any);
}

export function DialogPortal({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function DialogOverlay({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { setOpen } = useDialog();
  return (
    <div
      onClick={() => setOpen(false)}
      className={cn(
        "fixed inset-0 z-50 bg-background/80 backdrop-blur-sm transition-all duration-150 animate-in fade-in",
        className
      )}
      {...props}
    />
  );
}

export function DialogContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { open, setOpen } = useDialog();
  
  // Listen to Escape key to close dialog
  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <DialogPortal>
      <DialogOverlay />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className={cn(
            "pointer-events-auto relative w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-xl duration-200 animate-in fade-in zoom-in-95 slide-in-from-bottom-4 glass",
            className
          )}
          {...props}
        >
          {children}
          <button
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none cursor-pointer"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </div>
      </div>
    </DialogPortal>
  );
}

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col space-y-1.5 text-center sm:text-left mb-4",
        className
      )}
      {...props}
    />
  );
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6",
        className
      )}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "text-lg font-semibold leading-none tracking-tight font-display text-primary",
        className
      )}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

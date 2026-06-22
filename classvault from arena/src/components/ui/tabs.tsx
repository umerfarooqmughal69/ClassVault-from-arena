import * as React from "react";
import { cn } from "@/utils/cn";

interface TabsContextProps {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextProps | null>(null);

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  className,
  children,
  ...props
}: TabsProps) {
  const [localValue, setLocalValue] = React.useState(defaultValue || "");
  
  const activeValue = value !== undefined ? value : localValue;
  
  const handleValueChange = React.useCallback(
    (newValue: string) => {
      if (value === undefined) {
        setLocalValue(newValue);
      }
      onValueChange?.(newValue);
    },
    [value, onValueChange]
  );

  return (
    <TabsContext.Provider value={{ value: activeValue, onValueChange: handleValueChange }}>
      <div className={cn("w-full", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function useTabs() {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs components must be rendered within a <Tabs />");
  }
  return context;
}

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function TabsList({ className, children, ...props }: TabsListProps) {
  return (
    <div
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground w-full sm:w-auto overflow-x-auto select-none",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  children: React.ReactNode;
}

export function TabsTrigger({ className, value, children, ...props }: TabsTriggerProps) {
  const { value: activeValue, onValueChange } = useTabs();
  const isActive = activeValue === value;

  return (
    <button
      type="button"
      onClick={() => onValueChange(value)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
        isActive
          ? "bg-background text-primary font-semibold shadow-sm"
          : "hover:text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  children: React.ReactNode;
}

export function TabsContent({ className, value, children, ...props }: TabsContentProps) {
  const { value: activeValue } = useTabs();
  
  if (activeValue !== value) return null;

  return (
    <div
      className={cn(
        "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 animate-in fade-in duration-200",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

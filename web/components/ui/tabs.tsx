'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface TabsContextValue {
  baseId: string;
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = React.useContext(TabsContext);
  if (!ctx) {
    throw new Error('Tabs subcomponents must be used within <Tabs>.');
  }
  return ctx;
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

function Tabs({
  defaultValue,
  value: controlledValue,
  onValueChange,
  className,
  children,
  ...props
}: TabsProps) {
  const baseId = React.useId();
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const currentValue = controlledValue ?? internalValue;

  const handleChange = React.useCallback(
    (next: string) => {
      if (controlledValue === undefined) {
        setInternalValue(next);
      }
      onValueChange?.(next);
    },
    [controlledValue, onValueChange]
  );

  return (
    <TabsContext.Provider
      value={{ baseId, value: currentValue, onValueChange: handleChange }}
    >
      <div className={cn('flex flex-col gap-4', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

const TabsList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="tablist"
    className={cn(
      'inline-flex w-fit flex-wrap items-center gap-1 rounded-md border border-border bg-muted p-1 text-muted-foreground',
      className
    )}
    {...props}
  />
));
TabsList.displayName = 'TabsList';

export interface TabsTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, onKeyDown, ...props }, ref) => {
    const ctx = useTabsContext();
    const isSelected = ctx.value === value;

    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) {
        return;
      }

      const tabList = event.currentTarget.closest('[role="tablist"]');
      if (!tabList) {
        return;
      }

      const tabs = Array.from(
        tabList.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])')
      );
      const currentIndex = tabs.indexOf(event.currentTarget);
      if (currentIndex === -1 || tabs.length === 0) {
        return;
      }

      let targetIndex: number | null = null;
      if (event.key === 'ArrowRight') {
        targetIndex = (currentIndex + 1) % tabs.length;
      } else if (event.key === 'ArrowLeft') {
        targetIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      } else if (event.key === 'Home') {
        targetIndex = 0;
      } else if (event.key === 'End') {
        targetIndex = tabs.length - 1;
      }

      if (targetIndex !== null) {
        event.preventDefault();
        const nextTab = tabs[targetIndex];
        const nextValue = nextTab?.dataset.tabValue;
        nextTab?.focus();
        if (nextValue) {
          ctx.onValueChange(nextValue);
        }
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        id={`${ctx.baseId}-tab-${value}`}
        aria-controls={`${ctx.baseId}-panel-${value}`}
        aria-selected={isSelected}
        tabIndex={isSelected ? 0 : -1}
        data-tab-value={value}
        data-state={isSelected ? 'active' : 'inactive'}
        onClick={() => ctx.onValueChange(value)}
        onKeyDown={handleKeyDown}
        className={cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none',
          isSelected
            ? 'bg-card text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
          className
        )}
        {...props}
      />
    );
  }
);
TabsTrigger.displayName = 'TabsTrigger';

export interface TabsContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, ...props }, ref) => {
    const ctx = useTabsContext();
    if (ctx.value !== value) {
      return null;
    }

    return (
      <div
        ref={ref}
        role="tabpanel"
        id={`${ctx.baseId}-panel-${value}`}
        aria-labelledby={`${ctx.baseId}-tab-${value}`}
        tabIndex={0}
        className={cn('focus-visible:outline-none', className)}
        {...props}
      />
    );
  }
);
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent };

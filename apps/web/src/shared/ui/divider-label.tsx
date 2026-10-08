import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface DividerLabelProps {
  className?: string | undefined;
  label: ReactNode;
}

export function DividerLabel({ className, label }: DividerLabelProps) {
  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      <div className="border-border w-full border-t" />
      <span className="text-caption bg-card text-muted-foreground absolute px-2 font-semibold uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

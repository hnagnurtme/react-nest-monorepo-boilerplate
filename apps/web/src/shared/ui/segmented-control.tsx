import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { FOCUS_RING_INSET } from './focus-ring';

export interface SegmentedControlOption {
  icon?: ReactNode;
  label: ReactNode;
  value: string;
}

interface SegmentedControlProps {
  className?: string | undefined;
  onValueChange: (value: string) => void;
  options: SegmentedControlOption[];
  value: string;
}

export function SegmentedControl({
  className,
  onValueChange,
  options,
  value,
}: SegmentedControlProps) {
  return (
    <div className={cn('bg-muted border-border rounded-control flex border p-1', className)}>
      {options.map((option) => {
        const isSelected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => {
              onValueChange(option.value);
            }}
            className={cn(
              'text-label rounded-inner flex h-8 flex-1 cursor-pointer items-center justify-center gap-2 font-semibold transition-colors',
              FOCUS_RING_INSET,
              isSelected
                ? 'bg-card text-primary shadow-raised'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

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
    <div className={cn('bg-muted border-border flex rounded-xl border p-1', className)}>
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
              'flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition-all',
              isSelected
                ? 'bg-card text-primary shadow-sm'
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

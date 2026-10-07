import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface IconTextProps {
  children: ReactNode;
  className?: string | undefined;
  icon: ReactNode;
}

export function IconText({ children, className, icon }: IconTextProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {icon}
      {children}
    </div>
  );
}

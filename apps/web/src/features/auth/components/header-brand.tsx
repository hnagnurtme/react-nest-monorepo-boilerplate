import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { useBrand } from '@/shared/hooks';
import { FOCUS_RING } from '@/shared/ui';

interface HeaderBrandProps {
  className?: string;
}

export function HeaderBrand({ className }: HeaderBrandProps) {
  const brand = useBrand();

  return (
    <Link
      to="/"
      className={cn(
        'text-foreground text-heading rounded-inner inline-flex items-center gap-2 font-bold tracking-tight transition-opacity hover:opacity-90',
        FOCUS_RING,
        className,
      )}
      aria-label={brand.name}
    >
      {brand.name}
    </Link>
  );
}

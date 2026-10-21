import { cn } from '@/lib/utils';

/**
 * Two letters from the tenant's name, for a tenant with no logo yet.
 *
 * A generic building icon repeated down a list tells the eye nothing: every
 * tenant looks the same, which is the one thing an identifier must not do. The
 * initials at least differ per tenant.
 */
export function tenantInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0] ?? '';
  const second = words[1] ?? '';
  const letters = second === '' ? first.slice(0, 2) : `${first.slice(0, 1)}${second.slice(0, 1)}`;
  return letters.toLocaleUpperCase();
}

export interface TenantAvatarProps {
  name: string;
  /** The uploaded logo, when the tenant has one. */
  logoUrl?: string | null | undefined;
  /** Sizing belongs to the caller: a square utility such as `size-8`. */
  className?: string | undefined;
}

/**
 * A tenant's mark at a fixed square: its logo, or its initials when it has
 * none. The fallback is part of the component rather than of each caller, so a
 * tenant without a logo still occupies the same box and nothing reflows when
 * one is uploaded.
 */
export function TenantAvatar({ name, logoUrl, className }: TenantAvatarProps) {
  return (
    <span
      className={cn(
        'bg-muted text-muted-foreground rounded-control size-8 shrink-0 overflow-hidden',
        'flex items-center justify-center',
        className,
      )}
    >
      {logoUrl == null ? (
        <span className="text-label font-bold">{tenantInitials(name)}</span>
      ) : (
        // `alt=""`: the name is always beside it, and a second reading of it
        // only makes a screen reader say the tenant twice.
        <img src={logoUrl} alt="" className="size-full object-cover" />
      )}
    </span>
  );
}

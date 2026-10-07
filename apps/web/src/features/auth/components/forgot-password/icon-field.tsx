import { type ReactNode } from 'react';

export interface IconFieldProps {
  id: string;
  label: string;
  icon: ReactNode;
  children: ReactNode;
}

/** Labelled field with a leading icon; the three reset inputs share this frame. */
export function IconField({ id, label, icon, children }: IconFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-foreground block text-xs font-semibold">
        {label}
      </label>
      <div className="relative">
        <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
          {icon}
        </span>
        {children}
      </div>
    </div>
  );
}

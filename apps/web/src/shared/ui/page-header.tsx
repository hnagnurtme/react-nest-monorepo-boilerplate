import { type ReactNode } from 'react';

export interface PageHeaderProps {
  /**
   * Omit it when the app bar already names the page: the shell renders the `h1`
   * from the nav entry, so repeating it here prints the word twice and gives the
   * document two level-one headings. Pass it only on a page the nav cannot name
   * — a detail or a wizard step.
   */
  title?: string;
  subtitle?: string;
  /** Buttons and links, right-aligned next to the title. */
  actions?: ReactNode;
}

/** The title block every list page repeats; keeps the type scale in one place. */
export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        {title === undefined ? null : (
          <h1 className="text-foreground text-title font-bold">{title}</h1>
        )}
        {subtitle === undefined ? null : (
          <p className="text-muted-foreground text-body">{subtitle}</p>
        )}
      </div>
      {actions === undefined ? null : <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}

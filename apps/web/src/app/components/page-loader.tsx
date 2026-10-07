import { Loader2 } from 'lucide-react';

export function PageLoader() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-6">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
        <span className="text-muted-foreground text-xs font-medium">Loading...</span>
      </div>
    </div>
  );
}

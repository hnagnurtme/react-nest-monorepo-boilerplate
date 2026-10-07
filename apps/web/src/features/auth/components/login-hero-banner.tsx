import { useBrand } from '@/shared/hooks';

export function LoginHeroBanner() {
  const brand = useBrand();

  return (
    <div className="bg-primary text-primary-foreground relative flex h-full w-full flex-col items-center justify-center gap-3 overflow-hidden p-12 text-center">
      {brand.thumbnailUrl ? (
        <img
          src={brand.thumbnailUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-30"
        />
      ) : null}
      <p className="relative text-4xl font-bold tracking-tight">{brand.name}</p>
      <p className="relative max-w-sm text-base opacity-90">{brand.slogan}</p>
    </div>
  );
}

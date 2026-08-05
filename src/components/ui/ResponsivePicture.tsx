type Source = {
  src: string;
  /** CSS media query for &lt;source media=...&gt; */
  media: string;
};

/**
 * Picks a different image per breakpoint. Same scene/essence, different crop/frame.
 * Order: first matching &lt;source&gt; wins (put desktop first, then tablet, img = phone fallback).
 */
export function ResponsivePicture({
  sources,
  fallbackSrc,
  alt = '',
  className,
}: {
  sources: Source[];
  fallbackSrc: string;
  alt?: string;
  className?: string;
}) {
  return (
    <picture>
      {sources.map((s) => (
        <source key={s.media + s.src} media={s.media} srcSet={s.src} />
      ))}
      <img
        className={className}
        src={fallbackSrc}
        alt={alt}
        draggable={false}
        decoding="async"
        // Lowercase: React 18 does not know the camelCase form and passes it
        // straight through, which warns on every render of the welcome screen
        // and buries anything else in the console. React 19 accepts either.
        {...{ fetchpriority: 'high' }}
        loading="eager"
        aria-hidden={alt === '' ? true : undefined}
      />
    </picture>
  );
}

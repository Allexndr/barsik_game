type Source = {
  src: string;
  /** CSS-медиазапрос для атрибута media у &lt;source&gt;. */
  media: string;
};

/**
 * Подбирает своё изображение под каждую точку перелома. Сцена и суть те же, кадр и
 * обрезка разные. Порядок: побеждает первый подошедший &lt;source&gt;, поэтому сначала
 * десктоп, потом планшет, а img остаётся запасным вариантом для телефона.
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
        // В нижнем регистре: React 18 не знает формы в верблюжьем регистре и
        // передаёт её как есть, а это предупреждение на каждой отрисовке
        // приветственного экрана, которое хоронит в консоли всё остальное. React 19
        // принимает оба варианта.
        {...{ fetchpriority: 'high' }}
        loading="eager"
        aria-hidden={alt === '' ? true : undefined}
      />
    </picture>
  );
}

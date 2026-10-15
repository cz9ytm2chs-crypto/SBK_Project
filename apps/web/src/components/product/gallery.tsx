import { Dialog as D } from 'radix-ui';
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ImageDTO } from '@silt/shared';
import { cn, imageUrl, srcSet } from '@/lib/utils';

/** Desktop: thumbnails + main image with hover zoom. Mobile: swipeable strip. Click opens a full-screen viewer. */
export function Gallery({ images, name }: { images: ImageDTO[]; name: string }) {
  const [active, setActive] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [origin, setOrigin] = useState<string | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setActive(0);
  }, [images]);

  const current = images[active] ?? images[0];
  if (!current) return <div className="aspect-[4/5] bg-mist" />;

  const go = (i: number) => setActive((i + images.length) % images.length);

  const onStripScroll = () => {
    const el = stripRef.current;
    if (el) setActive(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div className="lg:grid lg:grid-cols-[72px_1fr] lg:gap-4">
      {/* Thumbnails */}
      <div className="hidden flex-col gap-3 lg:flex" role="tablist" aria-label="Фотографии товара">
        {images.map((img, i) => (
          <button
            key={img.id}
            role="tab"
            aria-selected={i === active}
            aria-label={`Фото ${i + 1}`}
            onClick={() => setActive(i)}
            className={cn('aspect-[4/5] overflow-hidden bg-mist transition-opacity', i === active ? 'ring-1 ring-ink' : 'opacity-60 hover:opacity-100')}
          >
            <img src={imageUrl(img.url, 160)} alt="" className="size-full object-cover" loading="lazy" />
          </button>
        ))}
      </div>

      {/* Desktop main image */}
      <div className="relative hidden lg:block">
        <button
          type="button"
          onClick={() => setZoomOpen(true)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
          }}
          onMouseLeave={() => setOrigin(null)}
          className="group relative block aspect-[4/5] w-full cursor-zoom-in overflow-hidden bg-mist"
          aria-label="Увеличить фото"
        >
          <img
            src={imageUrl(current.url, 1200)}
            srcSet={srcSet(current.url, [800, 1200, 1600])}
            sizes="(min-width:1024px) 50vw, 100vw"
            alt={current.alt || name}
            className="size-full object-cover transition-transform duration-300 ease-out"
            style={origin ? { transform: 'scale(1.8)', transformOrigin: origin } : undefined}
            fetchPriority="high"
          />
          <span className="absolute right-4 bottom-4 rounded-full bg-paper/90 p-2.5 opacity-0 transition-opacity group-hover:opacity-100">
            <ZoomIn className="size-4" />
          </span>
        </button>
        {images.length > 1 && (
          <>
            <NavButton side="left" onClick={() => go(active - 1)} />
            <NavButton side="right" onClick={() => go(active + 1)} />
          </>
        )}
      </div>

      {/* Mobile strip */}
      <div className="relative -mx-4 sm:-mx-6 lg:hidden">
        <div ref={stripRef} onScroll={onStripScroll} className="flex snap-x snap-mandatory overflow-x-auto no-scrollbar">
          {images.map((img, i) => (
            <button key={img.id} onClick={() => { setActive(i); setZoomOpen(true); }} className="aspect-[4/5] w-full shrink-0 snap-center bg-mist" aria-label={`Открыть фото ${i + 1}`}>
              <img src={imageUrl(img.url, 900)} srcSet={srcSet(img.url, [600, 900, 1200])} sizes="100vw" alt={img.alt || name} className="size-full object-cover" loading={i === 0 ? 'eager' : 'lazy'} />
            </button>
          ))}
        </div>
        {images.length > 1 && (
          <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5" aria-hidden>
            {images.map((img, i) => (
              <span key={img.id} className={cn('h-0.5 w-6 transition-colors', i === active ? 'bg-ink' : 'bg-ink/25')} />
            ))}
          </div>
        )}
      </div>

      <D.Root open={zoomOpen} onOpenChange={setZoomOpen}>
        <D.Portal>
          <D.Content className="fixed inset-0 z-50 flex items-center justify-center bg-paper focus:outline-none" onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') go(active - 1);
            if (e.key === 'ArrowRight') go(active + 1);
          }}>
            <D.Title className="sr-only">{name}</D.Title>
            <D.Description className="sr-only">Просмотр фотографий. Стрелки влево и вправо переключают фото.</D.Description>
            <img src={imageUrl(current.url, 1800)} alt={current.alt || name} className="max-h-full max-w-full object-contain" />
            <D.Close className="absolute top-4 right-4 rounded-full bg-mist p-3 hover:bg-line" aria-label="Закрыть">
              <X className="size-5" />
            </D.Close>
            {images.length > 1 && (
              <>
                <NavButton side="left" onClick={() => go(active - 1)} />
                <NavButton side="right" onClick={() => go(active + 1)} />
                <p className="absolute bottom-6 text-xs text-stone tabular-nums">
                  {active + 1} / {images.length}
                </p>
              </>
            )}
          </D.Content>
        </D.Portal>
      </D.Root>
    </div>
  );
}

function NavButton({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'left' ? 'Предыдущее фото' : 'Следующее фото'}
      className={cn('absolute top-1/2 -translate-y-1/2 rounded-full bg-paper/90 p-2.5 shadow-sm transition-colors hover:bg-paper', side === 'left' ? 'left-4' : 'right-4')}
    >
      <Icon className="size-5" />
    </button>
  );
}

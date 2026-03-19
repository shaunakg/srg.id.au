import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type TouchEvent,
} from 'react';
import { cx } from './utils';

interface CenteredCarouselProps<T> {
  items: readonly T[];
  ariaLabel: string;
  className?: string;
  slideClassName?: string;
  getItemKey?: (item: T, index: number) => string;
  getSlideAriaLabel?: (item: T, index: number, total: number) => string;
  renderItem: (item: T, index: number, isCurrent: boolean) => ReactNode;
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(mediaQuery.matches);
    update();

    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  return prefersReducedMotion;
}

const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export default function CenteredCarousel<T>({
  items,
  ariaLabel,
  className,
  slideClassName,
  getItemKey,
  getSlideAriaLabel,
  renderItem,
}: CenteredCarouselProps<T>) {
  const regionId = useId();
  const prefersReducedMotion = usePrefersReducedMotion();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<Array<HTMLLIElement | null>>([]);
  const touchStartXRef = useRef<number | null>(null);
  const touchCurrentXRef = useRef<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    slideRefs.current = slideRefs.current.slice(0, items.length);
    setCurrentIndex((value) => Math.min(value, Math.max(items.length - 1, 0)));
  }, [items.length]);

  const setActiveIndex = useCallback(
    (index: number) => {
      setCurrentIndex(Math.max(0, Math.min(index, items.length - 1)));
    },
    [items.length],
  );

  const syncPosition = useCallback(
    (index = currentIndex) => {
      const viewport = viewportRef.current;
      const slide = slideRefs.current[index];
      if (!viewport || !slide) return;

      const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
      const viewportCenter = viewport.clientWidth / 2;
      setTranslateX(Math.round(viewportCenter - slideCenter));
      setIsReady(true);
    },
    [currentIndex],
  );

  useClientLayoutEffect(() => {
    syncPosition(currentIndex);
  }, [currentIndex, syncPosition]);

  useClientLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    let frameId = 0;
    const scheduleSync = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        syncPosition(currentIndex);
      });
    };

    scheduleSync();
    window.addEventListener('resize', scheduleSync);
    window.addEventListener('load', scheduleSync);
    window.addEventListener('pageshow', scheduleSync);

    const resizeObserver = new ResizeObserver(scheduleSync);
    resizeObserver.observe(viewport);
    slideRefs.current.forEach((slide) => {
      if (slide) resizeObserver.observe(slide);
    });

    if (document.fonts?.ready) {
      document.fonts.ready.then(scheduleSync).catch(() => {});
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', scheduleSync);
      window.removeEventListener('load', scheduleSync);
      window.removeEventListener('pageshow', scheduleSync);
      resizeObserver.disconnect();
    };
  }, [currentIndex, items.length, syncPosition]);

  useEffect(() => {
    slideRefs.current.forEach((slide, index) => {
      if (!slide) return;

      slide.querySelectorAll('video').forEach((video) => {
        if (index !== currentIndex) {
          video.pause();
        }
      });
    });
  }, [currentIndex]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setActiveIndex(currentIndex - 1);
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setActiveIndex(currentIndex + 1);
      }
    },
    [currentIndex, setActiveIndex],
  );

  const handleTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const startX = event.changedTouches[0]?.screenX ?? null;
    touchStartXRef.current = startX;
    touchCurrentXRef.current = startX;
  }, []);

  const handleTouchMove = useCallback((event: TouchEvent<HTMLDivElement>) => {
    if (touchStartXRef.current === null) return;
    touchCurrentXRef.current = event.changedTouches[0]?.screenX ?? touchStartXRef.current;
  }, []);

  const handleTouchEnd = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (touchStartXRef.current === null) return;

      const touchEndX =
        touchCurrentXRef.current ?? event.changedTouches[0]?.screenX ?? touchStartXRef.current;
      const delta = touchStartXRef.current - touchEndX;
      touchStartXRef.current = null;
      touchCurrentXRef.current = null;

      if (Math.abs(delta) < 50) return;
      if (delta > 0) {
        setActiveIndex(currentIndex + 1);
      } else {
        setActiveIndex(currentIndex - 1);
      }
    },
    [currentIndex, setActiveIndex],
  );

  const itemsWithLabels = useMemo(
    () =>
      items.map((item, index) => ({
        item,
        ariaLabel:
          getSlideAriaLabel?.(item, index, items.length) ?? `Slide ${index + 1} of ${items.length}`,
      })),
    [getSlideAriaLabel, items],
  );

  if (items.length === 0) return null;

  return (
    <div
      className={cx('media-carousel', className, isReady && 'is-ready')}
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={viewportRef}
        className="media-carousel-viewport"
        tabIndex={0}
        aria-controls={regionId}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <ul
          id={regionId}
          className="media-carousel-track"
          style={{
            transform: `translate3d(${translateX}px, 0, 0)`,
            transitionDuration: prefersReducedMotion ? '0ms' : undefined,
          }}
        >
          {itemsWithLabels.map(({ item, ariaLabel }, index) => {
            const isCurrent = index === currentIndex;
            return (
              <li
                key={getItemKey?.(item, index) ?? `${index}`}
                ref={(node) => {
                  slideRefs.current[index] = node;
                }}
                className={cx('media-carousel-slide', slideClassName, isCurrent && 'current-slide')}
                aria-label={ariaLabel}
                aria-current={isCurrent ? 'true' : undefined}
                aria-hidden={isCurrent ? 'false' : 'true'}
                onClick={() => {
                  if (!isCurrent) {
                    setActiveIndex(index);
                  }
                }}
              >
                {renderItem(item, index, isCurrent)}
              </li>
            );
          })}
        </ul>
      </div>

      <button
        className="media-carousel-button media-carousel-button--prev"
        type="button"
        aria-label="Previous slide"
        disabled={currentIndex === 0}
        onClick={() => setActiveIndex(currentIndex - 1)}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>

      <button
        className="media-carousel-button media-carousel-button--next"
        type="button"
        aria-label="Next slide"
        disabled={currentIndex === items.length - 1}
        onClick={() => setActiveIndex(currentIndex + 1)}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>

      <div className="media-carousel-indicators">
        {items.map((item, index) => {
          const isCurrent = index === currentIndex;
          return (
            <button
              key={`indicator-${getItemKey?.(item, index) ?? index}`}
              className={cx('media-carousel-indicator', isCurrent && 'current-slide')}
              type="button"
              aria-label={`Go to slide ${index + 1}`}
              aria-current={isCurrent ? 'true' : undefined}
              onClick={() => setActiveIndex(index)}
            />
          );
        })}
      </div>
    </div>
  );
}

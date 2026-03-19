import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type TouchEvent } from 'react';
import { cx } from './utils';

interface HorizontalCarouselProps<T> {
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

export default function HorizontalCarousel<T>({
  items,
  ariaLabel,
  className,
  slideClassName,
  getItemKey,
  getSlideAriaLabel,
  renderItem,
}: HorizontalCarouselProps<T>) {
  const regionId = useId();
  const prefersReducedMotion = usePrefersReducedMotion();
  const trackContainerRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<Array<HTMLLIElement | null>>([]);
  const touchStartXRef = useRef<number | null>(null);
  const touchCurrentXRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const suppressClickTimeoutRef = useRef<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    slideRefs.current = slideRefs.current.slice(0, items.length);
    setCurrentIndex((value) => Math.min(value, Math.max(items.length - 1, 0)));
  }, [items.length]);

  useEffect(() => {
    const trackContainer = trackContainerRef.current;
    const firstSlide = slideRefs.current[0];
    if (!trackContainer || !firstSlide) return undefined;

    const carousel = trackContainer.closest<HTMLElement>('.carousel');
    if (!carousel) return undefined;

    const syncSlideWidth = () => {
      const slideWidth = Math.round(firstSlide.getBoundingClientRect().width);
      if (slideWidth > 0) {
        carousel.style.setProperty('--carousel-slide-width', `${slideWidth}px`);
      }
    };

    syncSlideWidth();
    trackContainer.scrollTo({ left: 0, behavior: 'auto' });

    const resizeObserver = new ResizeObserver(syncSlideWidth);
    resizeObserver.observe(trackContainer);
    resizeObserver.observe(firstSlide);

    if (document.fonts?.ready) {
      document.fonts.ready.then(syncSlideWidth).catch(() => {});
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [items.length]);

  const scrollToIndex = useCallback(
    (index: number) => {
      const nextIndex = Math.max(0, Math.min(index, items.length - 1));
      const slide = slideRefs.current[nextIndex];
      if (!slide) return;

      slide.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    },
    [items.length, prefersReducedMotion],
  );

  const updateCurrentIndex = useCallback(() => {
    const trackContainer = trackContainerRef.current;
    if (!trackContainer || slideRefs.current.length === 0) return;

    const viewportCenter = trackContainer.scrollLeft + trackContainer.clientWidth / 2;
    let nextIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    slideRefs.current.forEach((slide, index) => {
      if (!slide) return;
      const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
      const distance = Math.abs(slideCenter - viewportCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        nextIndex = index;
      }
    });

    setCurrentIndex((value) => (value === nextIndex ? value : nextIndex));
  }, []);

  useEffect(() => {
    const trackContainer = trackContainerRef.current;
    if (!trackContainer) return undefined;

    let frameId = 0;
    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateCurrentIndex);
    };

    scheduleUpdate();
    trackContainer.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);

    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(trackContainer);
    slideRefs.current.forEach((slide) => {
      if (slide) resizeObserver.observe(slide);
    });

    if (document.fonts?.ready) {
      document.fonts.ready.then(scheduleUpdate).catch(() => {});
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      trackContainer.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      resizeObserver.disconnect();
    };
  }, [updateCurrentIndex, items.length]);

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

  useEffect(() => {
    return () => {
      if (suppressClickTimeoutRef.current !== null) {
        window.clearTimeout(suppressClickTimeoutRef.current);
      }
    };
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        scrollToIndex(currentIndex - 1);
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        scrollToIndex(currentIndex + 1);
      }
    },
    [currentIndex, scrollToIndex],
  );

  const handleTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const startX = event.changedTouches[0]?.screenX ?? null;
    touchStartXRef.current = startX;
    touchCurrentXRef.current = startX;

    if (suppressClickTimeoutRef.current !== null) {
      window.clearTimeout(suppressClickTimeoutRef.current);
      suppressClickTimeoutRef.current = null;
    }
  }, []);

  const handleTouchMove = useCallback((event: TouchEvent<HTMLDivElement>) => {
    if (touchStartXRef.current === null) return;

    touchCurrentXRef.current = event.changedTouches[0]?.screenX ?? touchStartXRef.current;
    if (Math.abs(touchStartXRef.current - touchCurrentXRef.current) > 10) {
      suppressClickRef.current = true;
    }
  }, []);

  const handleTouchEnd = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (touchStartXRef.current === null) return;

      const touchEndX =
        touchCurrentXRef.current ?? event.changedTouches[0]?.screenX ?? touchStartXRef.current;
      const delta = touchStartXRef.current - touchEndX;
      touchStartXRef.current = null;
      touchCurrentXRef.current = null;

      if (Math.abs(delta) <= 10) {
        suppressClickRef.current = false;
        return;
      }

      suppressClickRef.current = true;
      if (suppressClickTimeoutRef.current !== null) {
        window.clearTimeout(suppressClickTimeoutRef.current);
      }
      suppressClickTimeoutRef.current = window.setTimeout(() => {
        suppressClickRef.current = false;
        suppressClickTimeoutRef.current = null;
      }, 250);

      if (Math.abs(delta) < 50) return;
      if (delta > 0) {
        scrollToIndex(currentIndex + 1);
      } else {
        scrollToIndex(currentIndex - 1);
      }
    },
    [currentIndex, scrollToIndex],
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
      className={cx('carousel', className)}
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={trackContainerRef}
        className="carousel-track-container"
        tabIndex={0}
        aria-controls={regionId}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClickCapture={(event) => {
          if (!suppressClickRef.current) return;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <ul id={regionId} className="carousel-track">
          {itemsWithLabels.map(({ item, ariaLabel }, index) => {
            const isCurrent = index === currentIndex;
            return (
              <li
                key={getItemKey?.(item, index) ?? `${index}`}
                ref={(node) => {
                  slideRefs.current[index] = node;
                }}
                className={cx('carousel-slide', slideClassName, isCurrent && 'current-slide')}
                aria-label={ariaLabel}
                aria-current={isCurrent ? 'true' : undefined}
              >
                {renderItem(item, index, isCurrent)}
              </li>
            );
          })}
        </ul>
      </div>

      <button
        className="carousel-button carousel-button--prev"
        type="button"
        aria-label="Previous slide"
        disabled={currentIndex === 0}
        onClick={() => scrollToIndex(currentIndex - 1)}
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
        className="carousel-button carousel-button--next"
        type="button"
        aria-label="Next slide"
        disabled={currentIndex === items.length - 1}
        onClick={() => scrollToIndex(currentIndex + 1)}
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

      <div className="carousel-indicators">
        {items.map((item, index) => {
          const isCurrent = index === currentIndex;
          return (
            <button
              key={`indicator-${getItemKey?.(item, index) ?? index}`}
              className={cx('carousel-indicator', isCurrent && 'current-slide')}
              type="button"
              aria-label={`Go to slide ${index + 1}`}
              aria-current={isCurrent ? 'true' : undefined}
              onClick={() => scrollToIndex(index)}
            />
          );
        })}
      </div>
    </div>
  );
}

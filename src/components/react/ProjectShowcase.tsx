import { useCallback, useEffect, useRef, useState } from 'react';
import HorizontalCarousel from './HorizontalCarousel';
import { cx, isExternalHref } from './utils';

export interface Project {
  title: string;
  summary: string;
  image: string;
  alt: string;
  href: string;
  kicker: string;
  width: number;
  height: number;
}

interface ProjectShowcaseProps {
  projects: Project[];
}

type PanelSide = 'left' | 'right';

export default function ProjectShowcase({ projects }: ProjectShowcaseProps) {
  const showcaseRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const closeTimeoutRef = useRef<number | null>(null);
  const closeCleanupTimeoutRef = useRef<number | null>(null);
  const swapTimeoutRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [panelIndex, setPanelIndex] = useState<number | null>(null);
  const [isPanelVisible, setIsPanelVisible] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [panelSide, setPanelSide] = useState<PanelSide>('right');
  const [panelTop, setPanelTop] = useState(0);

  const clearTimers = useCallback(() => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (closeCleanupTimeoutRef.current !== null) {
      window.clearTimeout(closeCleanupTimeoutRef.current);
      closeCleanupTimeoutRef.current = null;
    }
    if (swapTimeoutRef.current !== null) {
      window.clearTimeout(swapTimeoutRef.current);
      swapTimeoutRef.current = null;
    }
  }, []);

  const clearActiveCard = useCallback(() => {
    clearTimers();

    closeTimeoutRef.current = window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        const showcase = showcaseRef.current;
        if (showcase && showcase.contains(document.activeElement)) return;
        setIsSwapping(false);
        setIsPanelVisible(false);
        setActiveIndex(null);
      });
      closeTimeoutRef.current = null;

      closeCleanupTimeoutRef.current = window.setTimeout(() => {
        setPanelIndex(null);
        closeCleanupTimeoutRef.current = null;
      }, 260);
    }, 120);
  }, [clearTimers]);

  const getPanelTop = useCallback((index: number) => {
    const showcase = showcaseRef.current;
    const card = cardRefs.current[index];
    if (!showcase || !card) return null;

    const showcaseRect = showcase.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    return Math.round(cardRect.top - showcaseRect.top);
  }, []);

  const getPreferredSide = useCallback((index: number, clientX?: number): PanelSide => {
    const card = cardRefs.current[index];
    if (!card) return 'right';

    if (typeof clientX === 'number') {
      return clientX < window.innerWidth / 2 ? 'left' : 'right';
    }

    const rect = card.getBoundingClientRect();
    return rect.left + rect.width / 2 < window.innerWidth / 2 ? 'left' : 'right';
  }, []);

  const activateCard = useCallback(
    (index: number, clientX?: number) => {
      clearTimers();

      setActiveIndex(index);
      const nextPanelSide = getPreferredSide(index, clientX);
      const nextPanelTop = getPanelTop(index);

      if (panelIndex === null || !isPanelVisible) {
        setPanelIndex(index);
        setPanelSide(nextPanelSide);
        if (nextPanelTop !== null) {
          setPanelTop(nextPanelTop);
        }
        setIsPanelVisible(true);
        setIsSwapping(false);
        return;
      }

      setIsPanelVisible(true);

      if (panelIndex === index) {
        setPanelSide(nextPanelSide);
        if (nextPanelTop !== null) {
          setPanelTop(nextPanelTop);
        }
        setIsSwapping(false);
        return;
      }

      setIsSwapping(true);
      swapTimeoutRef.current = window.setTimeout(() => {
        setPanelIndex(index);
        setPanelSide(nextPanelSide);
        const swappedPanelTop = getPanelTop(index);
        if (swappedPanelTop !== null) {
          setPanelTop(swappedPanelTop);
        }
        window.requestAnimationFrame(() => {
          setIsSwapping(false);
        });
        swapTimeoutRef.current = null;
      }, 110);
    },
    [clearTimers, getPanelTop, getPreferredSide, isPanelVisible, panelIndex],
  );

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  useEffect(() => {
    if (panelIndex === null) return undefined;

    const handleResize = () => {
      const nextPanelTop = getPanelTop(panelIndex);
      if (nextPanelTop !== null) {
        setPanelTop(nextPanelTop);
      }
    };
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(handleResize);
    const showcase = showcaseRef.current;
    const card = cardRefs.current[panelIndex];
    if (showcase) resizeObserver.observe(showcase);
    if (card) resizeObserver.observe(card);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, [getPanelTop, panelIndex]);

  const activeProject = activeIndex === null ? null : projects[activeIndex];
  const panelProject = panelIndex === null ? null : projects[panelIndex];

  return (
    <div
      ref={showcaseRef}
      className="project-showcase"
      onPointerLeave={(event) => {
        if (event.pointerType !== 'touch') {
          clearActiveCard();
        }
      }}
    >
      <aside
        className={cx(
          'project-detail-panel',
          panelProject ? `is-${panelSide}` : 'is-right',
          !isPanelVisible && 'is-empty',
        )}
        aria-hidden={isPanelVisible && panelProject ? 'false' : 'true'}
        style={panelProject ? { top: `${panelTop}px` } : undefined}
      >
        <div className={cx('project-detail-content', isSwapping && 'is-swapping')}>
          <p className="project-detail-kicker mono">{panelProject?.kicker}</p>
          <h3 className="project-detail-title">{panelProject?.title}</h3>
          <p className="project-detail-summary">{panelProject?.summary}</p>
        </div>
      </aside>

      <ul className={cx('project-gallery', activeProject && 'has-active-card')} aria-label="Project gallery">
        {projects.map((project, index) => {
          const external = isExternalHref(project.href);
          const isActive = index === activeIndex;

          return (
            <li
              key={project.href}
              className="project-gallery-item"
            >
              <a
                ref={(node) => {
                  cardRefs.current[index] = node;
                }}
                className={cx('project-card', isActive && 'is-active')}
                href={project.href}
                target={external ? '_blank' : undefined}
                rel={external ? 'noopener noreferrer' : undefined}
                onPointerEnter={(event) => {
                  if (event.pointerType !== 'touch') {
                    activateCard(index, event.clientX);
                  }
                }}
                onPointerMove={(event) => {
                  if (event.pointerType !== 'touch') {
                    if (activeIndex === null || activeIndex !== index) {
                      activateCard(index, event.clientX);
                    }
                  }
                }}
                onFocus={() => activateCard(index)}
                onBlur={clearActiveCard}
              >
                <span className="project-card-image">
                  <img
                    src={`/${project.image}`}
                    alt={project.alt}
                    width={project.width}
                    height={project.height}
                    loading="lazy"
                    decoding="async"
                  />
                </span>
                <span className="sr-only">
                  {project.title}. {project.summary} {external ? 'Opens in a new tab.' : ''}
                </span>
                <span className="project-card-mobile-copy" aria-hidden="true">
                  <span className="project-card-mobile-kicker mono">{project.kicker}</span>
                  <span className="project-card-mobile-title">{project.title}</span>
                  <span className="project-card-mobile-summary">{project.summary}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>

      <HorizontalCarousel
        className="project-mobile-carousel"
        ariaLabel="Projects"
        items={projects}
        getItemKey={(project) => project.href}
        slideClassName="project-mobile-carousel-slide"
        renderItem={(project) => {
          const external = isExternalHref(project.href);

          return (
            <a
              className="project-mobile-card"
              href={project.href}
              target={external ? '_blank' : undefined}
              rel={external ? 'noopener noreferrer' : undefined}
            >
              <img
                src={`/${project.image}`}
                alt={project.alt}
                width={project.width}
                height={project.height}
                loading="lazy"
                decoding="async"
              />
              <span className="project-mobile-card-copy">
                <span className="project-mobile-card-kicker mono">{project.kicker}</span>
                <span className="project-mobile-card-title">{project.title}</span>
                <span className="project-mobile-card-summary">{project.summary}</span>
              </span>
            </a>
          );
        }}
      />
    </div>
  );
}

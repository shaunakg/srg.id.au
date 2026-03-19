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
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [panelSide, setPanelSide] = useState<PanelSide>('right');
  const [panelTop, setPanelTop] = useState(0);

  const clearActiveCard = useCallback(() => {
    window.requestAnimationFrame(() => {
      const showcase = showcaseRef.current;
      if (showcase && showcase.contains(document.activeElement)) return;
      setActiveIndex(null);
    });
  }, []);

  const updatePanelTop = useCallback((index: number) => {
    const showcase = showcaseRef.current;
    const card = cardRefs.current[index];
    if (!showcase || !card) return;

    const showcaseRect = showcase.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    setPanelTop(Math.round(cardRect.top - showcaseRect.top));
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
      setActiveIndex(index);
      setPanelSide(getPreferredSide(index, clientX));
      updatePanelTop(index);
    },
    [getPreferredSide, updatePanelTop],
  );

  useEffect(() => {
    if (activeIndex === null) return undefined;

    const handleResize = () => updatePanelTop(activeIndex);
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(handleResize);
    const showcase = showcaseRef.current;
    const card = cardRefs.current[activeIndex];
    if (showcase) resizeObserver.observe(showcase);
    if (card) resizeObserver.observe(card);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, [activeIndex, updatePanelTop]);

  const activeProject = activeIndex === null ? null : projects[activeIndex];

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
          activeProject ? `is-${panelSide}` : 'is-right',
          !activeProject && 'is-empty',
        )}
        aria-hidden={activeProject ? 'false' : 'true'}
        style={activeProject ? { top: `${panelTop}px` } : undefined}
      >
        <div className="project-detail-content">
          <p className="project-detail-kicker mono">{activeProject?.kicker}</p>
          <h3 className="project-detail-title">{activeProject?.title}</h3>
          <p className="project-detail-summary">{activeProject?.summary}</p>
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

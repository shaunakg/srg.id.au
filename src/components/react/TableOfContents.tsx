import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { TocHeading } from '../../lib/toc';
import { filterTocHeadings } from '../../lib/toc';
import { cx } from './utils';

interface TocNode extends TocHeading {
  children: TocNode[];
}

interface TableOfContentsProps {
  headings?: TocHeading[];
  postTitle: string;
  variant?: 'mobile' | 'desktop' | 'both';
}

function buildTree(source: TocHeading[]) {
  const root: TocNode[] = [];
  const stack: TocNode[] = [];

  for (const heading of source) {
    const node: TocNode = { ...heading, children: [] };
    while (stack.length && stack[stack.length - 1].depth >= node.depth) stack.pop();
    if (stack.length === 0) root.push(node);
    else stack[stack.length - 1].children.push(node);
    stack.push(node);
  }

  return root;
}

function isTrackableHeadingElement(element: HTMLElement) {
  if (element.classList.contains('sr-only')) return false;
  if (element.closest('.footnotes, .footnote-definition')) return false;

  const styles = window.getComputedStyle(element);
  return styles.display !== 'none' && styles.visibility !== 'hidden';
}

function TocItems({
  nodes,
  currentId,
  onNavigate,
}: {
  nodes: TocNode[];
  currentId: string;
  onNavigate?: () => void;
}) {
  return (
    <ul>
      {nodes.map((node) => (
        <li key={node.slug}>
          <a
            href={`#${node.slug}`}
            className={currentId === node.slug ? 'is-current' : undefined}
            aria-current={currentId === node.slug ? 'location' : undefined}
            onClick={onNavigate}
          >
            {node.text}
          </a>
          {node.children.length > 0 && <TocItems nodes={node.children} currentId={currentId} onNavigate={onNavigate} />}
        </li>
      ))}
    </ul>
  );
}

export default function TableOfContents({
  headings = [],
  postTitle,
  variant = 'both',
}: TableOfContentsProps) {
  const tocHeadings = useMemo(() => filterTocHeadings(headings), [headings]);
  const toc = useMemo(() => buildTree(tocHeadings), [tocHeadings]);
  const panelId = useId();
  const mobileShellRef = useRef<HTMLDivElement | null>(null);
  const mobileNavRef = useRef<HTMLElement | null>(null);
  const [currentId, setCurrentId] = useState(tocHeadings[0]?.slug ?? '');
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    setCurrentId((value) => (tocHeadings.some((heading) => heading.slug === value) ? value : (tocHeadings[0]?.slug ?? '')));
  }, [tocHeadings]);

  useEffect(() => {
    if (tocHeadings.length === 0) return undefined;

    const entries = tocHeadings
      .map((heading) => ({
        ...heading,
        element: document.getElementById(heading.slug),
      }))
      .filter(
        (entry): entry is TocHeading & { element: HTMLElement } =>
          entry.element instanceof HTMLElement && isTrackableHeadingElement(entry.element),
      );

    if (entries.length === 0) return undefined;

    const updateCurrent = () => {
      const triggerOffset = Math.max(96, window.innerHeight * 0.22);
      let current = entries[0];

      entries.forEach((entry) => {
        if (entry.element.getBoundingClientRect().top <= triggerOffset) {
          current = entry;
        }
      });

      setCurrentId((value) => (value === current.slug ? value : current.slug));
    };

    let ticking = false;
    const scheduleUpdate = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;
        updateCurrent();
      });
    };

    updateCurrent();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('hashchange', scheduleUpdate);
    window.addEventListener('load', scheduleUpdate);

    if (document.fonts?.ready) {
      document.fonts.ready.then(scheduleUpdate).catch(() => {});
    }

    return () => {
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('hashchange', scheduleUpdate);
      window.removeEventListener('load', scheduleUpdate);
    };
  }, [tocHeadings]);

  useEffect(() => {
    if (!isMobileOpen) return undefined;

    const handleClickOutside = (event: MouseEvent) => {
      const mobileShell = mobileShellRef.current;
      if (mobileShell && !mobileShell.contains(event.target as Node)) {
        setIsMobileOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileOpen]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 900) {
        setIsMobileOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isMobileOpen) return;
    const currentLink = mobileNavRef.current?.querySelector('a.is-current');
    if (currentLink instanceof HTMLElement) {
      currentLink.scrollIntoView({ block: 'nearest' });
    }
  }, [currentId, isMobileOpen]);

  if (toc.length === 0) return null;

  const currentHeading = tocHeadings.find((heading) => heading.slug === currentId) ?? tocHeadings[0];

  return (
    <>
      {(variant === 'mobile' || variant === 'both') && (
        <div ref={mobileShellRef} className={cx('mobile-toc-shell', isMobileOpen && 'is-open')}>
          <div className="mobile-toc-inner">
            <button
              className="mobile-toc-toggle"
              type="button"
              aria-expanded={isMobileOpen}
              aria-controls={panelId}
              onClick={() => setIsMobileOpen((value) => !value)}
            >
              <span className="mobile-toc-meta">
                <span className="mobile-toc-label">{isMobileOpen ? 'Table of contents' : 'In this post'}</span>
                <span className="mobile-toc-current-window" aria-live="polite" aria-atomic="true">
                  <span className="mobile-toc-current-text">{isMobileOpen ? postTitle : currentHeading?.text}</span>
                </span>
              </span>
              <span className="mobile-toc-icon" aria-hidden="true"></span>
            </button>
            <div id={panelId} className="mobile-toc-panel-shell" aria-hidden={!isMobileOpen}>
              <div className="mobile-toc-panel-inner">
                <nav ref={mobileNavRef} className="mobile-toc-panel-nav" aria-label="Table of contents">
                  <TocItems nodes={toc} currentId={currentId} onNavigate={() => setIsMobileOpen(false)} />
                </nav>
              </div>
            </div>
          </div>
        </div>
      )}

      {(variant === 'desktop' || variant === 'both') && (
        <aside className="toc-rail" aria-label="Table of contents">
          <nav className="toc">
            <h4>Table of contents</h4>
            <TocItems nodes={toc} currentId={currentId} />
          </nav>
        </aside>
      )}
    </>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import manifestData from '../../data/posts/brain/regions.json';
import type { BrainAtlasManifest, BrainAtlasScene } from './brain-atlas/scene';

interface LabelRefs {
  box?: HTMLDivElement | null;
  line?: SVGLineElement | null;
}

interface BrainAtlasIslandProps {
  title: string;
  authorLabel: string;
  pathLabel: string;
  dateLabel: string;
}

const manifest = manifestData as unknown as BrainAtlasManifest;

function toReactNodes(markup: string): ReactNode[] {
  if (!markup) {
    return [];
  }

  if (typeof DOMParser === 'undefined') {
    return [markup.replace(/<[^>]+>/g, '')];
  }

  const parser = new DOMParser();
  const documentFragment = parser.parseFromString(`<div>${markup}</div>`, 'text/html');
  const root = documentFragment.body.firstElementChild;

  if (!root) {
    return [markup];
  }

  const renderNode = (node: ChildNode, key: string): ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const element = node as HTMLElement;
    const children = Array.from(element.childNodes).map((child, index) => renderNode(child, `${key}-${index}`));
    const tagName = element.tagName.toLowerCase();

    if (tagName === 'a') {
      const href = element.getAttribute('href') ?? '#';
      const isExternal = /^[a-z][a-z\d+.-]*:/i.test(href);
      return (
        <a
          key={key}
          href={href}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noreferrer noopener' : undefined}
        >
          {children}
        </a>
      );
    }

    if (tagName === 'strong') {
      return <strong key={key}>{children}</strong>;
    }

    if (tagName === 'em') {
      return <em key={key}>{children}</em>;
    }

    if (tagName === 'code') {
      return <code key={key}>{children}</code>;
    }

    if (tagName === 'br') {
      return <br key={key} />;
    }

    return <span key={key}>{children}</span>;
  };

  return Array.from(root.childNodes).map((node, index) => renderNode(node, `description-${index}`));
}

export default function BrainAtlasIsland({ title, authorLabel, pathLabel, dateLabel }: BrainAtlasIslandProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<BrainAtlasScene | null>(null);
  const loadStartedRef = useRef(false);
  const labelRefs = useRef(new Map<string, LabelRefs>());
  const [isReady, setIsReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const update = () => {
      setPrefersReducedMotion(reducedMotion.matches);
    };

    update();
    reducedMotion.addEventListener('change', update);

    return () => {
      reducedMotion.removeEventListener('change', update);
    };
  }, []);

  const loadScene = useCallback(async () => {
    if (sceneRef.current || loadStartedRef.current || !canvasRef.current) {
      return;
    }

    loadStartedRef.current = true;
    setIsReady(false);
    setErrorMessage(null);

    let resizeObserver: ResizeObserver | null = null;

    try {
      const sceneModule = await import('./brain-atlas/scene');
      if (!canvasRef.current) {
        loadStartedRef.current = false;
        return;
      }

      const scene = new sceneModule.BrainAtlasScene({
        canvasHost: canvasRef.current,
        manifest,
        meshBaseUrl: '/posts/brain/meshes',
        reducedMotion: prefersReducedMotion,
        getLabelHandle: (id) => {
          const refs = labelRefs.current.get(id);
          if (!refs?.box || !refs?.line) {
            return null;
          }

          return {
            box: refs.box,
            line: refs.line,
          };
        },
        onLoadingProgress: () => {},
        onReady: () => {
          setIsReady(true);
        },
        onError: (message) => {
          setErrorMessage(message);
        },
      });

      sceneRef.current = scene;

      resizeObserver = new ResizeObserver(() => {
        scene.resize();
      });
      resizeObserver.observe(canvasRef.current);

      await scene.init();

      const handleVisibility = () => {
        scene.setActive(document.visibilityState !== 'hidden');
      };

      handleVisibility();
      document.addEventListener('visibilitychange', handleVisibility);

      if (rootRef.current) {
        const observer = new IntersectionObserver(
          ([entry]) => {
            scene.setActive(entry.isIntersecting && document.visibilityState !== 'hidden');
          },
          { threshold: 0.05 },
        );
        observer.observe(rootRef.current);

        scene.onDispose(() => {
          observer.disconnect();
          document.removeEventListener('visibilitychange', handleVisibility);
          resizeObserver?.disconnect();
        });
      } else {
        scene.onDispose(() => {
          document.removeEventListener('visibilitychange', handleVisibility);
          resizeObserver?.disconnect();
        });
      }
    } catch (error) {
      resizeObserver?.disconnect();
      sceneRef.current?.dispose();
      sceneRef.current = null;
      loadStartedRef.current = false;
      setIsReady(false);
      const message = error instanceof Error ? error.message : 'Unable to initialise the brain atlas.';
      setErrorMessage(message);
    }
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    let timeoutId: number | null = null;
    let idleId: number | null = null;

    const requestIdle = window.requestIdleCallback?.bind(window);
    const cancelIdle = window.cancelIdleCallback?.bind(window);
    const start = () => {
      void loadScene();
    };

    if (requestIdle) {
      idleId = requestIdle(start, { timeout: 1800 });
    } else {
      timeoutId = window.setTimeout(start, 500);
    }

    return () => {
      if (idleId !== null && cancelIdle) {
        cancelIdle(idleId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      sceneRef.current?.dispose();
      sceneRef.current = null;
      loadStartedRef.current = false;
    };
  }, [loadScene]);

  const descriptionNodes = useMemo(() => {
    const map = new Map<string, ReactNode[]>();
    for (const region of manifest.meshes) {
      map.set(region.id, toReactNodes(region.description ?? ''));
    }
    return map;
  }, []);

  return (
    <div
      ref={rootRef}
      className={`brain-atlas${isReady ? ' is-ready' : ''}`}
      aria-label="Interactive 3D model of segmented brain structures reconstructed from an MRI scan."
    >
      <div className={`brain-atlas__backdrop${isReady ? ' is-muted' : ''}`} aria-hidden="true">
        <div className="brain-atlas__meta brain-atlas__meta--top-left">{authorLabel}</div>
        <div className="brain-atlas__meta brain-atlas__meta--top-right">{pathLabel}</div>
        <div className="brain-atlas__meta brain-atlas__meta--bottom-left">{dateLabel}</div>
        <div className="brain-atlas__title-wrap">
          <div className="brain-atlas__title">{title}</div>
        </div>
      </div>

      <div
        ref={canvasRef}
        className="brain-atlas__stage"
        onPointerMove={(event) => {
          sceneRef.current?.setPointerFromClient(event.clientX, event.clientY);
        }}
        onPointerLeave={() => {
          sceneRef.current?.clearPointer();
        }}
      />

      <div className="brain-atlas__labels" aria-hidden="true">
        <svg className="brain-atlas__lines" preserveAspectRatio="none">
          {manifest.meshes.map((region) => (
            <line
              key={`${region.id}-line`}
              ref={(element) => {
                const current = labelRefs.current.get(region.id) ?? {};
                current.line = element;
                labelRefs.current.set(region.id, current);
              }}
              className="brain-atlas__line"
            />
          ))}
        </svg>
        <div className="brain-atlas__label-list">
          {manifest.meshes.map((region) => (
            <div
              key={region.id}
              ref={(element) => {
                const current = labelRefs.current.get(region.id) ?? {};
                current.box = element;
                labelRefs.current.set(region.id, current);
              }}
              className="brain-atlas__label"
              onPointerEnter={() => {
                sceneRef.current?.setLabelHover(region.id);
              }}
              onPointerLeave={() => {
                sceneRef.current?.setLabelHover(null);
              }}
            >
              <div className="brain-atlas__label-title">{region.name}</div>
              {region.description && (
                <div className="brain-atlas__label-description">{descriptionNodes.get(region.id)}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {errorMessage && <div className="brain-atlas__fallback">The 3D atlas could not be loaded: {errorMessage}</div>}
    </div>
  );
}

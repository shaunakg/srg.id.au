import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import manifestData from '../../data/posts/brain/regions.json';
import type { BrainAtlasLoadingProgress, BrainAtlasManifest, BrainAtlasScene } from './brain-atlas/scene';

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
const totalMeshes = manifest.meshes.length;

type InlineMarkupTag = 'a' | 'strong' | 'em' | 'code' | 'br';

type InlineMarkupNode =
  | {
      type: 'text';
      value: string;
    }
  | {
      type: 'element';
      tag: InlineMarkupTag;
      attributes: Record<string, string>;
      children: InlineMarkupNode[];
    };

type InlineMarkupParent = {
  tag?: Exclude<InlineMarkupTag, 'br'>;
  children: InlineMarkupNode[];
};

type InlineMarkupContainerNode = Extract<InlineMarkupNode, { type: 'element' }> & {
  tag: Exclude<InlineMarkupTag, 'br'>;
};

const inlineTagPattern = /<(\/)?(a|strong|em|code|br)\b([^>]*)>/gi;
const inlineAttributePattern = /([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>/]+)))?/g;
const htmlEntities: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|#39);/g, (match) => htmlEntities[match] ?? match);
}

function parseInlineAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};

  for (const match of source.matchAll(inlineAttributePattern)) {
    const [, name, doubleQuotedValue, singleQuotedValue, bareValue] = match;

    if (!name) {
      continue;
    }

    const value = doubleQuotedValue ?? singleQuotedValue ?? bareValue;
    attributes[name.toLowerCase()] = value ? decodeHtmlEntities(value) : '';
  }

  return attributes;
}

function parseInlineMarkup(markup: string): InlineMarkupNode[] {
  if (!markup) {
    return [];
  }

  const root: InlineMarkupParent = {
    children: [],
  };
  const stack: InlineMarkupParent[] = [root];
  let lastIndex = 0;

  const appendText = (value: string) => {
    if (!value) {
      return;
    }

    stack[stack.length - 1]?.children.push({
      type: 'text',
      value: decodeHtmlEntities(value),
    });
  };

  for (const match of markup.matchAll(inlineTagPattern)) {
    const [fullMatch, closingSlash, rawTag, attributeSource] = match;
    const matchIndex = match.index ?? 0;

    appendText(markup.slice(lastIndex, matchIndex));
    lastIndex = matchIndex + fullMatch.length;

    const tag = rawTag.toLowerCase() as InlineMarkupTag;
    const current = stack[stack.length - 1];

    if (!current) {
      continue;
    }

    if (closingSlash) {
      if (stack.length > 1 && current.tag === tag) {
        stack.pop();
      }
      continue;
    }

    if (tag === 'br') {
      current.children.push({
        type: 'element',
        tag,
        attributes: {},
        children: [],
      });
      continue;
    }

    const elementNode: InlineMarkupContainerNode = {
      type: 'element',
      tag,
      attributes: parseInlineAttributes(attributeSource),
      children: [],
    };

    current.children.push(elementNode);
    stack.push(elementNode);
  }

  appendText(markup.slice(lastIndex));

  return root.children;
}

function mergeRelValues(existingRel: string | undefined, additions: string[]): string | undefined {
  const tokens = new Set((existingRel ?? '').split(/\s+/).filter(Boolean));

  for (const token of additions) {
    tokens.add(token);
  }

  return tokens.size > 0 ? Array.from(tokens).join(' ') : undefined;
}

function renderInlineMarkup(nodes: InlineMarkupNode[], keyPrefix = 'description'): ReactNode[] {
  const renderNode = (node: InlineMarkupNode, key: string): ReactNode => {
    if (node.type === 'text') {
      return node.value;
    }

    const children = node.children.map((child, index) => renderNode(child, `${key}-${index}`));

    if (node.tag === 'a') {
      const href = node.attributes.href ?? '#';
      const isExternal = /^[a-z][a-z\d+.-]*:/i.test(href);
      const target = node.attributes.target ?? (isExternal ? '_blank' : undefined);
      const rel = target === '_blank' ? mergeRelValues(node.attributes.rel, ['noreferrer', 'noopener']) : node.attributes.rel;

      return (
        <a key={key} href={href} target={target} rel={rel}>
          {children}
        </a>
      );
    }

    if (node.tag === 'strong') {
      return <strong key={key}>{children}</strong>;
    }

    if (node.tag === 'em') {
      return <em key={key}>{children}</em>;
    }

    if (node.tag === 'code') {
      return <code key={key}>{children}</code>;
    }

    return <br key={key} />;
  };

  return nodes.map((node, index) => renderNode(node, `${keyPrefix}-${index}`));
}

function toReactNodes(markup: string): ReactNode[] {
  return renderInlineMarkup(parseInlineMarkup(markup));
}

export default function BrainAtlasIsland({ title, authorLabel, pathLabel, dateLabel }: BrainAtlasIslandProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<BrainAtlasScene | null>(null);
  const loadStartedRef = useRef(false);
  const labelRefs = useRef(new Map<string, LabelRefs>());
  const [isReady, setIsReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<BrainAtlasLoadingProgress>({
    loaded: 0,
    total: totalMeshes,
    percent: 0,
  });
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
    setLoadingProgress({
      loaded: 0,
      total: totalMeshes,
      percent: 0,
    });

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
        onLoadingProgress: (progress) => {
          setLoadingProgress(progress);
        },
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

  const isLoading = !isReady && !errorMessage;
  const progressScale = Math.max(0, Math.min(loadingProgress.percent / 100, 1));
  const safeLoadedMeshes = Math.max(0, Math.min(loadingProgress.loaded, loadingProgress.total));

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

      <div
        className={`brain-atlas__meta brain-atlas__meta--bottom-right brain-atlas__loading${isLoading ? '' : ' is-hidden'}`}
        role="progressbar"
        aria-label="Loading brain atlas meshes"
        aria-hidden={isLoading ? 'false' : 'true'}
        aria-valuemin={0}
        aria-valuemax={loadingProgress.total}
        aria-valuenow={safeLoadedMeshes}
        aria-valuetext={`${safeLoadedMeshes} of ${loadingProgress.total} meshes loaded`}
      >
        <div className="brain-atlas__loading-row">
          <span className="brain-atlas__loading-label">Loading meshes</span>
          <span className="brain-atlas__loading-count">{safeLoadedMeshes}/{loadingProgress.total}</span>
        </div>
        <div className="brain-atlas__loading-track" aria-hidden="true">
          <span
            className="brain-atlas__loading-fill"
            style={{ transform: `scaleX(${progressScale})` }}
          />
        </div>
      </div>

      {errorMessage && <div className="brain-atlas__fallback">The 3D atlas could not be loaded: {errorMessage}</div>}
    </div>
  );
}

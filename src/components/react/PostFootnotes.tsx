import { useEffect, useRef, useState } from 'react';
import { cx } from './utils';

interface NoteRecord {
  id: string;
  number: string;
  numberWord: string;
  content: string;
}

interface PostFootnotesProps {
  layoutSelector?: string;
  articleSelector?: string;
}

function numberToWord(value: string) {
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed) && parsed >= 0 && parsed < words.length) {
    return words[parsed];
  }

  return value;
}

export default function PostFootnotes({
  layoutSelector = '.post-layout',
  articleSelector = '.post-article',
}: PostFootnotesProps) {
  const railRef = useRef<HTMLElement | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const layoutRef = useRef<HTMLElement | null>(null);
  const noteRefs = useRef(new Map<string, HTMLElement>());
  const referenceMapRef = useRef(new Map<string, HTMLAnchorElement[]>());
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [positions, setPositions] = useState<Record<string, number>>({});
  const [modalNoteId, setModalNoteId] = useState<string | null>(null);

  useEffect(() => {
    const layout = document.querySelector(layoutSelector);
    const article = document.querySelector(articleSelector);
    if (!(layout instanceof HTMLElement) || !(article instanceof HTMLElement)) return undefined;

    layoutRef.current = layout;
    articleRef.current = article;

    let references = Array.from(
      article.querySelectorAll<HTMLAnchorElement>("sup.footnote-reference a[href^='#'], sup a[data-footnote-ref][href^='#']"),
    );

    if (references.length === 0) {
      references = Array.from(article.querySelectorAll<HTMLAnchorElement>("a.footnote-reference[href^='#'], a[data-footnote-ref][href^='#']"));
    }

    if (references.length === 0) {
      setNotes([]);
      return undefined;
    }

    const footnoteMap = new Map<string, string>();
    const definitionNodes = Array.from(article.querySelectorAll<HTMLElement>('.footnote-definition[id]'));

    if (definitionNodes.length > 0) {
      definitionNodes.forEach((item) => {
        const clone = item.cloneNode(true) as HTMLElement;
        clone.querySelector('.footnote-definition-label')?.remove();
        footnoteMap.set(item.id, clone.innerHTML.trim());
      });
    } else {
      const footnotesSection = article.querySelector<HTMLElement>('.footnotes, section.footnotes, div.footnotes');
      if (!footnotesSection) return undefined;

      Array.from(footnotesSection.querySelectorAll<HTMLElement>('li[id]')).forEach((item) => {
        const clone = item.cloneNode(true) as HTMLElement;
        clone.querySelector('a.footnote-backref, a[data-footnote-backref], a.data-footnote-backref')?.remove();
        footnoteMap.set(item.id, clone.innerHTML.trim());
      });
    }

    const nextReferenceMap = new Map<string, HTMLAnchorElement[]>();
    const nextNotes: NoteRecord[] = [];

    references.forEach((reference) => {
      const href = reference.getAttribute('href') ?? '';
      const id = href.startsWith('#') ? href.slice(1) : href;
      const content = footnoteMap.get(id);
      if (!content) return;

      nextReferenceMap.set(id, [...(nextReferenceMap.get(id) ?? []), reference]);

      if (nextNotes.some((note) => note.id === id)) return;

      const number = reference.textContent?.trim() ?? '';
      nextNotes.push({
        id,
        number,
        numberWord: numberToWord(number),
        content,
      });
    });

    referenceMapRef.current = nextReferenceMap;
    setNotes(nextNotes);

    if (nextNotes.length > 0) {
      document.body.classList.add('footnotes-enhanced');
    }

    return () => {
      document.body.classList.remove('footnotes-enhanced');
      referenceMapRef.current.forEach((referencesForId) => {
        referencesForId.forEach((reference) => reference.classList.remove('is-active'));
      });
      referenceMapRef.current.clear();
      noteRefs.current.clear();
    };
  }, [articleSelector, layoutSelector]);

  useEffect(() => {
    referenceMapRef.current.forEach((referencesForId, id) => {
      referencesForId.forEach((reference) => {
        reference.classList.toggle('is-active', id === activeId);
      });
    });
  }, [activeId]);

  useEffect(() => {
    if (notes.length === 0) return undefined;

    const isMobile = () => window.matchMedia('(max-width: 900px)').matches;
    const cleanups: Array<() => void> = [];

    notes.forEach((note) => {
      const referencesForId = referenceMapRef.current.get(note.id) ?? [];
      referencesForId.forEach((reference) => {
        const handleMouseEnter = () => {
          if (!isMobile()) setActiveId(note.id);
        };
        const handleMouseLeave = () => {
          if (!isMobile()) setActiveId((current) => (current === note.id ? null : current));
        };
        const handleClick = (event: MouseEvent) => {
          event.preventDefault();
          if (isMobile()) {
            setModalNoteId(note.id);
            return;
          }
          setActiveId(note.id);
        };

        reference.addEventListener('mouseenter', handleMouseEnter);
        reference.addEventListener('mouseleave', handleMouseLeave);
        reference.addEventListener('click', handleClick);

        cleanups.push(() => {
          reference.removeEventListener('mouseenter', handleMouseEnter);
          reference.removeEventListener('mouseleave', handleMouseLeave);
          reference.removeEventListener('click', handleClick);
        });
      });
    });

    const handleHash = () => {
      const hash = window.location.hash;
      if (!hash.startsWith('#fn')) return;

      const id = hash.slice(1);
      const matchingNote = notes.find((note) => note.id === id);
      const matchingReference = referenceMapRef.current.get(id)?.[0];
      if (!matchingNote || !matchingReference) return;

      if (isMobile()) {
        setModalNoteId(id);
        return;
      }

      matchingReference.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setActiveId(id);
    };

    window.addEventListener('hashchange', handleHash);
    handleHash();

    return () => {
      window.removeEventListener('hashchange', handleHash);
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [notes]);

  useEffect(() => {
    if (notes.length === 0) return undefined;

    let frameId = 0;
    const schedulePosition = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const layout = layoutRef.current;
        if (!layout) return;

        const nextPositions: Record<string, number> = {};
        const layoutRect = layout.getBoundingClientRect();
        let nextTop = 0;

        notes.forEach((note) => {
          const reference = referenceMapRef.current.get(note.id)?.[0];
          const noteElement = noteRefs.current.get(note.id);
          if (!reference || !noteElement) return;

          const referenceRect = reference.getBoundingClientRect();
          const anchorTop = referenceRect.top - layoutRect.top + referenceRect.height * 0.5;
          let top = anchorTop - noteElement.offsetHeight * 0.5;
          if (top < nextTop) top = nextTop;

          nextPositions[note.id] = top;
          nextTop = top + noteElement.offsetHeight + 14;
        });

        setPositions(nextPositions);
      });
    };

    schedulePosition();
    window.addEventListener('resize', schedulePosition);
    window.addEventListener('load', schedulePosition);

    const resizeObserver = new ResizeObserver(schedulePosition);
    const rail = railRef.current;
    const article = articleRef.current;
    if (rail) resizeObserver.observe(rail);
    if (article) resizeObserver.observe(article);
    notes.forEach((note) => {
      const noteElement = noteRefs.current.get(note.id);
      if (noteElement) resizeObserver.observe(noteElement);
    });

    if (document.fonts?.ready) {
      document.fonts.ready.then(schedulePosition).catch(() => {});
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', schedulePosition);
      window.removeEventListener('load', schedulePosition);
      resizeObserver.disconnect();
    };
  }, [notes]);

  useEffect(() => {
    document.body.classList.toggle('footnote-modal-open', modalNoteId !== null);
    return () => document.body.classList.remove('footnote-modal-open');
  }, [modalNoteId]);

  useEffect(() => {
    if (!modalNoteId) return undefined;

    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModalNoteId(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [modalNoteId]);

  const modalNote = modalNoteId ? notes.find((note) => note.id === modalNoteId) ?? null : null;

  return (
    <>
      <aside ref={railRef} className="footnote-rail right" aria-hidden={notes.length === 0 ? 'true' : 'false'}>
        {notes.map((note) => (
          <aside
            key={note.id}
            ref={(node) => {
              if (node) noteRefs.current.set(note.id, node);
              else noteRefs.current.delete(note.id);
            }}
            className={cx('sidenote', activeId === note.id && 'is-active')}
            style={positions[note.id] === undefined ? undefined : { top: `${positions[note.id]}px` }}
            onMouseEnter={() => setActiveId(note.id)}
            onMouseLeave={() => setActiveId((current) => (current === note.id ? null : current))}
            onPointerEnter={() => setActiveId(note.id)}
            onPointerLeave={() => setActiveId((current) => (current === note.id ? null : current))}
          >
            <div className="sidenote-inner">
              <div className="sidenote-header">
                Note <span className="sidenote-number">{note.numberWord}</span>
              </div>
              <div className="sidenote-body" dangerouslySetInnerHTML={{ __html: note.content }} />
            </div>
          </aside>
        ))}
      </aside>

      <div className={cx('footnote-modal', modalNote && 'is-open')} role="dialog" aria-modal="true" aria-hidden={modalNote ? 'false' : 'true'}>
        <button className="footnote-modal-backdrop" type="button" aria-label="Close footnote" onClick={() => setModalNoteId(null)}></button>
        <div className="footnote-modal-sheet" role="document">
          <div className="footnote-modal-grab" aria-hidden="true"></div>
          <div className="footnote-modal-header">
            <span className="footnote-modal-title">
              Footnote <span>{modalNote?.number ?? ''}</span>
            </span>
            <button ref={closeButtonRef} className="footnote-modal-close" type="button" aria-label="Close footnote" onClick={() => setModalNoteId(null)}>
              ×
            </button>
          </div>
          <div className="footnote-modal-body" dangerouslySetInnerHTML={{ __html: modalNote?.content ?? '' }} />
        </div>
      </div>
    </>
  );
}

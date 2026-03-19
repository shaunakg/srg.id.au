import { useEffect, useRef } from 'react';

interface UtterancesCommentsProps {
  repo: string;
}

export default function UtterancesComments({ repo }: UtterancesCommentsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    container.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://utteranc.es/client.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.setAttribute('repo', repo);
    script.setAttribute('issue-term', 'pathname');
    script.setAttribute('label', 'comments');
    script.setAttribute('theme', 'github-light');
    container.appendChild(script);

    return () => {
      container.innerHTML = '';
    };
  }, [repo]);

  return <div ref={containerRef}></div>;
}

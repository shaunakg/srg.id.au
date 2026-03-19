import { useEffect, useRef, useState } from 'react';
import CenteredCarousel from '../react/CenteredCarousel';

export interface MediaCarouselItem {
  src: string;
  alt?: string;
  caption?: string;
  type?: 'image' | 'video';
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  videoType?: string;
}

interface MediaCarouselProps {
  items: MediaCarouselItem[];
  ariaLabel?: string;
}

function MediaCarouselFigure({ item }: { item: MediaCarouselItem }) {
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);
  const [captionWidth, setCaptionWidth] = useState<number | null>(null);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return undefined;

    const updateCaptionWidth = () => {
      const nextWidth = Math.round(media.getBoundingClientRect().width);
      setCaptionWidth(nextWidth > 0 ? nextWidth : null);
    };

    updateCaptionWidth();

    const resizeObserver = new ResizeObserver(updateCaptionWidth);
    resizeObserver.observe(media);

    media.addEventListener('load', updateCaptionWidth);
    media.addEventListener('loadedmetadata', updateCaptionWidth);
    window.addEventListener('resize', updateCaptionWidth);

    return () => {
      resizeObserver.disconnect();
      media.removeEventListener('load', updateCaptionWidth);
      media.removeEventListener('loadedmetadata', updateCaptionWidth);
      window.removeEventListener('resize', updateCaptionWidth);
    };
  }, []);

  return (
    <figure className="media-carousel-item">
      {item.type === 'video' ? (
        <video
          ref={(node) => {
            mediaRef.current = node;
          }}
          controls
          autoPlay={item.autoplay}
          loop={item.loop}
          muted={item.muted}
          playsInline
          preload="metadata"
        >
          <source src={item.src} type={item.videoType ?? 'video/mp4'} />
          Your browser does not support the video tag.
        </video>
      ) : (
        <img
          ref={(node) => {
            mediaRef.current = node;
          }}
          src={item.src}
          alt={item.alt ?? ''}
          loading="lazy"
          draggable="false"
        />
      )}

      {item.caption ? (
        <figcaption
          className="media-carousel-caption"
          style={captionWidth ? { width: `${captionWidth}px`, maxWidth: '100%' } : undefined}
        >
          <p>{item.caption}</p>
        </figcaption>
      ) : null}
    </figure>
  );
}

export default function MediaCarousel({ items, ariaLabel = 'Image carousel' }: MediaCarouselProps) {
  return (
    <CenteredCarousel
      ariaLabel={ariaLabel}
      items={items}
      getItemKey={(item, index) => `${item.src}-${index}`}
      renderItem={(item) => <MediaCarouselFigure item={item} />}
    />
  );
}

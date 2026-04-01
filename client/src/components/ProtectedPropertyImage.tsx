import { useEffect, useMemo, useRef, useState, type ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import {
  PROPERTY_IMAGE_REQUEST_HEADER,
  toPropertyImageMediaEndpoint,
} from "@/lib/property-image";

type ProtectedPropertyImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src?: string | null;
  fallbackSrc?: string;
};

const INLINE_FALLBACK_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 420'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%23eef2f7'/%3E%3Cstop offset='100%25' stop-color='%23dce3eb'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='640' height='420' fill='url(%23g)'/%3E%3Ccircle cx='220' cy='170' r='42' fill='%2397a6b8'/%3E%3Cpath d='M90 320l120-110 75 65 90-90 175 135H90z' fill='%23aab6c4'/%3E%3C/svg%3E";
const DEFAULT_FALLBACK_SRC = INLINE_FALLBACK_SVG;

export default function ProtectedPropertyImage({
  src,
  fallbackSrc = DEFAULT_FALLBACK_SRC,
  className,
  style,
  onContextMenu,
  onDragStart,
  ...props
}: ProtectedPropertyImageProps) {
  const safeFallback = fallbackSrc || INLINE_FALLBACK_SVG;
  const normalizedSource = src?.trim() || safeFallback;
  const mediaEndpoint = useMemo(
    () => toPropertyImageMediaEndpoint(normalizedSource),
    [normalizedSource]
  );
  const [renderedSrc, setRenderedSrc] = useState<string>(normalizedSource);
  const activeBlobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!mediaEndpoint) {
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }
      setRenderedSrc(normalizedSource);
      return;
    }

    const abortController = new AbortController();

    (async () => {
      try {
        const response = await fetch(mediaEndpoint, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: {
            [PROPERTY_IMAGE_REQUEST_HEADER]: "1",
          },
          signal: abortController.signal,
        });

        if (!response.ok) {
          if (!activeBlobUrlRef.current) {
            setRenderedSrc(safeFallback);
          }
          return;
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        if (!abortController.signal.aborted) {
          if (activeBlobUrlRef.current && activeBlobUrlRef.current !== objectUrl) {
            URL.revokeObjectURL(activeBlobUrlRef.current);
          }
          activeBlobUrlRef.current = objectUrl;
          setRenderedSrc(objectUrl);
          return;
        }

        URL.revokeObjectURL(objectUrl);
      } catch {
        if (!activeBlobUrlRef.current) {
          setRenderedSrc(safeFallback);
        }
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [mediaEndpoint, normalizedSource, safeFallback]);

  useEffect(() => {
    return () => {
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }
    };
  }, []);

  const finalSrc = renderedSrc || safeFallback;

  return (
    <img
      {...props}
      src={finalSrc}
      className={cn(className)}
      draggable={false}
      style={{
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
        pointerEvents: "none",
        ...style,
      }}
      onError={event => {
        if ((event.currentTarget.getAttribute("src") || "") !== INLINE_FALLBACK_SVG) {
          event.currentTarget.setAttribute("src", INLINE_FALLBACK_SVG);
        }
      }}
      onContextMenu={event => {
        event.preventDefault();
        onContextMenu?.(event);
      }}
      onDragStart={event => {
        event.preventDefault();
        onDragStart?.(event);
      }}
    />
  );
}

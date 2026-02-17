import React from "react";

type BannerProps = {
  desktop: string;
  mobile: string;
  alt: string;
};

const styles = {
  container: {
    width: '100%',
    height: 'min(70vh, 720px)',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  },
};


export function Banner({ desktop, mobile, alt }: BannerProps ) {
  return (
    <picture className="absolute inset-0 z-0">
      <source media="(max-width: 600px)" srcSet={mobile} />
      <source media="(min-width: 769px)" srcSet={desktop} />
      <img
        src={desktop}
        alt={alt}
        className="w-full h-full object-cover object-[center_90%]"
      />
    </picture>
  );
}


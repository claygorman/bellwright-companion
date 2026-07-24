'use client';
// Wiki/asset icon for an item/building class, with a line-icon fallback when the
// image doesn't exist. RELIABILITY: show the fallback by default and only swap
// to the <img> once it SUCCESSFULLY loads (onLoad). This never leaves a broken-
// image glyph — the old "render img, catch onError" approach failed when a
// missing icon returned a redirect/HTML (e.g. behind an auth proxy) instead of a
// clean 404, so onError never fired. Icons live in web/public/icons/bw/.
import { useState, type ReactNode } from 'react';

export const ItemImg = ({ cls, size, radius = 4, fallback }: {
  cls: string | null | undefined;
  size: number;
  radius?: number;
  fallback: ReactNode;
}) => {
  const [loaded, setLoaded] = useState(false);
  if (!cls) return <>{fallback}</>;
  return (
    <>
      {!loaded && fallback}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/icons/bw/${cls}.png`} alt="" width={size} height={size}
        onLoad={() => setLoaded(true)}
        style={{
          width: size, height: size, objectFit: 'contain', borderRadius: radius,
          display: loaded ? 'block' : 'none',
        }} />
    </>
  );
};

'use client';
// Wiki-fetched icon for an item/building class, with a line-icon fallback
// when the image doesn't exist (icons are fetched via web/scripts/fetch-icons.ts).
import { useState, type ReactNode } from 'react';

export const ItemImg = ({ cls, size, radius = 4, fallback }: {
  cls: string | null | undefined;
  size: number;
  radius?: number;
  fallback: ReactNode;
}) => {
  const [failed, setFailed] = useState(false);
  if (!cls || failed) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/icons/bw/${cls}.png`} alt="" width={size} height={size}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, objectFit: 'contain', borderRadius: radius, display: 'block' }} />
  );
};

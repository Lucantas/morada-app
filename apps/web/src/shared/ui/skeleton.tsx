import type { CSSProperties, ReactNode } from 'react';

import { SurfaceCard } from './primitives';

type SkeletonProps = {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  circle?: boolean;
  style?: CSSProperties;
};

export function Skeleton({
  width = '100%',
  height = 14,
  radius,
  circle = false,
  style,
}: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className="skeleton"
      style={{
        width,
        height: circle ? width : height,
        borderRadius: circle ? '50%' : (radius ?? 'var(--r-sm)'),
        ...style,
      }}
    />
  );
}

export function SkeletonScreen({ children }: { children: ReactNode }) {
  return (
    <div role="status" aria-busy="true">
      <span className="visually-hidden">Carregando…</span>
      {children}
    </div>
  );
}

export function SkeletonRows({ count, avatar = true }: { count: number; avatar?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: count }).map((_, index) => (
        <SurfaceCard
          key={index}
          style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 14px' }}
        >
          {avatar && <Skeleton circle width={40} style={{ flex: 'none' }} />}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <Skeleton width="55%" height={13} style={{ display: 'block' }} />
            <Skeleton width="38%" height={11} style={{ display: 'block' }} />
          </div>
          <Skeleton width={54} height={22} radius={999} style={{ flex: 'none' }} />
        </SurfaceCard>
      ))}
    </div>
  );
}

export function SkeletonField() {
  return (
    <div style={{ marginBottom: 16 }}>
      <Skeleton width={110} height={12} style={{ display: 'block', marginBottom: 7 }} />
      <Skeleton height={50} radius="var(--r-md)" style={{ display: 'block' }} />
    </div>
  );
}

export function SkeletonButton() {
  return <Skeleton height={52} radius="var(--r-md)" style={{ display: 'block' }} />;
}

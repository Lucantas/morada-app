import { Skeleton, SkeletonButton, SkeletonScreen } from '@/shared/ui/skeleton';

export function PaySkeleton() {
  return (
    <SkeletonScreen>
      <div style={{ paddingTop: 2 }}>
        <Skeleton
          height={110}
          radius="var(--r-md)"
          style={{ display: 'block', marginBottom: 18 }}
        />
        <Skeleton width={150} height={12} style={{ display: 'block', marginBottom: 9 }} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <Skeleton height={44} radius="var(--r-sm)" style={{ display: 'block', flex: 1 }} />
          <Skeleton height={44} radius="var(--r-sm)" style={{ display: 'block', flex: 1 }} />
        </div>
        <SkeletonButton />
      </div>
    </SkeletonScreen>
  );
}

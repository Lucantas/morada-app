import { Skeleton, SkeletonRows, SkeletonScreen } from '@/shared/ui/skeleton';

export function ResidentsSkeleton() {
  return (
    <SkeletonScreen>
      <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
        <Skeleton height={64} radius="var(--r-md)" style={{ display: 'block', flex: 1 }} />
        <Skeleton height={64} radius="var(--r-md)" style={{ display: 'block', flex: 1 }} />
        <Skeleton height={64} radius="var(--r-md)" style={{ display: 'block', flex: 1 }} />
      </div>
      <Skeleton width={180} height={13} style={{ display: 'block', margin: '24px 2px 12px' }} />
      <SkeletonRows count={5} />
    </SkeletonScreen>
  );
}

import { Skeleton, SkeletonScreen } from '@/shared/ui/skeleton';

export function ResidentHomeSkeleton() {
  return (
    <SkeletonScreen>
      <Skeleton width={110} height={13} style={{ display: 'block', margin: '20px 2px 11px' }} />
      <Skeleton height={190} radius="var(--r-lg)" style={{ display: 'block' }} />
      <Skeleton width={90} height={13} style={{ display: 'block', margin: '20px 2px 11px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Skeleton height={96} radius="var(--r-md)" style={{ display: 'block' }} />
        <Skeleton height={96} radius="var(--r-md)" style={{ display: 'block' }} />
      </div>
    </SkeletonScreen>
  );
}

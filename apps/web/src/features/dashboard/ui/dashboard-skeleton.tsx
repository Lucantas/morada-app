import { Skeleton, SkeletonRows, SkeletonScreen } from '@/shared/ui/skeleton';

export function DashboardSkeleton() {
  return (
    <SkeletonScreen>
      <Skeleton height={150} radius="var(--r-lg)" style={{ display: 'block' }} />
      <Skeleton height={72} radius="var(--r-md)" style={{ display: 'block', marginTop: 12 }} />
      <Skeleton width={160} height={13} style={{ display: 'block', margin: '24px 2px 12px' }} />
      <SkeletonRows count={3} />
      <Skeleton width={160} height={13} style={{ display: 'block', margin: '24px 2px 12px' }} />
      <SkeletonRows count={2} />
    </SkeletonScreen>
  );
}

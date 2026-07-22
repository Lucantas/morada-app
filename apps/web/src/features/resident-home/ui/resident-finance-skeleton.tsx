import { Skeleton, SkeletonRows, SkeletonScreen } from '@/shared/ui/skeleton';

export function ResidentFinanceSkeleton() {
  return (
    <SkeletonScreen>
      <Skeleton height={170} radius="var(--r-lg)" style={{ display: 'block' }} />
      <Skeleton width={160} height={13} style={{ display: 'block', margin: '24px 2px 12px' }} />
      <SkeletonRows count={3} />
    </SkeletonScreen>
  );
}

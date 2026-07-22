import { Skeleton, SkeletonRows, SkeletonScreen } from '@/shared/ui/skeleton';

export function AccountsSkeleton() {
  return (
    <SkeletonScreen>
      <Skeleton height={52} radius="var(--r-md)" style={{ display: 'block', marginTop: 4 }} />
      <Skeleton height={46} radius="var(--r-md)" style={{ display: 'block', marginTop: 14 }} />
      <Skeleton width={120} height={13} style={{ display: 'block', margin: '24px 2px 12px' }} />
      <SkeletonRows count={6} />
    </SkeletonScreen>
  );
}

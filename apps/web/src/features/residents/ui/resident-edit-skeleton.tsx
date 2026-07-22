import { Skeleton, SkeletonField, SkeletonRows, SkeletonScreen } from '@/shared/ui/skeleton';

export function ResidentEditSkeleton() {
  return (
    <SkeletonScreen>
      <SkeletonField />
      <SkeletonField />
      <SkeletonField />
      <SkeletonField />
      <Skeleton width={140} height={13} style={{ display: 'block', margin: '24px 2px 12px' }} />
      <SkeletonRows count={3} avatar={false} />
    </SkeletonScreen>
  );
}

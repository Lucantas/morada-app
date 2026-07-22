import { Skeleton, SkeletonButton, SkeletonField, SkeletonScreen } from '@/shared/ui/skeleton';

export function AccountEditSkeleton() {
  return (
    <SkeletonScreen>
      <div style={{ paddingTop: 2 }}>
        <SkeletonField />
        <SkeletonField />
        <SkeletonField />
        <SkeletonField />
        <Skeleton width={80} height={12} style={{ display: 'block', marginBottom: 9 }} />
        <Skeleton height={44} radius="var(--r-sm)" style={{ display: 'block', marginBottom: 20 }} />
        <SkeletonButton />
      </div>
    </SkeletonScreen>
  );
}

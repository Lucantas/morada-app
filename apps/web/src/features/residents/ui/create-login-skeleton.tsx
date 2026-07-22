import { Skeleton, SkeletonButton, SkeletonField, SkeletonScreen } from '@/shared/ui/skeleton';

export function CreateLoginSkeleton() {
  return (
    <SkeletonScreen>
      <div style={{ paddingTop: 2 }}>
        <Skeleton width="80%" height={12} style={{ display: 'block', marginBottom: 16 }} />
        <SkeletonField />
        <SkeletonButton />
      </div>
    </SkeletonScreen>
  );
}

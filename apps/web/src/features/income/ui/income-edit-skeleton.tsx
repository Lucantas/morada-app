import { SkeletonButton, SkeletonField, SkeletonScreen } from '@/shared/ui/skeleton';

export function IncomeEditSkeleton() {
  return (
    <SkeletonScreen>
      <div style={{ paddingTop: 2 }}>
        <SkeletonField />
        <SkeletonField />
        <SkeletonField />
        <SkeletonField />
        <SkeletonButton />
      </div>
    </SkeletonScreen>
  );
}

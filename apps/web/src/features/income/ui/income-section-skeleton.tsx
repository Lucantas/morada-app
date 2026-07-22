import { SkeletonRows, SkeletonScreen } from '@/shared/ui/skeleton';

export function IncomeSectionSkeleton() {
  return (
    <SkeletonScreen>
      <SkeletonRows count={4} />
    </SkeletonScreen>
  );
}

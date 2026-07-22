import { SkeletonRows, SkeletonScreen } from '@/shared/ui/skeleton';

export function ReceiptsSkeleton() {
  return (
    <SkeletonScreen>
      <SkeletonRows count={5} avatar={false} />
    </SkeletonScreen>
  );
}

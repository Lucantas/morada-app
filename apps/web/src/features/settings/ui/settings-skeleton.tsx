import { SkeletonField, SkeletonScreen } from '@/shared/ui/skeleton';

export function SettingsSkeleton() {
  return (
    <SkeletonScreen>
      <div style={{ paddingTop: 2 }}>
        <SkeletonField />
        <SkeletonField />
      </div>
    </SkeletonScreen>
  );
}

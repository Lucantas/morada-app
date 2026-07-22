import { SurfaceCard } from '@/shared/ui/primitives';
import { Skeleton, SkeletonScreen } from '@/shared/ui/skeleton';

export function NoticesSkeleton() {
  return (
    <SkeletonScreen>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: 4 }).map((_, index) => (
          <SurfaceCard key={index} style={{ padding: '13px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <Skeleton width="50%" height={14} />
              <Skeleton width={54} height={22} radius={999} style={{ flex: 'none' }} />
            </div>
            <Skeleton width="92%" height={12} style={{ display: 'block', marginTop: 10 }} />
            <Skeleton width="70%" height={12} style={{ display: 'block', marginTop: 6 }} />
          </SurfaceCard>
        ))}
      </div>
    </SkeletonScreen>
  );
}

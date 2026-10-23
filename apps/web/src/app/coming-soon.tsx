import type { ReactNode } from 'react';

import { useCondoName } from '@/shared/lib/condo-scope';
import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { TopBar } from '@/shared/ui/top-bar';

export function ComingSoon({ title, bottomNav }: { title: string; bottomNav: ReactNode }) {
  const condoName = useCondoName();
  return (
    <Screen>
      <TopBar eyebrow={condoName} title={title} />
      <ScreenBody>
        <div
          style={{
            marginTop: 40,
            textAlign: 'center',
            color: 'var(--ink-500)',
            fontSize: '.95rem',
          }}
        >
          Em breve.
        </div>
      </ScreenBody>
      {bottomNav}
    </Screen>
  );
}

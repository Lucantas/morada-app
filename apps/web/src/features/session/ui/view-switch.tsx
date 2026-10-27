import { useHasHome } from '@/shared/lib/condo-scope';

import type { Role } from '../domain/session';
import { useSessionStore } from './session-store';

const SEGMENTS: readonly { role: Role; label: string }[] = [
  { role: 'resident', label: 'Minha casa' },
  { role: 'admin', label: 'O prédio' },
];

export function ViewSwitch({ onSwitch }: { onSwitch: (role: Role) => void }) {
  const current = useSessionStore((state) => state.role);
  const hasHome = useHasHome();
  if (!hasHome) return null;
  return (
    <div
      role="group"
      aria-label="Alternar visão"
      style={{
        display: 'flex',
        padding: 3,
        gap: 2,
        borderRadius: 999,
        background: 'rgba(255,255,255,.12)',
      }}
    >
      {SEGMENTS.map(({ role, label }) => {
        const active = role === current;
        return (
          <button
            key={role}
            type="button"
            aria-pressed={active}
            onClick={() => onSwitch(role)}
            style={{
              border: 'none',
              cursor: 'pointer',
              borderRadius: 999,
              padding: '6px 12px',
              fontSize: '.78rem',
              fontWeight: 600,
              background: active ? '#fff' : 'transparent',
              color: active ? 'var(--petrol-800)' : '#fff',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

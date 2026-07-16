import type { ReactNode } from 'react';

import { Icon, type IconName } from './icon';

type Props = {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        textAlign: 'center',
        padding: '22px 18px',
        background: 'var(--surface-2)',
        border: '1px dashed var(--line)',
        borderRadius: 'var(--r-md)',
      }}
    >
      {icon && (
        <div
          style={{
            width: 44,
            height: 44,
            marginBottom: 4,
            borderRadius: 999,
            background: 'var(--petrol-50)',
            color: 'var(--petrol-600)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Icon name={icon} size={20} />
        </div>
      )}
      <div style={{ fontWeight: 600, fontSize: '.95rem', color: 'var(--ink-900)' }}>{title}</div>
      {description && (
        <div style={{ fontSize: '.86rem', color: 'var(--ink-500)', maxWidth: 260 }}>
          {description}
        </div>
      )}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}

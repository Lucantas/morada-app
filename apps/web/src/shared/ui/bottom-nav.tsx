import { Icon, type IconName } from './icon';

export type NavItem = {
  key: string;
  label: string;
  icon: IconName;
  active?: boolean;
  onClick: () => void;
};

export function BottomNav({ items }: { items: NavItem[] }) {
  return (
    <nav
      style={{
        background: 'var(--surface)',
        borderTop: '1px solid var(--line)',
        display: 'flex',
        alignItems: 'center',
        padding: '8px 6px calc(8px + env(safe-area-inset-bottom))',
        boxShadow: '0 -2px 12px rgba(27,36,34,.05)',
        flex: 'none',
      }}
    >
      {items.map((item) => (
        <button
          key={item.key}
          onClick={item.onClick}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            padding: '6px 2px',
            fontSize: '.68rem',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: 'transparent',
            fontFamily: "'Inter', sans-serif",
            color: item.active ? 'var(--petrol-700)' : 'var(--ink-500)',
          }}
        >
          <Icon name={item.icon} size={23} />
          {item.label}
        </button>
      ))}
    </nav>
  );
}

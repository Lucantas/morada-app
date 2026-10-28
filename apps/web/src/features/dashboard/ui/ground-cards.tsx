import { formatBRL } from '@/shared/lib/money';
import { SurfaceCard } from '@/shared/ui/primitives';

type Props = {
  categories: string[];
  monthSpentCents: number;
  cashCents: number;
};

const VISIBLE_CATEGORIES = 3;

function GroundCard({ title, value, detail }: { title: string; value: string; detail?: string }) {
  return (
    <SurfaceCard style={{ flex: '1 1 0', minWidth: 96, padding: '10px 12px' }}>
      <div style={{ fontSize: '.72rem', color: 'var(--ink-500)' }}>{title}</div>
      <div className="fraunces" style={{ fontWeight: 600, fontSize: '1rem', marginTop: 2 }}>
        {value}
      </div>
      {detail !== undefined && (
        <div style={{ fontSize: '.7rem', color: 'var(--ink-500)', marginTop: 2 }}>{detail}</div>
      )}
    </SurfaceCard>
  );
}

export function GroundCards({ categories, monthSpentCents, cashCents }: Props) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <GroundCard
        title="Contas"
        value={String(categories.length)}
        detail={categories.slice(0, VISIBLE_CATEGORIES).join(' · ')}
      />
      <GroundCard title="Gasto no mês" value={`R$ ${formatBRL(monthSpentCents)}`} />
      <GroundCard title="Em caixa" value={`R$ ${formatBRL(cashCents)}`} />
    </div>
  );
}

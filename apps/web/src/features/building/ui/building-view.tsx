import type { CSSProperties, ReactNode } from 'react';

import type {
  ApartmentState,
  Building,
  BuildingApartment,
  BuildingBlock,
} from '../domain/building';

type Props = {
  building: Building;
  onSelectApartment: (apartment: BuildingApartment) => void;
  ground?: ReactNode;
  title?: string;
};

const WINDOW_COLORS: Readonly<Record<ApartmentState, CSSProperties>> = {
  vazio: {
    background: 'transparent',
    color: 'var(--ink-500)',
    border: '1.5px dashed var(--line)',
  },
  ocupado: {
    background: '#f0e4c7',
    color: '#8a6320',
    border: '1.5px solid transparent',
  },
  pendente: {
    background: 'var(--pend-bg)',
    color: 'var(--pend-700)',
    border: '1.5px solid var(--pend-line)',
  },
  atrasado: {
    background: 'var(--atraso-bg)',
    color: 'var(--atraso-700)',
    border: '1.5px solid var(--atraso-line)',
  },
};

const WINDOW_BASE: CSSProperties = {
  minHeight: 44,
  minWidth: 64,
  flex: '1 1 0',
  borderRadius: 'var(--r-sm)',
  fontSize: '.72rem',
  fontWeight: 600,
  cursor: 'pointer',
  padding: '4px 6px',
  fontFamily: 'inherit',
};

function stateText(apartment: BuildingApartment): string {
  if (apartment.state === 'ocupado') {
    return apartment.residentName ? `ocupado por ${apartment.residentName}` : 'ocupado';
  }
  return apartment.state;
}

function shortLabel(label: string): string {
  return label.replace(/^Apto\s+/, '').replace(/\s·\s.*$/, '');
}

function Window({
  apartment,
  onSelect,
}: {
  apartment: BuildingApartment;
  onSelect: (apartment: BuildingApartment) => void;
}) {
  return (
    <button
      type="button"
      className="building-window"
      aria-label={`${apartment.label} · ${stateText(apartment)}`}
      onClick={() => onSelect(apartment)}
      style={{ ...WINDOW_BASE, ...WINDOW_COLORS[apartment.state] }}
    >
      {shortLabel(apartment.label)}
    </button>
  );
}

function Block({
  block,
  onSelect,
}: {
  block: BuildingBlock;
  onSelect: (apartment: BuildingApartment) => void;
}) {
  return (
    <div style={{ flex: '0 0 auto', minWidth: 220, display: 'grid', gap: 6 }}>
      {block.name && (
        <strong style={{ fontSize: '.78rem', color: 'var(--ink-700)' }}>{block.name}</strong>
      )}
      <div
        aria-hidden="true"
        style={{
          height: 14,
          background: 'var(--petrol-800)',
          borderRadius: '10px 10px 0 0',
        }}
      />
      <div
        style={{
          display: 'grid',
          gap: 6,
          padding: 8,
          background: 'var(--surface-2)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-sm)',
        }}
      >
        {block.floors.map((floor, index) => (
          <div
            key={floor.floor}
            className="building-floor"
            style={{ '--floor-index': index, display: 'flex', gap: 6 } as CSSProperties}
          >
            {floor.apartments.map((apartment) => (
              <Window key={apartment.id} apartment={apartment} onSelect={onSelect} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function BuildingView({ building, onSelectApartment, ground, title }: Props) {
  return (
    <section style={{ display: 'grid', gap: 10 }}>
      {title && (
        <h2 style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: '1.05rem' }}>{title}</h2>
      )}
      <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {building.blocks.map((block, index) => (
          <Block key={block.name ?? `bloco-${index}`} block={block} onSelect={onSelectApartment} />
        ))}
      </div>
      {ground}
      {building.unplaced.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          <strong style={{ fontSize: '.78rem', color: 'var(--ink-700)' }}>Outras unidades</strong>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {building.unplaced.map((apartment) => (
              <Window key={apartment.id} apartment={apartment} onSelect={onSelectApartment} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

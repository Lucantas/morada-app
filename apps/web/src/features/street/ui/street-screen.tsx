import type { ChangeEvent } from 'react';

import type { LoginCondo } from '@/features/session/domain/login-response';
import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { Skeleton, SkeletonScreen } from '@/shared/ui/skeleton';
import { StatusView } from '@/shared/ui/status-view';

import {
  greeting,
  reasonsOf,
  sortByUrgency,
  summaryLine,
  type FlagLevel,
  type ReasonKind,
  type Street,
  type StreetCondo,
} from '../domain/street';
import type { StreetRepository } from '../domain/street-repository';

import { MiniBuilding } from './mini-building';
import { useStreet } from './use-street';

export type StreetTarget = 'a-home' | 'a-residents' | 'a-accounts' | 'a-messages' | 'r-home';

type Props = {
  repository: StreetRepository;
  onOpen: (condo: LoginCondo, target: StreetTarget) => void;
  onNewCondo: () => void;
  onSignOut: () => void;
  now?: () => Date;
};

const TARGET_BY_REASON: Readonly<Record<ReasonKind, StreetTarget>> = {
  overdue_residents: 'a-residents',
  proofs_to_review: 'a-residents',
  overdue_accounts: 'a-accounts',
  accounts_due_soon: 'a-accounts',
  unread_threads: 'a-messages',
};

const TAG_BY_LEVEL: Readonly<Record<FlagLevel, string>> = {
  urgente: 'urgente',
  atencao: 'atenção',
};

const LEVEL_RANK: Readonly<Record<FlagLevel, number>> = { urgente: 0, atencao: 1 };

const SELECT_PLACEHOLDER = 'Ir para um condomínio…';

function labelOf(condo: StreetCondo): string {
  const first = reasonsOf(condo.pendencies)[0];
  return first ? `${condo.name} — ${first.text}` : condo.name;
}

function ariaLabelOf(condo: StreetCondo): string {
  const reasons = reasonsOf(condo.pendencies).map((reason) => reason.text);
  return [condo.name, `${condo.windows.length} apartamentos`, ...reasons].join(', ');
}

function attentionItems(condos: StreetCondo[]) {
  return condos
    .flatMap((condo) => reasonsOf(condo.pendencies).map((reason) => ({ condo, reason })))
    .sort((a, b) => LEVEL_RANK[a.reason.level] - LEVEL_RANK[b.reason.level]);
}

function StreetSkeleton() {
  return (
    <SkeletonScreen>
      <Skeleton width="60%" height={26} style={{ display: 'block', marginBottom: 10 }} />
      <Skeleton width="40%" height={14} style={{ display: 'block', marginBottom: 24 }} />
      <div className="street-row">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} width={96} height={120} radius="var(--r-md)" />
        ))}
      </div>
    </SkeletonScreen>
  );
}

type ContentProps = Omit<Props, 'repository' | 'now'> & { street: Street; hour: number };

function StreetContent({ street, hour, onOpen, onNewCondo, onSignOut }: ContentProps) {
  const condos = sortByUrgency(street.condos);
  const items = attentionItems(condos);
  const needingAttention = condos.filter((c) => reasonsOf(c.pendencies).length > 0).length;

  const chooseCondo = (event: ChangeEvent<HTMLSelectElement>) => {
    const condo = condos.find((candidate) => candidate.id === event.target.value);
    if (condo) onOpen(condo, 'a-home');
  };

  return (
    <>
      <h1 className="fraunces street-greeting">{greeting(hour, street.name)}</h1>
      <p className="street-summary">{summaryLine(condos.length, needingAttention)}</p>

      <ul className="street-row" aria-label="Rua de condomínios">
        {condos.map((condo) => {
          const first = reasonsOf(condo.pendencies)[0];
          return (
            <li key={condo.id}>
              <button
                type="button"
                className="street-condo"
                aria-label={ariaLabelOf(condo)}
                onClick={() => onOpen(condo, 'a-home')}
              >
                <MiniBuilding windows={condo.windows} />
                {first && (
                  <span className="street-flag" data-level={first.level}>
                    {first.flag}
                  </span>
                )}
                <span className="street-name">{condo.name}</span>
              </button>
            </li>
          );
        })}
        <li>
          <button type="button" className="street-lot" onClick={onNewCondo}>
            + Novo condomínio
          </button>
        </li>
      </ul>
      <p className="street-hint">arraste para ver mais →</p>

      <label className="visually-hidden" htmlFor="street-select">
        {SELECT_PLACEHOLDER}
      </label>
      <select id="street-select" className="street-select" value="" onChange={chooseCondo}>
        <option value="" disabled>
          {SELECT_PLACEHOLDER}
        </option>
        {condos.map((condo) => (
          <option key={condo.id} value={condo.id}>
            {labelOf(condo)}
          </option>
        ))}
      </select>

      <section aria-labelledby="street-attention">
        <h2 id="street-attention" className="street-title">
          Pede atenção hoje
        </h2>
        {items.length === 0 ? (
          <p className="street-empty">Nada pede atenção hoje.</p>
        ) : (
          <ul className="street-list">
            {items.map(({ condo, reason }) => (
              <li key={`${condo.id}-${reason.kind}`}>
                <button
                  type="button"
                  className="street-item"
                  onClick={() => onOpen(condo, TARGET_BY_REASON[reason.kind])}
                >
                  <span className="street-item-text">
                    <strong>{condo.name}</strong>
                    <span>{reason.text}</span>
                  </span>
                  <span className="street-tag" data-level={reason.level}>
                    {TAG_BY_LEVEL[reason.level]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {street.homes.length > 0 && (
        <section aria-labelledby="street-homes">
          <h2 id="street-homes" className="street-title">
            Onde você mora
          </h2>
          <ul className="street-list">
            {street.homes.map((home) => (
              <li key={home.id}>
                <button
                  type="button"
                  className="street-item"
                  onClick={() => onOpen(home, 'r-home')}
                >
                  {home.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button type="button" className="street-signout" onClick={onSignOut}>
        Sair
      </button>
    </>
  );
}

export function StreetScreen({ repository, now = () => new Date(), ...handlers }: Props) {
  const street = useStreet(repository);

  return (
    <Screen>
      <ScreenBody>
        {street.isError ? (
          <StatusView
            variant="error"
            message="Não foi possível carregar seus condomínios."
            onRetry={() => void street.refetch()}
          />
        ) : street.data ? (
          <StreetContent street={street.data} hour={now().getHours()} {...handlers} />
        ) : (
          <StreetSkeleton />
        )}
      </ScreenBody>
    </Screen>
  );
}

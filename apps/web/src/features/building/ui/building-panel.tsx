import type { ReactNode } from 'react';

import { StatusView } from '@/shared/ui/status-view';

import type { BuildingApartment } from '../domain/building';
import type { BuildingRepository } from '../domain/building-repository';

import { BuildingView } from './building-view';
import { useBuilding } from './use-building';

type Props = {
  repository: BuildingRepository;
  onSelectApartment: (apartment: BuildingApartment) => void;
  ground?: ReactNode;
};

export function BuildingPanel({ repository, onSelectApartment, ground }: Props) {
  const building = useBuilding(repository);

  if (building.isError) {
    return (
      <StatusView
        variant="error"
        message="Não foi possível carregar o prédio."
        onRetry={() => void building.refetch()}
      />
    );
  }
  if (!building.isSuccess) {
    return <StatusView variant="loading" message="Carregando o prédio…" />;
  }
  return (
    <BuildingView building={building.data} onSelectApartment={onSelectApartment} ground={ground} />
  );
}

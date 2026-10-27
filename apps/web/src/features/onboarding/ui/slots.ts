import type { ComponentType, ReactNode } from 'react';

import type { Building, BuildingApartment } from '@/features/building/domain/building';
import type { InvitationRepository } from '@/features/invitations/domain/invitation-repository';

export type AccessInvitations = Pick<InvitationRepository, 'invitation' | 'invite' | 'revoke'>;

export type BuildingViewSlot = ComponentType<{
  building: Building;
  onSelectApartment: (apartment: BuildingApartment) => void;
  ground?: ReactNode;
  title?: string;
}>;

export type AccessCardSlot = ComponentType<{
  residentId: string;
  residentEmail: string;
  repository: AccessInvitations;
}>;

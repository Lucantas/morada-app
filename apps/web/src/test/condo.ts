import { act } from '@testing-library/react';

import { ALL_PERMISSIONS } from '@/shared/lib/permissions';
import { useCondoScope, type CurrentCondo } from '@/shared/lib/condo-scope';

export const TEST_CONDO_NAME = 'Residencial Ipê';

export function testCondo(overrides: Partial<CurrentCondo> = {}): CurrentCondo {
  return {
    id: 'c1',
    name: TEST_CONDO_NAME,
    condoRole: 'administrador',
    permissions: ALL_PERMISSIONS,
    hasHome: false,
    organizationId: 'o1',
    orgRole: 'owner',
    onboardingPending: false,
    ...overrides,
  };
}

export function setTestCondo(name: string = TEST_CONDO_NAME): void {
  act(() => useCondoScope.getState().setCondo(testCondo({ name })));
}

export function clearTestCondo(): void {
  act(() => useCondoScope.getState().setCondo(null));
}

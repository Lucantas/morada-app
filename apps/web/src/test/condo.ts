import { act } from '@testing-library/react';

import { useCondoScope } from '@/shared/lib/condo-scope';

export const TEST_CONDO_NAME = 'Residencial Ipê';

export function setTestCondo(name: string = TEST_CONDO_NAME): void {
  act(() => useCondoScope.getState().setCondo({ id: 'c1', name }));
}

export function clearTestCondo(): void {
  act(() => useCondoScope.getState().setCondo(null));
}

import { render } from '@testing-library/react';

import { MiniBuilding } from './mini-building';

describe('MiniBuilding', () => {
  test('mini building draws floors top-down with lit windows', () => {
    const { container } = render(
      <MiniBuilding
        windows={[
          { block: null, floor: 1, position: 1, lit: false },
          { block: null, floor: 2, position: 1, lit: true },
          { block: null, floor: 2, position: 2, lit: false },
        ]}
      />,
    );

    const floors = Array.from(container.querySelectorAll('[data-floor]'));

    expect(floors).toHaveLength(2);
    expect(floors[0]?.querySelectorAll('[data-lit="true"]')).toHaveLength(1);
    expect(floors[0]?.querySelectorAll('[data-lit]')).toHaveLength(2);
    expect(floors[1]?.querySelectorAll('[data-lit="true"]')).toHaveLength(0);
    expect(floors[1]?.querySelectorAll('[data-lit]')).toHaveLength(2);
  });

  test('draws a generic unlit 2x3 block when there are no windows', () => {
    const { container } = render(<MiniBuilding windows={[]} />);

    expect(container.querySelectorAll('[data-floor]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-lit="false"]')).toHaveLength(6);
    expect(container.querySelectorAll('[data-lit="true"]')).toHaveLength(0);
  });
});

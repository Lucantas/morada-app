import { render, screen } from '@testing-library/react';

import { Skeleton, SkeletonScreen, SkeletonRows } from './skeleton';

describe('Skeleton', () => {
  test('renders a block with the skeleton class and the given size', () => {
    render(<Skeleton width={80} height={20} />);
    const el = document.querySelector('.skeleton');
    expect(el).toBeInTheDocument();
    expect(el).toHaveStyle({ width: '80px', height: '20px' });
  });

  test('circle uses width for both axes and a round radius', () => {
    render(<Skeleton circle width={40} />);
    const el = document.querySelector('.skeleton');
    expect(el).toHaveStyle({ width: '40px', height: '40px', borderRadius: '50%' });
  });

  test('SkeletonScreen exposes an accessible busy status with a hidden label', () => {
    render(
      <SkeletonScreen>
        <span>content</span>
      </SkeletonScreen>,
    );
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('Carregando…');
  });

  test('SkeletonRows renders at least one skeleton block per requested row', () => {
    render(<SkeletonRows count={3} />);
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThanOrEqual(3);
  });
});

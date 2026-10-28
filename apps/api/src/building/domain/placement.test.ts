import { placementFromLabel } from './placement';

describe('placementFromLabel', () => {
  test.each([
    ['Apto 302', { floor: 3, position: 2 }],
    ['Apto 1204', { floor: 12, position: 4 }],
    ['Apto 12', null],
    ['Cobertura', null],
    ['Apto 101 · Bloco A', null],
    ['Apto 099', null],
  ])('places %p as %p', (label, expected) => {
    expect(placementFromLabel(label)).toEqual(expected);
  });
});

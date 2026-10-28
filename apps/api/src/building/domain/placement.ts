const PLACEABLE_LABEL = /^Apto ([0-9]{3,9})$/;
const MIN_PLACEABLE_NUMBER = 100;
const POSITIONS_PER_HUNDRED = 100;

export interface Placement {
  floor: number;
  position: number;
}

export function placementFromLabel(label: string): Placement | null {
  const match = PLACEABLE_LABEL.exec(label);
  if (!match?.[1]) return null;
  const number = Number(match[1]);
  if (number < MIN_PLACEABLE_NUMBER) return null;
  return {
    floor: Math.floor(number / POSITIONS_PER_HUNDRED),
    position: number % POSITIONS_PER_HUNDRED,
  };
}

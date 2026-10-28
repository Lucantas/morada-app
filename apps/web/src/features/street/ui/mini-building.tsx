import { miniBuilding, type MiniBlock, type StreetWindow } from '../domain/street';

type Props = { windows: StreetWindow[] };

const GENERIC_FLOORS = 3;
const GENERIC_WIDTH = 2;

const GENERIC_BLOCK: MiniBlock = {
  block: null,
  floors: Array.from({ length: GENERIC_FLOORS }, () =>
    Array.from({ length: GENERIC_WIDTH }, () => false),
  ),
};

export function MiniBuilding({ windows }: Props) {
  const blocks = windows.length === 0 ? [GENERIC_BLOCK] : miniBuilding(windows);

  return (
    <span className="street-building" aria-hidden="true">
      {blocks.map((block, blockIndex) => (
        <span key={block.block ?? `bloco-${blockIndex}`} className="street-block">
          {block.floors.map((floor, floorIndex) => (
            <span key={floorIndex} className="street-floor" data-floor={floorIndex}>
              {floor.map((lit, windowIndex) => (
                <span key={windowIndex} className="street-window" data-lit={lit} />
              ))}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}

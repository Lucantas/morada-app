import { useCanSeeStreet } from '@/shared/lib/condo-scope';

type Props = { onClick: () => void };

export function StreetShortcut({ onClick }: Props) {
  const visible = useCanSeeStreet();
  if (!visible) return null;
  return (
    <button type="button" className="street-shortcut" onClick={onClick}>
      Seus condomínios
    </button>
  );
}

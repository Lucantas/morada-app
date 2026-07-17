import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import { DateInput, brToIso, isoToBr, maskDate } from './date-input';

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <DateInput label="Data" value={value} onChange={setValue} />
      <output data-testid="value">{value}</output>
    </>
  );
}

function input(label = 'Data'): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement;
}

describe('maskDate', () => {
  it('progressively formats digits as dd, dd/mm, dd/mm/aaaa', () => {
    expect(maskDate('0')).toBe('0');
    expect(maskDate('08')).toBe('08');
    expect(maskDate('080')).toBe('08/0');
    expect(maskDate('0805')).toBe('08/05');
    expect(maskDate('08052')).toBe('08/05/2');
    expect(maskDate('08052026')).toBe('08/05/2026');
  });

  it('strips non-digit characters and caps at 8 digits', () => {
    expect(maskDate('08/05/2026extra')).toBe('08/05/2026');
    expect(maskDate('080520269999')).toBe('08/05/2026');
  });
});

describe('isoToBr', () => {
  it('converts an ISO date to dd/mm/aaaa', () => {
    expect(isoToBr('2026-05-08')).toBe('08/05/2026');
  });

  it('returns empty string for empty input', () => {
    expect(isoToBr('')).toBe('');
  });
});

describe('brToIso', () => {
  it('converts a complete valid dd/mm/aaaa to ISO', () => {
    expect(brToIso('08/05/2026')).toBe('2026-05-08');
  });

  it('returns empty string for an incomplete date', () => {
    expect(brToIso('08/05')).toBe('');
  });

  it('returns empty string for an impossible date (invalid month)', () => {
    expect(brToIso('32/13/2026')).toBe('');
  });

  it('returns empty string for a rollover date (30 Feb)', () => {
    expect(brToIso('30/02/2026')).toBe('');
  });
});

describe('DateInput', () => {
  it('renders an empty field when value is empty', () => {
    render(<Harness />);
    expect(input().value).toBe('');
  });

  it('renders value=2026-05-08 as 08/05/2026', () => {
    render(<Harness initial="2026-05-08" />);
    expect(input().value).toBe('08/05/2026');
  });

  it('masks progressively as the user types digits', () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: '08052026' } });
    expect(input().value).toBe('08/05/2026');
  });

  it('emits the ISO date once a complete valid date is typed', () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: '08/05/2026' } });
    expect(screen.getByTestId('value').textContent).toBe('2026-05-08');
  });

  it('emits empty string for a partial date', () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: '08/05' } });
    expect(screen.getByTestId('value').textContent).toBe('');
  });

  it('emits empty string for an impossible date', () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: '32/13/2026' } });
    expect(screen.getByTestId('value').textContent).toBe('');
  });

  it('does not wipe partial typing when the parent echoes back the same value', () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: '08/05' } });
    expect(input().value).toBe('08/05');
  });

  it('renders a calendar button with an accessible label and a hidden native date input', () => {
    render(<Harness />);
    const button = screen.getByRole('button', { name: 'Escolher data — Data' });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);

    const hidden = document.querySelector('input[type="date"]');
    expect(hidden).toBeInTheDocument();
  });

  it('updates the visible text when the hidden native date input changes', () => {
    render(<Harness />);
    const hidden = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(hidden, { target: { value: '2026-05-08' } });
    expect(input().value).toBe('08/05/2026');
    expect(screen.getByTestId('value').textContent).toBe('2026-05-08');
  });
});

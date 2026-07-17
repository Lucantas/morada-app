import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import { MoneyInput } from './money-input';

function Harness() {
  const [cents, setCents] = useState(0);
  return (
    <>
      <MoneyInput label="Valor" value={cents} onChange={setCents} />
      <output data-testid="cents">{cents}</output>
    </>
  );
}

function input(): HTMLInputElement {
  return screen.getByLabelText('Valor') as HTMLInputElement;
}

describe('MoneyInput', () => {
  it('renders the label, a fixed R$ prefix and starts empty with a 0,00 placeholder', () => {
    render(<Harness />);
    expect(screen.getByText('R$')).toBeInTheDocument();
    expect(input().value).toBe('');
    expect(input()).toHaveAttribute('placeholder', '0,00');
    expect(screen.getByTestId('cents').textContent).toBe('0');
  });

  it('fills cents from the right as digits are typed', () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: '150' } });
    expect(screen.getByTestId('cents').textContent).toBe('150');
    expect(input().value).toBe('1,50');

    fireEvent.change(input(), { target: { value: '150000' } });
    expect(screen.getByTestId('cents').textContent).toBe('150000');
    expect(input().value).toBe('1.500,00');
  });

  it('keeps only digits when pasting a formatted amount', () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: 'R$ 1.234,56' } });
    expect(screen.getByTestId('cents').textContent).toBe('123456');
    expect(input().value).toBe('1.234,56');
  });

  it('goes back to zero (empty field) when cleared', () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: '999' } });
    fireEvent.change(input(), { target: { value: '' } });
    expect(screen.getByTestId('cents').textContent).toBe('0');
    expect(input().value).toBe('');
  });
});

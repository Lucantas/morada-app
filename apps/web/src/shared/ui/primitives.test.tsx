import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PhoneFrame } from './phone-frame';
import { PrimaryButton, StatCard, SurfaceCard } from './primitives';

describe('shared primitives', () => {
  test('PhoneFrame renders its children', () => {
    render(<PhoneFrame>conteúdo</PhoneFrame>);
    expect(screen.getByText('conteúdo')).toBeInTheDocument();
  });

  test('StatCard renders value and label with default color', () => {
    render(<StatCard value={7} label="Moradores" />);
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Moradores')).toBeInTheDocument();
  });

  test('PrimaryButton without an icon still fires onClick', async () => {
    const onClick = jest.fn();
    render(<PrimaryButton onClick={onClick}>Salvar</PrimaryButton>);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onClick).toHaveBeenCalled();
  });

  test('SurfaceCard without onClick renders as a plain surface', () => {
    render(<SurfaceCard>caixa</SurfaceCard>);
    expect(screen.getByText('caixa')).toBeInTheDocument();
  });
});

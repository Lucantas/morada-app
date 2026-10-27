import { Client } from 'pg';
import type { Page } from '@playwright/test';

const E2E_DATABASE_URL = 'postgres://morada:morada@localhost:5433/morada_e2e';

export const E2E_PASSWORD = 'senha-onboarding-123';

async function markEmailVerified(email: string): Promise<void> {
  const client = new Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(
      'UPDATE users SET email_verified_at = now() WHERE email = $1',
      [email],
    );
    if (result.rowCount !== 1) throw new Error(`No user signed up with ${email}`);
  } finally {
    await client.end();
  }
}

export async function signUpConfirmAndLogin(page: Page, email: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.getByLabel('Nome').fill('Beatriz Nova');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.getByText(`Enviamos um link para ${email}`).waitFor();
  await markEmailVerified(email);
  await page.getByRole('button', { name: 'Voltar para o login' }).click();
  await page.getByLabel('E-mail ou usuário').fill(email);
  await page.getByLabel(/senha/i).fill(E2E_PASSWORD);
  await page.getByRole('button', { name: /entrar/i }).click();
}

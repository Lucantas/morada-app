import { expect, test } from '@playwright/test';

test('admin logs in and sees the dashboard', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('E-mail ou usuário').fill('admin');
  await page.getByLabel(/senha/i).fill('morada-admin');
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(page.getByText(/saldo do condomínio/i)).toBeVisible();
});

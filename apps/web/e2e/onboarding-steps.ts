import { expect, type Page } from '@playwright/test';

export async function answerUntilFee(page: Page, condoName: string): Promise<void> {
  await expect(page.getByText('Que condomínio vamos gerenciar hoje?')).toBeVisible();
  await page.getByLabel('Nome do condomínio').fill(condoName);
  await page.getByRole('button', { name: 'Enviar' }).click();
  await page.getByRole('button', { name: 'Só um prédio' }).click();
  await page.getByLabel('Andares').fill('4');
  await page.getByLabel('Apartamentos por andar').fill('4');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(
    page.getByText('Quanto cada apartamento paga por mês, e até que dia?'),
  ).toBeVisible();
}

export async function createCondoAndFinishOnboarding(page: Page, condoName: string): Promise<void> {
  await answerUntilFee(page, condoName);
  await page.getByLabel('Valor por mês').fill('35000');
  await page.getByLabel('Dia do vencimento').fill('10');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await page.getByRole('button', { name: 'Depois eu vejo' }).click();
  await page.getByRole('button', { name: `Criar o ${condoName}` }).click();
  await page.getByRole('button', { name: 'Agora as contas' }).click();
  await page.getByLabel('Valor em caixa').fill('1230000');
  await page.getByRole('button', { name: `Abrir o ${condoName}` }).click();
  await expect(page.getByText('Em caixa', { exact: true })).toBeVisible();
}

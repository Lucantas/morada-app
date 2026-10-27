import { expect, test, type Page } from '@playwright/test';

import { signUpConfirmAndLogin } from './confirmed-user';

const CONDO_NAME = 'Residencial Ipê';

function uniqueEmail(label: string): string {
  return `${label}-${Date.now()}@onboarding.test`;
}

async function answerUntilFee(page: Page): Promise<void> {
  await expect(page.getByText('Que condomínio vamos gerenciar hoje?')).toBeVisible();
  await page.getByLabel('Nome do condomínio').fill(CONDO_NAME);
  await page.getByRole('button', { name: 'Enviar' }).click();
  await page.getByRole('button', { name: 'Só um prédio' }).click();
  await page.getByLabel('Andares').fill('4');
  await page.getByLabel('Apartamentos por andar').fill('4');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(
    page.getByText('Quanto cada apartamento paga por mês, e até que dia?'),
  ).toBeVisible();
}

test.describe('onboarding do condomínio', () => {
  test('conversa, prédio, moradores, contas e caixa até a casa aberta', async ({ page }) => {
    await signUpConfirmAndLogin(page, uniqueEmail('jornada'));
    await answerUntilFee(page);

    await page.getByLabel('Valor por mês').fill('35000');
    await page.getByLabel('Dia do vencimento').fill('10');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await page.getByRole('button', { name: 'Depois eu vejo' }).click();

    await page.getByRole('button', { name: `Criar o ${CONDO_NAME}` }).click();

    await expect(
      page.getByText(`Pronto, esse é o ${CONDO_NAME}. Quem mora em cada um?`),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /^Apto \d+ · vazio$/ })).toHaveCount(16);

    await page.getByRole('button', { name: 'Apto 101 · vazio' }).click();
    await page.getByLabel('Nome', { exact: true }).fill('Ana');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('button', { name: 'Apto 101 · ocupado por Ana' })).toBeVisible();

    await page.getByRole('button', { name: 'Agora as contas' }).click();
    await page.getByLabel('Valor em caixa').fill('1230000');
    await page.getByRole('button', { name: `Abrir o ${CONDO_NAME}` }).click();

    await expect(page.getByText('Em caixa', { exact: true })).toBeVisible();
    await expect(page.getByText('R$ 12.300,00')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Apto 101 · ocupado por Ana' })).toBeVisible();

    await page.reload();
    await expect(page.getByText('Em caixa', { exact: true })).toBeVisible();
    await expect(page.getByText('R$ 12.300,00')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Agora as contas' })).toHaveCount(0);
  });

  test('retoma a conversa ao recarregar na pergunta da taxa', async ({ page }) => {
    await signUpConfirmAndLogin(page, uniqueEmail('retomada'));
    await answerUntilFee(page);

    await page.reload();

    await expect(
      page.getByText('Quanto cada apartamento paga por mês, e até que dia?'),
    ).toBeVisible();
    await expect(page.getByText(CONDO_NAME, { exact: true })).toBeVisible();
  });
});

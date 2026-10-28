import { expect, test } from '@playwright/test';

import { signUpConfirmAndLogin } from './confirmed-user';
import { createCondoAndFinishOnboarding } from './onboarding-steps';

const FIRST_CONDO = 'Residencial Ipê';
const SECOND_CONDO = 'Edifício Aurora';
const DAYS_OVERDUE = 2;

function daysAgoBr(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

test.describe('a rua de condomínios', () => {
  test('dois condomínios, bandeira de conta vencida e isolamento entre eles', async ({ page }) => {
    const accountDescription = `Portão do Aurora ${Date.now()}`;
    await signUpConfirmAndLogin(page, `rua-${Date.now()}@street.test`);
    await createCondoAndFinishOnboarding(page, FIRST_CONDO);

    await page.getByRole('button', { name: 'Seus condomínios' }).click();
    await expect(page.getByRole('button', { name: new RegExp(`^${FIRST_CONDO},`) })).toBeVisible();
    await page.getByRole('button', { name: '+ Novo condomínio' }).click();

    await createCondoAndFinishOnboarding(page, SECOND_CONDO);

    await page.getByRole('button', { name: 'Contas' }).click();
    await page.getByRole('button', { name: 'Registrar nova conta' }).click();
    await page.getByLabel('Descrição').fill(accountDescription);
    await page.getByLabel('Categoria').fill('Manutenção');
    await page.getByLabel('Data', { exact: true }).fill(daysAgoBr(DAYS_OVERDUE));
    await page.getByLabel('Vencimento', { exact: true }).fill(daysAgoBr(DAYS_OVERDUE));
    await page.getByLabel('Valor', { exact: true }).fill('12000');
    await page.getByRole('button', { name: 'Registrar conta' }).click();
    await expect(page.getByText(accountDescription)).toBeVisible();

    await page.getByRole('button', { name: 'Início' }).click();
    await page.getByRole('button', { name: 'Seus condomínios' }).click();

    const aurora = page.getByRole('button', { name: new RegExp(`^${SECOND_CONDO},`) });
    const ipe = page.getByRole('button', { name: new RegExp(`^${FIRST_CONDO},`) });
    await expect(aurora).toContainText('1 vencida');
    const buildings = page.getByRole('list', { name: 'Rua de condomínios' }).getByRole('button');
    await expect(buildings.first()).toHaveAccessibleName(new RegExp(`^${SECOND_CONDO},`));
    const auroraBox = await aurora.boundingBox();
    const ipeBox = await ipe.boundingBox();
    expect(auroraBox?.x ?? Infinity).toBeLessThan(ipeBox?.x ?? -Infinity);

    const attention = page.getByRole('region', { name: 'Pede atenção hoje' });
    const item = attention.getByRole('button', { name: /1 conta vencida/ });
    await expect(item).toContainText(SECOND_CONDO);
    await expect(item).toContainText('urgente');

    await item.click();
    await expect(page.getByText(accountDescription)).toBeVisible();

    await page.getByRole('button', { name: 'Início' }).click();
    await page.getByRole('button', { name: 'Seus condomínios' }).click();
    await ipe.click();
    await page.getByRole('button', { name: 'Contas' }).click();
    await expect(page.getByRole('button', { name: 'Registrar nova conta' })).toBeVisible();
    await expect(page.getByText(accountDescription)).toHaveCount(0);
  });
});

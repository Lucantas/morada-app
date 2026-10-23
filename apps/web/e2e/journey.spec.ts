import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROOF_PATH = path.join(__dirname, 'fixtures/proof.png');

const APT_NUMBER = String(900 + (Math.floor(Date.now() / 1000) % 100));
// A Playwright retry re-imports this module with a fresh APT_NUMBER, and the e2e
// DB is only reset once at boot (not between retries), so a fixed name would let
// two apartments share it and break the strict-mode getByText lookups below.
// Deriving the name from APT_NUMBER keeps every attempt's resident distinct.
const RESIDENT_NAME = `Maria Ribeiro ${APT_NUMBER}`;
const RESIDENT_EMAIL = `e2e-${Date.now()}@morada.test`;
const RESIDENT_PASSWORD = 'senha-e2e-123';
// A future competência avoids colliding with the current month's auto-issued
// charge (the admin dashboard calls ensureMonthlyReceipts() on every mount,
// which issues a receipt for the current month to every active resident).
const RECEIPT_REF = `12/${new Date().getUTCFullYear() + 2}`;
const RECEIPT_VALUE_DIGITS = '35000';

async function login(page: Page, username: string, password: string): Promise<void> {
  await page.goto('/');
  await page.getByLabel('E-mail ou usuário').fill(username);
  await page.getByLabel(/senha/i).fill(password);
  await page.getByRole('button', { name: /entrar/i }).click();
}

test.describe.serial('jornada crítica: ciclo de vida do morador', () => {
  let inviteToken = '';

  test('admin faz login e vê o dashboard', async ({ page }) => {
    await login(page, 'admin', 'morada-admin');
    await expect(page.getByText(/saldo do condomínio/i)).toBeVisible();
  });

  test('admin cadastra um apartamento e ele aparece na lista', async ({ page }) => {
    await login(page, 'admin', 'morada-admin');

    await page.getByRole('button', { name: 'Apartamentos' }).click();
    await page.getByRole('button', { name: /cadastrar (o primeiro )?apartamento/i }).click();

    await page.getByLabel('Número do apartamento').fill(APT_NUMBER);
    await page.getByLabel('Nome completo').fill(RESIDENT_NAME);
    await page.getByLabel('E-mail').fill(RESIDENT_EMAIL);
    await page.getByRole('button', { name: 'Cadastrar apartamento' }).click();

    await expect(page.getByText(`Apto ${APT_NUMBER}`)).toBeVisible();
    await expect(page.getByText(`${RESIDENT_NAME} · Condomínio Demo`)).toBeVisible();
  });

  test('admin gera o convite do morador e captura o link', async ({ page }) => {
    await login(page, 'admin', 'morada-admin');

    await page.getByRole('button', { name: 'Apartamentos' }).click();
    await page.getByText(`Apto ${APT_NUMBER}`).click();
    await page.getByRole('button', { name: 'Acesso do morador' }).click();

    await expect(page.getByLabel('E-mail do morador')).toHaveValue(RESIDENT_EMAIL);
    await page.getByRole('button', { name: 'Gerar convite' }).click();

    await expect(page.getByText(`E-mail enviado para ${RESIDENT_EMAIL}`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copiar link' })).toBeVisible();
    const link = (await page.getByTestId('invite-link').textContent())?.trim() ?? '';
    inviteToken = link.split('#/convite/')[1] ?? '';
    expect(inviteToken.length).toBeGreaterThan(20);
  });

  test('morador abre o convite, cria a senha e entra no app', async ({ browser }) => {
    const residentContext = await browser.newContext();
    const residentPage = await residentContext.newPage();

    await residentPage.goto(`/#/convite/${inviteToken}`);
    await expect(
      residentPage.getByRole('heading', { name: /Você foi convidado para o/ }),
    ).toBeVisible();
    await expect(residentPage.getByLabel('E-mail')).toHaveValue(RESIDENT_EMAIL);
    await expect(residentPage).not.toHaveURL(/convite/);
    await residentPage.getByLabel('Seu nome').fill(RESIDENT_NAME);
    await residentPage.getByLabel('Senha', { exact: true }).fill(RESIDENT_PASSWORD);
    await residentPage.getByLabel('Confirme a senha').fill(RESIDENT_PASSWORD);
    await residentPage.getByRole('button', { name: 'Aceitar convite' }).click();

    await expect(residentPage.getByText('Olá, Maria')).toBeVisible();
    await residentContext.close();
  });

  test('admin vê o acesso ativo do morador', async ({ page }) => {
    await login(page, 'admin', 'morada-admin');

    await page.getByRole('button', { name: 'Apartamentos' }).click();
    await page.getByText(`Apto ${APT_NUMBER}`).click();
    await page.getByRole('button', { name: 'Acesso do morador' }).click();

    await expect(page.getByText('Acesso ativo por e-mail')).toBeVisible();
  });

  test('admin emite uma cobrança pendente para o apartamento', async ({ page }) => {
    await login(page, 'admin', 'morada-admin');

    await page.getByRole('button', { name: 'Apartamentos' }).click();
    await page.getByText(`Apto ${APT_NUMBER}`).click();

    await page.getByRole('button', { name: 'Adicionar' }).click();
    await page.getByLabel('Competência').fill(RECEIPT_REF);
    await page.getByLabel('Valor').fill(RECEIPT_VALUE_DIGITS);
    await page.getByRole('button', { name: 'Adicionar e continuar' }).click();
    await page.getByRole('button', { name: 'Concluir' }).click();

    const receiptRow = page
      .locator('div', { has: page.getByText(`REF · ${RECEIPT_REF}`, { exact: false }) })
      .filter({ hasText: 'R$ 350,00' })
      .last();
    await expect(receiptRow).toBeVisible();
    await expect(receiptRow.getByText('Pendente', { exact: true })).toBeVisible();
  });

  test('morador loga com e-mail e senha, vê a cobrança e paga via pix', async ({ browser }) => {
    const residentContext = await browser.newContext();
    const residentPage = await residentContext.newPage();

    await login(residentPage, RESIDENT_EMAIL, RESIDENT_PASSWORD);
    await expect(residentPage.getByText(/próxima taxa/i)).toBeVisible();
    await expect(residentPage.getByText(`Taxa condominial · ${RECEIPT_REF}`)).toBeVisible();

    // The resident-home "Pagar taxa" CTA navigates to the receipts list, not
    // straight to the pay screen — the pay button lives on the specific
    // receipt's own ticket there.
    await residentPage.getByRole('button', { name: 'Pagar taxa' }).first().click();
    await expect(residentPage.getByRole('heading', { name: 'Meus recibos' })).toBeVisible();

    const receiptTicket = residentPage
      .getByText(`REF · ${RECEIPT_REF}`)
      .locator('xpath=ancestor::*[.//button[contains(., "Pagar taxa")]][1]');
    await receiptTicket.getByRole('button', { name: 'Pagar taxa' }).click();

    await expect(residentPage.getByLabel('Comprovante de pagamento')).toBeVisible();
    await expect(residentPage.getByText('R$ 350,00')).toBeVisible();

    await residentPage.getByRole('button', { name: 'Pix', exact: true }).click();
    await residentPage.getByLabel('Comprovante de pagamento').setInputFiles(PROOF_PATH);
    await residentPage.getByRole('button', { name: 'Enviar comprovante' }).click();

    await expect(residentPage.getByText('Aguardando confirmação')).toBeVisible();

    await residentContext.close();
  });

  test('admin confirma o pagamento e o recibo aparece como pago', async ({ page }) => {
    await login(page, 'admin', 'morada-admin');

    await page.getByRole('button', { name: 'Apartamentos' }).click();
    await page.getByText(`Apto ${APT_NUMBER}`).click();

    await expect(page.getByText('Em análise', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Ver comprovante' }).waitFor({ state: 'visible' });

    await page.getByRole('textbox', { name: 'Data do pagamento' }).fill('21/07/2026');
    await page.getByRole('button', { name: 'Confirmar', exact: true }).click();

    await expect(page.getByText('Pago', { exact: true })).toBeVisible();
  });

  test('morador e admin fazem logout e voltam à tela de login', async ({ browser }) => {
    const residentContext = await browser.newContext();
    const residentPage = await residentContext.newPage();
    await login(residentPage, RESIDENT_EMAIL, RESIDENT_PASSWORD);
    await residentPage.getByRole('button', { name: 'Perfil' }).click();
    await residentPage.getByRole('button', { name: 'Sair' }).click();
    await expect(residentPage.getByLabel('E-mail ou usuário')).toBeVisible();
    await residentContext.close();

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await login(adminPage, 'admin', 'morada-admin');
    await adminPage.getByRole('button', { name: 'Sair' }).click();
    await expect(adminPage.getByLabel('E-mail ou usuário')).toBeVisible();
    await adminContext.close();
  });
});

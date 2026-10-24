import { expect, test, type Browser, type Page } from '@playwright/test';

const STAMP = Date.now();
const SINDICO_EMAIL = 'sindico@e2e.test';
const SINDICO_NAME = 'Sônia Síndica';
const SINDICO_PASSWORD = 'senha-sindico-123';
const APT_NUMBER = String(700 + (Math.floor(STAMP / 1000) % 100));
const RESIDENT_NAME = `Paulo Pix ${APT_NUMBER}`;
const RESIDENT_EMAIL = `pix-${STAMP}@morada.test`;
const RESIDENT_PASSWORD = 'senha-pix-123';
const RECEIPT_REF = `11/${new Date().getUTCFullYear() + 3}`;
const ACCOUNT_DESCRIPTION = `Reparo do portão ${STAMP}`;
const PIX_KEY = '123e4567-e89b-12d3-a456-426614174000';

function todayBr(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${now.getFullYear()}`;
}

async function login(page: Page, username: string, password: string): Promise<void> {
  await page.goto('/');
  await page.getByLabel('E-mail ou usuário').fill(username);
  await page.getByLabel(/senha/i).fill(password);
  await page.getByRole('button', { name: /entrar/i }).click();
}

async function readInviteLink(page: Page): Promise<string> {
  const link = (await page.getByTestId('invite-link').textContent())?.trim() ?? '';
  const fragment = link.split('#')[1] ?? '';
  expect(fragment.length).toBeGreaterThan(20);
  return `/#${fragment}`;
}

async function acceptInvite(
  browser: Browser,
  invitePath: string,
  name: string,
  password: string,
): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(invitePath);
  await page.getByLabel('Seu nome').fill(name);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByLabel('Confirme a senha').fill(password);
  await page.getByRole('button', { name: 'Aceitar convite' }).click();
  return { page, close: () => context.close() };
}

test.describe.serial('jornada de papéis: síndico e Pix', () => {
  let sindicoInvitePath = '';
  let residentInvitePath = '';

  test('admin convida o síndico e captura o link', async ({ page }) => {
    await login(page, 'admin', 'morada-admin');
    await page.getByRole('button', { name: 'Ajustes' }).click();
    await page.getByRole('button', { name: 'Síndico' }).click();

    await page.getByLabel('E-mail do síndico').fill(SINDICO_EMAIL);
    await page.getByRole('button', { name: 'Gerar convite' }).click();

    sindicoInvitePath = await readInviteLink(page);
  });

  test('síndico aceita o convite, não vê o valor da taxa e lança uma conta', async ({
    browser,
  }) => {
    const sindico = await acceptInvite(browser, sindicoInvitePath, SINDICO_NAME, SINDICO_PASSWORD);
    const page = sindico.page;

    await expect(page.getByText(/saldo do condomínio/i)).toBeVisible();

    await page.getByRole('button', { name: 'Ajustes' }).click();
    await expect(page.getByText('Salvar e reclassificar contas')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Valor da taxa' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Voltar' }).click();

    await page.getByRole('button', { name: 'Contas' }).click();
    await page.getByRole('button', { name: 'Registrar nova conta' }).click();
    await page.getByLabel('Descrição').fill(ACCOUNT_DESCRIPTION);
    await page.getByLabel('Categoria').fill('Manutenção');
    await page.getByLabel('Data', { exact: true }).fill(todayBr());
    await page.getByLabel('Valor', { exact: true }).fill('12000');
    await page.getByRole('button', { name: 'Registrar conta' }).click();

    await expect(page.getByText(ACCOUNT_DESCRIPTION)).toBeVisible();
    await sindico.close();
  });

  test('admin vê "Conta lançada" com o nome do síndico em Atividade', async ({ page }) => {
    await login(page, 'admin', 'morada-admin');
    await page.getByRole('button', { name: 'Ajustes' }).click();
    await page.getByRole('button', { name: 'Atividade' }).click();

    const entry = page
      .locator('div', { has: page.getByText('Conta lançada', { exact: true }) })
      .filter({ hasText: SINDICO_NAME })
      .last();
    await expect(entry).toBeVisible();
  });

  test('admin configura a chave Pix e cadastra um morador com cobrança', async ({ page }) => {
    await login(page, 'admin', 'morada-admin');
    await page.getByRole('button', { name: 'Ajustes' }).click();
    await expect(page.getByRole('textbox', { name: 'Valor da taxa' })).toBeVisible();

    await page.getByLabel('Tipo de chave Pix').selectOption({ label: 'Chave aleatória' });
    await page.getByLabel('Chave Pix', { exact: true }).fill(PIX_KEY);
    await page.getByLabel('Nome do recebedor').fill('Condominio Morada');
    await page.getByLabel('Cidade').fill('Sao Paulo');
    await page.getByRole('button', { name: 'Salvar e reclassificar contas' }).click();
    await page.getByRole('button', { name: 'Voltar' }).click();

    await page.getByRole('button', { name: 'Apartamentos' }).click();
    await page.getByRole('button', { name: /cadastrar (o primeiro )?apartamento/i }).click();
    await page.getByLabel('Número do apartamento').fill(APT_NUMBER);
    await page.getByLabel('Nome completo').fill(RESIDENT_NAME);
    await page.getByLabel('E-mail').fill(RESIDENT_EMAIL);
    await page.getByRole('button', { name: 'Cadastrar apartamento' }).click();
    await expect(page.getByText(`Apto ${APT_NUMBER}`)).toBeVisible();

    await page.getByText(`Apto ${APT_NUMBER}`).click();
    await page.getByRole('button', { name: 'Acesso do morador' }).click();
    await page.getByRole('button', { name: 'Gerar convite' }).click();
    residentInvitePath = await readInviteLink(page);

    await page.getByRole('button', { name: 'Voltar' }).click();
    await page.getByRole('button', { name: 'Adicionar' }).click();
    await page.getByLabel('Competência').fill(RECEIPT_REF);
    await page.getByLabel('Valor').fill('35000');
    await page.getByRole('button', { name: 'Adicionar e continuar' }).click();
    await page.getByRole('button', { name: 'Concluir' }).click();
    await expect(page.getByText(`REF · ${RECEIPT_REF}`).first()).toBeVisible();
  });

  test('morador abre o pagamento e copia um código Pix válido', async ({ browser }) => {
    const resident = await acceptInvite(
      browser,
      residentInvitePath,
      RESIDENT_NAME,
      RESIDENT_PASSWORD,
    );
    const page = resident.page;
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    await expect(page.getByText(/próxima taxa/i)).toBeVisible();
    await page.getByRole('button', { name: 'Pagar taxa' }).first().click();
    await expect(page.getByRole('heading', { name: 'Meus recibos' })).toBeVisible();

    const ticket = page
      .getByText(`REF · ${RECEIPT_REF}`)
      .locator('xpath=ancestor::*[.//button[contains(., "Pagar taxa")]][1]');
    await ticket.getByRole('button', { name: 'Pagar taxa' }).click();

    await expect(page.getByRole('img', { name: 'QR Code Pix' })).toBeVisible();
    await page.getByRole('button', { name: 'Copiar código Pix' }).click();
    await expect(page.getByText('Código Pix copiado!')).toBeVisible();

    const code = await page.evaluate(() => navigator.clipboard.readText());
    expect(code.startsWith('000201')).toBe(true);
    expect(code).toContain('br.gov.bcb.pix');
    await resident.close();
  });
});

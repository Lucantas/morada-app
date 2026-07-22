export interface Migration {
  id: string;
  sql: string;
}

// Ordered schema migrations, mirroring the SQLite schema in platform/db.ts.
// SQLite integers-as-booleans (active/dismissed/unread) become native BOOLEAN;
// the partial unique indexes carry the same invariants (one active resident per
// apartment, one login per resident).
export const migrations: Migration[] = [
  {
    id: '001_init',
    sql: `
CREATE TABLE apartments (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL UNIQUE
);

CREATE TABLE residents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE apartment_residents (
  id TEXT PRIMARY KEY,
  apartment_id TEXT NOT NULL,
  resident_id TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (apartment_id, resident_id)
);

CREATE UNIQUE INDEX idx_one_active_resident_per_apartment
  ON apartment_residents (apartment_id) WHERE active;

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  date_label TEXT NOT NULL,
  value_cents INTEGER NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE receipts (
  id TEXT PRIMARY KEY,
  ref TEXT NOT NULL,
  title TEXT NOT NULL,
  due_label TEXT NOT NULL,
  value_cents INTEGER NOT NULL,
  status TEXT NOT NULL,
  method TEXT,
  resident_id TEXT,
  apartment_id TEXT
);

CREATE TABLE notices (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL,
  audience TEXT NOT NULL,
  date_label TEXT NOT NULL,
  dismissed BOOLEAN NOT NULL
);

CREATE TABLE threads (
  id TEXT PRIMARY KEY,
  resident_name TEXT NOT NULL,
  apt TEXT NOT NULL,
  unread BOOLEAN NOT NULL,
  messages TEXT NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  resident_id TEXT
);

CREATE UNIQUE INDEX idx_users_resident_id
  ON users (resident_id) WHERE resident_id IS NOT NULL;
`,
  },
  {
    // Dates as real DATE columns (was free-text labels) so they store cleanly and
    // report well: receipts get a due date + a payment date; accounts get a date.
    id: '002_dates',
    sql: `
ALTER TABLE receipts DROP COLUMN due_label;
ALTER TABLE receipts ADD COLUMN due_date DATE;
ALTER TABLE receipts ADD COLUMN paid_at DATE;

ALTER TABLE accounts DROP COLUMN date_label;
ALTER TABLE accounts ADD COLUMN date DATE;
`,
  },
  {
    id: '003_payment_methods',
    sql: `
UPDATE receipts SET method = 'dinheiro' WHERE method IN ('boleto', 'cartao');
`,
  },
  {
    id: '004_condo_settings',
    sql: `
CREATE TABLE condo_settings (
  id TEXT PRIMARY KEY,
  monthly_fee_cents INTEGER NOT NULL,
  due_day INTEGER NOT NULL DEFAULT 15
);

INSERT INTO condo_settings (id, monthly_fee_cents, due_day) VALUES ('default', 15000, 15);
`,
  },
  {
    id: '005_receipt_review',
    sql: `
ALTER TABLE receipts ADD COLUMN submitted_at DATE;
ALTER TABLE receipts ADD COLUMN proof_data_url TEXT;
`,
  },
  {
    id: '006_resident_status_override',
    sql: `
ALTER TABLE residents ADD COLUMN status_override TEXT;
`,
  },
  {
    id: '007_categories',
    sql: `
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  keywords TEXT NOT NULL,
  position INTEGER NOT NULL
);

INSERT INTO categories (id, name, keywords, position) VALUES
  ('cat-agua', 'Água', 'água, agua, saneamento, esgoto', 0),
  ('cat-energia', 'Energia', 'energia, luz, elétr, eletr', 1),
  ('cat-servicos', 'Serviços', 'limpeza, internet, portaria, serviço, servico, segurança', 2),
  ('cat-manutencao', 'Manutenção', 'manutenção, manutencao, reparo, elevador, conserto, bomba', 3);
`,
  },
  {
    id: '008_incomes',
    sql: `
CREATE TABLE incomes (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  source TEXT NOT NULL,
  value_cents INTEGER NOT NULL,
  date DATE,
  proof_data_url TEXT
);
`,
  },
  {
    id: '009_visible',
    sql: `
ALTER TABLE receipts ADD COLUMN visible boolean NOT NULL DEFAULT true;
ALTER TABLE accounts ADD COLUMN visible boolean NOT NULL DEFAULT true;
`,
  },
  {
    id: '010_notice_dismissals',
    sql: `
CREATE TABLE notice_dismissals (
  notice_id TEXT NOT NULL REFERENCES notices(id),
  resident_id TEXT NOT NULL,
  PRIMARY KEY (notice_id, resident_id)
);

ALTER TABLE notices DROP COLUMN dismissed;
`,
  },
  {
    id: '011_income_visible',
    sql: `
ALTER TABLE incomes ADD COLUMN visible boolean NOT NULL DEFAULT true;
`,
  },
  {
    // Fixes the ensure-month race (check-then-insert with no DB guard could
    // duplicate 'Taxa condominial' receipts). Step 1 archives (visible = false —
    // nothing is deleted) existing visible duplicates per (resident_id, ref),
    // keeping the one with the strongest evidence: pago > em_analise > rest, tie
    // broken by lowest id. Step 2 adds the partial unique index that makes a
    // second visible condo-fee receipt for the same resident/month impossible.
    id: '012_receipt_monthly_unique',
    sql: `
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY resident_id, ref
           ORDER BY
             CASE status WHEN 'pago' THEN 0 WHEN 'em_analise' THEN 1 ELSE 2 END,
             id
         ) AS rn
  FROM receipts
  WHERE visible AND title = 'Taxa condominial'
)
UPDATE receipts SET visible = false
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX idx_receipts_condo_fee_month
  ON receipts (resident_id, ref) WHERE visible AND title = 'Taxa condominial';
`,
  },
  {
    // proof_key points at an object in R2 (offloaded proof); proof_data_url keeps
    // legacy base64 rows working. Added to both tables so income's own storage
    // offload (a later task) needs no further migration.
    id: '013_proof_key',
    sql: `
ALTER TABLE receipts ADD COLUMN proof_key TEXT;
ALTER TABLE incomes ADD COLUMN proof_key TEXT;
`,
  },
];

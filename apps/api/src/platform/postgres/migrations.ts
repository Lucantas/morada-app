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
  {
    id: '014_account_proof',
    sql: `
ALTER TABLE accounts ADD COLUMN proof_data_url TEXT;
ALTER TABLE accounts ADD COLUMN proof_key TEXT;
`,
  },
  {
    // Introduces organizations/condominiums and moves every existing row into
    // condo-legacy. The condominium_id defaults keep the not-yet-scoped adapters
    // writing valid rows until 018_drop_legacy_defaults removes them.
    id: '015_tenancy',
    sql: `
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE condominiums (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO organizations (id, name) VALUES ('org-legacy', 'Condomínio Morada');
INSERT INTO condominiums (id, organization_id, name)
  VALUES ('condo-legacy', 'org-legacy', 'Condomínio Morada · Bloco 2');

ALTER TABLE apartments ADD COLUMN condominium_id TEXT REFERENCES condominiums(id) DEFAULT 'condo-legacy';
UPDATE apartments SET condominium_id = 'condo-legacy';
ALTER TABLE apartments ALTER COLUMN condominium_id SET NOT NULL;
CREATE INDEX idx_apartments_condominium_id ON apartments (condominium_id);

ALTER TABLE residents ADD COLUMN condominium_id TEXT REFERENCES condominiums(id) DEFAULT 'condo-legacy';
UPDATE residents SET condominium_id = 'condo-legacy';
ALTER TABLE residents ALTER COLUMN condominium_id SET NOT NULL;
CREATE INDEX idx_residents_condominium_id ON residents (condominium_id);

ALTER TABLE accounts ADD COLUMN condominium_id TEXT REFERENCES condominiums(id) DEFAULT 'condo-legacy';
UPDATE accounts SET condominium_id = 'condo-legacy';
ALTER TABLE accounts ALTER COLUMN condominium_id SET NOT NULL;
CREATE INDEX idx_accounts_condominium_id ON accounts (condominium_id);

ALTER TABLE receipts ADD COLUMN condominium_id TEXT REFERENCES condominiums(id) DEFAULT 'condo-legacy';
UPDATE receipts SET condominium_id = 'condo-legacy';
ALTER TABLE receipts ALTER COLUMN condominium_id SET NOT NULL;
CREATE INDEX idx_receipts_condominium_id ON receipts (condominium_id);

ALTER TABLE notices ADD COLUMN condominium_id TEXT REFERENCES condominiums(id) DEFAULT 'condo-legacy';
UPDATE notices SET condominium_id = 'condo-legacy';
ALTER TABLE notices ALTER COLUMN condominium_id SET NOT NULL;
CREATE INDEX idx_notices_condominium_id ON notices (condominium_id);

ALTER TABLE threads ADD COLUMN condominium_id TEXT REFERENCES condominiums(id) DEFAULT 'condo-legacy';
UPDATE threads SET condominium_id = 'condo-legacy';
ALTER TABLE threads ALTER COLUMN condominium_id SET NOT NULL;
CREATE INDEX idx_threads_condominium_id ON threads (condominium_id);

ALTER TABLE categories ADD COLUMN condominium_id TEXT REFERENCES condominiums(id) DEFAULT 'condo-legacy';
UPDATE categories SET condominium_id = 'condo-legacy';
ALTER TABLE categories ALTER COLUMN condominium_id SET NOT NULL;
CREATE INDEX idx_categories_condominium_id ON categories (condominium_id);

ALTER TABLE incomes ADD COLUMN condominium_id TEXT REFERENCES condominiums(id) DEFAULT 'condo-legacy';
UPDATE incomes SET condominium_id = 'condo-legacy';
ALTER TABLE incomes ALTER COLUMN condominium_id SET NOT NULL;
CREATE INDEX idx_incomes_condominium_id ON incomes (condominium_id);

ALTER TABLE condo_settings ADD COLUMN condominium_id TEXT REFERENCES condominiums(id) DEFAULT 'condo-legacy';
UPDATE condo_settings SET condominium_id = 'condo-legacy';
ALTER TABLE condo_settings ALTER COLUMN condominium_id SET NOT NULL;

ALTER TABLE apartments DROP CONSTRAINT apartments_label_key;
ALTER TABLE apartments ADD CONSTRAINT apartments_condominium_label_key UNIQUE (condominium_id, label);

ALTER TABLE condo_settings DROP CONSTRAINT condo_settings_pkey;
ALTER TABLE condo_settings DROP COLUMN id;
ALTER TABLE condo_settings ADD PRIMARY KEY (condominium_id);

CREATE TABLE organization_members (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (organization_id, user_id)
);

CREATE TABLE condo_roles (
  id TEXT PRIMARY KEY,
  condominium_id TEXT NOT NULL REFERENCES condominiums(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('administrador', 'sindico', 'morador')),
  resident_id TEXT REFERENCES residents(id),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (condominium_id, user_id, role)
);

CREATE INDEX idx_condo_roles_user_id ON condo_roles (user_id);

INSERT INTO organization_members (id, organization_id, user_id, role)
  SELECT gen_random_uuid()::text, 'org-legacy', id, 'owner' FROM users WHERE role = 'admin';

INSERT INTO condo_roles (id, condominium_id, user_id, role, resident_id)
  SELECT gen_random_uuid()::text, 'condo-legacy', id, 'administrador', NULL
  FROM users WHERE role = 'admin';

INSERT INTO condo_roles (id, condominium_id, user_id, role, resident_id)
  SELECT gen_random_uuid()::text, 'condo-legacy', u.id, 'morador', u.resident_id
  FROM users u JOIN residents r ON r.id = u.resident_id
  WHERE u.role = 'resident';
`,
  },
  {
    // Legacy threads are keyed by the resident id; the apartment comes from the
    // resident's active occupancy (NULL when there is none).
    id: '016_thread_links',
    sql: `
ALTER TABLE threads ADD COLUMN resident_id TEXT;
ALTER TABLE threads ADD COLUMN apartment_id TEXT;

UPDATE threads t SET resident_id = r.id FROM residents r WHERE r.id = t.id;

UPDATE threads t SET apartment_id = ar.apartment_id
  FROM apartment_residents ar
  WHERE ar.resident_id = t.resident_id AND ar.active;
`,
  },
  {
    id: '017_account_due_date',
    sql: `
ALTER TABLE accounts ADD COLUMN due_date DATE;
`,
  },
  {
    id: '018_drop_legacy_defaults',
    sql: `
ALTER TABLE apartments ALTER COLUMN condominium_id DROP DEFAULT;
ALTER TABLE residents ALTER COLUMN condominium_id DROP DEFAULT;
ALTER TABLE accounts ALTER COLUMN condominium_id DROP DEFAULT;
ALTER TABLE receipts ALTER COLUMN condominium_id DROP DEFAULT;
ALTER TABLE notices ALTER COLUMN condominium_id DROP DEFAULT;
ALTER TABLE threads ALTER COLUMN condominium_id DROP DEFAULT;
ALTER TABLE categories ALTER COLUMN condominium_id DROP DEFAULT;
ALTER TABLE incomes ALTER COLUMN condominium_id DROP DEFAULT;
ALTER TABLE condo_settings ALTER COLUMN condominium_id DROP DEFAULT;
`,
  },
  {
    id: '019_identity',
    sql: `
ALTER TABLE users ALTER COLUMN username DROP NOT NULL;
ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN name TEXT;
ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ;
CREATE UNIQUE INDEX idx_users_email ON users (email) WHERE email IS NOT NULL;
`,
  },
  {
    id: '020_auth_tokens',
    sql: `
CREATE TABLE auth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('confirm_email', 'reset_password')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_auth_tokens_user_kind ON auth_tokens (user_id, kind);
`,
  },
  {
    id: '021_session_version',
    sql: `
ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0;
`,
  },
  {
    id: '022_invitations',
    sql: `
CREATE TABLE invitations (
  id TEXT PRIMARY KEY,
  condominium_id TEXT NOT NULL REFERENCES condominiums(id),
  resident_id TEXT NOT NULL REFERENCES residents(id),
  role TEXT NOT NULL CHECK (role IN ('morador')),
  email TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pendente', 'aceito', 'revogado')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  claimed_by TEXT REFERENCES users(id),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invitations_condo_resident ON invitations (condominium_id, resident_id);
`,
  },
  {
    id: '023_one_pending_invitation',
    sql: `
UPDATE invitations SET status = 'revogado'
WHERE status = 'pendente' AND id NOT IN (
  SELECT DISTINCT ON (resident_id) id FROM invitations
  WHERE status = 'pendente' ORDER BY resident_id, created_at DESC
);
CREATE UNIQUE INDEX idx_invitations_one_pending ON invitations (resident_id) WHERE status = 'pendente';
`,
  },
  {
    id: '024_activity_log',
    sql: `
CREATE TABLE activity_log (
  id TEXT PRIMARY KEY,
  condominium_id TEXT NOT NULL REFERENCES condominiums(id),
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  subject_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_log_condo_created ON activity_log (condominium_id, created_at DESC);
`,
  },
  {
    id: '025_staff_invitations',
    sql: `
ALTER TABLE invitations ALTER COLUMN resident_id DROP NOT NULL;
ALTER TABLE invitations ALTER COLUMN condominium_id DROP NOT NULL;
ALTER TABLE invitations ADD COLUMN organization_id TEXT REFERENCES organizations(id);
ALTER TABLE invitations ADD COLUMN org_role TEXT CHECK (org_role IN ('owner', 'member'));
ALTER TABLE invitations DROP CONSTRAINT invitations_role_check;
ALTER TABLE invitations ADD CONSTRAINT invitations_role_check CHECK (role IN ('morador', 'sindico', 'membro'));
ALTER TABLE invitations ADD CONSTRAINT invitations_shape_check CHECK (
  (role = 'morador' AND condominium_id IS NOT NULL AND resident_id IS NOT NULL AND organization_id IS NULL) OR
  (role = 'sindico' AND condominium_id IS NOT NULL AND resident_id IS NULL AND organization_id IS NULL AND email IS NOT NULL) OR
  (role = 'membro' AND organization_id IS NOT NULL AND condominium_id IS NULL AND resident_id IS NULL AND email IS NOT NULL AND org_role IS NOT NULL)
);
CREATE UNIQUE INDEX idx_invitations_one_pending_sindico ON invitations (condominium_id) WHERE role = 'sindico' AND status = 'pendente';
CREATE UNIQUE INDEX idx_invitations_one_pending_member ON invitations (organization_id, email) WHERE role = 'membro' AND status = 'pendente';
`,
  },
  {
    id: '026_condo_pix',
    sql: `
ALTER TABLE condo_settings ADD COLUMN pix_key_type TEXT CHECK (pix_key_type IN ('cpf','cnpj','email','telefone','aleatoria'));
ALTER TABLE condo_settings ADD COLUMN pix_key TEXT;
ALTER TABLE condo_settings ADD COLUMN pix_receiver_name TEXT;
ALTER TABLE condo_settings ADD COLUMN pix_city TEXT;
ALTER TABLE condo_settings ADD CONSTRAINT condo_settings_pix_all_or_none CHECK (
  (pix_key_type IS NULL AND pix_key IS NULL AND pix_receiver_name IS NULL AND pix_city IS NULL) OR
  (pix_key_type IS NOT NULL AND pix_key IS NOT NULL AND pix_receiver_name IS NOT NULL AND pix_city IS NOT NULL)
);
`,
  },
];

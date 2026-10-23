import { useState, type ReactNode } from 'react';

import { Field, PrimaryButton } from '@/shared/ui/primitives';

import { validateInviteEmail } from '../domain/invitation';
import type { Validation } from '@/features/auth/domain/auth-schemas';

type Props = {
  initialEmail: string;
  submitLabel: string;
  pending: boolean;
  error: string | null;
  onSubmit: (email: string, phone?: string) => void;
  emailLabel?: string;
  description?: string;
  validateEmail?: (email: string) => Validation<string>;
  askPhone?: boolean;
  extraFields?: ReactNode;
};

const DEFAULT_DESCRIPTION =
  'O morador recebe um link para criar a própria senha. Sem e-mail, envie o link pelo WhatsApp.';

export function InviteForm({
  initialEmail,
  submitLabel,
  pending,
  error,
  onSubmit,
  emailLabel = 'E-mail do morador',
  description = DEFAULT_DESCRIPTION,
  validateEmail = validateInviteEmail,
  askPhone = false,
  extraFields,
}: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState('');
  const [invalid, setInvalid] = useState<string | null>(null);

  const submit = () => {
    const result = validateEmail(email);
    if (!result.ok) {
      setInvalid(result.message);
      return;
    }
    setInvalid(null);
    const trimmedPhone = phone.trim();
    onSubmit(result.data, trimmedPhone === '' ? undefined : trimmedPhone);
  };

  const message = invalid ?? error;

  return (
    <div>
      <p style={{ color: 'var(--ink-500)', fontSize: '.92rem', margin: '0 0 16px' }}>
        {description}
      </p>
      <Field
        label={emailLabel}
        type="email"
        value={email}
        onChange={setEmail}
        placeholder={askPhone ? undefined : 'Opcional'}
      />
      {askPhone && (
        <Field
          label="Telefone (opcional)"
          type="tel"
          value={phone}
          onChange={setPhone}
          autoComplete="tel"
        />
      )}
      {extraFields}
      {message && (
        <p role="alert" style={{ color: 'var(--atraso-700)', margin: '0 0 14px' }}>
          {message}
        </p>
      )}
      <PrimaryButton icon="userPlus" onClick={submit} disabled={pending}>
        {pending ? 'Gerando…' : submitLabel}
      </PrimaryButton>
    </div>
  );
}

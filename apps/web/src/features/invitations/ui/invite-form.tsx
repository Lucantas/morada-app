import { useState } from 'react';

import { Field, PrimaryButton } from '@/shared/ui/primitives';

import { validateInviteEmail } from '../domain/invitation';

type Props = {
  initialEmail: string;
  submitLabel: string;
  pending: boolean;
  error: string | null;
  onSubmit: (email: string) => void;
};

export function InviteForm({ initialEmail, submitLabel, pending, error, onSubmit }: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [invalid, setInvalid] = useState<string | null>(null);

  const submit = () => {
    const result = validateInviteEmail(email);
    if (!result.ok) {
      setInvalid(result.message);
      return;
    }
    setInvalid(null);
    onSubmit(result.data);
  };

  const message = invalid ?? error;

  return (
    <div>
      <p style={{ color: 'var(--ink-500)', fontSize: '.92rem', margin: '0 0 16px' }}>
        O morador recebe um link para criar a própria senha. Sem e-mail, envie o link pelo WhatsApp.
      </p>
      <Field
        label="E-mail do morador"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="Opcional"
      />
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

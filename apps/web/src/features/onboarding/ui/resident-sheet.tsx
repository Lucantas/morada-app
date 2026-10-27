import { useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import type { ResidentRepository } from '@/features/residents/domain/resident-repository';
import { saveResident } from '@/features/residents/domain/save-resident';
import { FormError, TextLink } from '@/shared/ui/entry-layout';
import { Field, PrimaryButton, SurfaceCard } from '@/shared/ui/primitives';

import type { AccessCardSlot, AccessInvitations } from './slots';

type SheetApartment = { label: string; residentId: string | null };

type Props = {
  apartment: SheetApartment;
  residents: Pick<ResidentRepository, 'save' | 'getById'>;
  invitations: AccessInvitations;
  accessCard: AccessCardSlot;
  onSaved: () => void;
  onClose: () => void;
};

type Access = { residentId: string; email: string | null };

function SheetFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} style={{ marginTop: 16 }}>
      <SurfaceCard>
        <h3 style={{ margin: '0 0 14px', fontFamily: "'Fraunces', serif", fontSize: '1.1rem' }}>
          {title}
        </h3>
        {children}
      </SurfaceCard>
    </section>
  );
}

function ResidentForm({
  apartment,
  residents,
  onSaved,
  onClose,
}: Pick<Props, 'apartment' | 'residents' | 'onClose'> & { onSaved: (access: Access) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [invalid, setInvalid] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () =>
      saveResident(residents, {
        name: name.trim(),
        apt: apartment.label,
        phone: phone.trim(),
        email: email.trim(),
        status: 'em_dia',
      }),
    onSuccess: (resident) => onSaved({ residentId: resident.id, email: resident.email }),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim() === '') {
      setInvalid('Informe o nome do morador.');
      return;
    }
    setInvalid(null);
    save.mutate();
  };

  const error =
    invalid ?? (save.isError ? 'Não foi possível salvar o morador. Tente de novo.' : null);

  return (
    <form noValidate onSubmit={submit}>
      <Field label="Nome" value={name} onChange={setName} autoComplete="off" />
      <Field label="Telefone" type="tel" value={phone} onChange={setPhone} autoComplete="off" />
      <Field label="E-mail" type="email" value={email} onChange={setEmail} autoComplete="off" />
      <FormError message={error} />
      <PrimaryButton type="submit" disabled={save.isPending}>
        {save.isPending ? 'Salvando…' : 'Salvar'}
      </PrimaryButton>
      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <TextLink onClick={onClose}>Cancelar</TextLink>
      </div>
    </form>
  );
}

function KnownResidentAccess({
  residentId,
  residents,
  invitations,
  accessCard: AccessCard,
}: Pick<Props, 'residents' | 'invitations' | 'accessCard'> & { residentId: string }) {
  const resident = useQuery({
    queryKey: ['residents', 'detail', residentId],
    queryFn: () => residents.getById(residentId),
  });
  if (resident.isPending) {
    return (
      <p role="status" style={{ color: 'var(--ink-500)', margin: '0 0 16px' }}>
        Carregando…
      </p>
    );
  }
  if (resident.isError) {
    return <FormError message="Não foi possível carregar o morador." />;
  }
  return (
    <AccessCard
      residentId={residentId}
      residentEmail={resident.data?.email ?? ''}
      repository={invitations}
    />
  );
}

export function ResidentSheet({
  apartment,
  residents,
  invitations,
  accessCard: AccessCard,
  onSaved,
  onClose,
}: Props) {
  const [access, setAccess] = useState<Access | null>(
    apartment.residentId === null ? null : { residentId: apartment.residentId, email: null },
  );

  if (access === null) {
    return (
      <SheetFrame title={`Quem mora no ${apartment.label}?`}>
        <ResidentForm
          apartment={apartment}
          residents={residents}
          onClose={onClose}
          onSaved={(saved) => {
            setAccess(saved);
            onSaved();
          }}
        />
      </SheetFrame>
    );
  }

  return (
    <SheetFrame title="Acesso do morador">
      {access.email === null ? (
        <KnownResidentAccess
          residentId={access.residentId}
          residents={residents}
          invitations={invitations}
          accessCard={AccessCard}
        />
      ) : (
        <AccessCard
          residentId={access.residentId}
          residentEmail={access.email}
          repository={invitations}
        />
      )}
      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <TextLink onClick={onClose}>Fechar</TextLink>
      </div>
    </SheetFrame>
  );
}

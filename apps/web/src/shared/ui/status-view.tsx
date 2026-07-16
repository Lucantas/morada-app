type Props = {
  variant: 'loading' | 'error';
  message: string;
  onRetry?: () => void;
};

export function StatusView({ variant, message, onRetry }: Props) {
  const isError = variant === 'error';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      style={{
        display: 'grid',
        placeItems: 'center',
        gap: 14,
        minHeight: '55%',
        textAlign: 'center',
        padding: 24,
      }}
    >
      {!isError && <div className="spinner" aria-hidden="true" />}
      <p style={{ margin: 0, color: isError ? 'var(--atraso-700)' : 'var(--ink-500)' }}>
        {message}
      </p>
      {isError && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            minHeight: 42,
            padding: '0 18px',
            borderRadius: 'var(--r-md)',
            border: '1.5px solid var(--petrol-600)',
            background: 'var(--surface)',
            color: 'var(--petrol-800)',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: '.92rem',
            cursor: 'pointer',
          }}
        >
          Tentar de novo
        </button>
      )}
    </div>
  );
}

import type { Message, MessageAuthor } from '../domain/message';

type Props = {
  messages: Message[];
  ownSide: MessageAuthor;
};

export function ChatThread({ messages, ownSide }: Props) {
  if (messages.length === 0) {
    return (
      <p style={{ color: 'var(--ink-500)', textAlign: 'center', marginTop: 24 }}>
        Nenhuma mensagem ainda. Envie a primeira.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {messages.map((message) => (
        <ChatBubble key={message.id} message={message} own={message.author === ownSide} />
      ))}
    </div>
  );
}

function ChatBubble({ message, own }: { message: Message; own: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: own ? 'flex-end' : 'flex-start' }}>
      <div style={{ maxWidth: '78%' }}>
        <div
          style={{
            padding: '10px 13px',
            borderRadius: 'var(--r-md)',
            background: own ? 'var(--petrol-700)' : 'var(--surface)',
            color: own ? '#fff' : 'var(--ink-900)',
            border: own ? 'none' : '1px solid var(--line)',
            fontSize: '.95rem',
            lineHeight: 1.4,
          }}
        >
          {message.text}
        </div>
        <div
          style={{
            fontSize: '.72rem',
            color: 'var(--ink-500)',
            marginTop: 4,
            textAlign: own ? 'right' : 'left',
          }}
        >
          {message.dateLabel}
        </div>
      </div>
    </div>
  );
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app/app';
import { trackAppHeight } from '@/shared/lib/viewport-height';
import '@/shared/ui/tokens.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root container #root not found');

trackAppHeight();

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

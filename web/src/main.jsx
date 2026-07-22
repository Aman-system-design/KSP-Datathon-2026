import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AppRouter } from './app/router.jsx';
import { readRuntime } from './app/runtime.js';
import { loadCatalystInit } from './auth/catalyst-auth.js';
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-500.css';
import '@fontsource/roboto/latin-700.css';
import './styles/tokens.css';
import './styles/app.css';

const runtime = readRuntime();
loadCatalystInit(document, runtime.authOrigin ? `${runtime.authOrigin}/__catalyst/sdk/init.js` : undefined);
createRoot(document.getElementById('root')).render(<StrictMode><AppRouter /></StrictMode>);

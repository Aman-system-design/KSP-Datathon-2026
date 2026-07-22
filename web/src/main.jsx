import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AppRouter } from './app/router.jsx';
import { loadCatalystInit } from './auth/catalyst-auth.js';
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-500.css';
import '@fontsource/roboto/latin-700.css';
import './styles/tokens.css';
import './styles/app.css';

loadCatalystInit();
createRoot(document.getElementById('root')).render(<StrictMode><AppRouter /></StrictMode>);

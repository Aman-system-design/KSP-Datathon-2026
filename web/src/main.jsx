import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AppRouter } from './app/router.jsx';
import { loadCatalystInit } from './auth/catalyst-auth.js';
import './styles/tokens.css';
import './styles/app.css';

loadCatalystInit();
createRoot(document.getElementById('root')).render(<StrictMode><AppRouter /></StrictMode>);

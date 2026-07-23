import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AppRouter } from './app/router.jsx';
import { BrandProvider } from './branding/BrandProvider.jsx';
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-500.css';
import '@fontsource/roboto/latin-700.css';
import './styles/tokens.css';
import './styles/app.css';

createRoot(document.getElementById('root')).render(<StrictMode><BrandProvider><AppRouter /></BrandProvider></StrictMode>);

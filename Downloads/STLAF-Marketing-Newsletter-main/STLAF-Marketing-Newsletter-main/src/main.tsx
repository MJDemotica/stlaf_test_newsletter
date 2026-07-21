//
// File: main.tsx
// Author: Juan Dela Cruz
// Date: 2026-06-09
// Purpose: Main entry point of the React frontend application, initializing and rendering the App in StrictMode
//

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

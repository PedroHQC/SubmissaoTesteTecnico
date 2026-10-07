import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { enableMocking } from './mocks/browser';
import './index.css';
import './components/ui/responsive.css';

async function bootstrap(): Promise<void> {
  try {
    await enableMocking();
  } catch (error) {
    console.warn('The demo API could not start. Gameplay remains available.', error);
  }
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
void bootstrap();

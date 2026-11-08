import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@/lib/theme';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <TooltipProvider delayDuration={300}>
      <App />
      <Toaster position="bottom-center" />
    </TooltipProvider>
  </ThemeProvider>,
);

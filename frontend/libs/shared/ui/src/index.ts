import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';

export const sharedPrimeNGConfig = providePrimeNG({
  theme: { preset: Aura, options: { darkModeSelector: '.app-dark' } },
});

export * from './lib/atoms/e-button/e-button.component';

export * from './lib/atoms/e-input-text/e-input-text.component';

export * from './lib/atoms/e-breadcrumb/e-breadcrumb.component';

export * from './lib/layouts/e-two-section-layout/e-two-section-layout.component';

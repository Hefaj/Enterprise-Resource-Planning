import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';

export const sharedPrimeNGConfig = providePrimeNG({
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '.app-dark',
    },
  },
});

export * from './lib/_components/erp-breadcrumb/erp-breadcrumb';

export * from './lib/_components/erp-menu/erp-menu';

export * from './lib/_components/erp-notification/erp-notification';

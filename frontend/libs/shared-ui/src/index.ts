import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';

export const sharedPrimeNGConfig = providePrimeNG({
  theme: {
    preset: Aura,
  },
});

export * from './lib/_components/erp-breadcrumb/erp-breadcrumb';

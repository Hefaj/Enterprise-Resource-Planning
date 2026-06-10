import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';

export const sharedPrimeNGConfig = providePrimeNG({
  theme: { preset: Aura, options: { darkModeSelector: '.dark' } },
});

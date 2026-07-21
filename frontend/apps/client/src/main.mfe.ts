((window as unknown) as Record<string, unknown>)['ngDevMode'] =
  ((window as unknown) as Record<string, unknown>)['ngDevMode'] ?? false;
import { initFederation } from '@angular-architects/native-federation';

initFederation('/module-federation.manifest.json')
  .then(() => import('./bootstrap'))
  .catch((err: unknown) => console.error(err));

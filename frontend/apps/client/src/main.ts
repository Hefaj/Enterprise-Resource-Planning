import { initFederation } from '@angular-architects/native-federation';

initFederation('/module-federation.manifest.json')
  .then(() => import('./bootstrap'))
  .catch((err) => console.error(err));

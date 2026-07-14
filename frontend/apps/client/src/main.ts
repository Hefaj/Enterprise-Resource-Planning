import { initFederation } from '@angular-architects/native-federation';

// async function bootstrap() {
//   const manifestUrl = '/module-federation.manifest.json';
  
//   try {
//     const response = await fetch(manifestUrl);
//     if (!response.ok) {
//       throw new Error(`Failed to fetch manifest: ${response.statusText}`);
//     }
//     const manifest = await response.json() as Record<string, string>;
    
//     // Check in parallel which remotes are reachable
//     const activeManifest: Record<string, string> = {};
//     const checks = Object.entries(manifest).map(async ([key, url]) => {
//       try {
//         const controller = new AbortController();
//         const timeoutId = setTimeout(() => controller.abort(), 1000);
        
//         // Fetch remoteEntry.json to check if remote is running
//         const res = await fetch(url, { signal: controller.signal });
//         clearTimeout(timeoutId);
        
//         if (res.ok) {
//           activeManifest[key] = url;
//         }
//       } catch {
//         console.warn(`[MFE Gateway] Remote "${key}" at ${url} is offline or unreachable.`);
//       }
//     });
    
//     await Promise.all(checks);
//     await initFederation(activeManifest);
//   } catch (err) {
//     console.error('[MFE Gateway] Failed to load manifest or initialize federation. Falling back to local only.', err);
//     await initFederation({});
//   }

//   await import('./bootstrap');
// }

// bootstrap().catch(err => console.error(err));

initFederation('/module-federation.manifest.json')
  .then(() => import('./bootstrap'))
  .catch((err) => console.error(err));

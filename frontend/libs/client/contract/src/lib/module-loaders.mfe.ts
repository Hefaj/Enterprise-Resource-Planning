import { loadRemoteModule } from '@angular-architects/native-federation';

/**
 * Rejestr dynamicznych loaderów kontraktów i tras dla modułów w trybie MIKROFRONTENDÓW (Native Federation).
 * Plik ten podmieniany jest przez mechanizm `fileReplacements` w project.json hosta w konfiguracjach MFE/Production.
 */
export async function loadModuleContract(modulePrefix: string): Promise<any> {
  try {
    return await loadRemoteModule({
      remoteName: modulePrefix,
      exposedModule: './contract',
    });
  } catch (error) {
    console.warn(`[ModuleLoaders/MFE] Nie udało się pobrać kontraktu zdalnego remota "${modulePrefix}".`, error);
    return null;
  }
}

export async function loadModuleRoutes(modulePrefix: string): Promise<any[]> {
  const module = await loadModuleContract(modulePrefix);
  return module?.remoteRoutes ?? [];
}

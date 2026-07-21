/**
 * Rejestr dynamicznych loaderów kontraktów i tras dla modułów w trybie MONOLIT (DEV).
 * Plik ten jest używany domyślnie podczas lokalnego programowania bez osobnych serwerów remotów.
 */
export const MODULE_LOADERS: Record<string, () => Promise<any>> = {
  catalog: () => import('@erp/catalog/contract'),
  inventory: () => import('@erp/inventory/contract'),
  sales: () => import('@erp/sales/contract'),
  dms: () => import('@erp/dms/contract'),
  'task-management': () => import('@erp/task-management/contract'),
  notification: () => import('@erp/notification/contract'),
};

export async function loadModuleContract(modulePrefix: string): Promise<any> {
  const loader = MODULE_LOADERS[modulePrefix];
  if (!loader) {
    console.warn(`[ModuleLoaders/Monolith] Brak zarejestrowanego loadera dla modułu "${modulePrefix}"`);
    return null;
  }
  return loader();
}

export async function loadModuleRoutes(modulePrefix: string): Promise<any[]> {
  const module = await loadModuleContract(modulePrefix);
  return module?.remoteRoutes ?? [];
}

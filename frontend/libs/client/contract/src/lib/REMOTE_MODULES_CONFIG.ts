export interface RemoteModuleConfig {
  id: string;
  label: string;
  path: string; // Ścieżka do Module Federation (np. 'catalog/MenuDefinition')
  routePrefix: string; // Ścieżka w Angular Routerze Hosta (np. 'catalog')
}
// Konfiguracja naszych modułów - łatwa do rozszerzania w przyszłości
export const REMOTE_MODULES_CONFIG: RemoteModuleConfig[] = [
  { id: 'catalog', label: 'Katalog', path: 'catalog/MenuDefinition', routePrefix: 'catalog' },
  { id: 'inventory', label: 'WMS', path: 'inventory/MenuDefinition', routePrefix: 'inventory' },
  { id: 'sales', label: 'Sprzedaż', path: 'sales/MenuDefinition', routePrefix: 'sales' },
];

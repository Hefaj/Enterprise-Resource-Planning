export interface RemoteModuleConfig {
  id: string;
  label: string;
  routePrefix: string; // Ścieżka w Angular Routerze Hosta (np. 'catalog')
}
// Konfiguracja naszych modułów - łatwa do rozszerzania w przyszłości
export const REMOTE_MODULES_CONFIG: RemoteModuleConfig[] = [
  { id: 'catalog', label: 'Katalog', routePrefix: 'catalog' },
  { id: 'inventory', label: 'WMS', routePrefix: 'inventory' },
  { id: 'sales', label: 'Sprzedaż', routePrefix: 'sales' },
];

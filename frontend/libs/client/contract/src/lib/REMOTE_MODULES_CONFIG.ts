import { RemoteModuleConfig } from '@erp/client/util';

export type { RemoteModuleConfig };

// Konfiguracja naszych modułów - łatwa do rozszerzania w przyszłości
export const REMOTE_MODULES_CONFIG: RemoteModuleConfig[] = [
  { id: 'catalog', label: 'Katalog', routePrefix: 'catalog' },
  { id: 'inventory', label: 'WMS', routePrefix: 'inventory' },
  { id: 'sales', label: 'Sprzedaż', routePrefix: 'sales' },
  { id: 'dms', label: 'DMS', routePrefix: 'dms' },
  { id: 'task-management', label: 'Zadania', routePrefix: 'task-management' },
  { id: 'notification', label: 'Notyfikacje', routePrefix: 'notification' },
];

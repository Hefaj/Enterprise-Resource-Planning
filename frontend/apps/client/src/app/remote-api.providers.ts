import { Provider } from '@angular/core';
import { API_BASE_URL as CATALOG_API_BASE_URL } from '@erp/catalog/data-access';
import { API_BASE_URL as NOTIFICATION_API_BASE_URL } from '@erp/notification/data-access';
import { API_BASE_URL as IDENTITY_API_BASE_URL } from '@erp/identity/data-access';
import { SIGNALR_HUB_URL } from '@erp/shared/data-access';
import { IDENTITY_PERMISSIONS_API_BASE_URL } from '@erp/shared/auth';

/**
 * Konfiguracja bazowych adresów URL dla klientów API poszczególnych modułów.
 * Zgrupowane tutaj, aby uniknąć zaśmiecania głównego pliku app.config.ts.
 */
export const remoteApiProviders: Provider[] = [
  { provide: CATALOG_API_BASE_URL, useValue: 'http://localhost:5149' },
  { provide: NOTIFICATION_API_BASE_URL, useValue: 'http://localhost:5250' },
  { provide: IDENTITY_API_BASE_URL, useValue: 'http://localhost:5280' },
  // Osobny token od IDENTITY_API_BASE_URL (ta sama wartość) — `PermissionStore` żyje w
  // `@erp/shared/auth` (`type:auth`), które nie może zależeć od `@erp/identity/data-access`
  // (`type:data-access`), patrz docs/backend/identity-authz.md §6 Faza 5.
  { provide: IDENTITY_PERMISSIONS_API_BASE_URL, useValue: 'http://localhost:5280' },
  // Hub SignalR mieszka w Notification — domyślna ścieżka względna `/hubs/sync` zakłada
  // wspólny origin za gatewayem, którego jeszcze nie ma, więc do czasu jego powstania
  // wskazujemy wprost na port Notification.
  { provide: SIGNALR_HUB_URL, useValue: 'http://localhost:5250/hubs/sync' },
];

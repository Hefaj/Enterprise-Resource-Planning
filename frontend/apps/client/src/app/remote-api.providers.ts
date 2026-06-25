import { Provider } from '@angular/core';
import { API_BASE_URL as CATALOG_API_BASE_URL } from '@erp/catalog/data-access';
import { API_BASE_URL as NOTIFICATION_API_BASE_URL } from '@erp/notification/data-access';

/**
 * Konfiguracja bazowych adresów URL dla klientów API poszczególnych modułów.
 * Zgrupowane tutaj, aby uniknąć zaśmiecania głównego pliku app.config.ts.
 */
export const remoteApiProviders: Provider[] = [
  { provide: CATALOG_API_BASE_URL, useValue: 'http://localhost:5149' },
  { provide: NOTIFICATION_API_BASE_URL, useValue: 'http://localhost:5250' },
];

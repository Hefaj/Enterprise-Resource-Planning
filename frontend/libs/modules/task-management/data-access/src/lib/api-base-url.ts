/**
 * Adres bazowy mikroserwisu Task Management (domyślnie `http://localhost:5290` w dev — patrz
 * `remote-api.providers.ts` hosta). Token `API_BASE_URL` jest re-eksportowany wprost
 * z wygenerowanego klienta NSwag — jedno źródło prawdy, ten sam `InjectionToken`, żeby
 * `remoteApiProviders` konfigurował faktycznie używaną instancję `TaskManagementClient`,
 * a nie osobny, niepowiązany token.
 */
export { API_BASE_URL } from './api-client';

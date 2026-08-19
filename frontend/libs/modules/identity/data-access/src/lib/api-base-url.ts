/**
 * Adres bazowy mikroserwisu Identity (domyślnie `http://localhost:5280` w dev — patrz
 * `remote-api.providers.ts` hosta). Od czasu wygenerowania `api-client.ts` (NSwag) token
 * `API_BASE_URL` jest re-eksportowany wprost z wygenerowanego klienta — jedno źródło prawdy,
 * ten sam `InjectionToken`, żeby `remoteApiProviders` konfigurował faktycznie używaną
 * instancję `IdentityClient`, a nie osobny, niepowiązany token.
 */
export { API_BASE_URL } from './api-client';

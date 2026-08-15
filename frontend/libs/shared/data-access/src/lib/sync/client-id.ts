/**
 * Identyfikator tej karty/instancji przeglądarki — stały w obrębie sesji.
 *
 * `sessionStorage`, nie `localStorage`: każda karta ma dostawać własne powiadomienia
 * o zadaniach, a nie dzielić jeden identyfikator ze wszystkimi kartami tej samej przeglądarki.
 *
 * Ta sama wartość jedzie DWOMA kanałami i to jest cały sens wydzielenia jej tutaj:
 * - jako `clientId` w query stringu połączenia SignalR (`SignalrSyncService`),
 * - jako nagłówek `X-Client-Id` w żądaniach HTTP (`erpClientIdInterceptor`).
 *
 * Dzięki temu backend zapisuje w zadaniu tego samego adresata, do którego potem adresuje
 * powiadomienie o jego zakończeniu (`RealtimeBroadcaster.BroadcastJobsAsync` → grupa
 * `client:{clientId}`). Rozjazd między tymi dwoma kanałami oznaczałby zadania, o których
 * zakończeniu nikt się nie dowie.
 *
 * <b>To nie jest uwierzytelnianie</b> — patrz udokumentowane ograniczenie w `SyncHub`
 * i `ExecutionContextMiddleware` po stronie backendu.
 */
const CLIENT_ID_STORAGE_KEY = 'erp_signalr_client_id';

export function getOrCreateClientId(): string {
  let clientId = sessionStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (!clientId) {
    clientId = crypto.randomUUID();
    sessionStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId);
  }
  return clientId;
}

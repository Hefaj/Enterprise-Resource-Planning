import { Injectable, inject, InjectionToken } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export const SIGNALR_HUB_URL = new InjectionToken<string>('SIGNALR_HUB_URL', {
  providedIn: 'root',
  factory: (): string => '/hubs/sync'
});

export interface AggregateUpdateMessage {
  signature: string;
  uuids: string[];
}

/**
 * Identyfikator tej karty/instancji przeglądarki — stały w obrębie sesji (sessionStorage,
 * nie localStorage: każda karta ma dostawać własne powiadomienia o zadaniach, a nie dzielić
 * jeden identyfikator ze wszystkimi kartami tej samej przeglądarki).
 *
 * Wysyłany do huba jako `clientId` w query stringu połączenia — patrz `SyncHub.OnConnectedAsync`
 * po stronie backendu i jego udokumentowane ograniczenie: to NIE jest uwierzytelnianie,
 * tylko luźny identyfikator do grupowania, dopóki nie powstanie prawdziwe uwierzytelnianie.
 */
function getOrCreateClientId(): string {
  const key = 'erp_signalr_client_id';
  let clientId = sessionStorage.getItem(key);
  if (!clientId) {
    clientId = crypto.randomUUID();
    sessionStorage.setItem(key, clientId);
  }
  return clientId;
}

@Injectable({
  providedIn: 'root'
})
export class SignalrSyncService {
  private readonly _hubUrl: string = inject(SIGNALR_HUB_URL);
  private readonly _update$: Subject<AggregateUpdateMessage> = new Subject<AggregateUpdateMessage>();
  private _connection: signalR.HubConnection | null = null;

  /** Sygnatury już zasubskrybowane po stronie huba — żeby nie wołać `Subscribe` powtórnie
   * dla każdego kolejnego `onUpdate(signature)` tej samej sygnatury. */
  private readonly _subscribedSignatures = new Set<string>();

  public constructor() {
    this._initConnection();
  }

  private _initConnection(): void {
    const clientId = getOrCreateClientId();

    this._connection = new signalR.HubConnectionBuilder()
      .withUrl(`${this._hubUrl}?clientId=${encodeURIComponent(clientId)}`)
      .withAutomaticReconnect()
      .build();

    this._connection.on('ReceiveUpdates', (signature: string, uuids: string[]) => {
      this._update$.next({ signature, uuids });
    });

    // Ponowne dołączenie do wszystkich subskrybowanych grup po reconnect — SignalR nie
    // pamięta grup po stronie serwera między połączeniami (nowe ConnectionId za każdym razem).
    this._connection.onreconnected(() => {
      for (const signature of this._subscribedSignatures) {
        this._invokeSubscribe(signature);
      }
    });

    this._connection
      .start()
      .then(() => {
        console.log(`[SignalrSyncService] Connected to Real-time Sync Hub: ${this._hubUrl}`);
        for (const signature of this._subscribedSignatures) {
          this._invokeSubscribe(signature);
        }
      })
      .catch(err => console.error('[SignalrSyncService] Connection error: ', err));
  }

  /**
   * Listen to real-time update events for a specific aggregate signature.
   *
   * Pierwsze wywołanie dla danej sygnatury dołącza połączenie do grupy `agg:{signature}`
   * po stronie huba — bez tego serwer nigdy by nic nie wysłał (broadcast jest adresowany
   * do grupy, nie do wszystkich połączeń). Odpowiednik wywołania `Subscribe` na hubie.
   */
  public onUpdate(signature: string): Observable<string[]> {
    if (!this._subscribedSignatures.has(signature)) {
      this._subscribedSignatures.add(signature);
      this._invokeSubscribe(signature);
    }

    return this._update$.pipe(
      filter(msg => msg.signature === signature),
      map(msg => msg.uuids)
    );
  }

  private _invokeSubscribe(signature: string): void {
    if (this._connection?.state !== signalR.HubConnectionState.Connected) {
      // Połączenie jeszcze się nie ustanowiło — `start().then(...)` dogoni subskrypcję.
      return;
    }

    console.log(`[SignalrSyncService] Subscribe(${signature})`);
    this._connection.invoke('Subscribe', signature)
      .then(() => console.log(`[SignalrSyncService] Subscribe(${signature}) acked`))
      .catch(err => console.error(`[SignalrSyncService] Subscribe(${signature}) failed: `, err));
  }

  /**
   * Directly inject an update event. This is useful for:
   * 1. Writing unit/integration tests.
   * 2. Triggering local client synchronizations manually.
   */
  public triggerLocalUpdate(signature: string, uuids: string[]): void {
    console.log(`[SignalrSyncService] Local sync update triggered for [${signature}]:`, uuids);
    this._update$.next({ signature, uuids });
  }
}

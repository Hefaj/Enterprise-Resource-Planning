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
  private readonly _delete$: Subject<AggregateUpdateMessage> = new Subject<AggregateUpdateMessage>();
  /** Emituje samą sygnaturę, gdy trzeba porzucić cache i przeładować widoczne dane —
   * zarówno na wprost wysłany `ReceiveResync`, jak i na `ReceiveInvalidation(signature, 'all')`.
   * Dla konsumenta (`BaseOrchestrator`) skutek jest identyczny, więc jeden strumień. */
  private readonly _fullRefresh$: Subject<string> = new Subject<string>();
  private _connection: signalR.HubConnection | null = null;

  /** Liczba aktywnych subskrybentów (orkiestratorów) per sygnatura — hub `Subscribe`/
   * `Unsubscribe` woła się dopiero na przejściu 0→1 / 1→0. Ref-counted, bo `BaseOrchestrator`
   * jest `@Injectable()` bez `providedIn: 'root'`: kolejne nawigacje mogą tworzyć i niszczyć
   * kolejne instancje tego samego typu, a subskrypcja grupy na hubie musi przeżyć, dopóki
   * choć jedna z nich żyje. */
  private readonly _refCounts = new Map<string, number>();

  /** Ostatni znany numer sekwencji per sygnatura (patrz `ReceiveSequence` / `SyncHub.Subscribe`
   * po stronie backendu). Celowo NIE czyszczony przy `unsubscribe` — stary numer zostaje, żeby
   * ponowna subskrypcja po dłuższej nieobecności poprawnie wykryła lukę i wymusiła resync. */
  private readonly _lastSeenSequence = new Map<string, number>();

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

    this._connection.on('ReceiveDeletes', (signature: string, uuids: string[]) => {
      this._delete$.next({ signature, uuids });
    });

    this._connection.on('ReceiveInvalidation', (signature: string, scope: string) => {
      if (scope === 'all') {
        this._fullRefresh$.next(signature);
      }
    });

    this._connection.on('ReceiveResync', (signature: string) => {
      this._fullRefresh$.next(signature);
    });

    this._connection.on('ReceiveSequence', (signature: string, sequence: number) => {
      this._lastSeenSequence.set(signature, sequence);
    });

    // Ponowne dołączenie do wszystkich subskrybowanych grup po reconnect — SignalR nie
    // pamięta grup po stronie serwera między połączeniami (nowe ConnectionId za każdym razem).
    // Każdy z nich niesie swój `lastSeenSequence` — to jest właśnie moment, w którym backend
    // wykrywa lukę powstałą w trakcie rozłączenia i odsyła `ReceiveResync`.
    this._connection.onreconnected(() => {
      for (const signature of this._refCounts.keys()) {
        this._invokeSubscribe(signature);
      }
    });

    this._connection
      .start()
      .then(() => {
        console.log(`[SignalrSyncService] Connected to Real-time Sync Hub: ${this._hubUrl}`);
        for (const signature of this._refCounts.keys()) {
          this._invokeSubscribe(signature);
        }
      })
      .catch(err => console.error('[SignalrSyncService] Connection error: ', err));
  }

  /**
   * Zarejestruj zainteresowanie sygnaturą — pierwsze wywołanie dla danej sygnatury (0→1)
   * dołącza połączenie do grupy `agg:{signature}` po stronie huba. Musi mieć odpowiadające
   * `unsubscribe(signature)`, inaczej grupa na hubie nigdy się nie zwalnia.
   */
  public subscribe(signature: string): void {
    const count = this._refCounts.get(signature) ?? 0;
    this._refCounts.set(signature, count + 1);

    if (count === 0) {
      this._invokeSubscribe(signature);
    }
  }

  /**
   * Odwrotność `subscribe` — na przejściu 1→0 opuszcza grupę `agg:{signature}` na hubie.
   * `_lastSeenSequence` dla tej sygnatury celowo nie jest czyszczony (patrz pole).
   */
  public unsubscribe(signature: string): void {
    const count = this._refCounts.get(signature) ?? 0;
    if (count <= 1) {
      this._refCounts.delete(signature);
      this._invokeUnsubscribe(signature);
    } else {
      this._refCounts.set(signature, count - 1);
    }
  }

  /**
   * Listen to real-time update events for a specific aggregate signature.
   * Nie subskrybuje sam z siebie grupy na hubie — wymaga jawnego `subscribe(signature)`.
   */
  public onUpdate(signature: string): Observable<string[]> {
    return this._update$.pipe(
      filter(msg => msg.signature === signature),
      map(msg => msg.uuids)
    );
  }

  /** Jak `onUpdate`, ale dla usunięć (`ReceiveDeletes`). */
  public onDelete(signature: string): Observable<string[]> {
    return this._delete$.pipe(
      filter(msg => msg.signature === signature),
      map(msg => msg.uuids)
    );
  }

  /** Emituje, gdy trzeba porzucić cache tej sygnatury i przeładować to, co aktualnie
   * załadowane — `ReceiveResync` albo próg inwalidacji (`ReceiveInvalidation(.., 'all')`). */
  public onResync(signature: string): Observable<void> {
    return this._fullRefresh$.pipe(
      filter(sig => sig === signature),
      map(() => undefined)
    );
  }

  private _invokeSubscribe(signature: string): void {
    if (this._connection?.state !== signalR.HubConnectionState.Connected) {
      // Połączenie jeszcze się nie ustanowiło — `start().then(...)` dogoni subskrypcję.
      return;
    }

    const lastSeenSequence = this._lastSeenSequence.get(signature) ?? null;

    console.log(`[SignalrSyncService] Subscribe(${signature}, lastSeenSequence=${lastSeenSequence})`);
    this._connection.invoke('Subscribe', signature, lastSeenSequence)
      .then(() => console.log(`[SignalrSyncService] Subscribe(${signature}) acked`))
      .catch(err => console.error(`[SignalrSyncService] Subscribe(${signature}) failed: `, err));
  }

  private _invokeUnsubscribe(signature: string): void {
    if (this._connection?.state !== signalR.HubConnectionState.Connected) {
      return;
    }

    console.log(`[SignalrSyncService] Unsubscribe(${signature})`);
    this._connection.invoke('Unsubscribe', signature)
      .catch(err => console.error(`[SignalrSyncService] Unsubscribe(${signature}) failed: `, err));
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

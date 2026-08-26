import { Injectable, inject, InjectionToken } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { getOrCreateClientId } from './client-id';

export const SIGNALR_HUB_URL = new InjectionToken<string>('SIGNALR_HUB_URL', {
  providedIn: 'root',
  factory: (): string => '/hubs/sync'
});

/**
 * Dostawca access tokenu dla negocjacji SignalR. Wstrzykiwany jako funkcja (nie bezpośrednia
 * zależność od `@erp/shared/auth`) — `data-access` nie może importować warstwy `auth` (patrz
 * granice modułów w `CLAUDE.md`: `auth` jest dostępne tylko dla `contract`), więc hosta
 * (`app.config.ts`, warstwa `contract`) podstawia tu `() => authService.getAccessToken()`.
 * Domyślnie `null` — SignalR łączy się bez tokenu (dopóki `SyncHub` nie miał `[Authorize]`,
 * tak właśnie działało; teraz host MUSI nadpisać ten provider, inaczej negocjacja dostaje 401).
 */
export const SIGNALR_ACCESS_TOKEN_FACTORY = new InjectionToken<() => Promise<string> | string | null>(
  'SIGNALR_ACCESS_TOKEN_FACTORY',
  {
    providedIn: 'root',
    factory: (): (() => null) => () => null,
  },
);

export interface AggregateUpdateMessage {
  signature: string;
  uuids: string[];
}

@Injectable({
  providedIn: 'root'
})
export class SignalrSyncService {
  private readonly _hubUrl: string = inject(SIGNALR_HUB_URL);
  private readonly _accessTokenFactory = inject(SIGNALR_ACCESS_TOKEN_FACTORY);
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
      .withUrl(`${this._hubUrl}?clientId=${encodeURIComponent(clientId)}`, {
        accessTokenFactory: () => this._accessTokenFactory() ?? '',

        // Bez negocjacji — wymóg pracy za load balancerem bez powinowactwa sesji.
        //
        // Uzgadnianie SignalR (`negotiate`) zwraca token połączenia związany z INSTANCJĄ, która
        // je obsłużyła. Przy kilku instancjach Notification kolejne żądanie trafia round-robinem
        // gdzie indziej, ta instancja nic o tym tokenie nie wie i połączenie nie wstaje. Zamiast
        // wymagać sticky sessions na LB, usuwamy stan, który trzeba by przykleić: bez negocjacji
        // klient od razu otwiera WebSocket.
        //
        // Cena, przyjęta świadomie: znika fallback na SSE i long-polling, więc WebSockety muszą
        // działać na CAŁEJ drodze sieciowej (proxy, LB, firmowy firewall). Uwierzytelnianie
        // działa bez zmian — przy transporcie WebSocket token i tak idzie w query stringu
        // `access_token`, a `ErpAuthExtensions.OnMessageReceived` już go stamtąd czyta.
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets,
      })
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

    void this._startWithRetry();
  }

  /**
   * Pierwsze `.start()` może przegonić token — `SignalrSyncService` jest `providedIn: 'root'`
   * i startuje połączenie już w konstruktorze, czyli w chwili PIERWSZEGO wstrzyknięcia (dziś:
   * synchronicznie na początku `STARTUP()`, PRZED `authService.waitUntilAuthReady()`). Negocjacja
   * wysłana z pustym/nieaktualnym tokenem z `_accessTokenFactory()` kończy się `401`, a
   * `withAutomaticReconnect()` NIE obejmuje tego przypadku — łapie tylko rozłączenie PO udanym
   * połączeniu, nie porażkę pierwszego `.start()`. Retry z krótkim odstępem daje tokenowi czas
   * (ten sam problem i to samo remedium co `PermissionStore.loadWithRetry`, z którym `data-access`
   * nie może się dzielić kodem — `type:data-access` nie wolno zależeć od `type:auth`, patrz
   * granice modułów w CLAUDE.md).
   */
  private async _startWithRetry(attempt = 1, maxAttempts = 10, delayMs = 500): Promise<void> {
    if (!this._connection) {
      return;
    }

    try {
      await this._connection.start();
      console.log(`[SignalrSyncService] Connected to Real-time Sync Hub: ${this._hubUrl}`);
      for (const signature of this._refCounts.keys()) {
        this._invokeSubscribe(signature);
      }
    } catch (err) {
      if (attempt >= maxAttempts) {
        console.error('[SignalrSyncService] Connection error: ', err);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
      await this._startWithRetry(attempt + 1, maxAttempts, delayMs);
    }
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

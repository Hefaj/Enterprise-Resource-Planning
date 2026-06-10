import { Injectable, inject, InjectionToken } from '@angular/core';
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

@Injectable({
  providedIn: 'root'
})
export class SignalrSyncService {
  private readonly _hubUrl: string = inject(SIGNALR_HUB_URL);
  private readonly _update$: Subject<AggregateUpdateMessage> = new Subject<AggregateUpdateMessage>();
  private _connection: unknown = null;

  public constructor() {
    this._initConnection();
  }

  private _initConnection(): void {
    // Standard SignalR integration blueprint.
    // Once @microsoft/signalr is installed, replace this stub with:
    //
    // import * as signalR from '@microsoft/signalr';
    //
    // this._connection = new signalR.HubConnectionBuilder()
    //   .withUrl(this._hubUrl)
    //   .withAutomaticReconnect()
    //   .build();
    //
    // this._connection.on('ReceiveUpdates', (signature: string, uuids: string[]) => {
    //   this._update$.next({ signature, uuids });
    // });
    //
    // this._connection.start()
    //   .then(() => console.log('[SignalrSyncService] Connected to Real-time Sync Hub'))
    //   .catch(err => console.error('[SignalrSyncService] Connection error: ', err));

    console.log(`[SignalrSyncService] Initializing hub connection to: ${this._hubUrl}`);
  }

  /**
   * Listen to real-time update events for a specific aggregate signature.
   */
  public onUpdate(signature: string): Observable<string[]> {
    return this._update$.pipe(
      filter(msg => msg.signature === signature),
      map(msg => msg.uuids)
    );
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

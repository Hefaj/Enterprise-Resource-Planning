import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { SignalrSyncService } from '../sync/signalr-sync.service';

/**
 * Licznik nieprzeczytanych powiadomień osobistych (`UserNotification` — Faza 5,
 * `docs/backend/user-notifications.md`) — mieszka w `shared`, tak samo jak {@link JobService}
 * i z tego samego powodu: dzwonek stoi w shellu (`scope:host`) i musi znać licznik, zanim
 * ktokolwiek pociągnie zdalny komponent listy z modułu `notification`.
 *
 * <b>Inaczej niż zadania, ten licznik ma prawdę wyłącznie na serwerze</b> — `read_at` jest
 * kolumną, nie heurystyką klienta (`LAST_SEEN_STORAGE_KEY` w `JobService`). Front tylko
 * odzwierciedla to, co przyszło z `getUnreadCount`/`ReceiveNotification`, nigdy nie liczy sam.
 */
@Injectable({ providedIn: 'root' })
export class UserNotificationService {
  private readonly _signalrSync = inject(SignalrSyncService);
  private readonly _unreadCount = signal(0);

  public readonly unreadCount: Signal<number> = computed(() => this._unreadCount());

  public constructor() {
    // Kanał `ReceiveNotification` jest auto-dołączony do grupy `user:{userId}` na hubie —
    // bez jawnego `subscribe(...)`, inaczej niż `agg:{signature}` (patrz SyncHub).
    this._signalrSync.onNotification().subscribe(({ unreadCount }) => this._unreadCount.set(unreadCount));
  }

  /** Wpisuje licznik z odpowiedzi serwera (`getUnreadCount`, bootstrap sesji). */
  public setUnreadCount(count: number): void {
    this._unreadCount.set(Math.max(0, count));
  }
}

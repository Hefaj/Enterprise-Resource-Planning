import { Injectable, Signal, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { UserNotificationService } from '@erp/shared/data-access';

import { NotificationClient, UserNotificationDto } from './api-client';

/** Rozmiar strony listy powiadomień pod dzwonkiem — feed pod popoverem, nie pełna historia. */
const NOTIFICATION_FEED_PAGE_SIZE = 20;

/**
 * Spina osobisty feed powiadomień (`UserNotification`, Faza 5) z licznikiem w `shared`
 * ({@link UserNotificationService}) — ten sam podział odpowiedzialności co {@link JobFeedService}
 * dla zadań: serwis w `shared` niesie tylko licznik dla dzwonka hosta, ten serwis (w module
 * `notification`) zna API i utrzymuje samą listę, wczytywaną dopiero po otwarciu panelu.
 *
 * <b>Bez orkiestratora i bez kanału `agg:{signature}` — celowo</b> (patrz
 * `NotificationInfrastructureExtensions` po stronie backendu): to feed osobisty, nie replika
 * współdzielonego agregatu. Realtime idzie wyłącznie przez `ReceiveNotification`
 * (`SignalrSyncService.onNotification()`), które tu triggeruje przeładowanie pierwszej strony.
 */
@Injectable({ providedIn: 'root' })
export class UserNotificationFeedService {
  private readonly _api = inject(NotificationClient);
  private readonly _unread = inject(UserNotificationService);

  private readonly _items = signal<UserNotificationDto[]>([]);
  private readonly _loading = signal(false);

  public readonly items: Signal<UserNotificationDto[]> = this._items.asReadonly();
  public readonly loading: Signal<boolean> = this._loading.asReadonly();

  /** Wczytuje licznik nieprzeczytanych — wołane przy starcie sesji, zanim ktokolwiek otworzy
   * dzwonek, tak samo jak `JobFeedService.bootstrap()`. */
  public async bootstrapUnreadCount(): Promise<void> {
    try {
      const response = await firstValueFrom(this._api.getUnreadCount());
      this._unread.setUnreadCount(response.count ?? 0);
    } catch (error) {
      console.error('[UserNotificationFeedService] Nie udało się pobrać licznika nieprzeczytanych.', error);
    }
  }

  /** Wczytuje listę powiadomień do panelu — wołane dopiero przy otwarciu zakładki. */
  public async loadAsync(): Promise<void> {
    this._loading.set(true);

    try {
      const response = await firstValueFrom(
        this._api.searchUserNotification({ page: 1, pageSize: NOTIFICATION_FEED_PAGE_SIZE }),
      );
      this._items.set(response.items ?? []);
    } catch (error) {
      console.error('[UserNotificationFeedService] Nie udało się pobrać powiadomień.', error);
    } finally {
      this._loading.set(false);
    }
  }

  /** Oznacza jedno powiadomienie jako przeczytane — optymistycznie usuwa je z lokalnej listy
   * i odejmuje jeden od licznika, żeby dzwonek zgasł natychmiast, bez czekania na odpowiedź. */
  public async markReadAsync(uuid: string): Promise<void> {
    const wasUnread = this._items().some((item) => item.uuid === uuid && !item.readAt);

    this._items.update((items) =>
      items.map((item) => (item.uuid === uuid ? { ...item, readAt: item.readAt ?? new Date() } : item)),
    );

    if (wasUnread) {
      this._unread.setUnreadCount(this._unread.unreadCount() - 1);
    }

    try {
      await firstValueFrom(this._api.setNotificationRead({ uuid }));
    } catch (error) {
      console.error('[UserNotificationFeedService] Nie udało się oznaczyć powiadomienia jako przeczytane.', error);
    }
  }

  public async markAllReadAsync(): Promise<void> {
    this._items.update((items) => items.map((item) => ({ ...item, readAt: item.readAt ?? new Date() })));
    this._unread.setUnreadCount(0);

    try {
      await firstValueFrom(this._api.setAllNotificationsRead());
    } catch (error) {
      console.error('[UserNotificationFeedService] Nie udało się oznaczyć wszystkich powiadomień jako przeczytane.', error);
    }
  }
}

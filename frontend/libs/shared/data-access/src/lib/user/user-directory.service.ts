import { HttpClient } from '@angular/common/http';
import { InjectionToken, Injectable, Provider, Signal, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  ERP_USER_DIRECTORY,
  ErpUserDirectory,
  ErpUserDirectoryPage,
  ErpUserDirectoryQuery,
  ErpUserRef,
} from '@erp/shared/util';

/**
 * Adres mikroserwisu Identity dla katalogu użytkowników.
 *
 * <p>Osobny token od <c>API_BASE_URL</c> Identity (ta sama wartość) — z tego samego powodu,
 * dla którego osobny jest <c>IDENTITY_PERMISSIONS_API_BASE_URL</c>: <c>@erp/shared/data-access</c>
 * nie może zależeć od <c>@erp/identity/data-access</c>, bo reguła <c>scope:shared</c> pozwala mu
 * zależeć wyłącznie od <c>scope:shared</c>.</p>
 */
export const USER_DIRECTORY_API_BASE_URL = new InjectionToken<string>('USER_DIRECTORY_API_BASE_URL');

/** Ile pozycji oddaje jedna strona wyszukiwania, gdy wołający nie powie inaczej. */
const DEFAULT_PAGE_SIZE = 25;

interface UserDirectoryDto {
  uuid: string;
  displayName: string;
  email: string;
  isActive: boolean;
}

interface SearchResponseDto {
  uuids: string[];
  totalCount: number;
}

/**
 * Katalog użytkowników — jedno miejsce w całym froncie, które zamienia uuid na nazwisko.
 *
 * <p><b>Dlaczego wspólny serwis, a nie orkiestrator per moduł.</b> Użytkownik jest bytem
 * <b>ponadmodułowym</b>: to samo nazwisko pokazuje przypisany w Task Management, akceptujący
 * w DMS i autor nadania w Identity. Trzy orkiestratory oznaczałyby trzy cache’e tych samych
 * osób i trzy komplety żądań przy przejściu między modułami — a scope’y NX i tak nie pozwalają
 * im się nawzajem widzieć.</p>
 *
 * <p><b>Sklejanie paczek jest tu istotą, nie optymalizacją.</b> Tabela zgłoszeń renderuje
 * pięćdziesiąt wierszy naraz, każdy pyta o swojego przypisanego. Bez sklejenia byłoby to
 * pięćdziesiąt żądań HTTP na jedno przewinięcie; z nim — jedno, bo zamówienia z tego samego
 * cyklu renderowania trafiają do wspólnego koszyka i wychodzą jednym <c>getUserDirectory</c>.</p>
 *
 * <p><b>Braku wpisu nie ponawiamy.</b> Uuid, którego katalog nie zna (konto skasowane
 * w Keycloaku, dane z importu), zostaje zapamiętany jako „nie ma” — inaczej każde przerysowanie
 * tabeli pytałoby o niego od nowa, w nieskończoność.</p>
 */
@Injectable({ providedIn: 'root' })
export class UserDirectoryService implements ErpUserDirectory {
  private readonly _http = inject(HttpClient);
  private readonly _baseUrl = inject(USER_DIRECTORY_API_BASE_URL, { optional: true }) ?? '';

  /** Cache tożsamościowy: uuid → sygnał z pozycją katalogu (albo `undefined`, gdy brak). */
  private readonly _users = new Map<string, ReturnType<typeof signal<ErpUserRef | undefined>>>();

  /** Uuidy zamówione w tym cyklu, jeszcze niewysłane. */
  private readonly _pending = new Set<string>();

  /** Żądanie sklejające bieżący koszyk — `null`, gdy koszyk jest pusty. */
  private _flush: Promise<void> | null = null;

  /** @inheritdoc */
  public getOne(uuid: string | null | undefined): Signal<ErpUserRef | undefined> {
    if (!uuid) {
      return signal<ErpUserRef | undefined>(undefined).asReadonly();
    }

    const cached = this._users.get(uuid);

    if (cached) {
      return cached.asReadonly();
    }

    const entry = signal<ErpUserRef | undefined>(undefined);
    this._users.set(uuid, entry);
    this._enqueue(uuid);

    return entry.asReadonly();
  }

  /** @inheritdoc */
  public async loadAsync(uuids: readonly string[]): Promise<void> {
    const missing = uuids.filter((uuid) => uuid && !this._users.has(uuid));

    for (const uuid of missing) {
      this._users.set(uuid, signal<ErpUserRef | undefined>(undefined));
      this._enqueue(uuid);
    }

    await (this._flush ?? Promise.resolve());
  }

  /** @inheritdoc */
  public async searchAsync(query: ErpUserDirectoryQuery): Promise<ErpUserDirectoryPage> {
    const response = await firstValueFrom(
      this._http.post<SearchResponseDto>(`${this._baseUrl}/user/searchUserDirectory`, {
        query: query.text ?? null,
        includeInactive: query.includeInactive ?? false,
        page: query.page ?? 1,
        pageSize: query.pageSize ?? DEFAULT_PAGE_SIZE,
      }),
    );

    return { uuids: response.uuids ?? [], totalCount: response.totalCount ?? 0 };
  }

  /** @inheritdoc */
  public async getManyAsync(uuids: readonly string[]): Promise<readonly ErpUserRef[]> {
    if (uuids.length === 0) {
      return [];
    }

    const fetched = await this._fetch(uuids);

    // Wynik idzie też do cache’u: picker i tabela pytają o tych samych ludzi.
    for (const user of fetched) {
      this._entry(user.uuid).set(user);
    }

    return fetched;
  }

  private _enqueue(uuid: string): void {
    this._pending.add(uuid);

    this._flush ??= Promise.resolve().then(() => this._flushPending());
  }

  private async _flushPending(): Promise<void> {
    const batch = [...this._pending];
    this._pending.clear();
    this._flush = null;

    if (batch.length === 0) {
      return;
    }

    try {
      for (const user of await this._fetch(batch)) {
        this._entry(user.uuid).set(user);
      }
    } catch (error) {
      // Katalog jest wygodą, nie warunkiem działania ekranu: przy błędzie zostają uuidy,
      // a nie pusta tabela. Wpisy zostają w cache’u jako `undefined`, więc nie odpytujemy
      // w pętli przy każdym przerysowaniu.
      console.error('[UserDirectoryService] Nie udało się pobrać katalogu użytkowników.', error);
    }
  }

  private async _fetch(uuids: readonly string[]): Promise<readonly ErpUserRef[]> {
    const response = await firstValueFrom(
      this._http.post<UserDirectoryDto[]>(`${this._baseUrl}/user/getUserDirectory`, { uuids }),
    );

    return response ?? [];
  }

  private _entry(uuid: string): ReturnType<typeof signal<ErpUserRef | undefined>> {
    let entry = this._users.get(uuid);

    if (!entry) {
      entry = signal<ErpUserRef | undefined>(undefined);
      this._users.set(uuid, entry);
    }

    return entry;
  }
}

/**
 * Podpina katalog użytkowników pod token widziany przez `@erp/shared/ui`.
 *
 * Wołane w `app.config.ts` hosta **i każdego remote'a** — remote uruchomiony samodzielnie
 * (`nx serve task-management`) ma własny injector i bez tego pokazywałby uuidy.
 */
export function provideErpUserDirectory(baseUrl: string): Provider[] {
  return [
    { provide: USER_DIRECTORY_API_BASE_URL, useValue: baseUrl },
    { provide: ERP_USER_DIRECTORY, useExisting: UserDirectoryService },
  ];
}

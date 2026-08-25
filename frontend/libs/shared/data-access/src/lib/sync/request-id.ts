/**
 * Identyfikator OPERACJI użytkownika, wysyłany w nagłówku `X-Request-Id` i używany przez backend
 * jako klucz idempotencji (`IdempotencyCommandMiddleware`, `JobStore`).
 *
 * <b>Dlaczego identyfikator nadaje klient, a nie serwer.</b> Tylko klient wie, które dwa żądania
 * są tą samą operacją. Dwa identyczne co do bajtu żądania mogą być świadomym powtórzeniem
 * („dodaj jeszcze raz”) albo ponowieniem po zerwanym połączeniu — z treści nie da się ich
 * odróżnić, a serwer zgadujący po treści blokowałby to pierwsze.
 *
 * <b>Zakres, nie parametr.</b> Klienty NSwag są generowane i nie przyjmują nagłówków per
 * wywołanie, więc identyfikator jedzie ambientem: `withRequestId` ustawia go na czas
 * SYNCHRONICZNEGO wywołania, a interceptor odczytuje przy budowaniu żądania. To wystarcza,
 * bo `firstValueFrom(client.x())` subskrybuje synchronicznie — czyli w środku zakresu.
 * Sam identyfikator jest przy tym stały dla całego zakresu, więc jedna operacja złożona
 * z kilku żądań (rejestracja plików, a zaraz po niej dopięcie ich do produktów) idzie pod
 * jednym kluczem; backend rozróżnia je po nazwie operacji dołączanej do klucza.
 *
 * <b>Czego to nie robi.</b> Nie dedupuje dwóch osobnych kliknięć użytkownika — to są dwie różne
 * operacje i dostają dwa różne identyfikatory. Chroni przed ponowieniem TEJ SAMEJ operacji:
 * ponowną próbą po błędzie sieci i podwójnym wywołaniem z tego samego zakresu.
 */
let ambientRequestId: string | null = null;

/**
 * Uruchamia operację zapisu w zakresie jednego identyfikatora żądania.
 *
 * Zakres kończy się razem z synchronicznym wykonaniem `operation` — nie z rozwiązaniem
 * zwróconej obietnicy. Nagłówek jest wtedy już doklejony, a ambient nie wycieka na kod,
 * który wykona się po `await`.
 *
 * Zagnieżdżenie zachowuje identyfikator zewnętrzny: cała operacja złożona jest jedną operacją.
 */
export function withRequestId<T>(operation: () => T): T {
  const previous = ambientRequestId;
  ambientRequestId = previous ?? crypto.randomUUID();

  try {
    return operation();
  } finally {
    ambientRequestId = previous;
  }
}

/** Identyfikator bieżącej operacji albo `null`, gdy żądanie leci poza zakresem. */
export function currentRequestId(): string | null {
  return ambientRequestId;
}

import { SHARED_KEYS } from './keys';

/**
 * Tłumaczenie stabilnych kodów błędów backendu (`DomainException.ErrorCode`,
 * `ValidationError.ErrorCode`, `job_item.error_code`) na tekst dla użytkownika.
 *
 * <p>Kody są kontraktem maszynowym i backend celowo NIE tłumaczy ich sam — nie zna języka
 * użytkownika, a `ErrorMessage` z reguł wsadowych jest opisany jako komunikat dla developera.
 * Cała prezentacja siedzi więc tutaj.</p>
 *
 * <p>Klucze leżą w scope'ie `shared`, a nie w scope'ie modułu, który zgłosił błąd, i to jest tu
 * sedno: powiadomienie o zakończonym zadaniu renderuje moduł `notification`, który nigdy nie ma
 * załadowanego scope'u Catalogu czy Identity. `shared` jest jedynym scope'em widocznym dla
 * wszystkich naraz — dokładnie tak samo rozwiązane są nazwy operacji masowych
 * (`shared.jobs.commands.*`).</p>
 *
 * <p><b>Brak drugiego rejestru.</b> `SHARED_KEYS` jest generowany z `pl-PL.json`, więc gałąź
 * `errors.codes` JEST listą znanych kodów. Dodanie obsługi nowego kodu to wpis w dwóch plikach
 * JSON i `pnpm translate:keys` — nic więcej się nie utrzymuje ręcznie.</p>
 */
const ERROR_CODE_KEYS = SHARED_KEYS.errors.codes as Record<string, string>;

/**
 * `multimedia_still_referenced` → `multimediaStillReferenced`,
 * `taskmgmt.transition_not_allowed` → `taskmgmtTransitionNotAllowed`.
 *
 * Kropka jest traktowana jak podkreślnik, bo Task Management prefiksuje swoje kody nazwą modułu
 * (`docs/backend/task-management.md` §2). Rejestr kluczy zostaje płaski — zagnieżdżanie go per
 * moduł rozbiłoby jedyną zaletę tego scope'u, czyli to, że `notification` widzi wszystkie kody
 * naraz bez ładowania scope'ów cudzych modułów.
 */
function toCamelCase(errorCode: string): string {
  return errorCode.toLowerCase().replace(/[._]([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

/**
 * Klucz tłumaczenia dla kodu błędu albo `null`, gdy kod nie ma jeszcze tłumaczenia.
 *
 * `null` jest tu istotny: nowa reguła domenowa pojawia się w backendzie wcześniej niż wpis
 * w tłumaczeniach, a wtedy lepiej pokazać surowy kod niż `Missing translation for ...`.
 */
export function resolveErrorCodeKey(errorCode: string | null | undefined): string | null {
  if (!errorCode) {
    return null;
  }

  return ERROR_CODE_KEYS[toCamelCase(errorCode)] ?? null;
}

/**
 * Kod błędu w postaci gotowej do podania do `erpTranslate` — klucz tłumaczenia, gdy taki
 * istnieje, w przeciwnym razie surowy kod (pipe przepuszcza nieznany klucz przez Transloco,
 * dlatego zwracamy tekst, a nie klucz).
 */
export function translatableErrorCode(errorCode: string): string {
  return resolveErrorCodeKey(errorCode) ?? errorCode;
}

/** Jeden kod błędu z podsumowania zadania masowego wraz z liczbą elementów, które go zwróciły. */
export interface JobErrorSummaryEntry {
  /** Surowy kod z backendu, np. `multimedia_still_referenced`. */
  code: string;
  /** Ile elementów zadania odpadło z tym kodem. */
  count: number;
}

/**
 * Rozbiera `job.errorsSummary` na pary kod → liczba.
 *
 * <p>Duplikat (nie import) tej samej funkcji z `@erp/notification/util` — celowo. Host
 * (`ErpOptimisticRollbackBridge`, `apps/client`) potrzebuje jej do tłumaczenia kodu błędu
 * z pierwszego cofniętego zadania optymistycznego, a nie wolno mu zależeć od `@erp/notification/util`:
 * to biblioteka `type:util` REMOTA notification, a jej statyczny import wciągnąłby remota do
 * bundla hosta ({@link resolveErrorCodeKey} w tym samym pliku ma dokładnie to samo uzasadnienie).
 * Kilkanaście linijek bez logiki biznesowej nie usprawiedliwia trzeciej wspólnej biblioteki tylko
 * dla jednej funkcji — format (`"code_a: 12; code_b: 3"`) powstaje w JEDNYM miejscu w backendzie
 * (`BulkCommandRunner.BuildErrorsSummaryAsync`) i stamtąd wędruje bez zmian, więc dwie kopie tego
 * samego parsera nie mają się jak rozjechać.</p>
 */
export function parseJobErrorsSummary(summary: string | null | undefined): JobErrorSummaryEntry[] {
  if (!summary) {
    return [];
  }

  const entries: JobErrorSummaryEntry[] = [];

  for (const part of summary.split(';')) {
    const separatorIndex = part.lastIndexOf(':');
    if (separatorIndex < 0) {
      continue;
    }

    const code = part.slice(0, separatorIndex).trim();
    const count = Number.parseInt(part.slice(separatorIndex + 1).trim(), 10);

    if (code.length > 0 && Number.isFinite(count)) {
      entries.push({ code, count });
    }
  }

  return entries;
}

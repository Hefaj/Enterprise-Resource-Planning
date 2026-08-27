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

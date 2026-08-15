/**
 * Segment trasy historii zadań wewnątrz remota `notification`.
 * Host dokleja prefix modułu, więc pełny adres to `/notification/jobs`.
 */
export const JOBS_ROUTE = 'jobs';

/**
 * Ile zadań ciągnie feed powiadomień przy starcie.
 *
 * Popover pokazuje kilka ostatnich pozycji, ale licznik przy dzwonku musi być policzony
 * z szerszego zbioru niż to, co widać — stąd zapas ponad rozmiar listy.
 */
export const JOB_FEED_PAGE_SIZE = 25;

/** Ile pozycji mieści popover pod dzwonkiem, zanim odeśle użytkownika do pełnej historii. */
export const JOB_POPOVER_LIMIT = 6;

/** Rozmiar strony na widoku historii zadań. */
export const JOB_HISTORY_PAGE_SIZE = 20;

/**
 * Sygnatura kanału synchronizacji agregatu zadania — musi zgadzać się co do znaku
 * z `AggregateSignatures.NotificationJob` po stronie backendu. Literówka nie wywali buildu
 * po żadnej stronie, tylko cicho wyłączy aktualizacje w czasie rzeczywistym.
 */
export const NOTIFICATION_JOB_SIGNATURE = 'notification.job';

/**
 * Okno zbijania zdarzeń o pojawieniu się nowego zadania.
 *
 * Kanał `notification.job` jest wspólny dla wszystkich klientów, więc w ruchliwym systemie
 * potrafi tętnić zdarzeniami o cudzych zadaniach. Bez tego okna każde z nich kosztowałoby
 * jedno zapytanie `searchJob`.
 */
export const JOB_ARRIVAL_DEBOUNCE_MS = 400;

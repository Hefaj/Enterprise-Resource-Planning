namespace Erp.BuildingBlocks.Contracts;

/// <summary>Waga powiadomienia — steruje ikoną/kolorem w dzwonku, nie kanałem dostawy
/// (Faza 1 ma jeden kanał, InApp). Kolejność wartości jest częścią kontraktu — nie przenumerowywać.</summary>
public enum NotificationSeverity
{
    Info = 0,
    Warning = 1,
    Critical = 2,
}

/// <summary>
/// Jedno zdarzenie „powiadom tych ludzi o tym fakcie" dla wszystkich modułów — <c>Kind</c> jest
/// daną, nie typem. Publikowane przez moduł-producenta (np. Task Management) w tej samej
/// transakcji co zmiana, która je wywołała; Notification jest jedynym konsumentem
/// (patrz <c>docs/modules/notification/user-notifications.md</c> §3, Faza 1).
///
/// <para><b>Sprawca a odbiorcy.</b> Producent wylicza <see cref="Recipients"/> i sam decyduje,
/// czy <see cref="ActorId"/> ma się w nich znaleźć — Notification i tak wyklucza sprawcę z
/// fan-outu przy zapisie, więc producent nie musi go ręcznie odfiltrowywać z listy.</para>
///
/// <para><b>Identyfikatory użytkowników są tu <c>string</c>, nie <c>Guid</c></b> — zgodnie
/// z resztą kontraktów tego serwisu (<see cref="JobAccepted.UserId"/>,
/// <c>IExecutionContext.UserId</c>): to claim <c>sub</c> tokenu Keycloak, nie uuid agregatu
/// Identity.User.</para>
/// </summary>
/// <param name="Recipients">Odbiorcy — wyliczeni przez producenta (obserwujący, wzmiankowani,
/// przypisany...). Pusta lista jest poprawna i oznacza „nic do zrobienia".</param>
/// <param name="ActorId">Sprawca zdarzenia, jeśli istnieje (system/scan terminów nie ma sprawcy) —
/// wykluczany z fan-outu, żeby nikt nie dostał powiadomienia o własnej akcji.</param>
/// <param name="Kind">Rodzaj zdarzenia, np. <c>"taskmgmt.issue.commented"</c> — klucz doboru
/// ikony/kategorii na froncie, nie typ C#. Nieznany <c>Kind</c> nie jest błędem (patrz doc §5).</param>
/// <param name="SubjectSignature">Sygnatura agregatu, którego dotyczy powiadomienie —
/// jedna z <see cref="AggregateSignatures"/>.</param>
/// <param name="SubjectUuid">Uuid agregatu, którego dotyczy powiadomienie.</param>
/// <param name="SubjectKey">Czytelny dla człowieka klucz przedmiotu (np. <c>"DEV-412"</c>) —
/// do wyświetlenia bez dodatkowego zapytania.</param>
/// <param name="TitleKey">Klucz tłumaczenia tytułu — <b>nigdy gotowy tekst</b>, bo locale jest
/// per-odbiorca, a Notification nie zna języka odbiorcy w chwili publikacji.</param>
/// <param name="Params">Parametry podstawiane w przetłumaczonym tytule (np. imię autora
/// komentarza) — teksty, nie klucze do dalszego tłumaczenia.</param>
/// <param name="GroupKey">Klucz grupowania kolejnych zdarzeń w jedno powiadomienie z licznikiem
/// (np. kilka komentarzy pod rząd) — <c>null</c> oznacza „zawsze osobny wpis".</param>
/// <param name="Link">Trasa frontu, na którą prowadzi kliknięcie (np.
/// <c>"/task-management/issue/DEV-412"</c>) — autoryzacja odbywa się przy kliknięciu, nie tutaj.</param>
/// <param name="Severity">Waga do ikony/koloru.</param>
/// <param name="CorrelationId">Korelacja z operacją źródłową — używana też jako część klucza
/// deduplikacji, gdy <see cref="GroupKey"/> jest puste.</param>
/// <param name="OccurredAt">Moment zajścia faktu (UTC).</param>
public sealed record UserNotificationRequested(
    IReadOnlyList<string> Recipients,
    string? ActorId,
    string Kind,
    string SubjectSignature,
    Guid SubjectUuid,
    string? SubjectKey,
    string TitleKey,
    IReadOnlyDictionary<string, string> Params,
    string? GroupKey,
    string Link,
    NotificationSeverity Severity,
    Guid CorrelationId,
    DateTimeOffset OccurredAt);

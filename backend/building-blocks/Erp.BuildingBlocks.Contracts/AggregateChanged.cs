namespace Erp.BuildingBlocks.Contracts;

/// <summary>Rodzaj zmiany agregatu.</summary>
public enum ChangeType
{
    /// <summary>Utworzony lub zmodyfikowany — klient ma pobrać aktualny stan.</summary>
    Upserted = 0,

    /// <summary>Usunięty — klient ma wyrzucić wpis z cache, bez pobierania.</summary>
    Deleted = 1,
}

/// <summary>
/// Zmieniły się agregaty o podanych identyfikatorach. Publikowane przez serwis będący
/// właścicielem agregatu, konsumowane przez Notification, który rozgłasza je hubem SignalR
/// do grupy <c>agg:{signature}</c>.
///
/// Celowo niesie <b>tylko identyfikatory</b>, nie stan. Klient dostaje sygnał „to jest nieaktualne”
/// i sam pobiera świeże dane przez zwykłe <c>getX</c> — dzięki temu kontrakt zdarzenia nie musi
/// nadążać za kształtem DTO, a autoryzacja odczytu zostaje na endpoincie HTTP (event nie może
/// wycieknąć pól, których odbiorca nie ma prawa zobaczyć).
///
/// <see cref="ChangeType.Deleted"/> jest niezbędne, bo samo „odśwież po uuid” nie odróżnia
/// usunięcia od błędu pobrania — bez tego usunięte wiersze zostawałyby w cache klienta.
/// </summary>
/// <param name="Signature">Kanał — jedna z wartości <see cref="AggregateSignatures"/>.</param>
/// <param name="Uuids">Identyfikatory zmienionych agregatów.</param>
/// <param name="Change">Rodzaj zmiany.</param>
/// <param name="CorrelationId">Korelacja z żądaniem, które wywołało zmianę — pozwala klientowi
/// odfiltrować echo własnej komendy.</param>
/// <param name="OccurredAt">Moment zmiany (UTC).</param>
public sealed record AggregateChanged(
    string Signature,
    IReadOnlyList<Guid> Uuids,
    ChangeType Change,
    Guid CorrelationId,
    DateTimeOffset OccurredAt);

/// <summary>
/// Zmiana była zbyt masowa, żeby wyliczyć ją identyfikatorami — klient ma unieważnić cały cache
/// dla danej sygnatury i przeładować to, co aktualnie widoczne.
///
/// Powód istnienia: bulk na 50 tys. produktów nie może wysłać 50 tys. uuid-ów przez WebSocket
/// do każdej otwartej przeglądarki. Powyżej progu (konfigurowalnego w Notification) zamiast
/// <see cref="AggregateChanged"/> leci to zdarzenie. To świadoma wymiana precyzji na przepustowość.
/// </summary>
/// <param name="Signature">Kanał — jedna z wartości <see cref="AggregateSignatures"/>.</param>
/// <param name="Scope">Zakres unieważnienia; obecnie wyłącznie <c>"all"</c>.</param>
/// <param name="CorrelationId">Korelacja z żądaniem, które wywołało zmianę.</param>
/// <param name="OccurredAt">Moment zmiany (UTC).</param>
public sealed record AggregateInvalidated(
    string Signature,
    string Scope,
    Guid CorrelationId,
    DateTimeOffset OccurredAt)
{
    /// <summary>Jedyny obecnie obsługiwany zakres — unieważnia cały cache danej sygnatury.</summary>
    public const string ScopeAll = "all";
}

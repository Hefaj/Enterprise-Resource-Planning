using Erp.BuildingBlocks.Api.Contracts;

namespace Notification.Application.Jobs;

/// <summary>Pobranie zadań po identyfikatorach.</summary>
public sealed class GetJobRequest
{
    public List<Guid>? Uuids { get; set; }
}

/// <summary>Filtry wyszukiwania zadań.</summary>
public sealed class SearchJobRequest : PagedRequest
{
    public string? QueueId { get; set; }

    public string? TrackingId { get; set; }

    public bool? IsComplete { get; set; }

    /// <summary>
    /// Karta przeglądarki, która zleciła zadanie — <b>opcjonalne zawężenie</b> w obrębie zadań
    /// zalogowanego użytkownika, nie kontrola dostępu. Filtr dokładny, nie ILIKE: clientId jest
    /// GUID-em generowanym przez klienta, więc wyszukiwanie częściowe nie miałoby tu sensu.
    ///
    /// <para>Właściciela feedu wyznacza <c>IExecutionContext.UserId</c> po stronie endpointu —
    /// patrz <see cref="IJobQueries"/>. Pole <c>UserId</c> w tym żądaniu istniało, dopóki backend
    /// nie miał uwierzytelniania; zostało usunięte, bo filtr sterowany przez klienta pozwalał
    /// odczytać cudzy feed.</para>
    /// </summary>
    public string? ClientId { get; set; }
}

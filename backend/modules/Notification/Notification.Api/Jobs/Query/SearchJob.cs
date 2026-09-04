using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using FastEndpoints;
using Notification.Application.Jobs;

namespace Notification.Jobs.Query;

/// <summary>
/// Wyszukiwanie zadań w replice — zwraca identyfikatory i licznik, zgodnie
/// z tym samym wzorcem „szukaj → pobierz”, co pozostałe moduły.
///
/// <para><b>Celowo bez <c>Permissions(...)</c>.</b> W przeciwieństwie do reszty Fazy 3
/// (patrz <c>docs/architecture/security.md</c> §7 Faza 3), ten endpoint karmi dzwonek
/// powiadomień w nagłówku — własny feed użytkownika o JEGO WŁASNYCH zadaniach masowych, nie
/// uprzywilejowany zasób. Bramkowanie go przez <c>notification.job.read</c> odcięłoby każdego
/// nowego użytkownika bez wyraźnie nadanego uprawnienia od widoku własnych powiadomień —
/// regresja UX gorsza niż brak kontroli dostępu. Uwierzytelnienie (Faza 1) wystarcza.
/// </para>
///
/// <para><b>Ale „bez uprawnienia” nie znaczy „bez zawężenia”.</b> Wynik jest ograniczony do zadań
/// zalogowanego użytkownika — identyfikator bierze się z <c>IExecutionContext</c> (claim <c>sub</c>
/// tokenu), nie z ciała żądania. To jedyna kontrola dostępu na tym endpoincie, więc nie wolno jej
/// obejść, dopisując filtr sterowany przez klienta.</para>
/// </summary>
public sealed class SearchJobEndpoint : Endpoint<SearchJobRequest, SearchResponse>
{
    private readonly IJobQueries _queries;
    private readonly IExecutionContext _executionContext;

    public SearchJobEndpoint(IJobQueries queries, IExecutionContext executionContext)
    {
        _queries = queries;
        _executionContext = executionContext;
    }

    public override void Configure()
    {
        Post("searchJob");
        Group<JobGroup>();
    }

    public override async Task HandleAsync(SearchJobRequest req, CancellationToken ct)
    {
        var userId = _executionContext.UserId;
        if (string.IsNullOrWhiteSpace(userId))
        {
            // Endpoint jest za fallback policy, więc bez tożsamości nie powinien tu dojść.
            // Pusty wynik zamiast wyjątku: feed powiadomień nie może przewrócić nagłówka.
            await Send.OkAsync(new SearchResponse { Uuids = [], TotalCount = 0 }, ct);
            return;
        }

        var response = await _queries.SearchAsync(req, userId, ct);
        await Send.OkAsync(response, ct);
    }
}

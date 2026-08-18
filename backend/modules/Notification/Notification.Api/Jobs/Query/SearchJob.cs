using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using Notification.Application.Jobs;

namespace Notification.Jobs.Query;

/// <summary>
/// Wyszukiwanie zadań w replice — zwraca identyfikatory i licznik, zgodnie
/// z tym samym wzorcem „szukaj → pobierz”, co pozostałe moduły.
///
/// <para><b>Celowo bez <c>Permissions(...)</c>.</b> W przeciwieństwie do reszty Fazy 3
/// (patrz <c>docs/backend/identity-authz.md</c> §7 Faza 3), ten endpoint karmi dzwonek
/// powiadomień w nagłówku — własny feed użytkownika o JEGO WŁASNYCH zadaniach masowych, nie
/// uprzywilejowany zasób. Bramkowanie go przez <c>notification.job.read</c> odcięłoby każdego
/// nowego użytkownika bez wyraźnie nadanego uprawnienia od widoku własnych powiadomień —
/// regresja UX gorsza niż brak kontroli dostępu. Uwierzytelnienie (Faza 1) wystarcza.
/// </para>
/// </summary>
public sealed class SearchJobEndpoint : Endpoint<SearchJobRequest, SearchResponse>
{
    private readonly IJobQueries _queries;

    public SearchJobEndpoint(IJobQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchJob");
        Group<JobGroup>();
    }

    public override async Task HandleAsync(SearchJobRequest req, CancellationToken ct)
    {
        var response = await _queries.SearchAsync(req, ct);
        await Send.OkAsync(response, ct);
    }
}

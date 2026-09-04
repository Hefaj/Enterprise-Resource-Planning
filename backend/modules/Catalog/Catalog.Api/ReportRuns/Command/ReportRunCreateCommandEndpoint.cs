using Catalog.Application.Abstractions;
using Catalog.Application.ReportRuns;
using Erp.BuildingBlocks.Api.Commands;
using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Catalog.ReportRuns.Command;

/// <summary>
/// Zlecenie raportu/eksportu katalogu do pliku.
///
/// <para><b>Dlaczego to NIE jest endpoint wsadowy</b>, mimo że każda inna komenda zapisu nim jest.
/// Raport już jest operacją zbiorczą — zbiorczą po rekordach, nie po przebiegach. Zlecenie pięciu
/// raportów naraz nie jest przypadkiem użycia, za to przepuszczenie tej komendy przez
/// <c>BatchEndpointBase</c> miało konkretny, zły skutek: powstawały DWA zadania na jeden raport
/// — map-owe, które wykonywało komendę tworzącą, i reduce, które faktycznie robiło plik. Klient
/// dostawał <c>jobUuid</c> tego pierwszego, więc dzwonek pokazywał „gotowe" w chwili, w której
/// raport dopiero się zaczynał.</para>
///
/// <para>Endpoint zwraca <see cref="BatchResult"/> mimo braku wsadu — kształt odpowiedzi zostaje
/// ten sam, co przy operacjach masowych, bo frontend rejestruje zadanie w <c>JobService</c>
/// dokładnie tak samo. Zwracany <c>JobUuid</c> to zadanie <c>Reduce</c>, czyli to, którego
/// postęp użytkownik faktycznie chce widzieć.</para>
/// </summary>
public sealed class ReportRunCreateCommandEndpoint : Endpoint<ReportRunCreateCommand, BatchResult>
{
    private readonly IReportRunRepository _repository;
    private readonly ICommandDispatcher _dispatcher;

    public ReportRunCreateCommandEndpoint(IReportRunRepository repository, ICommandDispatcher dispatcher)
    {
        _repository = repository;
        _dispatcher = dispatcher;
    }

    public override void Configure()
    {
        Post("create");
        Group<ReportRunGroup>();
        Permissions(P.Catalog.ReportRunCreate);
        Description(d => d
            .WithSummary("Zlecenie raportu/eksportu katalogu")
            .WithDescription(
                "Zakłada przebieg raportu i zwraca identyfikator zadania, po którym frontend "
                + "śledzi postęp. Sam plik powstaje w tle (ReportRunner); gotowość sygnalizuje "
                + "kanał powiadomień `jobs`, a artefakt pobiera się przez "
                + "`reportRun/getReportRunDownloadUrl`."));
    }

    public override async Task HandleAsync(ReportRunCreateCommand req, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(req);

        // Granicę transakcji wyznacza pipeline komend — handler świadomie nie woła IUnitOfWork
        // (patrz docs/guides/backend/cqrs.md §3). Powtórzone żądanie z tym samym `X-Request-Id` nie
        // zleci drugiego raportu, tylko odda identyfikator pierwszego przebiegu.
        var runUuid = await _dispatcher.SendAsync<ReportRunCreateCommand, Guid>(req, ct);

        var run = await _repository.FindAsync(runUuid, ct)
            ?? throw new InvalidOperationException($"Przebieg raportu {runUuid} zniknął zaraz po utworzeniu.");

        await Send.OkAsync(new BatchResult { JobUuid = run.JobUuid }, ct);
    }
}

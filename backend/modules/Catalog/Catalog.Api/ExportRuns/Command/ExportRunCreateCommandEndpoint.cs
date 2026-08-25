using Catalog.Application.Abstractions;
using Catalog.Application.ExportRuns;
using Erp.BuildingBlocks.Api.Commands;
using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Catalog.ExportRuns.Command;

/// <summary>
/// Zlecenie eksportu katalogu do pliku.
///
/// <para><b>Dlaczego to NIE jest endpoint wsadowy</b>, mimo że każda inna komenda zapisu nim jest.
/// Eksport już jest operacją zbiorczą — zbiorczą po produktach, nie po przebiegach. Zlecenie
/// pięciu eksportów naraz nie jest przypadkiem użycia, za to przepuszczenie tej komendy przez
/// <c>BatchEndpointBase</c> miało konkretny, zły skutek: powstawały DWA zadania na jeden eksport
/// — map-owe, które wykonywało komendę tworzącą, i reduce, które faktycznie robiło plik. Klient
/// dostawał <c>jobUuid</c> tego pierwszego, więc dzwonek pokazywał „gotowe" w chwili, w której
/// eksport dopiero się zaczynał.</para>
///
/// <para>Endpoint zwraca <see cref="BatchResult"/> mimo braku wsadu — kształt odpowiedzi zostaje
/// ten sam, co przy operacjach masowych, bo frontend rejestruje zadanie w <c>JobService</c>
/// dokładnie tak samo. Zwracany <c>JobUuid</c> to zadanie <c>Reduce</c>, czyli to, którego
/// postęp użytkownik faktycznie chce widzieć.</para>
/// </summary>
public sealed class ExportRunCreateCommandEndpoint : Endpoint<ExportRunCreateCommand, BatchResult>
{
    private readonly IExportRunRepository _repository;
    private readonly ICommandDispatcher _dispatcher;

    public ExportRunCreateCommandEndpoint(IExportRunRepository repository, ICommandDispatcher dispatcher)
    {
        _repository = repository;
        _dispatcher = dispatcher;
    }

    public override void Configure()
    {
        Post("create");
        Group<ExportRunGroup>();
        Permissions(P.Catalog.ExportRunCreate);
        Description(d => d
            .WithSummary("Zlecenie eksportu katalogu")
            .WithDescription(
                "Zakłada przebieg eksportu i zwraca identyfikator zadania, po którym frontend "
                + "śledzi postęp. Sam plik powstaje w tle (ExportRunner); gotowość sygnalizuje "
                + "kanał powiadomień `jobs`, a artefakt pobiera się przez "
                + "`exportRun/getExportRunDownloadUrl`."));
    }

    public override async Task HandleAsync(ExportRunCreateCommand req, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(req);

        // Granicę transakcji wyznacza pipeline komend — handler świadomie nie woła IUnitOfWork
        // (patrz docs/backend/cqrs.md §3). Powtórzone żądanie z tym samym `X-Request-Id` nie
        // zleci drugiego eksportu, tylko odda identyfikator pierwszego przebiegu.
        var runUuid = await _dispatcher.SendAsync<ExportRunCreateCommand, Guid>(req, ct);

        var run = await _repository.FindAsync(runUuid, ct)
            ?? throw new InvalidOperationException($"Przebieg eksportu {runUuid} zniknął zaraz po utworzeniu.");

        await Send.OkAsync(new BatchResult { JobUuid = run.JobUuid }, ct);
    }
}

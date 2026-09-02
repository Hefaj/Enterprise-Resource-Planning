using Catalog.Application.Abstractions;
using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Reporting;
using FastEndpoints;

namespace Catalog.Application.ReportRuns;

/// <summary>
/// Zlecenie raportu/eksportu katalogu do pliku.
///
/// <para><b>To jest <c>Create</c>, a nie <c>Exec</c> na produkcie</b> — operacja produkuje
/// artefakt z wielu rekordów, więc jej naturalnym kształtem jest nowy agregat przebiegu,
/// nie czasownik na agregacie źródłowym (patrz <c>docs/backend/endpoint-naming.md</c> §5
/// i <c>docs/backend/reporting.md</c> §3).</para>
///
/// <para><c>Uuid</c> generuje klient — jest jednocześnie kluczem idempotencji.</para>
/// </summary>
public sealed class ReportRunCreateCommand : ICommand<Guid>, IAggregateCommand
{
    /// <inheritdoc />
    public Guid Uuid { get; set; }

    /// <summary>Klucz definicji raportu, np. <c>"catalog.product-export"</c>.</summary>
    public string ReportKey { get; set; } = string.Empty;

    /// <summary>Format wyjściowy; dziś obsługiwany wyłącznie <c>xml</c>.</summary>
    public string Format { get; set; } = "xml";

    /// <summary>
    /// Filtr wyznaczający zbiór rekordów do zraportowania, serializowany do JSON.
    /// Pusty oznacza cały zakres domyślny definicji.
    /// </summary>
    public string? ParametersJson { get; set; }
}

/// <summary>
/// Zakłada przebieg i wiąże go z zadaniem typu <c>Reduce</c>, które niesie go do dzwonka
/// powiadomień i historii zadań.
///
/// <para>Wykonanie należy do <c>ReportRunner{TContext}</c> — ten handler ma się skończyć
/// natychmiast, tak samo jak endpoint operacji masowej. Generowanie pliku wewnątrz żądania HTTP
/// oznaczałoby otwarte połączenie na czas eksportu 50 tys. produktów.</para>
/// </summary>
public sealed class ReportRunCreateCommandHandler : CommandHandler<ReportRunCreateCommand, Guid>
{
    private readonly IReportRunRepository _repository;
    private readonly IReportJobFactory _jobFactory;
    private readonly IClock _clock;

    public ReportRunCreateCommandHandler(
        IReportRunRepository repository,
        IReportJobFactory jobFactory,
        IClock clock)
    {
        _repository = repository;
        _jobFactory = jobFactory;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(ReportRunCreateCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var now = _clock.UtcNow;
        var run = ReportRun.Create(command.Uuid, command.ReportKey, command.Format, command.ParametersJson, now);

        var (jobUuid, expireOn) = await _jobFactory
            .CreateForReportAsync(run.Uuid, nameof(ReportRunCreateCommand), command.ParametersJson, ct)
            .ConfigureAwait(false);

        run.AttachJob(jobUuid, expireOn);
        await _repository.AddAsync(run, ct).ConfigureAwait(false);

        return run.Uuid;
    }
}

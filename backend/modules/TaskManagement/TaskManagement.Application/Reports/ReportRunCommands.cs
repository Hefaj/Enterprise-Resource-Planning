using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Reporting;
using FastEndpoints;
using TaskManagement.Application.Abstractions;

namespace TaskManagement.Application.Reports;

/// <summary>
/// Zlecenie raportu Task Management do pliku.
///
/// <para><b>To jest <c>Create</c>, a nie <c>Exec</c></b> — operacja produkuje artefakt z wielu
/// rekordów, więc jej naturalnym kształtem jest nowy agregat przebiegu, nie czasownik na agregacie
/// źródłowym (patrz <c>docs/backend/endpoint-naming.md</c> §5 i <c>docs/backend/reporting.md</c> §3).</para>
///
/// <para><c>Uuid</c> generuje klient — jest jednocześnie kluczem idempotencji.</para>
/// </summary>
public sealed class ReportRunCreateCommand : ICommand<Guid>, IAggregateCommand
{
    /// <inheritdoc />
    public Guid Uuid { get; set; }

    /// <summary>Klucz definicji raportu, np. <c>"taskmgmt.hours-by-department"</c>.</summary>
    public string ReportKey { get; set; } = string.Empty;

    /// <summary>Format wyjściowy.</summary>
    public string Format { get; set; } = "csv";

    /// <summary>
    /// Filtr i parametry raportu, serializowane do JSON — kształt zależy od definicji wskazanej
    /// przez <see cref="ReportKey"/>.
    /// </summary>
    public string? ParametersJson { get; set; }
}

/// <summary>
/// Zakłada przebieg i wiąże go z zadaniem typu <c>Reduce</c>, które niesie go do dzwonka
/// powiadomień i historii zadań.
///
/// <para>Wykonanie należy do <c>ReportRunner{TContext}</c> — ten handler ma się skończyć
/// natychmiast, tak samo jak endpoint operacji masowej.</para>
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

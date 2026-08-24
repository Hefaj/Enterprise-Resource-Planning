using Catalog.Application.Abstractions;
using Catalog.Domain.ExportRuns;
using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using FastEndpoints;

namespace Catalog.Application.ExportRuns;

/// <summary>
/// Zlecenie eksportu katalogu do pliku.
///
/// <para><b>To jest <c>Create</c>, a nie <c>Exec</c> na produkcie</b> — operacja produkuje
/// artefakt z wielu rekordów, więc jej naturalnym kształtem jest nowy agregat przebiegu,
/// nie czasownik na agregacie źródłowym (patrz <c>docs/backend/endpoint-naming.md</c> §5
/// i <c>docs/backend/exports-artifacts.md</c> §1).</para>
///
/// <para><c>Uuid</c> generuje klient — jest jednocześnie kluczem idempotencji.</para>
/// </summary>
public sealed class ExportRunCreateCommand : ICommand<Guid>, IAggregateCommand
{
    /// <inheritdoc />
    public Guid Uuid { get; set; }

    /// <summary>Format wyjściowy; dziś obsługiwany wyłącznie <c>xml</c>.</summary>
    public string Format { get; set; } = "xml";

    /// <summary>
    /// Filtr wyznaczający zbiór produktów do wyeksportowania, serializowany do JSON.
    /// Pusty oznacza cały katalog.
    /// </summary>
    public string? ParametersJson { get; set; }
}

/// <summary>
/// Zakłada przebieg i wiąże go z zadaniem typu <c>Reduce</c>, które niesie go do dzwonka
/// powiadomień i historii zadań.
///
/// <para>Wykonanie należy do <c>ExportRunner</c> — ten handler ma się skończyć natychmiast,
/// tak samo jak endpoint operacji masowej. Generowanie pliku wewnątrz żądania HTTP oznaczałoby
/// otwarte połączenie na czas eksportu 50 tys. produktów.</para>
/// </summary>
public sealed class ExportRunCreateCommandHandler : CommandHandler<ExportRunCreateCommand, Guid>
{
    private readonly IExportRunRepository _repository;
    private readonly IExportJobFactory _jobFactory;
    private readonly IClock _clock;

    public ExportRunCreateCommandHandler(
        IExportRunRepository repository,
        IExportJobFactory jobFactory,
        IClock clock)
    {
        _repository = repository;
        _jobFactory = jobFactory;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(ExportRunCreateCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var now = _clock.UtcNow;
        var run = ExportRun.Create(command.Uuid, command.Format, command.ParametersJson, now);

        var (jobUuid, expireOn) = await _jobFactory
            .CreateForExportAsync(run.Uuid, nameof(ExportRunCreateCommand), command.ParametersJson, ct)
            .ConfigureAwait(false);

        run.AttachJob(jobUuid, expireOn);
        await _repository.AddAsync(run, ct).ConfigureAwait(false);

        return run.Uuid;
    }
}

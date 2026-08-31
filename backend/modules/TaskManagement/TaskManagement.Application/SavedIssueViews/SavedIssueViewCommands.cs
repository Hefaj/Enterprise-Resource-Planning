using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Application.Issues;
using TaskManagement.Domain.Issues;

namespace TaskManagement.Application.SavedIssueViews;

/// <summary>
/// Założenie osobistego widoku listy zgłoszeń.
///
/// <para><b>Własny namespace, nie <c>Issues</c></b> — z tego samego powodu, co
/// <see cref="WorkLogs.WorkLogCreateCommand"/>: to osobny agregat, a prefiks komendy musi zgadzać
/// się z agregatem (<c>docs/backend/endpoint-naming.md</c> §9).</para>
/// </summary>
public sealed class SavedIssueViewCreateCommand : ICommand<Guid>
{
    public string Name { get; set; } = string.Empty;
    public string FilterJson { get; set; } = "{}";
    public string ColumnsJson { get; set; } = "[]";
    public bool IsDefault { get; set; }
}

public sealed class SavedIssueViewCreateCommandHandler : CommandHandler<SavedIssueViewCreateCommand, Guid>
{
    private readonly ISavedIssueViewRepository _repository;
    private readonly IExecutionContext _context;
    private readonly IClock _clock;
    public SavedIssueViewCreateCommandHandler(ISavedIssueViewRepository repository, IExecutionContext context, IClock clock)
        => (_repository, _context, _clock) = (repository, context, clock);

    public override Task<Guid> ExecuteAsync(SavedIssueViewCreateCommand command, CancellationToken ct = default)
    {
        var view = SavedIssueView.Create(IssueCreateCommandHandler.ActorUuid(_context), command.Name, command.FilterJson, command.ColumnsJson, command.IsDefault, _clock.UtcNow);
        _repository.Add(view);
        return Task.FromResult(view.Uuid);
    }
}

/// <summary>
/// Nadpisanie definicji widoku — nazwy, filtra, układu kolumn i flagi domyślności.
///
/// <para><b>Nie <c>Update</c></b>: konwencja zna pięć czasowników i żaden z nich nie brzmi
/// „aktualizuj” (<c>docs/backend/endpoint-naming.md</c> §1). Człon <c>Definition</c> nazywa
/// plaster, który komenda nadpisuje — cała definicja widoku jest tu jedną, niepodzielną całością
/// wypełnianą jednym formularzem, więc rozbijanie jej na osobne <c>Set</c> na pole nie miałoby
/// odbiorcy. Właściciel jest poza tym plastrem i nie da się go tą komendą zmienić.</para>
/// </summary>
public sealed class SavedIssueViewSetDefinitionCommand : ICommand<Guid>
{
    public Guid Uuid { get; set; }
    public string Name { get; set; } = string.Empty;
    public string FilterJson { get; set; } = "{}";
    public string ColumnsJson { get; set; } = "[]";
    public bool IsDefault { get; set; }
}

public sealed class SavedIssueViewSetDefinitionCommandHandler : CommandHandler<SavedIssueViewSetDefinitionCommand, Guid>
{
    private readonly ISavedIssueViewRepository _repository;
    private readonly IExecutionContext _context;
    private readonly IClock _clock;
    public SavedIssueViewSetDefinitionCommandHandler(ISavedIssueViewRepository repository, IExecutionContext context, IClock clock)
        => (_repository, _context, _clock) = (repository, context, clock);

    public override async Task<Guid> ExecuteAsync(SavedIssueViewSetDefinitionCommand command, CancellationToken ct = default)
    {
        var view = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(SavedIssueView), command.Uuid);
        if (view.OwnerUuid != IssueCreateCommandHandler.ActorUuid(_context))
            throw new DomainException("taskmgmt.saved_view_forbidden", "Można zmieniać tylko własny zapisany widok.");
        view.SetDefinition(command.Name, command.FilterJson, command.ColumnsJson, command.IsDefault, _clock.UtcNow);
        return view.Uuid;
    }
}

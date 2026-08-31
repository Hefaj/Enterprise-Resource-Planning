using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Issues;

namespace TaskManagement.Application.Issues;

/// <summary>
/// Zaczyna obserwować zgłoszenie.
///
/// <para><b>Obserwator to nie uprawnienie.</b> Dopisanie się do listy nie otwiera dostępu do
/// zgłoszenia, którego użytkownik i tak by nie zobaczył — predykat widoczności liczy się po
/// projekcie i obowiązuje bez zmian (<c>docs/backend/task-management.md</c> §10.1). Lista służy
/// wyłącznie zakresowi „Obserwowane" i doborowi odbiorców powiadomień.</para>
///
/// <para>Komenda dopisuje <b>wołającego</b>, nie dowolną osobę: „obserwuj za kogoś" jest
/// zapisywaniem cudzej skrzynki i nie ma tu odbiorcy.</para>
/// </summary>
public sealed class IssueAddWatcherCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }
}

public sealed class IssueAddWatcherCommandHandler : CommandHandler<IssueAddWatcherCommand, Guid>
{
    private readonly IIssueRepository _repository;
    private readonly IExecutionContext _executionContext;
    private readonly IClock _clock;

    public IssueAddWatcherCommandHandler(IIssueRepository repository, IExecutionContext executionContext, IClock clock)
        => (_repository, _executionContext, _clock) = (repository, executionContext, clock);

    public override async Task<Guid> ExecuteAsync(IssueAddWatcherCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var issue = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Issue), command.Uuid);

        issue.AddWatcher(IssueCreateCommandHandler.ActorUuid(_executionContext), _clock.UtcNow);

        return issue.Uuid;
    }
}

/// <summary>Przestaje obserwować zgłoszenie. Brak obserwacji nie jest błędem.</summary>
public sealed class IssueRemoveWatcherCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }
}

public sealed class IssueRemoveWatcherCommandHandler : CommandHandler<IssueRemoveWatcherCommand, Guid>
{
    private readonly IIssueRepository _repository;
    private readonly IExecutionContext _executionContext;
    private readonly IClock _clock;

    public IssueRemoveWatcherCommandHandler(IIssueRepository repository, IExecutionContext executionContext, IClock clock)
        => (_repository, _executionContext, _clock) = (repository, executionContext, clock);

    public override async Task<Guid> ExecuteAsync(IssueRemoveWatcherCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var issue = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Issue), command.Uuid);

        issue.RemoveWatcher(IssueCreateCommandHandler.ActorUuid(_executionContext), _clock.UtcNow);

        return issue.Uuid;
    }
}

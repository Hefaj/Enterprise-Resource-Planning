using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Workflow;

namespace TaskManagement.Application.Issues;

/// <summary>
/// Komendy zgłoszenia. Handlery <b>nie wołają</b> <c>SaveChangesAsync</c> — granicę transakcji
/// wyznacza wywołujący (<c>BulkCommandRunner</c> zapisuje raz na chunk), inaczej N elementów
/// chunka dałoby N commitów i popsuło częściowy sukces
/// (<c>docs/backend/cqrs.md</c> §6, <c>docs/backend/bulk-commands.md</c>).
/// </summary>
public sealed class IssueCreateCommand : ICommand<Guid>, IAggregateCommand
{
    /// <summary>Uuid generowany przez klienta — tworzenie ma sens wyłącznie w trybie
    /// <c>Commands[]</c>, bo agregatu jeszcze nie ma czym wskazać.</summary>
    public Guid Uuid { get; set; }

    public Guid ProjectUuid { get; set; }

    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    public IssuePriority Priority { get; set; } = IssuePriority.Normal;

    public Guid? AssigneeUuid { get; set; }

    public DateTimeOffset? DueAt { get; set; }
}

public sealed class IssueCreateCommandHandler : CommandHandler<IssueCreateCommand, Guid>
{
    private readonly IIssueRepository _repository;
    private readonly IWorkflowSchemeRepository _schemes;
    private readonly IIssueKeyAllocator _keyAllocator;
    private readonly IExecutionContext _executionContext;
    private readonly IRichTextSanitizer _sanitizer;
    private readonly IClock _clock;

    public IssueCreateCommandHandler(
        IIssueRepository repository,
        IWorkflowSchemeRepository schemes,
        IIssueKeyAllocator keyAllocator,
        IExecutionContext executionContext,
        IRichTextSanitizer sanitizer,
        IClock clock)
    {
        _repository = repository;
        _schemes = schemes;
        _keyAllocator = keyAllocator;
        _executionContext = executionContext;
        _sanitizer = sanitizer;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(IssueCreateCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var scheme = await _schemes.FindByProjectAsync(command.ProjectUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Domain.Projects.Project), command.ProjectUuid);

        // Numer bierzemy z licznika projektu w TEJ SAMEJ transakcji, co zapis zgłoszenia —
        // `MAX(number) + 1` byłby klasycznym wyścigiem przy dwóch instancjach (§4).
        var key = await _keyAllocator.AllocateAsync(command.ProjectUuid, ct).ConfigureAwait(false);

        var now = _clock.UtcNow;

        var issue = Issue.CreateWithUuid(
            command.Uuid,
            command.ProjectUuid,
            key,
            command.Title,
            scheme,
            ActorUuid(_executionContext),
            now);

        issue.SetDescription(_sanitizer.Sanitize(command.Description), now);
        issue.SetPriority(command.Priority, now);
        issue.SetAssignee(command.AssigneeUuid, now);
        issue.SetDueDate(command.DueAt, now);

        _repository.Add(issue);

        return issue.Uuid;
    }

    /// <summary>Zgłaszający to zalogowany użytkownik, nigdy pole z żądania — inaczej klient
    /// podstawia cudze autorstwo.</summary>
    internal static Guid ActorUuid(IExecutionContext executionContext)
        => Guid.TryParse(executionContext.UserId, out var actorUuid) ? actorUuid : Guid.Empty;
}

public sealed class IssueSetTitleCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public string Title { get; set; } = string.Empty;
}

public sealed class IssueSetTitleCommandHandler : IssueCommandHandlerBase<IssueSetTitleCommand>
{
    public IssueSetTitleCommandHandler(IIssueRepository repository, IClock clock) : base(repository, clock)
    {
    }

    protected override void Apply(Issue issue, IssueSetTitleCommand command, DateTimeOffset now)
        => issue.SetTitle(command.Title, now);
}

public sealed class IssueSetDescriptionCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public string? Description { get; set; }
}

/// <summary>
/// Opis jest tekstem formatowanym (HTML z edytora), więc przechodzi przez
/// <see cref="IRichTextSanitizer"/> ZANIM dotknie agregatu — patrz uzasadnienie przy tym
/// interfejsie. Reszta komend zgłoszenia operuje na wartościach prostych i sanityzacji nie
/// potrzebuje.
/// </summary>
public sealed class IssueSetDescriptionCommandHandler : IssueCommandHandlerBase<IssueSetDescriptionCommand>
{
    private readonly IRichTextSanitizer _sanitizer;

    public IssueSetDescriptionCommandHandler(
        IIssueRepository repository,
        IRichTextSanitizer sanitizer,
        IClock clock)
        : base(repository, clock)
    {
        _sanitizer = sanitizer;
    }

    protected override void Apply(Issue issue, IssueSetDescriptionCommand command, DateTimeOffset now)
        => issue.SetDescription(_sanitizer.Sanitize(command.Description), now);
}

public sealed class IssueSetPriorityCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public IssuePriority Priority { get; set; }
}

public sealed class IssueSetPriorityCommandHandler : IssueCommandHandlerBase<IssueSetPriorityCommand>
{
    public IssueSetPriorityCommandHandler(IIssueRepository repository, IClock clock) : base(repository, clock)
    {
    }

    protected override void Apply(Issue issue, IssueSetPriorityCommand command, DateTimeOffset now)
        => issue.SetPriority(command.Priority, now);
}

public sealed class IssueSetAssigneeCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    /// <summary><c>null</c> zdejmuje przypisanie.</summary>
    public Guid? AssigneeUuid { get; set; }
}

public sealed class IssueSetAssigneeCommandHandler : IssueCommandHandlerBase<IssueSetAssigneeCommand>
{
    public IssueSetAssigneeCommandHandler(IIssueRepository repository, IClock clock) : base(repository, clock)
    {
    }

    protected override void Apply(Issue issue, IssueSetAssigneeCommand command, DateTimeOffset now)
        => issue.SetAssignee(command.AssigneeUuid, now);
}

public sealed class IssueSetDueDateCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public DateTimeOffset? DueAt { get; set; }
}

public sealed class IssueSetDueDateCommandHandler : IssueCommandHandlerBase<IssueSetDueDateCommand>
{
    public IssueSetDueDateCommandHandler(IIssueRepository repository, IClock clock) : base(repository, clock)
    {
    }

    protected override void Apply(Issue issue, IssueSetDueDateCommand command, DateTimeOffset now)
        => issue.SetDueDate(command.DueAt, now);
}

/// <summary>
/// Zmiana stanu — jedyna komenda zgłoszenia, która potrzebuje schematu projektu. Przejście
/// nieopisane w schemacie odpada błędem <c>taskmgmt.transition_not_allowed</c> i nic nie zapisuje.
/// </summary>
public sealed class IssueSetStateCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid StateUuid { get; set; }
}

public sealed class IssueSetStateCommandHandler : CommandHandler<IssueSetStateCommand, Guid>
{
    private readonly IIssueRepository _repository;
    private readonly IWorkflowSchemeRepository _schemes;
    private readonly IClock _clock;

    public IssueSetStateCommandHandler(
        IIssueRepository repository,
        IWorkflowSchemeRepository schemes,
        IClock clock)
    {
        _repository = repository;
        _schemes = schemes;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(IssueSetStateCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var issue = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Issue), command.Uuid);

        var scheme = await _schemes.FindByProjectAsync(issue.ProjectUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(WorkflowScheme), issue.ProjectUuid);

        issue.SetState(scheme, command.StateUuid, _clock.UtcNow);

        return issue.Uuid;
    }
}

/// <summary>
/// Wspólny szkielet komend, które tylko wołają jedną metodę agregatu. Bez tego pięć handlerów
/// różniłoby się jedną linijką — a to jest dokładnie ten rodzaj powtórzenia, przy którym
/// literówka w „nie znaleziono” przechodzi przez review.
/// </summary>
public abstract class IssueCommandHandlerBase<TCommand> : CommandHandler<TCommand, Guid>
    where TCommand : ICommand<Guid>, IAggregateCommand
{
    private readonly IIssueRepository _repository;
    private readonly IClock _clock;

    protected IssueCommandHandlerBase(IIssueRepository repository, IClock clock)
    {
        _repository = repository;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(TCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var issue = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Issue), command.Uuid);

        Apply(issue, command, _clock.UtcNow);

        return issue.Uuid;
    }

    protected abstract void Apply(Issue issue, TCommand command, DateTimeOffset now);
}

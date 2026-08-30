using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Projects;
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
    private readonly IProjectRepository _projects;
    private readonly IIssueKeyAllocator _keyAllocator;
    private readonly IIssueActivityWriter _activity;
    private readonly IExecutionContext _executionContext;
    private readonly IRichTextSanitizer _sanitizer;
    private readonly IClock _clock;

    public IssueCreateCommandHandler(
        IIssueRepository repository,
        IWorkflowSchemeRepository schemes,
        IProjectRepository projects,
        IIssueKeyAllocator keyAllocator,
        IIssueActivityWriter activity,
        IExecutionContext executionContext,
        IRichTextSanitizer sanitizer,
        IClock clock)
    {
        _repository = repository;
        _schemes = schemes;
        _projects = projects;
        _keyAllocator = keyAllocator;
        _activity = activity;
        _executionContext = executionContext;
        _sanitizer = sanitizer;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(IssueCreateCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var scheme = await _schemes.FindByProjectAsync(command.ProjectUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Domain.Projects.Project), command.ProjectUuid);
        var project = await _projects.FindAsync(command.ProjectUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Domain.Projects.Project), command.ProjectUuid);

        // Numer bierzemy z licznika projektu w TEJ SAMEJ transakcji, co zapis zgłoszenia —
        // `MAX(number) + 1` byłby klasycznym wyścigiem przy dwóch instancjach (§4).
        var key = await _keyAllocator.AllocateAsync(command.ProjectUuid, ct).ConfigureAwait(false);

        var now = _clock.UtcNow;
        var actor = ActorUuid(_executionContext);

        var issue = Issue.CreateWithUuid(
            command.Uuid,
            command.ProjectUuid,
            key,
            command.Title,
            scheme,
            actor,
            now);

        issue.SetDescription(_sanitizer.Sanitize(command.Description), now);
        issue.SetPriority(command.Priority, now);
        issue.SetAssignee(command.AssigneeUuid, now);
        issue.SetDueDate(command.DueAt ?? project.SlaPolicy?.CalculateResolutionDueAt(now), now);

        _repository.Add(issue);

        // Pierwszy wpis historii. Wartości początkowych pól tu NIE powielamy — są w samym
        // zgłoszeniu, a historia odpowiada na pytanie „co się zmieniło”, nie „od czego zaczęto”.
        _activity.Add(IssueActivity.Record(
            issue.Uuid,
            IssueActivityKind.Created,
            fieldCode: null,
            oldValue: null,
            newValue: issue.Key,
            actor,
            _executionContext.CorrelationId,
            now));

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
    public IssueSetTitleCommandHandler(
        IIssueRepository repository,
        IIssueActivityWriter activity,
        IExecutionContext executionContext,
        IClock clock)
        : base(repository, activity, executionContext, clock)
    {
    }

    protected override IssueFieldChange Apply(Issue issue, IssueSetTitleCommand command, DateTimeOffset now)
    {
        var previous = issue.Title;
        issue.SetTitle(command.Title, now);

        return IssueFieldChange.Of("title", previous, issue.Title);
    }
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
        IIssueActivityWriter activity,
        IExecutionContext executionContext,
        IRichTextSanitizer sanitizer,
        IClock clock)
        : base(repository, activity, executionContext, clock)
    {
        _sanitizer = sanitizer;
    }

    protected override IssueFieldChange Apply(Issue issue, IssueSetDescriptionCommand command, DateTimeOffset now)
    {
        var previous = issue.Description;
        issue.SetDescription(_sanitizer.Sanitize(command.Description), now);

        // Do historii idzie sam FAKT zmiany opisu, bez treści: opis bywa wielostronicowy,
        // a jego dwie pełne kopie przy każdej edycji zamieniłyby historię w archiwum treści
        // (patrz `IssueActivity.MaxValueLength`).
        return IssueFieldChange.Fact("description", previous != issue.Description);
    }
}

public sealed class IssueSetPriorityCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public IssuePriority Priority { get; set; }
}

public sealed class IssueSetPriorityCommandHandler : IssueCommandHandlerBase<IssueSetPriorityCommand>
{
    public IssueSetPriorityCommandHandler(
        IIssueRepository repository,
        IIssueActivityWriter activity,
        IExecutionContext executionContext,
        IClock clock)
        : base(repository, activity, executionContext, clock)
    {
    }

    protected override IssueFieldChange Apply(Issue issue, IssueSetPriorityCommand command, DateTimeOffset now)
    {
        var previous = issue.Priority;
        issue.SetPriority(command.Priority, now);

        return IssueFieldChange.Of(
            "priority",
            IssueActivityValue.From(previous),
            IssueActivityValue.From(issue.Priority));
    }
}

public sealed class IssueSetAssigneeCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    /// <summary><c>null</c> zdejmuje przypisanie.</summary>
    public Guid? AssigneeUuid { get; set; }
}

public sealed class IssueSetAssigneeCommandHandler : IssueCommandHandlerBase<IssueSetAssigneeCommand>
{
    public IssueSetAssigneeCommandHandler(
        IIssueRepository repository,
        IIssueActivityWriter activity,
        IExecutionContext executionContext,
        IClock clock)
        : base(repository, activity, executionContext, clock)
    {
    }

    protected override IssueFieldChange Apply(Issue issue, IssueSetAssigneeCommand command, DateTimeOffset now)
    {
        var previous = issue.AssigneeUuid;
        issue.SetAssignee(command.AssigneeUuid, now);

        return IssueFieldChange.Of(
            "assignee",
            IssueActivityValue.From(previous),
            IssueActivityValue.From(issue.AssigneeUuid));
    }
}

public sealed class IssueSetDueDateCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public DateTimeOffset? DueAt { get; set; }
}

public sealed class IssueSetDueDateCommandHandler : IssueCommandHandlerBase<IssueSetDueDateCommand>
{
    public IssueSetDueDateCommandHandler(
        IIssueRepository repository,
        IIssueActivityWriter activity,
        IExecutionContext executionContext,
        IClock clock)
        : base(repository, activity, executionContext, clock)
    {
    }

    protected override IssueFieldChange Apply(Issue issue, IssueSetDueDateCommand command, DateTimeOffset now)
    {
        var previous = issue.DueAt;
        issue.SetDueDate(command.DueAt, now);

        return IssueFieldChange.Of(
            "due_at",
            IssueActivityValue.From(previous),
            IssueActivityValue.From(issue.DueAt));
    }
}

/// <summary>
/// Zmiana stanu — jedyna komenda zgłoszenia, która potrzebuje schematu projektu. Przejście
/// nieopisane w schemacie odpada błędem <c>taskmgmt.transition_not_allowed</c> i nic nie zapisuje.
/// </summary>
public sealed class IssueSetStateCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid StateUuid { get; set; }

    /// <summary>
    /// Wartości uzupełniane razem z przejściem. Pole jest opcjonalne, aby istniejące klienty i
    /// przejścia bez wymagań zachowały kontrakt; nieobecne wartości pozostają bez zmian.
    /// </summary>
    public Dictionary<string, string?> CustomFieldValues { get; set; } = [];
}

/// <summary>
/// Techniczna migracja po publikacji schematu. Idzie przez <c>BatchEndpointBase</c>, więc
/// użytkownik widzi postęp i błędy pojedynczych zgłoszeń w zwykłej historii zadań.
/// </summary>
public sealed class IssueMigrateWorkflowStateCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }
    public Guid SchemeUuid { get; set; }
    public Guid FromStateUuid { get; set; }
    public Guid ToStateUuid { get; set; }
}

public sealed class IssueMigrateWorkflowStateCommandHandler : CommandHandler<IssueMigrateWorkflowStateCommand, Guid>
{
    private readonly IIssueRepository _repository;
    private readonly IWorkflowSchemeRepository _schemes;
    private readonly IIssueActivityWriter _activity;
    private readonly IExecutionContext _executionContext;
    private readonly IClock _clock;

    public IssueMigrateWorkflowStateCommandHandler(IIssueRepository repository, IWorkflowSchemeRepository schemes, IIssueActivityWriter activity, IExecutionContext executionContext, IClock clock)
        => (_repository, _schemes, _activity, _executionContext, _clock) = (repository, schemes, activity, executionContext, clock);

    public override async Task<Guid> ExecuteAsync(IssueMigrateWorkflowStateCommand command, CancellationToken ct = default)
    {
        var issue = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Issue), command.Uuid);
        if (issue.StateUuid != command.FromStateUuid)
            return issue.Uuid; // ponowione zadanie nie może cofnąć późniejszej ręcznej zmiany.

        var scheme = await _schemes.FindAsync(command.SchemeUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(WorkflowScheme), command.SchemeUuid);
        var previous = issue.StateUuid;
        var now = _clock.UtcNow;
        issue.MigrateWorkflowState(scheme, command.ToStateUuid, now);
        _activity.Add(IssueActivity.Record(issue.Uuid, IssueActivityKind.StateChanged, "state", previous.ToString(), issue.StateUuid.ToString(), IssueCreateCommandHandler.ActorUuid(_executionContext), _executionContext.CorrelationId, now));
        return issue.Uuid;
    }
}

public sealed class IssueSetStateCommandHandler : CommandHandler<IssueSetStateCommand, Guid>
{
    private readonly IIssueRepository _repository;
    private readonly IProjectRepository _projects;
    private readonly IWorkflowSchemeRepository _schemes;
    private readonly IFieldSchemeRepository _fieldSchemes;
    private readonly IIssueActivityWriter _activity;
    private readonly IExecutionContext _executionContext;
    private readonly IClock _clock;
    private readonly IRequestDeliveryStateRecalculator _deliveryState;

    public IssueSetStateCommandHandler(
        IIssueRepository repository,
        IProjectRepository projects,
        IWorkflowSchemeRepository schemes,
        IFieldSchemeRepository fieldSchemes,
        IIssueActivityWriter activity,
        IExecutionContext executionContext,
        IClock clock,
        IRequestDeliveryStateRecalculator deliveryState)
    {
        _repository = repository;
        _projects = projects;
        _schemes = schemes;
        _fieldSchemes = fieldSchemes;
        _activity = activity;
        _executionContext = executionContext;
        _clock = clock;
        _deliveryState = deliveryState;
    }

    public override async Task<Guid> ExecuteAsync(IssueSetStateCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var issue = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Issue), command.Uuid);

        var scheme = await _schemes.FindByProjectAsync(issue.ProjectUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(WorkflowScheme), issue.ProjectUuid);

        var targetState = scheme.States.FirstOrDefault(state => state.Uuid == command.StateUuid)
            ?? throw new DomainException(
                "taskmgmt.transition_unknown_state",
                $"Stan {command.StateUuid} nie należy do schematu `{scheme.Name}`.");

        // „Zakończone” na zleceniu Intake oznacza odbiór przez człowieka, a nie techniczne
        // domknięcie pracy. Nie można go wykonać, dopóki wszystkie powiązane realizacje nie
        // skończą pracy; sama decyzja o odbiorze wciąż jest jawnym przejściem użytkownika.
        if (issue.StateUuid != command.StateUuid && targetState.Category == WorkflowStateCategory.Done)
        {
            var project = await _projects.FindAsync(issue.ProjectUuid, ct).ConfigureAwait(false)
                ?? throw new AggregateNotFoundException(nameof(Project), issue.ProjectUuid);

            if (project.Kind == ProjectKind.Intake
                && issue.DerivedDeliveryState != WorkflowStateCategory.Done)
            {
                throw new DomainException(
                    "taskmgmt.request_delivery_incomplete",
                    "Nie można odebrać zlecenia, dopóki wszystkie jego realizacje nie są zakończone.");
            }
        }

        var now = _clock.UtcNow;
        var previous = issue.StateUuid;

        var transition = scheme.Transitions.FirstOrDefault(item =>
            item.FromStateUuid == issue.StateUuid && item.ToStateUuid == command.StateUuid);

        if (transition is not null && transition.RequiredFieldCodes.Count > 0)
        {
            var fieldScheme = await _fieldSchemes.FindByProjectAsync(issue.ProjectUuid, ct).ConfigureAwait(false)
                ?? throw new DomainException(
                    "taskmgmt.project_without_field_scheme",
                    "Przejście wymaga pól niestandardowych, ale projekt nie ma schematu pól.");

            issue.SetTransitionCustomFields(fieldScheme, transition.RequiredFieldCodes, command.CustomFieldValues, now);
        }

        issue.SetState(scheme, command.StateUuid, now);

        // Wpis dopisuje się dopiero PO metodzie agregatu i tylko przy faktycznej zmianie:
        // przejście odrzucone rzuca wyjątkiem i nie dochodzi tutaj, a przejście „w to samo
        // miejsce” agregat pomija po cichu i historia ma je pominąć tak samo.
        if (previous != issue.StateUuid)
        {
            _activity.Add(IssueActivity.Record(
                issue.Uuid,
                IssueActivityKind.StateChanged,
                "state",
                previous.ToString(),
                issue.StateUuid.ToString(),
                IssueCreateCommandHandler.ActorUuid(_executionContext),
                _executionContext.CorrelationId,
                now));

            await _deliveryState.RecalculateForDeliveryAsync(issue.Uuid, now, ct).ConfigureAwait(false);
        }

        return issue.Uuid;
    }
}

/// <summary>
/// Zmiana jednego pola opisana na potrzeby historii: co się zmieniło, z czego i na co.
///
/// <para>Zwracana przez <see cref="IssueCommandHandlerBase{TCommand}.Apply"/>, bo tylko tam
/// widać obie wartości — przed i po. Wyliczanie „co się zmieniło” po fakcie, ze ChangeTrackera,
/// dałoby dokładnie to, co daje już <c>AggregateChanged</c>: informację, że coś się ruszyło,
/// bez znaczenia pola (<c>docs/backend/task-management.md</c> §11).</para>
/// </summary>
public readonly record struct IssueFieldChange(string? FieldCode, string? OldValue, string? NewValue, bool Changed)
{
    /// <summary>Zmiana z wartościami — do historii idzie stara i nowa.</summary>
    public static IssueFieldChange Of(string fieldCode, string? oldValue, string? newValue)
        => new(fieldCode, oldValue, newValue, !string.Equals(oldValue, newValue, StringComparison.Ordinal));

    /// <summary>Zmiana bez wartości — do historii idzie sam fakt (pola zbyt obszerne, żeby je
    /// kopiować).</summary>
    public static IssueFieldChange Fact(string fieldCode, bool changed)
        => new(fieldCode, null, null, changed);

    /// <summary>Brak zmiany godnej historii.</summary>
    public static IssueFieldChange None => new(null, null, null, false);
}

/// <summary>
/// Wspólny szkielet komend, które tylko wołają jedną metodę agregatu. Bez tego pięć handlerów
/// różniłoby się jedną linijką — a to jest dokładnie ten rodzaj powtórzenia, przy którym
/// literówka w „nie znaleziono” przechodzi przez review.
///
/// <para>Baza dopisuje też wpis historii, żeby nie dało się dodać komendy zmieniającej pole
/// i <b>zapomnieć</b> o historii: <see cref="Apply"/> musi powiedzieć, co zmieniła, bo taki
/// ma typ zwracany.</para>
/// </summary>
public abstract class IssueCommandHandlerBase<TCommand> : CommandHandler<TCommand, Guid>
    where TCommand : ICommand<Guid>, IAggregateCommand
{
    private readonly IIssueRepository _repository;
    private readonly IIssueActivityWriter _activity;
    private readonly IExecutionContext _executionContext;
    private readonly IClock _clock;

    protected IssueCommandHandlerBase(
        IIssueRepository repository,
        IIssueActivityWriter activity,
        IExecutionContext executionContext,
        IClock clock)
    {
        _repository = repository;
        _activity = activity;
        _executionContext = executionContext;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(TCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var issue = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Issue), command.Uuid);

        var now = _clock.UtcNow;
        var change = Apply(issue, command, now);

        // Zapis „tytuł na ten sam tytuł” nie jest zdarzeniem w historii, choć jest poprawną
        // komendą — inaczej masowe ustawienie priorytetu na już ustawiony zasypałoby kartę.
        if (change is { Changed: true, FieldCode: not null })
        {
            _activity.Add(IssueActivity.Record(
                issue.Uuid,
                IssueActivityKind.FieldChanged,
                change.FieldCode,
                change.OldValue,
                change.NewValue,
                IssueCreateCommandHandler.ActorUuid(_executionContext),
                _executionContext.CorrelationId,
                now));
        }

        return issue.Uuid;
    }

    /// <summary>Wykonuje zmianę i mówi, co zmieniła. Wartości „przed” trzeba odczytać
    /// <b>przed</b> wywołaniem metody agregatu — potem już ich nie ma.</summary>
    protected abstract IssueFieldChange Apply(Issue issue, TCommand command, DateTimeOffset now);
}

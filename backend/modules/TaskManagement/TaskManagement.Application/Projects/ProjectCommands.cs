using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Application.Issues;
using TaskManagement.Domain.IssueTypes;
using TaskManagement.Domain.Projects;
using TaskManagement.Domain.Workflow;

namespace TaskManagement.Application.Projects;

/// <summary>
/// Założenie projektu. Razem z projektem powstaje jego licznik numeracji — jedno bez drugiego
/// nie ma sensu, a rozdzielenie na dwie komendy dawałoby okno, w którym projekt istnieje,
/// ale nie da się w nim utworzyć zgłoszenia (<c>docs/modules/task-management/domain.md</c> §4).
/// </summary>
public sealed class ProjectCreateCommand : ICommand<Guid>, IAggregateCommand
{
    /// <summary>Uuid generowany przez klienta — tryb <c>Commands[]</c>.</summary>
    public Guid Uuid { get; set; }

    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public ProjectKind Kind { get; set; } = ProjectKind.Delivery;

    /// <summary>Schemat stanów; puste = schemat systemowy modułu.</summary>
    public Guid? WorkflowSchemeUuid { get; set; }

    /// <summary>Schemat typów zgłoszeń; puste = schemat systemowy modułu (TYP-001).</summary>
    public Guid? IssueTypeSchemeUuid { get; set; }

    public bool IsPublic { get; set; }
}

public sealed class ProjectCreateCommandHandler : CommandHandler<ProjectCreateCommand, Guid>
{
    private readonly IProjectRepository _repository;
    private readonly IWorkflowSchemeRepository _schemes;
    private readonly IIssueTypeSchemeRepository _issueTypeSchemes;
    private readonly IProjectKeyCounterWriter _counters;

    public ProjectCreateCommandHandler(
        IProjectRepository repository,
        IWorkflowSchemeRepository schemes,
        IIssueTypeSchemeRepository issueTypeSchemes,
        IProjectKeyCounterWriter counters)
    {
        _repository = repository;
        _schemes = schemes;
        _issueTypeSchemes = issueTypeSchemes;
        _counters = counters;
    }

    public override async Task<Guid> ExecuteAsync(ProjectCreateCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var schemeUuid = command.WorkflowSchemeUuid ?? WorkflowSchemeDefaults.SystemSchemeUuid;

        var scheme = await _schemes.FindAsync(schemeUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Domain.Workflow.WorkflowScheme), schemeUuid);

        var issueTypeSchemeUuid = command.IssueTypeSchemeUuid ?? IssueTypeSchemeDefaults.SystemSchemeUuid;

        var issueTypeScheme = await _issueTypeSchemes.FindAsync(issueTypeSchemeUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(IssueTypeScheme), issueTypeSchemeUuid);

        var project = Project.CreateWithUuid(
            command.Uuid,
            command.Code,
            command.Name,
            command.Kind,
            scheme.Uuid,
            issueTypeScheme.Uuid,
            command.IsPublic);

        _repository.Add(project);
        _counters.Add(ProjectKeyCounter.Create(project.Uuid, project.Code));

        return project.Uuid;
    }
}

/// <summary>Podmienia schemat typów zgłoszeń projektu (TYP-001). Zgłoszenia istniejące
/// zachowują swój <see cref="Issue.TypeUuid"/> — podmiana nie migruje danych wstecz.</summary>
public sealed class ProjectSetIssueTypeSchemeCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid IssueTypeSchemeUuid { get; set; }
}

public sealed class ProjectSetIssueTypeSchemeCommandHandler : CommandHandler<ProjectSetIssueTypeSchemeCommand, Guid>
{
    private readonly IProjectRepository _repository;
    private readonly IIssueTypeSchemeRepository _issueTypeSchemes;

    public ProjectSetIssueTypeSchemeCommandHandler(
        IProjectRepository repository,
        IIssueTypeSchemeRepository issueTypeSchemes)
    {
        _repository = repository;
        _issueTypeSchemes = issueTypeSchemes;
    }

    public override async Task<Guid> ExecuteAsync(ProjectSetIssueTypeSchemeCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var project = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Project), command.Uuid);

        _ = await _issueTypeSchemes.FindAsync(command.IssueTypeSchemeUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(IssueTypeScheme), command.IssueTypeSchemeUuid);

        project.SetIssueTypeScheme(command.IssueTypeSchemeUuid);

        return project.Uuid;
    }
}

public sealed class ProjectSetNameCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public string Name { get; set; } = string.Empty;
}

public sealed class ProjectSetNameCommandHandler : CommandHandler<ProjectSetNameCommand, Guid>
{
    private readonly IProjectRepository _repository;

    public ProjectSetNameCommandHandler(IProjectRepository repository) => _repository = repository;

    public override async Task<Guid> ExecuteAsync(ProjectSetNameCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var project = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Project), command.Uuid);

        project.SetName(command.Name);

        return project.Uuid;
    }
}

/// <summary>Zmiana prefiksu klucza zgłoszeń (PRJ-003) — istniejące klucze zostają bez zmian,
/// nowe zgłoszenia dostają nowy prefiks, licznik nie jest resetowany.</summary>
public sealed class ProjectSetCodeCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public string Code { get; set; } = string.Empty;
}

public sealed class ProjectSetCodeCommandHandler : CommandHandler<ProjectSetCodeCommand, Guid>
{
    private readonly IProjectRepository _repository;
    private readonly IProjectKeyCounterWriter _counters;

    public ProjectSetCodeCommandHandler(IProjectRepository repository, IProjectKeyCounterWriter counters)
    {
        _repository = repository;
        _counters = counters;
    }

    public override async Task<Guid> ExecuteAsync(ProjectSetCodeCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var project = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Project), command.Uuid);

        // Walidacja formatu (myślnik, długość) jest w `Project.SetCode` — tu tylko odczytujemy
        // znormalizowany kod z powrotem, żeby licznik dostał DOKŁADNIE to, co przyjął agregat,
        // a nie surowe wejście komendy.
        project.SetCode(command.Code);

        await _counters.SetPrefixAsync(project.Uuid, project.Code, ct).ConfigureAwait(false);

        return project.Uuid;
    }
}

/// <summary>Ustawia albo zdejmuje widok domyślny projektu (VIEW-002, `Could`). Widok musi być
/// udostępniony TEMU projektowi — prywatny albo udostępniony innemu projektowi jest odrzucony:
/// widok domyślny musi być widoczny dla każdego, kto widzi projekt, a prywatny widok innej osoby
/// nie spełnia tego z definicji.</summary>
public sealed class ProjectSetDefaultSavedViewCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid? SavedViewUuid { get; set; }
}

public sealed class ProjectSetDefaultSavedViewCommandHandler : CommandHandler<ProjectSetDefaultSavedViewCommand, Guid>
{
    private readonly IProjectRepository _repository;
    private readonly ISavedViewRepository _savedViews;

    public ProjectSetDefaultSavedViewCommandHandler(IProjectRepository repository, ISavedViewRepository savedViews)
    {
        _repository = repository;
        _savedViews = savedViews;
    }

    public override async Task<Guid> ExecuteAsync(ProjectSetDefaultSavedViewCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var project = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Project), command.Uuid);

        if (command.SavedViewUuid is { } savedViewUuid && savedViewUuid != Guid.Empty)
        {
            var view = await _savedViews.FindAsync(savedViewUuid, ct).ConfigureAwait(false)
                ?? throw new AggregateNotFoundException(nameof(Domain.SavedViews.SavedView), savedViewUuid);

            if (view.ProjectUuid != project.Uuid)
            {
                throw new DomainException(
                    "taskmgmt.saved_view_not_shared_with_project",
                    "Widokiem domyślnym może zostać wyłącznie widok udostępniony temu projektowi.");
            }
        }

        project.SetDefaultSavedView(command.SavedViewUuid);

        return project.Uuid;
    }
}

/// <summary>Archiwizacja/przywrócenie projektu (PRJ-004). Bez osobnej komendy usuwania —
/// projektu w tym module się nie kasuje (PRJ-004 AC2).</summary>
public sealed class ProjectSetArchivedCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public bool IsArchived { get; set; }
}

public sealed class ProjectSetArchivedCommandHandler : CommandHandler<ProjectSetArchivedCommand, Guid>
{
    private readonly IProjectRepository _repository;

    public ProjectSetArchivedCommandHandler(IProjectRepository repository) => _repository = repository;

    public override async Task<Guid> ExecuteAsync(ProjectSetArchivedCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var project = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Project), command.Uuid);

        if (command.IsArchived)
        {
            project.Archive();
        }
        else
        {
            project.Unarchive();
        }

        return project.Uuid;
    }
}

/// <summary>Nadanie roli w projekcie — <b>atrybut nadania</b>, nie kod uprawnienia (§10.2).</summary>
public sealed class ProjectAddMemberCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid UserUuid { get; set; }

    public ProjectMemberRole Role { get; set; } = ProjectMemberRole.Contributor;
}

public sealed class ProjectAddMemberCommandHandler : CommandHandler<ProjectAddMemberCommand, Guid>
{
    private readonly IProjectRepository _repository;

    public ProjectAddMemberCommandHandler(IProjectRepository repository) => _repository = repository;

    public override async Task<Guid> ExecuteAsync(ProjectAddMemberCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var project = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Project), command.Uuid);

        project.AddMember(command.UserUuid, command.Role);

        return project.Uuid;
    }
}

public sealed class ProjectRemoveMemberCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid UserUuid { get; set; }
}

public sealed class ProjectRemoveMemberCommandHandler : CommandHandler<ProjectRemoveMemberCommand, Guid>
{
    private readonly IProjectRepository _repository;

    public ProjectRemoveMemberCommandHandler(IProjectRepository repository) => _repository = repository;

    public override async Task<Guid> ExecuteAsync(ProjectRemoveMemberCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var project = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Project), command.Uuid);

        project.RemoveMember(command.UserUuid);

        return project.Uuid;
    }
}

/// <summary>Zakłada albo aktualizuje politykę SLA projektu (PRJ-006, faza 5).</summary>
public sealed class ProjectSetSlaCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public int ResponseMinutes { get; set; }

    public int ResolutionMinutes { get; set; }

    public SlaWorkingDays WorkingDays { get; set; }

    public TimeOnly WorkStartTime { get; set; }

    public TimeOnly WorkEndTime { get; set; }
}

public sealed class ProjectSetSlaCommandHandler : CommandHandler<ProjectSetSlaCommand, Guid>
{
    private readonly IProjectRepository _repository;

    public ProjectSetSlaCommandHandler(IProjectRepository repository) => _repository = repository;

    public override async Task<Guid> ExecuteAsync(ProjectSetSlaCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var project = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Project), command.Uuid);

        project.SetSla(
            command.ResponseMinutes,
            command.ResolutionMinutes,
            command.WorkingDays,
            command.WorkStartTime,
            command.WorkEndTime);

        return project.Uuid;
    }
}

/// <summary>Wycisza/odcisza powiadomienia z projektu dla WOŁAJĄCEGO (NTF-003) — ustawienie
/// osobiste, nie administracyjne: <see cref="Muted"/> jedyny parametr wejściowy, użytkownika
/// bierzemy zawsze z <see cref="IExecutionContext"/>, nigdy z payloadu, bo inaczej dałoby się
/// wyciszyć powiadomienia komuś innemu.</summary>
public sealed class ProjectSetNotificationMutedCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public bool Muted { get; set; }
}

public sealed class ProjectSetNotificationMutedCommandHandler : CommandHandler<ProjectSetNotificationMutedCommand, Guid>
{
    private readonly IProjectRepository _repository;
    private readonly IExecutionContext _executionContext;
    private readonly IClock _clock;

    public ProjectSetNotificationMutedCommandHandler(
        IProjectRepository repository,
        IExecutionContext executionContext,
        IClock clock)
    {
        _repository = repository;
        _executionContext = executionContext;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(ProjectSetNotificationMutedCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var project = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Project), command.Uuid);

        project.SetNotificationMuted(
            IssueCreateCommandHandler.ActorUuid(_executionContext),
            command.Muted,
            _clock.UtcNow);

        return project.Uuid;
    }
}

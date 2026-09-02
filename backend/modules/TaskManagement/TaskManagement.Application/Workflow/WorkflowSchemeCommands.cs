using System.Text.Json;
using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using Erp.BuildingBlocks.Jobs;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Application.Issues;
using TaskManagement.Domain.Workflow;

namespace TaskManagement.Application.Workflow;

/// <summary>Zakłada schemat stanów. Stany i przejścia dokłada się osobno — wzorzec identyczny
/// jak <c>IssueTypeSchemeCreateCommand</c> (WF-001/WF-007).</summary>
public sealed class WorkflowSchemeCreateCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public string Name { get; set; } = string.Empty;
}

public sealed class WorkflowSchemeCreateCommandHandler : CommandHandler<WorkflowSchemeCreateCommand, Guid>
{
    private readonly IWorkflowSchemeRepository _schemes;

    public WorkflowSchemeCreateCommandHandler(IWorkflowSchemeRepository schemes) => _schemes = schemes;

    public override Task<Guid> ExecuteAsync(WorkflowSchemeCreateCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var scheme = WorkflowScheme.CreateWithUuid(command.Uuid, command.Name, isSystem: false);
        _schemes.Add(scheme);

        return Task.FromResult(scheme.Uuid);
    }
}

/// <summary>Dokłada stan do schematu (WF-001, WF-007) — nowy stan pojawia się w kolumnach
/// tablicy i w filtrze listy bez wdrożenia.</summary>
public sealed class WorkflowSchemeAddStateCommand : ICommand<Guid>, IAggregateCommand
{
    /// <summary>Uuid schematu.</summary>
    public Guid Uuid { get; set; }

    /// <summary>Uuid zakładanego stanu — nadaje go klient, jak przy każdym elemencie kolekcji
    /// zakładanym w trybie <c>Commands[]</c>.</summary>
    public Guid StateUuid { get; set; }

    public string Code { get; set; } = string.Empty;

    public string NameKey { get; set; } = string.Empty;

    public WorkflowStateCategory Category { get; set; }

    public int OrderNo { get; set; }
}

public sealed class WorkflowSchemeAddStateCommandHandler : CommandHandler<WorkflowSchemeAddStateCommand, Guid>
{
    private readonly IWorkflowSchemeRepository _schemes;

    public WorkflowSchemeAddStateCommandHandler(IWorkflowSchemeRepository schemes) => _schemes = schemes;

    public override async Task<Guid> ExecuteAsync(WorkflowSchemeAddStateCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var scheme = await _schemes.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(WorkflowScheme), command.Uuid);

        scheme.AddState(
            command.StateUuid == Guid.Empty ? Entity.NewUuid() : command.StateUuid,
            command.Code,
            command.NameKey,
            command.Category,
            command.OrderNo);

        return scheme.Uuid;
    }
}

/// <summary>Nadpisuje szczegóły stanu — nazwę, kategorię i kolejność. Kod pozostaje niezmienny
/// (patrz <see cref="WorkflowSchemeAddStateCommand"/>).</summary>
public sealed class WorkflowSchemeSetStateCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid StateUuid { get; set; }

    public string NameKey { get; set; } = string.Empty;

    public WorkflowStateCategory Category { get; set; }

    public int OrderNo { get; set; }
}

public sealed class WorkflowSchemeSetStateCommandHandler : CommandHandler<WorkflowSchemeSetStateCommand, Guid>
{
    private readonly IWorkflowSchemeRepository _schemes;

    public WorkflowSchemeSetStateCommandHandler(IWorkflowSchemeRepository schemes) => _schemes = schemes;

    public override async Task<Guid> ExecuteAsync(WorkflowSchemeSetStateCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var scheme = await _schemes.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(WorkflowScheme), command.Uuid);

        scheme.SetState(command.StateUuid, command.NameKey, command.Category, command.OrderNo);

        return scheme.Uuid;
    }
}

/// <summary>
/// Usuwa stan ze schematu.
///
/// <para>Odmawia, gdy <b>którekolwiek zgłoszenie siedzi w tym stanie</b> — sprawdzane przez
/// <see cref="IWorkflowStateUsageProbe"/>, wzorem <c>IssueTypeSchemeRemoveTypeCommandHandler</c>
/// (TYP-004). Administrator dostaje wtedy podpowiedź, że stan z otwartymi zgłoszeniami usuwa się
/// przez <see cref="WorkflowSchemeExecPublishCommand"/>, nie przez tę komendę (WF-006).</para>
/// </summary>
public sealed class WorkflowSchemeRemoveStateCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid StateUuid { get; set; }
}

public sealed class WorkflowSchemeRemoveStateCommandHandler : CommandHandler<WorkflowSchemeRemoveStateCommand, Guid>
{
    private readonly IWorkflowSchemeRepository _schemes;
    private readonly IWorkflowStateUsageProbe _usage;

    public WorkflowSchemeRemoveStateCommandHandler(IWorkflowSchemeRepository schemes, IWorkflowStateUsageProbe usage)
    {
        _schemes = schemes;
        _usage = usage;
    }

    public override async Task<Guid> ExecuteAsync(WorkflowSchemeRemoveStateCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var scheme = await _schemes.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(WorkflowScheme), command.Uuid);

        var state = scheme.FindStateByUuid(command.StateUuid)
            ?? throw new AggregateNotFoundException(nameof(WorkflowState), command.StateUuid);

        var usageCount = await _usage.CountByStateAsync(command.StateUuid, ct).ConfigureAwait(false);

        if (usageCount > 0)
        {
            throw new DomainException(
                "taskmgmt.workflow_state_in_use",
                $"Stan `{state.Code}` ma {usageCount} zgłoszeń — usuń go przez publikację schematu z mapowaniem migracji (WF-006).");
        }

        scheme.RemoveState(command.StateUuid);

        return scheme.Uuid;
    }
}

/// <summary>Dokłada przejście do schematu (WF-001, WF-007).</summary>
public sealed class WorkflowSchemeAddTransitionCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    /// <summary>Uuid zakładanego przejścia — nadaje go klient.</summary>
    public Guid TransitionUuid { get; set; }

    public Guid FromStateUuid { get; set; }

    public Guid ToStateUuid { get; set; }

    public string NameKey { get; set; } = string.Empty;

    public string? RequiredPermission { get; set; }

    public List<string>? RequiredFields { get; set; }
}

public sealed class WorkflowSchemeAddTransitionCommandHandler : CommandHandler<WorkflowSchemeAddTransitionCommand, Guid>
{
    private readonly IWorkflowSchemeRepository _schemes;

    public WorkflowSchemeAddTransitionCommandHandler(IWorkflowSchemeRepository schemes) => _schemes = schemes;

    public override async Task<Guid> ExecuteAsync(WorkflowSchemeAddTransitionCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var scheme = await _schemes.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(WorkflowScheme), command.Uuid);

        scheme.AddTransition(
            command.TransitionUuid == Guid.Empty ? Entity.NewUuid() : command.TransitionUuid,
            command.FromStateUuid,
            command.ToStateUuid,
            command.NameKey,
            command.RequiredPermission,
            command.RequiredFields);

        return scheme.Uuid;
    }
}

/// <summary>Nadpisuje szczegóły przejścia — nazwę, uprawnienie i pola wymagane (WF-003, WF-007).
/// Krawędź (z/do) pozostaje niezmienna — zmiana krawędzi to usunięcie i dodanie nowej.</summary>
public sealed class WorkflowSchemeSetTransitionCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid TransitionUuid { get; set; }

    public string NameKey { get; set; } = string.Empty;

    public string? RequiredPermission { get; set; }

    public List<string>? RequiredFields { get; set; }
}

public sealed class WorkflowSchemeSetTransitionCommandHandler : CommandHandler<WorkflowSchemeSetTransitionCommand, Guid>
{
    private readonly IWorkflowSchemeRepository _schemes;

    public WorkflowSchemeSetTransitionCommandHandler(IWorkflowSchemeRepository schemes) => _schemes = schemes;

    public override async Task<Guid> ExecuteAsync(WorkflowSchemeSetTransitionCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var scheme = await _schemes.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(WorkflowScheme), command.Uuid);

        scheme.SetTransition(command.TransitionUuid, command.NameKey, command.RequiredPermission, command.RequiredFields);

        return scheme.Uuid;
    }
}

/// <summary>Usuwa przejście ze schematu — nie ma tu reguły chroniącej, bo krawędzie nie mają
/// odbicia na zgłoszeniach poza tym, że jedna ścieżka przejścia przestaje istnieć.</summary>
public sealed class WorkflowSchemeRemoveTransitionCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid TransitionUuid { get; set; }
}

public sealed class WorkflowSchemeRemoveTransitionCommandHandler : CommandHandler<WorkflowSchemeRemoveTransitionCommand, Guid>
{
    private readonly IWorkflowSchemeRepository _schemes;

    public WorkflowSchemeRemoveTransitionCommandHandler(IWorkflowSchemeRepository schemes) => _schemes = schemes;

    public override async Task<Guid> ExecuteAsync(WorkflowSchemeRemoveTransitionCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var scheme = await _schemes.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(WorkflowScheme), command.Uuid);

        scheme.RemoveTransition(command.TransitionUuid);

        return scheme.Uuid;
    }
}

/// <summary>
/// Publikuje usunięcie stanów, które mają otwarte zgłoszenia, razem z migracją tych zgłoszeń
/// (WF-006). Czasownik <c>Exec</c>, bo operacja nie da się opisać jednym z <c>Set</c>/<c>Add</c>/
/// <c>Remove</c> na samym agregacie schematu — dotyka też zgłoszeń spoza jego granicy
/// (`docs/backend/endpoint-naming.md` §5).
///
/// <para>Handler w dwóch krokach: (1) <see cref="WorkflowScheme.Publish"/> waliduje mapowanie
/// i usuwa stany ze schematu — od tego momentu tablica i filtr stanu już ich nie pokazują;
/// (2) zgłoszenia, które w chwili publikacji siedziały w usuniętych stanach, migrują przez
/// zwykłe zadanie masowe (<c>job</c>/<c>job_item</c>, ten sam <see cref="BulkCommandRunner{TContext}"/>,
/// który wykonuje każdą inną operację wsadową) — element po elemencie, przez
/// <c>IssueSetStateCommand</c>, więc podlega tej samej regule przejść: zgłoszenie, którego stan
/// docelowy nie ma opisanego przejścia z jego aktualnego stanu, kończy się <c>Failed</c>, a reszta
/// idzie dalej (WF-006 AC3 — sukces częściowy).</para>
/// </summary>
public sealed class WorkflowSchemeExecPublishCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    /// <summary>Stany wskazane do usunięcia w tej publikacji.</summary>
    public List<Guid> StatesToRemove { get; set; } = [];

    /// <summary>Mapowanie usuwany stan → stan docelowy migracji zgłoszeń. Musi mieć dokładnie
    /// jeden wpis na każdy element <see cref="StatesToRemove"/> (WF-006 AC2).</summary>
    public Dictionary<Guid, Guid> Mapping { get; set; } = [];

    /// <summary>Identyfikator grupujący zadanie migracji we froncie (dzwonek powiadomień).</summary>
    public string? QueueId { get; set; }
}

public sealed class WorkflowSchemeExecPublishCommandHandler : CommandHandler<WorkflowSchemeExecPublishCommand, Guid>
{
    private readonly IWorkflowSchemeRepository _schemes;
    private readonly IWorkflowSchemePublishIssueQueries _affectedIssues;
    private readonly IJobStore _jobStore;

    public WorkflowSchemeExecPublishCommandHandler(
        IWorkflowSchemeRepository schemes,
        IWorkflowSchemePublishIssueQueries affectedIssues,
        IJobStore jobStore)
    {
        _schemes = schemes;
        _affectedIssues = affectedIssues;
        _jobStore = jobStore;
    }

    public override async Task<Guid> ExecuteAsync(WorkflowSchemeExecPublishCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var scheme = await _schemes.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(WorkflowScheme), command.Uuid);

        // Zgłoszenia siedzące w usuwanych stanach trzeba poznać PRZED wywołaniem `Publish` —
        // po nim stany znikają ze schematu i nie da się już odróżnić „stan usunięty w tej
        // publikacji” od „stan, którego nigdy nie było”.
        var affected = await _affectedIssues
            .FindByStatesAsync(command.StatesToRemove, ct)
            .ConfigureAwait(false);

        // Waliduje kompletność mapowania i usuwa stany — rzuca `DomainException`, jeśli mapowanie
        // jest niepełne albo niespójne (WF-006 AC2), zanim powstanie choćby jeden `job_item`.
        var migrations = scheme.Publish(command.StatesToRemove, command.Mapping);
        var targetByRemovedState = migrations.ToDictionary(m => m.RemovedStateUuid, m => m.TargetStateUuid);

        if (affected.Count > 0)
        {
            var targets = affected
                .Select(issue => new JobTarget(
                    issue.IssueUuid,
                    JsonSerializer.Serialize(new IssueSetStateCommand
                    {
                        Uuid = issue.IssueUuid,
                        StateUuid = targetByRemovedState[issue.StateUuid],
                    })))
                .ToList();

            await _jobStore
                .CreateAsync(
                    nameof(IssueSetStateCommand),
                    commandJson: null,
                    targets,
                    command.QueueId,
                    uiMetadata: null,
                    preValidatedFailures: null,
                    ct)
                .ConfigureAwait(false);
        }

        return scheme.Uuid;
    }
}

using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.IssueTypes;
using TaskManagement.Domain.Issues;

namespace TaskManagement.Application.Issues;

/// <summary>
/// Ustawia albo zdejmuje rodzica zgłoszenia. Pusty <see cref="ParentUuid"/> wypina zgłoszenie
/// z hierarchii — to poprawna operacja, nie brak decyzji.
/// </summary>
public sealed class IssueSetParentCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid? ParentUuid { get; set; }
}

public sealed class IssueSetParentCommandHandler : CommandHandler<IssueSetParentCommand, Guid>
{
    private readonly IIssueRepository _issues;
    private readonly IIssueGraphQueries _graph;
    private readonly IIssueTypeSchemeRepository _issueTypeSchemes;
    private readonly IIssueActivityWriter _activity;
    private readonly IExecutionContext _executionContext;
    private readonly IClock _clock;

    public IssueSetParentCommandHandler(
        IIssueRepository issues,
        IIssueGraphQueries graph,
        IIssueTypeSchemeRepository issueTypeSchemes,
        IIssueActivityWriter activity,
        IExecutionContext executionContext,
        IClock clock)
    {
        _issues = issues;
        _graph = graph;
        _issueTypeSchemes = issueTypeSchemes;
        _activity = activity;
        _executionContext = executionContext;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(IssueSetParentCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var issue = await _issues.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Issue), command.Uuid);

        var previous = issue.ParentUuid;
        Issue? parent = null;

        if (command.ParentUuid is { } parentUuid && parentUuid != Guid.Empty)
        {
            parent = await _issues.FindAsync(parentUuid, ct).ConfigureAwait(false)
                ?? throw new AggregateNotFoundException(nameof(Issue), parentUuid);

            // DRUGA linia obrony po `IssueParentCycleRule`. Reguła wsadowa widzi stan
            // ZACOMMITOWANY plus krawędzie z tego samego wsadu; to sprawdzenie łapie cykl
            // względem zadania, które zacommitowało się pomiędzy pre-checkiem a wykonaniem.
            // Ten sam podział ról, co przy grafie ról w Identity (§8.2).
            var ancestors = await _graph
                .GetAncestorsAsync([parentUuid], ct)
                .ConfigureAwait(false);

            if (ancestors.TryGetValue(parentUuid, out var chain) && chain.Contains(issue.Uuid))
            {
                throw new DomainException(
                    "taskmgmt.parent_cycle",
                    $"Zgłoszenie {parentUuid} leży w poddrzewie {issue.Key} — taka hierarchia byłaby pętlą.");
            }
        }

        // Kategorie typów wchodzą jako parametry, bo agregat nie ma jak sam sięgnąć po
        // `IssueTypeScheme` — tak samo jak schemat stanów przy `SetState` (TYP-001, LNK-001 AC2).
        // Rodzic i dziecko mogą teoretycznie należeć do schematów o różnych zestawach typów,
        // ale są w tym samym projekcie (sprawdzone wyżej), więc mają ten sam schemat typów.
        var scheme = await _issueTypeSchemes.FindByProjectAsync(issue.ProjectUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Domain.Projects.Project), issue.ProjectUuid);

        var thisTypeCategory = scheme.FindByUuid(issue.TypeUuid)?.Category ?? IssueTypeCategory.Standard;
        var parentTypeCategory = parent is null ? (IssueTypeCategory?)null : scheme.FindByUuid(parent.TypeUuid)?.Category;

        var now = _clock.UtcNow;
        issue.SetParent(parent, thisTypeCategory, parentTypeCategory, now);

        _activity.Add(IssueActivity.Record(
            issue.Uuid,
            IssueActivityKind.FieldChanged,
            "parent",
            previous?.ToString(),
            issue.ParentUuid?.ToString(),
            IssueCreateCommandHandler.ActorUuid(_executionContext),
            _executionContext.CorrelationId,
            now));

        return issue.Uuid;
    }
}

/// <summary>
/// Dopina powiązanie do zgłoszenia. <see cref="Uuid"/> to <b>źródło</b> krawędzi — kierunek
/// jest częścią znaczenia (<c>A blokuje B</c> ≠ <c>B blokuje A</c>).
/// </summary>
public sealed class IssueAddLinkCommand : ICommand<Guid>, IAggregateCommand
{
    /// <summary>Uuid zgłoszenia źródłowego.</summary>
    public Guid Uuid { get; set; }

    /// <summary>Uuid zakładanej krawędzi — nadaje go klient, jak przy każdym agregacie
    /// tworzonym w trybie <c>Commands[]</c>.</summary>
    public Guid LinkUuid { get; set; }

    public Guid TargetUuid { get; set; }

    public IssueLinkType Type { get; set; }
}

public sealed class IssueAddLinkCommandHandler : CommandHandler<IssueAddLinkCommand, Guid>
{
    private readonly IIssueRepository _issues;
    private readonly IIssueLinkRepository _links;
    private readonly IIssueGraphQueries _graph;
    private readonly IIssueActivityWriter _activity;
    private readonly IssueDeliveryStateRecalculator _deliveryRecalculator;
    private readonly IExecutionContext _executionContext;
    private readonly IClock _clock;

    public IssueAddLinkCommandHandler(
        IIssueRepository issues,
        IIssueLinkRepository links,
        IIssueGraphQueries graph,
        IIssueActivityWriter activity,
        IssueDeliveryStateRecalculator deliveryRecalculator,
        IExecutionContext executionContext,
        IClock clock)
    {
        _issues = issues;
        _links = links;
        _graph = graph;
        _activity = activity;
        _deliveryRecalculator = deliveryRecalculator;
        _executionContext = executionContext;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(IssueAddLinkCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var source = await _issues.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Issue), command.Uuid);

        // Cel musi istnieć, ale NIE musi być w tym samym projekcie: blokada między działami
        // jest dokładnie tym, po co ten graf istnieje. Widoczność rozstrzyga się przy odczycie
        // („wgląd z powiązania" to nagłówek, §10.1), nie przy zapisie.
        _ = await _issues.FindAsync(command.TargetUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Issue), command.TargetUuid);

        if (command.Type == IssueLinkType.Blocks)
        {
            var reachable = await _graph
                .GetBlockingReachableAsync([command.TargetUuid], ct)
                .ConfigureAwait(false);

            if (reachable.TryGetValue(command.TargetUuid, out var blocked) && blocked.Contains(command.Uuid))
            {
                throw new DomainException(
                    "taskmgmt.link_cycle",
                    "Ta blokada zamknęłaby pętlę — cel (pośrednio) blokuje już źródło.");
            }
        }

        var now = _clock.UtcNow;
        var actor = IssueCreateCommandHandler.ActorUuid(_executionContext);

        var link = IssueLink.CreateWithUuid(
            command.LinkUuid == Guid.Empty ? Entity.NewUuid() : command.LinkUuid,
            command.Uuid,
            command.TargetUuid,
            command.Type,
            actor,
            now);

        _links.Add(link);

        _activity.Add(IssueActivity.Record(
            source.Uuid,
            IssueActivityKind.FieldChanged,
            "link",
            null,
            $"{command.Type}:{command.TargetUuid}",
            actor,
            _executionContext.CorrelationId,
            now));

        // Nowa realizacja zmienia zbiór, po którym liczy się stan zlecenia (REQ-003) —
        // niezależnie od tego, czy realizacja jest akurat zamknięta.
        if (command.Type == IssueLinkType.Delivers)
        {
            await _deliveryRecalculator.RecalculateAsync(command.TargetUuid, now, ct).ConfigureAwait(false);
        }

        return source.Uuid;
    }
}

/// <summary>Odpina powiązanie. <see cref="Uuid"/> to zgłoszenie, z którego karty operacja
/// wyszła — krawędź wskazuje <see cref="LinkUuid"/>.</summary>
public sealed class IssueRemoveLinkCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid LinkUuid { get; set; }
}

public sealed class IssueRemoveLinkCommandHandler : CommandHandler<IssueRemoveLinkCommand, Guid>
{
    private readonly IIssueLinkRepository _links;
    private readonly IIssueActivityWriter _activity;
    private readonly IssueDeliveryStateRecalculator _deliveryRecalculator;
    private readonly IExecutionContext _executionContext;
    private readonly IClock _clock;

    public IssueRemoveLinkCommandHandler(
        IIssueLinkRepository links,
        IIssueActivityWriter activity,
        IssueDeliveryStateRecalculator deliveryRecalculator,
        IExecutionContext executionContext,
        IClock clock)
    {
        _links = links;
        _activity = activity;
        _deliveryRecalculator = deliveryRecalculator;
        _executionContext = executionContext;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(IssueRemoveLinkCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var link = await _links.FindAsync(command.LinkUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(IssueLink), command.LinkUuid);

        // Odpiąć wolno z obu stron krawędzi — blokadę widać na obu kartach, więc oczekiwanie,
        // że da się ją zdjąć tylko z tej, z której powstała, byłoby zaskoczeniem.
        if (link.SourceUuid != command.Uuid && link.TargetUuid != command.Uuid)
        {
            throw new DomainException(
                "taskmgmt.link_other_issue",
                "To powiązanie nie dotyczy wskazanego zgłoszenia.");
        }

        _links.Remove(link);

        var now = _clock.UtcNow;

        _activity.Add(IssueActivity.Record(
            command.Uuid,
            IssueActivityKind.FieldChanged,
            "link",
            $"{link.Type}:{(link.SourceUuid == command.Uuid ? link.TargetUuid : link.SourceUuid)}",
            null,
            IssueCreateCommandHandler.ActorUuid(_executionContext),
            _executionContext.CorrelationId,
            now));

        // Odpięcie realizacji też zmienia zbiór, po którym liczy się stan zlecenia (REQ-003).
        if (link.Type == IssueLinkType.Delivers)
        {
            await _deliveryRecalculator.RecalculateAsync(link.TargetUuid, now, ct).ConfigureAwait(false);
        }

        return command.Uuid;
    }
}

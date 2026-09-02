using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Workflow;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Queries;

/// <summary>Odczyty schematów stanów — wzorzec identyczny jak <see cref="IssueTypeSchemeQueries"/>.
/// Ekran konfiguracji projektu, zakładka „Schemat stanów" (WF-007).</summary>
public sealed class WorkflowSchemeQueries : IWorkflowSchemeQueries
{
    private readonly TaskManagementDbContext _dbContext;

    public WorkflowSchemeQueries(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public async Task<List<WorkflowSchemeDto>> SearchAsync(
        SearchWorkflowSchemeRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = _dbContext.WorkflowSchemes.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.Text))
        {
            var text = request.Text.Trim();
            query = query.Where(s => EF.Functions.ILike(s.Name, $"%{text}%"));
        }

        var schemeUuids = await query
            .OrderBy(s => s.Name)
            .Select(s => new { s.Uuid, s.Name, s.IsSystem })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var result = new List<WorkflowSchemeDto>(schemeUuids.Count);

        foreach (var scheme in schemeUuids)
        {
            result.Add(await BuildAsync(scheme.Uuid, scheme.Name, scheme.IsSystem, cancellationToken).ConfigureAwait(false));
        }

        return result;
    }

    /// <inheritdoc />
    public async Task<WorkflowSchemeDto?> GetAsync(Guid uuid, CancellationToken cancellationToken)
    {
        var scheme = await _dbContext.WorkflowSchemes
            .AsNoTracking()
            .Where(s => s.Uuid == uuid)
            .Select(s => new { s.Uuid, s.Name, s.IsSystem })
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        return scheme is null
            ? null
            : await BuildAsync(scheme.Uuid, scheme.Name, scheme.IsSystem, cancellationToken).ConfigureAwait(false);
    }

    private async Task<WorkflowSchemeDto> BuildAsync(
        Guid schemeUuid,
        string name,
        bool isSystem,
        CancellationToken cancellationToken)
    {
        var states = await _dbContext.WorkflowStates
            .AsNoTracking()
            .Where(s => s.SchemeUuid == schemeUuid)
            .OrderBy(s => s.OrderNo)
            .Select(s => new WorkflowStateDto(s.Uuid, s.Code, s.NameKey, s.Category, s.OrderNo))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var transitions = await _dbContext.WorkflowTransitions
            .AsNoTracking()
            .Where(t => t.SchemeUuid == schemeUuid)
            .Select(t => new WorkflowTransitionDto(
                t.Uuid,
                t.FromStateUuid,
                t.ToStateUuid,
                t.NameKey,
                t.RequiredPermission,
                EF.Property<List<string>>(t, "_requiredFields")))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return new WorkflowSchemeDto(schemeUuid, name, isSystem, states, transitions);
    }
}

/// <summary>
/// Podgląd publikacji (WF-006) — dla stanów wskazanych do usunięcia liczy zgłoszenia, które
/// w nich siedzą, i zwraca zbiór stanów-celów migracji (wszystko poza usuwanymi).
///
/// <para>Odczyt idzie wprost po <c>Issue.StateUuid</c>, nie po projekcji przez agregat: stan
/// jest identyfikowany globalnie unikalnym uuidem (nadawanym przez agregat, nie przez bazę —
/// patrz <c>WorkflowStateConfiguration</c>), więc zapytanie po nim nie musi znać, który projekt
/// czy typ zgłoszenia wskazuje na ten konkretny schemat.</para>
/// </summary>
public sealed class WorkflowSchemePublishPreviewQueries : IWorkflowSchemePublishPreviewQueries
{
    private readonly TaskManagementDbContext _dbContext;

    public WorkflowSchemePublishPreviewQueries(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public async Task<WorkflowSchemePublishPreviewDto> PreviewAsync(
        GetWorkflowSchemePublishPreviewRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var removeSet = request.StatesToRemove.ToHashSet();

        var allStates = await _dbContext.WorkflowStates
            .AsNoTracking()
            .Where(s => s.SchemeUuid == request.SchemeUuid)
            .Select(s => new { s.Uuid, s.Code, s.NameKey })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var statesToRemove = new List<WorkflowStatePublishCandidateDto>(removeSet.Count);

        foreach (var state in allStates.Where(s => removeSet.Contains(s.Uuid)))
        {
            var issueCount = await _dbContext.Issues
                .AsNoTracking()
                .CountAsync(i => i.StateUuid == state.Uuid, cancellationToken)
                .ConfigureAwait(false);

            statesToRemove.Add(new WorkflowStatePublishCandidateDto(state.Uuid, state.Code, state.NameKey, issueCount));
        }

        var availableTargets = allStates
            .Where(s => !removeSet.Contains(s.Uuid))
            .Select(s => new WorkflowStatePublishTargetDto(s.Uuid, s.Code, s.NameKey))
            .ToList();

        return new WorkflowSchemePublishPreviewDto(request.SchemeUuid, statesToRemove, availableTargets);
    }
}

/// <summary>Zgłoszenia siedzące w zbiorze stanów — wyłącznie dla handlera publikacji, zbierane
/// PRZED wywołaniem <see cref="Domain.Workflow.WorkflowScheme.Publish"/> (patrz uzasadnienie przy
/// <see cref="IWorkflowSchemePublishIssueQueries"/>).</summary>
public sealed class WorkflowSchemePublishIssueQueries : IWorkflowSchemePublishIssueQueries
{
    private readonly TaskManagementDbContext _dbContext;

    public WorkflowSchemePublishIssueQueries(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public async Task<IReadOnlyList<WorkflowSchemeAffectedIssueDto>> FindByStatesAsync(
        IReadOnlyList<Guid> stateUuids,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(stateUuids);

        if (stateUuids.Count == 0)
        {
            return [];
        }

        return await _dbContext.Issues
            .AsNoTracking()
            .Where(i => stateUuids.Contains(i.StateUuid))
            .Select(i => new WorkflowSchemeAffectedIssueDto(i.Uuid, i.StateUuid))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }
}

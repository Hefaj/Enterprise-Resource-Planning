using Erp.BuildingBlocks.Application.Abstractions;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Workflow;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Queries;

/// <summary>
/// Odczyt schematu stanów projektu. Front rysuje z tego filtr stanu, przyciski przejść na karcie
/// i (od fazy 2) kolumny tablicy — dlatego stany i przejścia idą <b>jednym</b> żądaniem: dwa
/// osobne dawałyby okno, w którym karta zna stany, ale nie wie, dokąd wolno je przesunąć.
/// </summary>
public sealed class WorkflowQueries : IWorkflowQueries
{
    private readonly TaskManagementDbContext _dbContext;
    private readonly IExecutionContext _executionContext;

    public WorkflowQueries(TaskManagementDbContext dbContext, IExecutionContext executionContext)
    {
        _dbContext = dbContext;
        _executionContext = executionContext;
    }

    /// <inheritdoc />
    public async Task<ProjectWorkflowDto?> GetProjectWorkflowAsync(
        Guid projectUuid,
        CancellationToken cancellationToken)
    {
        var me = IssueVisibility.CurrentUser(_executionContext);

        var project = await _dbContext.Projects
            .AsNoTracking()
            .VisibleTo(_dbContext, me)
            .Where(p => p.Uuid == projectUuid)
            .Select(p => new { p.Uuid, p.WorkflowSchemeUuid })
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        if (project is null)
        {
            return null;
        }

        var scheme = await _dbContext.WorkflowSchemes
            .AsNoTracking()
            .Where(s => s.Uuid == project.WorkflowSchemeUuid)
            .Select(s => new { s.Uuid, s.Name })
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        if (scheme is null)
        {
            return null;
        }

        var states = await _dbContext.WorkflowStates
            .AsNoTracking()
            .Where(s => s.SchemeUuid == scheme.Uuid)
            .OrderBy(s => s.OrderNo)
            .Select(s => new WorkflowStateDto(s.Uuid, s.Code, s.NameKey, s.Category, s.OrderNo))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var transitions = await _dbContext.WorkflowTransitions
            .AsNoTracking()
            .Where(t => t.SchemeUuid == scheme.Uuid)
            .Select(t => new WorkflowTransitionDto(
                t.Uuid,
                t.FromStateUuid,
                t.ToStateUuid,
                t.NameKey,
                t.RequiredPermission,
                t.RequiredFieldCodes))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return new ProjectWorkflowDto(project.Uuid, scheme.Uuid, scheme.Name, states, transitions);
    }

    public async Task<WorkflowSchemeDto?> GetWorkflowSchemeAsync(Guid schemeUuid, CancellationToken cancellationToken)
    {
        var scheme = await _dbContext.WorkflowSchemes.AsNoTracking().Where(x => x.Uuid == schemeUuid)
            .Select(x => new { x.Uuid, x.Name, x.IsSystem }).FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        if (scheme is null) return null;
        var states = await _dbContext.WorkflowStates.AsNoTracking().Where(x => x.SchemeUuid == schemeUuid).OrderBy(x => x.OrderNo)
            .Select(x => new WorkflowStateDto(x.Uuid, x.Code, x.NameKey, x.Category, x.OrderNo)).ToListAsync(cancellationToken).ConfigureAwait(false);
        var transitions = await _dbContext.WorkflowTransitions.AsNoTracking().Where(x => x.SchemeUuid == schemeUuid)
            .Select(x => new WorkflowTransitionDto(
                x.Uuid,
                x.FromStateUuid,
                x.ToStateUuid,
                x.NameKey,
                x.RequiredPermission,
                x.RequiredFieldCodes)).ToListAsync(cancellationToken).ConfigureAwait(false);
        return new WorkflowSchemeDto(scheme.Uuid, scheme.Name, scheme.IsSystem, states, transitions);
    }

    public async Task<IReadOnlyList<WorkflowSchemeListItemDto>> GetWorkflowSchemesAsync(CancellationToken cancellationToken)
        => await _dbContext.WorkflowSchemes.AsNoTracking().OrderBy(x => x.Name)
            .Select(x => new WorkflowSchemeListItemDto(x.Uuid, x.Name, x.IsSystem))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
}

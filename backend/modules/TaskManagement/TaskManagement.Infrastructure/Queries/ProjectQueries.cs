using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Projects;
using TaskManagement.Domain.Projects;
using TaskManagement.Domain.Workflow;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Queries;

/// <summary>Odczyty projektów. Ta sama widoczność, co przy zgłoszeniach — projekt niewidoczny
/// nie może pojawić się w przełączniku kontekstu, bo wybranie go dałoby pustą listę
/// zamiast odmowy.</summary>
public sealed class ProjectQueries : IProjectQueries
{
    private readonly TaskManagementDbContext _dbContext;
    private readonly IExecutionContext _executionContext;

    public ProjectQueries(TaskManagementDbContext dbContext, IExecutionContext executionContext)
    {
        _dbContext = dbContext;
        _executionContext = executionContext;
    }

    /// <inheritdoc />
    public async Task<SearchResponse> SearchAsync(SearchProjectRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = Filtered(request);

        var totalCount = await query.CountAsync(cancellationToken).ConfigureAwait(false);

        var uuids = await query
            .OrderBy(p => p.Code)
            .ThenBy(p => p.Uuid)
            .Skip((Math.Max(request.Page, 1) - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(p => p.Uuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return new SearchResponse { Uuids = uuids, TotalCount = totalCount };
    }

    /// <inheritdoc />
    public async Task<List<Guid>> GetMatchingUuidsAsync(
        SearchProjectRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        return await Filtered(request)
            .OrderBy(p => p.Uuid)
            .Select(p => p.Uuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task<List<ProjectDto>> GetAsync(
        IReadOnlyCollection<Guid>? uuids,
        CancellationToken cancellationToken)
    {
        var me = IssueVisibility.CurrentUser(_executionContext);
        var query = _dbContext.Projects.AsNoTracking().VisibleTo(_dbContext, me);

        if (uuids is { Count: > 0 })
        {
            var uuidList = uuids.ToList();
            query = query.Where(p => uuidList.Contains(p.Uuid));
        }

        return await query
            .Select(p => new ProjectDto(
                p.Uuid,
                p.Code,
                p.Name,
                p.Kind,
                p.WorkflowSchemeUuid,
                p.IssueTypeSchemeUuid,
                p.FieldSchemeUuid,
                p.IsPublic,
                // Licznik otwartych zgłoszeń liczy się po KATEGORII stanu, nie po jego nazwie —
                // projekt może mieć stan „Czeka na sprzęt”, który nadal jest pracą w toku.
                _dbContext.Issues.Count(i => i.ProjectUuid == p.Uuid
                    && _dbContext.WorkflowStates.Any(s =>
                        s.Uuid == i.StateUuid && s.Category != WorkflowStateCategory.Done)),
                p.Members
                    .Select(m => new ProjectMemberDto(m.UserUuid, m.Role))
                    .ToList(),
                p.SlaResponseMinutes == null
                    ? null
                    : new ProjectSlaDto(
                        p.SlaResponseMinutes!.Value,
                        p.SlaResolutionMinutes!.Value,
                        p.SlaWorkingDays!.Value,
                        p.SlaWorkStartTime!.Value,
                        p.SlaWorkEndTime!.Value)))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    private IQueryable<Project> Filtered(SearchProjectRequest request)
    {
        var me = IssueVisibility.CurrentUser(_executionContext);
        var query = _dbContext.Projects.AsNoTracking().VisibleTo(_dbContext, me);

        if (request.OnlyMine == true)
        {
            query = query.Where(p => _dbContext.ProjectMembers.Any(m => m.ProjectUuid == p.Uuid && m.UserUuid == me));
        }

        if (request.Kind is { } kind)
        {
            query = query.Where(p => p.Kind == kind);
        }

        if (!string.IsNullOrWhiteSpace(request.Text))
        {
            var text = request.Text.Trim();
            query = query.Where(p => EF.Functions.ILike(p.Name, $"%{text}%")
                || EF.Functions.ILike(p.Code, $"%{text}%"));
        }

        return query;
    }
}

using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Issues;
using TaskManagement.Domain.Issues;
using TaskManagement.Infrastructure.Persistence;
using TaskManagement.Infrastructure.Persistence.Graph;

namespace TaskManagement.Infrastructure.Queries;

/// <inheritdoc cref="IIssueDeliveryHoursQueries"/>
public sealed class IssueDeliveryHoursQueries : IIssueDeliveryHoursQueries
{
    /// <summary>Patrz uzasadnienie limitu przy <c>IssueGraphQueries.MaxDepth</c> — sam mechanizm,
    /// sam powód: bez granicy pętla w danych sprzed reguł cyklu kręciłaby CTE w nieskończoność.</summary>
    private const int MaxDepth = 64;

    private readonly TaskManagementDbContext _dbContext;

    public IssueDeliveryHoursQueries(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public async Task<IssueDeliveryHoursSummaryDto> GetAsync(
        Guid requestIssueUuid,
        CancellationToken cancellationToken)
    {
        var delivers = IssueLinkType.Delivers.ToString();

        // `chain` schodzi WSTECZ po `Delivers` (target → source): zaczyna od zagadnienia
        // i zbiera każde zgłoszenie wykonawcze, które realizuje JE albo realizuje coś, co je
        // realizuje — dowolna głębokość, nie tylko jeden poziom (TIME-004 AC2).
        var rows = await _dbContext.Database
            .SqlQuery<DeliveryHoursRow>(
                $"""
                 with recursive chain as (
                     select i.uuid as execution_uuid, i.project_uuid as project_uuid, 0 as depth
                     from taskmgmt.issue i
                     where i.uuid = {requestIssueUuid}
                     union all
                     select src.uuid, src.project_uuid, chain.depth + 1
                     from chain
                     join taskmgmt.issue_link l on l.target_uuid = chain.execution_uuid and l.type = {delivers}
                     join taskmgmt.issue src on src.uuid = l.source_uuid
                     where chain.depth < {MaxDepth}
                 )
                 select
                     c.execution_uuid as execution_uuid,
                     ei.key as execution_issue_key,
                     c.project_uuid as project_uuid,
                     p.code as project_code,
                     p.name as project_name,
                     coalesce(sum(wl.minutes), 0)::int as minutes,
                     greatest(
                         0,
                         (select count(distinct l2.target_uuid)
                          from taskmgmt.issue_link l2
                          where l2.source_uuid = c.execution_uuid and l2.type = {delivers}) - 1
                     )::int as shared_with_other_requests_count
                 from chain c
                 join taskmgmt.issue ei on ei.uuid = c.execution_uuid
                 join taskmgmt.project p on p.uuid = c.project_uuid
                 left join taskmgmt.issue_work_log wl on wl.issue_uuid = c.execution_uuid
                 group by c.execution_uuid, ei.key, c.project_uuid, p.code, p.name
                 order by ei.key
                 """)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var entries = rows
            .Select(r => new IssueDeliveryHoursEntryDto(
                r.ExecutionUuid,
                r.ExecutionIssueKey,
                r.ProjectUuid,
                r.ProjectCode,
                r.ProjectName,
                r.Minutes,
                r.SharedWithOtherRequestsCount))
            .ToList();

        return new IssueDeliveryHoursSummaryDto(requestIssueUuid, entries, entries.Sum(e => e.Minutes));
    }
}

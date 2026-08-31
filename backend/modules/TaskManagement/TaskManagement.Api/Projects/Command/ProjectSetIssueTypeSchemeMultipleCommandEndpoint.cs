using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Projects;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Projects.Command;

/// <summary>Podmienia schemat typów zgłoszeń projektu (TYP-001)</summary>
public sealed class ProjectSetIssueTypeSchemeMultipleCommandEndpoint
    : BatchEndpointBase<ProjectSetIssueTypeSchemeCommand, SearchProjectRequest>
{
    private readonly IProjectQueries _queries;

    public ProjectSetIssueTypeSchemeMultipleCommandEndpoint(IProjectQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-set-issue-type-scheme");
        Group<ProjectGroup>();
        Permissions(P.TaskManagement.ProjectManage);
        Description(d => d.WithSummary("Podmienia schemat typów zgłoszeń projektu"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchProjectRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}

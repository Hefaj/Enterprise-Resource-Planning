using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using TaskManagement.Application.Projects;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Projects.Command;

/// <summary>Wyciszenie/odciszenie powiadomień z projektu dla WOŁAJĄCEGO (NTF-003) z obsługą
/// błędów cząstkowych. Ustawienie jest osobiste — komenda bierze użytkownika z kontekstu
/// wykonania, nie z payloadu, więc uprawnienie to WYŁĄCZNIE widoczność projektu
/// (<c>IssueRead</c>, ten sam gate co <c>SearchProjectEndpoint</c>), nie
/// <c>ProjectManage</c> — to nie jest akcja administracyjna nad cudzym ustawieniem.</summary>
public sealed class ProjectSetNotificationMutedMultipleCommandEndpoint
    : BatchEndpointBase<ProjectSetNotificationMutedCommand, SearchProjectRequest>
{
    private readonly IProjectQueries _queries;

    public ProjectSetNotificationMutedMultipleCommandEndpoint(IProjectQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-set-notification-muted");
        Group<ProjectGroup>();
        Permissions(P.TaskManagement.IssueRead);
        Description(d => d.WithSummary("Wyciszenie/odciszenie powiadomień z projektu dla wołającego z obsługą błędów cząstkowych"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchProjectRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}

using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using TaskManagement.Application.Projects;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Projects.Command;

/// <summary>Seryjne zakładanie projektów. Razem z projektem powstaje jego licznik numeracji —
/// dlatego nie ma osobnej komendy „załóż licznik”.</summary>
public sealed class ProjectCreateMultipleCommandEndpoint
    : CreateBatchEndpointBase<ProjectCreateCommand, SearchProjectRequest>
{
    public override void Configure()
    {
        Post("batch-create");
        Group<ProjectGroup>();
        Permissions(P.TaskManagement.ProjectManage);
        Description(d => d.WithSummary("Seryjne zakładanie projektów z obsługą błędów cząstkowych"));
    }
}

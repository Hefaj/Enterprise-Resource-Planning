using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Sprints;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Sprints.Command;

/// <summary>Zakłada sprinty na tablicy scrumowej.</summary>
public sealed class SprintCreateMultipleCommandEndpoint
    : CreateBatchEndpointBase<SprintCreateCommand, SearchSprintRequest>
{
    public override void Configure()
    {
        Post("batch-create");
        Group<SprintGroup>();
        Permissions(P.TaskManagement.BoardManage);
        Description(d => d.WithSummary("Zakłada sprinty na tablicy scrumowej"));
    }
}

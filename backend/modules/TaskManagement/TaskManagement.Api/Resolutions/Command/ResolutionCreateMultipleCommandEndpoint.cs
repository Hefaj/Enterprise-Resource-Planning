using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Resolutions;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Resolutions.Command;

/// <summary>Dokłada rozwiązanie własne projektu (ISS-007) — konfiguracja projektu, wzorem
/// schematów pól i typów.</summary>
public sealed class ResolutionCreateMultipleCommandEndpoint
    : CreateBatchEndpointBase<ResolutionCreateCommand, SearchResolutionRequest>
{
    public override void Configure()
    {
        Post("batch-create");
        Group<ResolutionGroup>();
        Permissions(P.TaskManagement.ProjectManage);
        Description(d => d.WithSummary("Dokłada rozwiązanie własne projektu"));
    }
}

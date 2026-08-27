using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.FieldSchemes;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.FieldSchemes.Command;

/// <summary>Zakłada schematy pól niestandardowych</summary>
public sealed class FieldSchemeCreateMultipleCommandEndpoint
    : CreateBatchEndpointBase<FieldSchemeCreateCommand, SearchFieldSchemeRequest>
{
    public override void Configure()
    {
        Post("batch-create");
        Group<FieldSchemeGroup>();
        Permissions(P.TaskManagement.SchemeManage);
        Description(d => d.WithSummary("Zakłada schematy pól niestandardowych"));
    }
}

using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.IssueTypes;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.IssueTypes.Command;

/// <summary>Zakłada schematy typów zgłoszeń</summary>
public sealed class IssueTypeSchemeCreateMultipleCommandEndpoint
    : CreateBatchEndpointBase<IssueTypeSchemeCreateCommand, SearchIssueTypeSchemeRequest>
{
    public override void Configure()
    {
        Post("batch-create");
        Group<IssueTypeGroup>();
        Permissions(P.TaskManagement.SchemeManage);
        Description(d => d.WithSummary("Zakłada schematy typów zgłoszeń"));
    }
}

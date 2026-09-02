using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.SavedViews;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.SavedViews.Command;

/// <summary>Zakłada zapisany widok (VIEW-001).</summary>
public sealed class SavedViewCreateMultipleCommandEndpoint
    : CreateBatchEndpointBase<SavedViewCreateCommand, SearchSavedViewRequest>
{
    public override void Configure()
    {
        Post("batch-create");
        Group<SavedViewGroup>();
        Permissions(P.TaskManagement.IssueRead);
        Description(d => d.WithSummary("Zakłada zapisany widok"));
    }
}

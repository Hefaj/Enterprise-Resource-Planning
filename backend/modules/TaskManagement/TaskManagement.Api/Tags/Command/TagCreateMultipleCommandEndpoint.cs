using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Tags;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Tags.Command;

/// <summary>Zakłada tagi (TAG-002) — kto wolno, decyduje <c>taskmgmt.tag.manage</c>.</summary>
public sealed class TagCreateMultipleCommandEndpoint : CreateBatchEndpointBase<TagCreateCommand, SearchTagRequest>
{
    public override void Configure()
    {
        Post("batch-create");
        Group<TagGroup>();
        Permissions(P.TaskManagement.TagManage);
        Description(d => d.WithSummary("Zakłada tagi"));
    }
}

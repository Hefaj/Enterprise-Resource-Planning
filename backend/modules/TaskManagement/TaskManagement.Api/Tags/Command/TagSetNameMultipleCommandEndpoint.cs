using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Tags;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Tags.Command;

/// <summary>Zmiana nazwy tagu (TAG-003) — kto wolno, decyduje <c>taskmgmt.tag.manage</c>.</summary>
public sealed class TagSetNameMultipleCommandEndpoint : BatchEndpointBase<TagSetNameCommand, SearchTagRequest>
{
    private readonly ITagQueries _queries;

    public TagSetNameMultipleCommandEndpoint(ITagQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-set-name");
        Group<TagGroup>();
        Permissions(P.TaskManagement.TagManage);
        Description(d => d.WithSummary("Zmienia nazwę tagu"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(SearchTagRequest filter, CancellationToken ct)
        => (await _queries.SearchAsync(filter, ct).ConfigureAwait(false)).Select(t => t.Uuid);
}

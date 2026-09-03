using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Tags;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Tags.Command;

/// <summary>Scala tag źródłowy w tag docelowy (TAG-003) — kto wolno, decyduje
/// <c>taskmgmt.tag.manage</c>. Realny UI zawsze podaje pojedynczy uuid przez
/// <c>BatchCommand.Commands</c>, filtr istnieje wyłącznie dla spójności kontraktu z resztą
/// operacji wsadowych.</summary>
public sealed class TagExecMergeMultipleCommandEndpoint : BatchEndpointBase<TagExecMergeCommand, SearchTagRequest>
{
    private readonly ITagQueries _queries;

    public TagExecMergeMultipleCommandEndpoint(ITagQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-exec-merge");
        Group<TagGroup>();
        Permissions(P.TaskManagement.TagManage);
        Description(d => d.WithSummary("Scala tag źródłowy w tag docelowy"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(SearchTagRequest filter, CancellationToken ct)
        => (await _queries.SearchAsync(filter, ct).ConfigureAwait(false)).Select(t => t.Uuid);
}

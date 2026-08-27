using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Boards;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Boards.Command;

/// <summary>Seryjna zmiana nazwy tablic</summary>
public sealed class BoardSetNameMultipleCommandEndpoint
    : BatchEndpointBase<BoardSetNameCommand, SearchBoardRequest>
{
    private readonly IBoardQueries _queries;

    public BoardSetNameMultipleCommandEndpoint(IBoardQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-set-name");
        Group<BoardGroup>();
        Permissions(P.TaskManagement.BoardManage);
        Description(d => d.WithSummary("Seryjna zmiana nazwy tablic"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchBoardRequest filter,
        CancellationToken ct)
    {
        var boards = await _queries.SearchAsync(filter, ct);

        return boards.Select(b => b.Uuid);
    }
}

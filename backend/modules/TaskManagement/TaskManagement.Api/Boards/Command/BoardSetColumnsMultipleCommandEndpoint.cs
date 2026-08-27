using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Boards;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Boards.Command;

/// <summary>Nadpisuje układ kolumn tablicy w całości</summary>
public sealed class BoardSetColumnsMultipleCommandEndpoint
    : BatchEndpointBase<BoardSetColumnsCommand, SearchBoardRequest>
{
    private readonly IBoardQueries _queries;

    public BoardSetColumnsMultipleCommandEndpoint(IBoardQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-set-columns");
        Group<BoardGroup>();
        Permissions(P.TaskManagement.BoardManage);
        Description(d => d.WithSummary("Nadpisuje układ kolumn tablicy w całości"));
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

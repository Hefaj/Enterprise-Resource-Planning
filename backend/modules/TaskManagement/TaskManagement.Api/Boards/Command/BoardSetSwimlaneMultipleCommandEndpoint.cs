using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Boards;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Boards.Command;

/// <summary>Ustawienie osi grupowania wierszy tablicy (BRD-006)</summary>
public sealed class BoardSetSwimlaneMultipleCommandEndpoint
    : BatchEndpointBase<BoardSetSwimlaneCommand, SearchBoardRequest>
{
    private readonly IBoardQueries _queries;

    public BoardSetSwimlaneMultipleCommandEndpoint(IBoardQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-set-swimlane");
        Group<BoardGroup>();
        Permissions(P.TaskManagement.BoardManage);
        Description(d => d.WithSummary("Ustawienie osi grupowania wierszy tablicy"));
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

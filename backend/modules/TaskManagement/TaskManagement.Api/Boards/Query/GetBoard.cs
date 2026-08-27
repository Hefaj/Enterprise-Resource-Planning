using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Boards;
using TaskManagement.Domain.Boards;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Boards.Query;

/// <summary>Tablica razem z kolumnami — bez nich nie da się narysować ani jednej karty.</summary>
public sealed class GetBoardEndpoint : Endpoint<GetBoardRequest, BoardDto>
{
    private readonly IBoardQueries _queries;

    public GetBoardEndpoint(IBoardQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getBoard");
        Group<BoardGroup>();
        Permissions(P.TaskManagement.IssueRead);
    }

    public override async Task HandleAsync(GetBoardRequest req, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(req);

        var board = await _queries.GetAsync(req.Uuid, ct)
            ?? throw new AggregateNotFoundException(nameof(Board), req.Uuid);

        await Send.OkAsync(board, ct);
    }
}

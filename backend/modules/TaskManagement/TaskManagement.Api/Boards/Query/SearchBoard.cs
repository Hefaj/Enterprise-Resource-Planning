using FastEndpoints;
using TaskManagement.Application.Boards;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Boards.Query;

/// <summary>Tablice widoczne dla użytkownika, opcjonalnie zawężone do projektu.</summary>
public sealed class SearchBoardEndpoint : Endpoint<SearchBoardRequest, List<BoardDto>>
{
    private readonly IBoardQueries _queries;

    public SearchBoardEndpoint(IBoardQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchBoard");
        Group<BoardGroup>();
        Permissions(P.TaskManagement.IssueRead);
    }

    public override async Task HandleAsync(SearchBoardRequest req, CancellationToken ct)
    {
        var boards = await _queries.SearchAsync(req, ct);
        await Send.OkAsync(boards, ct);
    }
}

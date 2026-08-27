using FastEndpoints;
using TaskManagement.Application.Boards;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Boards.Query;

/// <summary>
/// Karty tablicy w kolejności <c>(rank, uuid)</c>, razem z nagłówkiem zgłoszenia.
///
/// <para>Puste <c>Uuids</c> zwraca całą tablicę; wypełnione — wyłącznie wskazane karty, i tą
/// ścieżką idzie odświeżenie po zdarzeniu <c>taskmgmt.board</c>
/// (<c>docs/backend/task-management.md</c> §7.4).</para>
/// </summary>
public sealed class GetBoardCardsEndpoint : Endpoint<GetBoardCardsRequest, List<BoardCardDto>>
{
    private readonly IBoardQueries _queries;

    public GetBoardCardsEndpoint(IBoardQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getBoardCards");
        Group<BoardGroup>();
        Permissions(P.TaskManagement.IssueRead);
    }

    public override async Task HandleAsync(GetBoardCardsRequest req, CancellationToken ct)
    {
        var cards = await _queries.GetCardsAsync(req, ct);
        await Send.OkAsync(cards, ct);
    }
}

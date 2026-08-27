using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Boards;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Boards.Command;

/// <summary>
/// Przestawia karty na tablicy — rank liczy serwer z sąsiadów wskazanych w komendzie.
///
/// <para>Uprawnieniem jest <c>issue.update</c>, nie <c>board.manage</c>: przeciąganie kart to
/// codzienna praca zespołu, a <c>board.manage</c> odpowiada na pytanie „kto konfiguruje
/// tablicę”. Gdyby kolejność wymagała tego drugiego, uprawnienie do konfiguracji musiałby
/// dostać każdy członek zespołu i przestałoby cokolwiek znaczyć.</para>
/// </summary>
public sealed class BoardSetCardPositionMultipleCommandEndpoint
    : BatchEndpointBase<BoardSetCardPositionCommand, SearchBoardRequest>
{
    private readonly IBoardQueries _queries;

    public BoardSetCardPositionMultipleCommandEndpoint(IBoardQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-set-card-position");
        Group<BoardGroup>();
        Permissions(P.TaskManagement.IssueUpdate);
        Description(d => d.WithSummary("Przestawia karty na tablicy — rank liczy serwer z sąsiadów wskazanych w komendzie"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchBoardRequest filter,
        CancellationToken ct)
    {
        // Tryb filtra jest tu bez sensu („przestaw karty na wszystkich tablicach projektu”
        // nie jest operacją, o którą ktokolwiek prosi) — endpoint stoi na wspólnym szkielecie
        // wsadowym dla idempotencji i śladu w historii zadań, jak komentarze zgłoszenia.
        var boards = await _queries.SearchAsync(filter, ct);

        return boards.Select(b => b.Uuid);
    }
}

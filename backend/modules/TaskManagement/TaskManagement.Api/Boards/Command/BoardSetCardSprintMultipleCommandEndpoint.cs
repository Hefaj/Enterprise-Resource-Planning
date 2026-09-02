using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Boards;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Boards.Command;

/// <summary>
/// Przenosi karty między backlogiem a sprintem — rank liczy serwer z sąsiadów wskazanych
/// w komendzie, tak samo jak przy przeciąganiu na tablicy kanbanowej.
///
/// <para>Uprawnieniem jest <c>issue.update</c>, nie <c>board.manage</c> — planowanie sprintu
/// jest codzienną pracą zespołu (jak <see cref="BoardSetCardPositionMultipleCommandEndpoint"/>).</para>
/// </summary>
public sealed class BoardSetCardSprintMultipleCommandEndpoint
    : BatchEndpointBase<BoardSetCardSprintCommand, SearchBoardRequest>
{
    private readonly IBoardQueries _queries;

    public BoardSetCardSprintMultipleCommandEndpoint(IBoardQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-set-card-sprint");
        Group<BoardGroup>();
        Permissions(P.TaskManagement.IssueUpdate);
        Description(d => d.WithSummary("Przenosi karty między backlogiem a sprintem"));
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

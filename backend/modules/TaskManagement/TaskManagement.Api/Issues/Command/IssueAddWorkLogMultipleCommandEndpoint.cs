using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Command;

/// <summary>
/// Dodanie wpisu czasu (TIME-001) z karty zgłoszenia — paczka jednoelementowa, wzorem
/// <see cref="IssueAddCommentMultipleCommandEndpoint"/>: skeleton wsadowy niesie idempotencję
/// i ślad w historii zadań, nie sugeruje, że ktokolwiek loguje czas masowo.
/// </summary>
public sealed class IssueAddWorkLogMultipleCommandEndpoint
    : BatchEndpointBase<IssueAddWorkLogCommand, SearchIssueRequest>
{
    private readonly IIssueQueries _queries;

    public IssueAddWorkLogMultipleCommandEndpoint(IIssueQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-add-work-log");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueUpdate);
        Description(d => d.WithSummary("Dodanie wpisu czasu"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchIssueRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}

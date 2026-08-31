using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Validation;
using FastEndpoints;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Command;

/// <summary>Seryjna zmiana stanu zgłoszeń — przejście spoza schematu odpada jako błąd elementu</summary>
public sealed class IssueSetStateMultipleCommandEndpoint
    : BatchEndpointBase<IssueSetStateCommand, SearchIssueRequest>
{
    private readonly IIssueQueries _queries;
    private readonly IssueBatchValidator _validator;

    public IssueSetStateMultipleCommandEndpoint(IIssueQueries queries, IssueBatchValidator validator)
    {
        _queries = queries;
        _validator = validator;
    }

    public override void Configure()
    {
        Post("batch-set-state");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueUpdate);
        Description(d => d.WithSummary("Seryjna zmiana stanu zgłoszeń — przejście spoza schematu odpada jako błąd elementu"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchIssueRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);

    /// <summary>Krawędź z <c>required_permission</c>, którego wołający nie ma, odpada TU —
    /// jedyne miejsce, w którym ClaimsPrincipal żądania jeszcze istnieje
    /// (<c>docs/backend/task-management.md</c> §5.2).</summary>
    protected override Task<ValidationTracker> ValidateTargetsAsync(
        IReadOnlyList<BatchTarget<IssueSetStateCommand>> targets,
        CancellationToken ct)
        => _validator.ValidateSetStateAsync(targets, ct);
}

using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Validation;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Command;

/// <summary>Seryjne przeniesienie zgłoszeń (razem z ich poddrzewem) do innego projektu, z nowymi
/// kluczami i obsługą błędów cząstkowych (ISS-010).</summary>
public sealed class IssueSetProjectMultipleCommandEndpoint
    : BatchEndpointBase<IssueSetProjectCommand, SearchIssueRequest>
{
    private readonly IIssueQueries _queries;
    private readonly IssueBatchValidator _validator;

    public IssueSetProjectMultipleCommandEndpoint(IIssueQueries queries, IssueBatchValidator validator)
    {
        _queries = queries;
        _validator = validator;
    }

    public override void Configure()
    {
        Post("batch-set-project");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueUpdate);
        Description(d => d.WithSummary("Seryjne przeniesienie zgłoszeń do innego projektu, razem z poddrzewem"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchIssueRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);

    /// <inheritdoc />
    protected override Task<ValidationTracker> ValidateTargetsAsync(
        IReadOnlyList<BatchTarget<IssueSetProjectCommand>> targets,
        CancellationToken ct)
        => _validator.ValidateMoveToProjectAsync(targets, ct);
}

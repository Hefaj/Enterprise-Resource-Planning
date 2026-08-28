using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Validation;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Command;

/// <summary>Seryjna zmiana rodzica w hierarchii — pętla w drzewie odpada w pre-checku</summary>
public sealed class IssueSetParentMultipleCommandEndpoint
    : BatchEndpointBase<IssueSetParentCommand, SearchIssueRequest>
{
    private readonly IIssueQueries _queries;
    private readonly IssueBatchValidator _validator;

    public IssueSetParentMultipleCommandEndpoint(IIssueQueries queries, IssueBatchValidator validator)
    {
        _queries = queries;
        _validator = validator;
    }

    public override void Configure()
    {
        Post("batch-set-parent");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueUpdate);
        Description(d => d.WithSummary("Seryjna zmiana rodzica w hierarchii — pętla w drzewie odpada w pre-checku"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchIssueRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);

    /// <inheritdoc />
    protected override Task<ValidationTracker> ValidateTargetsAsync(
        IReadOnlyList<BatchTarget<IssueSetParentCommand>> targets,
        CancellationToken ct)
        => _validator.ValidateSetParentAsync(targets, ct);
}

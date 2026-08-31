using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Validation;
using TaskManagement.Application.IssueTypes;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.IssueTypes.Command;

/// <summary>Usuwa typ ze schematu — odmawia, gdy zgłoszenia mają ten typ (TYP-004)</summary>
public sealed class IssueTypeSchemeRemoveTypeMultipleCommandEndpoint
    : BatchEndpointBase<IssueTypeSchemeRemoveTypeCommand, SearchIssueTypeSchemeRequest>
{
    private readonly IIssueTypeSchemeQueries _queries;
    private readonly IssueTypeSchemeBatchValidator _validator;

    public IssueTypeSchemeRemoveTypeMultipleCommandEndpoint(
        IIssueTypeSchemeQueries queries,
        IssueTypeSchemeBatchValidator validator)
    {
        _queries = queries;
        _validator = validator;
    }

    public override void Configure()
    {
        Post("batch-remove-type");
        Group<IssueTypeGroup>();
        Permissions(P.TaskManagement.SchemeManage);
        Description(d => d.WithSummary("Usuwa typ ze schematu — odmawia, gdy zgłoszenia mają ten typ"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchIssueTypeSchemeRequest filter,
        CancellationToken ct)
    {
        var schemes = await _queries.SearchAsync(filter, ct);

        return schemes.Select(s => s.Uuid);
    }

    /// <inheritdoc />
    protected override Task<ValidationTracker> ValidateTargetsAsync(
        IReadOnlyList<BatchTarget<IssueTypeSchemeRemoveTypeCommand>> targets,
        CancellationToken ct)
        => _validator.ValidateRemoveTypeAsync(targets, ct);
}

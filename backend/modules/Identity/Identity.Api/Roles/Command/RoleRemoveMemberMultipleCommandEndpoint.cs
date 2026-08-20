using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Validation;
using FastEndpoints;
using Identity.Application.Roles;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Identity.Roles.Command;

/// <summary>Seryjne odłączenie roli składowej od kontenerów.</summary>
public sealed class RoleRemoveMemberMultipleCommandEndpoint
    : BatchEndpointBase<RoleRemoveMemberCommand, SearchRoleRequest>
{
    private readonly IRoleQueries _queries;
    private readonly RoleBatchValidator _validator;

    public RoleRemoveMemberMultipleCommandEndpoint(IRoleQueries queries, RoleBatchValidator validator)
    {
        _queries = queries;
        _validator = validator;
    }

    public override void Configure()
    {
        Post("batch-remove-member");
        Group<RoleGroup>();
        Permissions(P.Identity.RoleManage);
        Description(d => d
            .WithSummary("Seryjne odłączenie roli składowej z obsługą błędów cząstkowych")
            .WithDescription(
                "Odłącza rolę składową od wielu ról-kontenerów jednocześnie na podstawie "
                + "filtrów, identyfikatorów lub konkretnych komend."));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchRoleRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);

    /// <inheritdoc />
    protected override Task<ValidationTracker> ValidateTargetsAsync(
        IReadOnlyList<BatchTarget<RoleRemoveMemberCommand>> targets,
        CancellationToken ct)
        => _validator.ValidateRemoveMemberAsync([.. targets.Select(t => t.AggregateUuid)], ct);
}

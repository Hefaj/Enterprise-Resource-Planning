using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Validation;
using FastEndpoints;
using Identity.Application.Roles;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Identity.Roles.Command;

/// <summary>Seryjne odebranie uprawnienia rolom.</summary>
public sealed class RoleRemovePermissionMultipleCommandEndpoint
    : BatchEndpointBase<RoleRemovePermissionCommand, SearchRoleRequest>
{
    private readonly IRoleQueries _queries;
    private readonly RoleBatchValidator _validator;

    public RoleRemovePermissionMultipleCommandEndpoint(IRoleQueries queries, RoleBatchValidator validator)
    {
        _queries = queries;
        _validator = validator;
    }

    public override void Configure()
    {
        Post("batch-remove-permission");
        Group<RoleGroup>();
        Permissions(P.Identity.RoleManage);
        Description(d => d
            .WithSummary("Seryjne odebranie uprawnienia rolom z obsługą błędów cząstkowych")
            .WithDescription(
                "Odbiera uprawnienie wielu rolom jednocześnie na podstawie filtrów, "
                + "identyfikatorów lub konkretnych komend."));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchRoleRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);

    /// <inheritdoc />
    protected override Task<ValidationTracker> ValidateTargetsAsync(
        IReadOnlyList<BatchTarget<RoleRemovePermissionCommand>> targets,
        CancellationToken ct)
        => _validator.ValidateRemovePermissionAsync([.. targets.Select(t => t.AggregateUuid)], ct);
}

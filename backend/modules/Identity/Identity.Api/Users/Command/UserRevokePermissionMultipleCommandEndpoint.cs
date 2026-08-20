using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Validation;
using FastEndpoints;
using Identity.Application.Users;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Identity.Users.Command;

/// <summary>Seryjne odebranie bezpośrednio nadanego uprawnienia użytkownikom.</summary>
public sealed class UserRevokePermissionMultipleCommandEndpoint
    : BatchEndpointBase<UserRevokePermissionCommand, SearchUserAccountRequest>
{
    private readonly IUserAccountQueries _queries;
    private readonly UserBatchValidator _validator;

    public UserRevokePermissionMultipleCommandEndpoint(IUserAccountQueries queries, UserBatchValidator validator)
    {
        _queries = queries;
        _validator = validator;
    }

    public override void Configure()
    {
        Post("batch-revoke-permission");
        Group<UserGroup>();
        Permissions(P.Identity.UserManage);
        Description(d => d
            .WithSummary("Seryjne odebranie bezpośrednio nadanego uprawnienia z obsługą błędów cząstkowych")
            .WithDescription(
                "Odbiera bezpośrednio nadane uprawnienie wielu użytkownikom jednocześnie "
                + "na podstawie filtrów, identyfikatorów lub konkretnych komend."));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchUserAccountRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);

    /// <inheritdoc />
    protected override Task<ValidationTracker> ValidateTargetsAsync(
        IReadOnlyList<BatchTarget<UserRevokePermissionCommand>> targets,
        CancellationToken ct)
        => _validator.ValidateRevokePermissionAsync([.. targets.Select(t => t.AggregateUuid)], ct);
}

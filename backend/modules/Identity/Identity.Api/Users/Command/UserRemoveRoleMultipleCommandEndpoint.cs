using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Validation;
using FastEndpoints;
using Identity.Application.Users;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Identity.Users.Command;

/// <summary>Seryjne odebranie roli użytkownikom.</summary>
public sealed class UserRemoveRoleMultipleCommandEndpoint
    : BatchEndpointBase<UserRemoveRoleCommand, SearchUserAccountRequest>
{
    private readonly IUserAccountQueries _queries;
    private readonly UserBatchValidator _validator;

    public UserRemoveRoleMultipleCommandEndpoint(IUserAccountQueries queries, UserBatchValidator validator)
    {
        _queries = queries;
        _validator = validator;
    }

    public override void Configure()
    {
        Post("batch-remove-role");
        Group<UserGroup>();
        Permissions(P.Identity.UserManage);
        Description(d => d
            .WithSummary("Seryjne odebranie roli użytkownikom z obsługą błędów cząstkowych")
            .WithDescription(
                "Odbiera rolę wielu użytkownikom jednocześnie na podstawie filtrów, "
                + "identyfikatorów lub konkretnych komend."));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchUserAccountRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);

    /// <inheritdoc />
    protected override Task<ValidationTracker> ValidateTargetsAsync(
        IReadOnlyList<BatchTarget<UserRemoveRoleCommand>> targets,
        CancellationToken ct)
        => _validator.ValidateRemoveRoleAsync([.. targets.Select(t => t.AggregateUuid)], ct);
}

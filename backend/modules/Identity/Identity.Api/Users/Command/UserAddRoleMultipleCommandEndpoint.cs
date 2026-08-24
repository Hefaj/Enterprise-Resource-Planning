using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Validation;
using FastEndpoints;
using Identity.Application.Users;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Identity.Users.Command;

/// <summary>Seryjne nadanie roli użytkownikom.</summary>
public sealed class UserAddRoleMultipleCommandEndpoint
    : BatchEndpointBase<UserAddRoleCommand, SearchUserAccountRequest>
{
    private readonly IUserAccountQueries _queries;
    private readonly UserBatchValidator _validator;

    public UserAddRoleMultipleCommandEndpoint(IUserAccountQueries queries, UserBatchValidator validator)
    {
        _queries = queries;
        _validator = validator;
    }

    public override void Configure()
    {
        Post("batch-add-role");
        Group<UserGroup>();
        Permissions(P.Identity.UserManage);
        Description(d => d
            .WithSummary("Seryjne nadanie roli użytkownikom z obsługą błędów cząstkowych")
            .WithDescription(
                "Nadaje rolę wielu użytkownikom jednocześnie na podstawie filtrów, "
                + "identyfikatorów lub konkretnych komend."));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchUserAccountRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);

    /// <inheritdoc />
    protected override Task<ValidationTracker> ValidateTargetsAsync(
        IReadOnlyList<BatchTarget<UserAddRoleCommand>> targets,
        CancellationToken ct)
        => _validator.ValidateAddRoleAsync(targets, ct);
}

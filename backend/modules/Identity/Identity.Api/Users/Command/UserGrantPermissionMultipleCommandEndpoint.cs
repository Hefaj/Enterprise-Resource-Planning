using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Validation;
using FastEndpoints;
using Identity.Application.Users;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Identity.Users.Command;

/// <summary>Seryjne bezpośrednie nadanie uprawnienia użytkownikom, z pominięciem ról.</summary>
public sealed class UserGrantPermissionMultipleCommandEndpoint
    : BatchEndpointBase<UserGrantPermissionCommand, SearchUserAccountRequest>
{
    private readonly IUserAccountQueries _queries;
    private readonly UserBatchValidator _validator;

    public UserGrantPermissionMultipleCommandEndpoint(IUserAccountQueries queries, UserBatchValidator validator)
    {
        _queries = queries;
        _validator = validator;
    }

    public override void Configure()
    {
        Post("batch-grant-permission");
        Group<UserGroup>();
        Permissions(P.Identity.UserManage);
        Description(d => d
            .WithSummary("Seryjne bezpośrednie nadanie uprawnienia użytkownikom z obsługą błędów cząstkowych")
            .WithDescription(
                "Nadaje uprawnienie bezpośrednio wielu użytkownikom jednocześnie na podstawie "
                + "filtrów, identyfikatorów lub konkretnych komend. Kod uprawnienia musi istnieć "
                + "w katalogu i nie być wycofany — inaczej element odpada z kodem "
                + "`permission_code_unknown`."));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchUserAccountRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);

    /// <inheritdoc />
    protected override Task<ValidationTracker> ValidateTargetsAsync(
        IReadOnlyList<BatchTarget<UserGrantPermissionCommand>> targets,
        CancellationToken ct)
        => _validator.ValidateGrantPermissionAsync(targets, ct);
}

using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Validation;
using FastEndpoints;
using Identity.Application.Users;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Identity.Users.Command;

/// <summary>
/// Seryjne wymuszenie wylogowania — odwołuje sesje Keycloak i unieważnia cache uprawnień
/// dla wielu użytkowników. Skutki poza bazą (Keycloak Admin API) nie cofają się przy rollbacku
/// chunka, ale są idempotentne — ponowienie elementu jest bezpieczne. Mitygacja kosztu N wywołań
/// HTTP w jednej transakcji: <c>BulkJobs:ChunkSize</c> obniżony w konfiguracji Identity.
/// </summary>
public sealed class UserExecForceLogoutMultipleCommandEndpoint
    : BatchEndpointBase<UserExecForceLogoutCommand, SearchUserAccountRequest>
{
    private readonly IUserAccountQueries _queries;
    private readonly UserBatchValidator _validator;

    public UserExecForceLogoutMultipleCommandEndpoint(IUserAccountQueries queries, UserBatchValidator validator)
    {
        _queries = queries;
        _validator = validator;
    }

    public override void Configure()
    {
        Post("batch-exec-force-logout");
        Group<UserGroup>();
        Permissions(P.Identity.UserManage);
        Description(d => d
            .WithSummary("Seryjne wymuszenie wylogowania z obsługą błędów cząstkowych")
            .WithDescription(
                "Odwołuje aktywne sesje Keycloak wielu użytkowników jednocześnie na podstawie "
                + "filtrów, identyfikatorów lub konkretnych komend."));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchUserAccountRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);

    /// <inheritdoc />
    protected override Task<ValidationTracker> ValidateTargetsAsync(
        IReadOnlyList<BatchTarget<UserExecForceLogoutCommand>> targets,
        CancellationToken ct)
        => _validator.ValidateForceLogoutAsync([.. targets.Select(t => t.AggregateUuid)], ct);
}

using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Validation;
using FastEndpoints;
using Identity.Application.Roles;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Identity.Roles.Command;

/// <summary>
/// Seryjne dodanie uprawnienia rolom. Naturalny przypadek użycia to odwrotność Catalogu —
/// „dodaj N uprawnień do jednej roli” zamiast „zmień jedną wartość na N agregatach". Kontrakt
/// to pokrywa: tryb <c>Commands[]</c> niesie kilka różnych <c>PermissionCode</c> dla TEGO
/// SAMEGO <c>Uuid</c> — elementy nie są odduplikowane po agregacie (patrz
/// <c>BatchEndpointBase.ValidateTargetsAsync</c>), a wszystkie trafiają do jednej transakcji
/// chunka, więc dają jeden <c>UPDATE</c> na tej samej śledzonej encji.
/// </summary>
public sealed class RoleAddPermissionMultipleCommandEndpoint
    : BatchEndpointBase<RoleAddPermissionCommand, SearchRoleRequest>
{
    private readonly IRoleQueries _queries;
    private readonly RoleBatchValidator _validator;

    public RoleAddPermissionMultipleCommandEndpoint(IRoleQueries queries, RoleBatchValidator validator)
    {
        _queries = queries;
        _validator = validator;
    }

    public override void Configure()
    {
        Post("batch-add-permission");
        Group<RoleGroup>();
        Permissions(P.Identity.RoleManage);
        Description(d => d
            .WithSummary("Seryjne dodanie uprawnienia rolom z obsługą błędów cząstkowych")
            .WithDescription(
                "Dodaje uprawnienie wielu rolom jednocześnie na podstawie filtrów, "
                + "identyfikatorów lub konkretnych komend. Kod uprawnienia musi istnieć "
                + "w katalogu i nie być wycofany — inaczej element odpada z kodem "
                + "`permission_code_unknown`."));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchRoleRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);

    /// <inheritdoc />
    protected override Task<ValidationTracker> ValidateTargetsAsync(
        IReadOnlyList<BatchTarget<RoleAddPermissionCommand>> targets,
        CancellationToken ct)
        => _validator.ValidateAddPermissionAsync(targets, ct);
}

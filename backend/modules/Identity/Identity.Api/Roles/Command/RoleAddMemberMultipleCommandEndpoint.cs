using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Validation;
using FastEndpoints;
using Identity.Application.Roles;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Identity.Roles.Command;

/// <summary>
/// Seryjne dołączenie roli składowej do kontenerów. Walidacja cyklu WEWNĄTRZ wsadu dzieje się
/// w pre-checku (<see cref="RoleBatchValidator.ValidateAddMemberAsync"/> → <c>RoleGraphCycleRule</c>)
/// — <c>RoleAddMemberCommandHandler</c> nadal woła <c>IsDescendantAsync</c>, ale to DRUGA linia
/// obrony na stanie zacommitowanym, nie ta, która łapie parę <c>A→B</c> + <c>B→A</c> w jednym
/// zadaniu (patrz <c>docs/backend/identity-bulk-migration.md</c> §1.3).
/// </summary>
public sealed class RoleAddMemberMultipleCommandEndpoint : BatchEndpointBase<RoleAddMemberCommand, SearchRoleRequest>
{
    private readonly IRoleQueries _queries;
    private readonly RoleBatchValidator _validator;

    public RoleAddMemberMultipleCommandEndpoint(IRoleQueries queries, RoleBatchValidator validator)
    {
        _queries = queries;
        _validator = validator;
    }

    public override void Configure()
    {
        Post("batch-add-member");
        Group<RoleGroup>();
        Permissions(P.Identity.RoleManage);
        Description(d => d
            .WithSummary("Seryjne dołączenie roli składowej z obsługą błędów cząstkowych")
            .WithDescription(
                "Dołącza rolę składową do wielu ról-kontenerów jednocześnie na podstawie "
                + "filtrów, identyfikatorów lub konkretnych komend. Krawędź zamykająca cykl "
                + "(także wewnątrz tego samego zadania) odpada z kodem `role_cycle_detected`; "
                + "samo-zawieranie z kodem `role_self_membership`."));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchRoleRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);

    /// <inheritdoc />
    protected override Task<ValidationTracker> ValidateTargetsAsync(
        IReadOnlyList<BatchTarget<RoleAddMemberCommand>> targets,
        CancellationToken ct)
        => _validator.ValidateAddMemberAsync(targets, ct);
}

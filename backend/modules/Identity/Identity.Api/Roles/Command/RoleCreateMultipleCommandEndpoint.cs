using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Validation;
using FastEndpoints;
using Identity.Application.Roles;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Identity.Roles.Command;

/// <summary>
/// Seryjne zakładanie ról. Jedyny endpoint operacji masowej w Identity, dla którego tryb
/// szablon+filtr i szablon+identyfikatory NIE mają zastosowania — cel jest agregatem, który
/// jeszcze nie istnieje, więc nie ma czego wskazać. Sensowny jest wyłącznie tryb <c>Commands[]</c>
/// (jawna lista nowych ról); filtr zawsze zwraca pusty zbiór.
/// </summary>
public sealed class RoleCreateMultipleCommandEndpoint : BatchEndpointBase<RoleCreateCommand, SearchRoleRequest>
{
    private readonly RoleBatchValidator _validator;

    public RoleCreateMultipleCommandEndpoint(RoleBatchValidator validator)
    {
        _validator = validator;
    }

    public override void Configure()
    {
        Post("batch-create");
        Group<RoleGroup>();
        Permissions(P.Identity.RoleManage);
        Description(d => d
            .WithSummary("Seryjne zakładanie ról z obsługą błędów cząstkowych")
            .WithDescription(
                "Zakłada wiele ról jednocześnie na podstawie listy komend (`commands`). "
                + "Tryby filtra i identyfikatorów nie mają zastosowania — nowa rola nie ma "
                + "jeszcze uuid, którym dałoby się ją wskazać."));
    }

    /// <inheritdoc />
    protected override Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(SearchRoleRequest filter, CancellationToken ct)
        => Task.FromResult(Enumerable.Empty<Guid>());

    /// <inheritdoc />
    protected override Task<ValidationTracker> ValidateTargetsAsync(
        IReadOnlyList<BatchTarget<RoleCreateCommand>> targets,
        CancellationToken ct)
        => _validator.ValidateCreateAsync(targets, ct);
}

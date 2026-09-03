using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using Identity.Application.IntegrationClients;
using Identity.Application.Users;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Identity.IntegrationClients.Command;

/// <summary>
/// Rejestracja kont serwisowych (kluczy integracyjnych, API-003). Tak jak przy zakładaniu ról
/// (patrz <c>RoleCreateMultipleCommandEndpoint</c>), cel jest agregatem, który jeszcze nie
/// istnieje — sensowny jest wyłącznie tryb <c>Commands[]</c>, tryby filtra i identyfikatorów
/// odrzuca <see cref="CreateBatchEndpointBase{TCommand, TFilter}"/> błędem 400.
///
/// <para>Gate'owane NOWYM uprawnieniem <see cref="P.Identity.IntegrationClientManage"/> —
/// jedynym nowym kodem tej funkcjonalności. Przeglądanie listy (ta sama strona Użytkownicy)
/// idzie po <see cref="P.Identity.UserRead"/>, nadawanie ról/uprawnień kontu serwisowemu po
/// <see cref="P.Identity.UserManage"/> (istniejące endpointy, bez zmian).</para>
/// </summary>
public sealed class IntegrationClientCreateMultipleCommandEndpoint
    : CreateBatchEndpointBase<IntegrationClientCreateCommand, SearchUserAccountRequest>
{
    public override void Configure()
    {
        Post("batch-create");
        Group<IntegrationClientGroup>();
        Permissions(P.Identity.IntegrationClientManage);
        Description(d => d
            .WithSummary("Seryjna rejestracja kont serwisowych (kluczy integracyjnych)")
            .WithDescription(
                "Rejestruje konta serwisowe na podstawie listy komend (`commands`) — `Uuid` to "
                + "`sub` service-accounta poufnego klienta Keycloaka, założonego ręcznie przez "
                + "administratora. Tryby filtra i identyfikatorów nie mają zastosowania."));
    }
}

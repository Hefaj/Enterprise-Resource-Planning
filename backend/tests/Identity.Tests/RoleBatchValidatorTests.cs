using Erp.BuildingBlocks.Api.Contracts;
using Identity.Application.Permissions;
using Identity.Application.Roles;
using Shouldly;
using Xunit;

namespace Identity.Tests;

/// <summary>
/// Walidator ról spina pięć niezależnych reguł (istnienie roli, istnienie referencji,
/// unikalność kodu, cykl grafu, istnienie kodu uprawnienia) w pre-checki dla pięciu operacji
/// masowych. Testy pilnują doboru reguł per operacja — patrz uzasadnienie w
/// <c>RoleBatchValidator</c> (np. „odbierz” nie wymaga istnienia referencji, „utwórz” nie
/// wymaga istnienia roli, bo cel jest nowym agregatem).
/// </summary>
public class RoleBatchValidatorTests
{
    private static RoleBatchValidator Build(
        FakeRoleQueries? roles = null,
        FakePermissionCatalogQueries? permissions = null)
    {
        var roleQueries = roles ?? new FakeRoleQueries();
        var permissionQueries = permissions ?? new FakePermissionCatalogQueries();

        return new RoleBatchValidator(
            new RoleMustExistRule(roleQueries),
            new ReferencedRoleMustExistRule(roleQueries),
            new RoleCodeUniqueRule(roleQueries),
            new RoleGraphCycleRule(roleQueries),
            new PermissionCodeMustExistRule(permissionQueries));
    }

    [Fact]
    public async Task Utworzenie_roli_o_zajetym_kodzie_jest_odrzucane()
    {
        var candidate = Guid.NewGuid();
        var validator = Build(new FakeRoleQueries { ExistingCodes = { "administrator" } });

        var tracker = await validator.ValidateCreateAsync(
            [new BatchTarget<RoleCreateCommand>(candidate, new RoleCreateCommand { Uuid = candidate, Code = "administrator", Name = "Administrator" })],
            CancellationToken.None);

        tracker.Errors[candidate][0].ErrorCode.ShouldBe("role_code_duplicate");
    }

    [Fact]
    public async Task Utworzenie_roli_nie_wymaga_zeby_uuid_juz_istnial()
    {
        // Cel operacji "utwórz" jest NOWYM agregatem — RoleMustExistRule celowo nie wchodzi
        // w grę, inaczej każde tworzenie roli odpadałoby jako "nie znaleziono roli".
        var candidate = Guid.NewGuid();
        var validator = Build();

        var tracker = await validator.ValidateCreateAsync(
            [new BatchTarget<RoleCreateCommand>(candidate, new RoleCreateCommand { Uuid = candidate, Code = "sales-rep", Name = "Sales Rep" })],
            CancellationToken.None);

        tracker.Errors.ShouldBeEmpty();
    }

    [Fact]
    public async Task Dodanie_uprawnienia_nieistniejacej_roli_jest_odrzucane()
    {
        var missing = Guid.NewGuid();
        var validator = Build(permissions: new FakePermissionCatalogQueries { ExistingCodes = { "catalog.product.read" } });

        var tracker = await validator.ValidateAddPermissionAsync(
            [new BatchTarget<RoleAddPermissionCommand>(missing, new RoleAddPermissionCommand { Uuid = missing, PermissionCode = "catalog.product.read" })],
            CancellationToken.None);

        tracker.Errors[missing][0].ErrorCode.ShouldBe("aggregate_not_found");
    }

    [Fact]
    public async Task Dodanie_nieznanego_kodu_uprawnienia_jest_odrzucane()
    {
        var role = Guid.NewGuid();
        var validator = Build(new FakeRoleQueries { ExistingUuids = { role } });

        var tracker = await validator.ValidateAddPermissionAsync(
            [new BatchTarget<RoleAddPermissionCommand>(role, new RoleAddPermissionCommand { Uuid = role, PermissionCode = "literowka" })],
            CancellationToken.None);

        tracker.Errors[role][0].ErrorCode.ShouldBe("permission_code_unknown");
    }

    [Fact]
    public async Task Dodanie_znanego_uprawnienia_istniejacej_roli_przechodzi()
    {
        var role = Guid.NewGuid();
        const string code = "catalog.product.read";
        var validator = Build(
            new FakeRoleQueries { ExistingUuids = { role } },
            new FakePermissionCatalogQueries { ExistingCodes = { code } });

        var tracker = await validator.ValidateAddPermissionAsync(
            [new BatchTarget<RoleAddPermissionCommand>(role, new RoleAddPermissionCommand { Uuid = role, PermissionCode = code })],
            CancellationToken.None);

        tracker.Errors.ShouldBeEmpty();
    }

    /// <summary>Odebranie uprawnienia nie wymaga, żeby kod istniał w katalogu —
    /// <c>Role.RemovePermission</c> jest bezpiecznym no-opem dla nieznanego kodu.</summary>
    [Fact]
    public async Task Odebranie_uprawnienia_nieznanym_kodem_wciaz_przechodzi_dla_istniejacej_roli()
    {
        var role = Guid.NewGuid();
        var validator = Build(new FakeRoleQueries { ExistingUuids = { role } });

        var tracker = await validator.ValidateRemovePermissionAsync([role], CancellationToken.None);

        tracker.Errors.ShouldBeEmpty();
    }

    [Fact]
    public async Task Dolaczenie_nieistniejacej_roli_skladowej_jest_odrzucane()
    {
        var container = Guid.NewGuid();
        var missingMember = Guid.NewGuid();
        var validator = Build(new FakeRoleQueries { ExistingUuids = { container } });

        var tracker = await validator.ValidateAddMemberAsync(
            [new BatchTarget<RoleAddMemberCommand>(container, new RoleAddMemberCommand { Uuid = container, MemberRoleUuid = missingMember })],
            CancellationToken.None);

        tracker.Errors[container][0].ErrorCode.ShouldBe("aggregate_not_found");
    }

    /// <summary>Trzy reguły naraz w jednej operacji: istnienie kontenera, istnienie składowej,
    /// brak cyklu — <c>ValidateAddMemberAsync</c> jest jedyną metodą walidatora, która woła
    /// wszystkie trzy.</summary>
    [Fact]
    public async Task Dolaczenie_roli_zamykajacej_cykl_jest_odrzucane()
    {
        var container = Guid.NewGuid();
        var member = Guid.NewGuid();
        var validator = Build(new FakeRoleQueries
        {
            ExistingUuids = { container, member },
            MembershipEdges = { new RoleMembershipEdge(member, container) },
        });

        var tracker = await validator.ValidateAddMemberAsync(
            [new BatchTarget<RoleAddMemberCommand>(container, new RoleAddMemberCommand { Uuid = container, MemberRoleUuid = member })],
            CancellationToken.None);

        tracker.Errors[container][0].ErrorCode.ShouldBe("role_cycle_detected");
    }

    [Fact]
    public async Task Dolaczenie_poprawnej_roli_skladowej_przechodzi()
    {
        var container = Guid.NewGuid();
        var member = Guid.NewGuid();
        var validator = Build(new FakeRoleQueries { ExistingUuids = { container, member } });

        var tracker = await validator.ValidateAddMemberAsync(
            [new BatchTarget<RoleAddMemberCommand>(container, new RoleAddMemberCommand { Uuid = container, MemberRoleUuid = member })],
            CancellationToken.None);

        tracker.Errors.ShouldBeEmpty();
    }

    /// <summary>Odłączenie nie wymaga istnienia składowej — <c>Role.RemoveMember</c> jest
    /// bezpiecznym no-opem dla nieobecnego grantu.</summary>
    [Fact]
    public async Task Odlaczenie_roli_skladowej_wciaz_przechodzi_dla_istniejacego_kontenera()
    {
        var container = Guid.NewGuid();
        var validator = Build(new FakeRoleQueries { ExistingUuids = { container } });

        var tracker = await validator.ValidateRemoveMemberAsync([container], CancellationToken.None);

        tracker.Errors.ShouldBeEmpty();
    }
}

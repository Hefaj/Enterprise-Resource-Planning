using Erp.BuildingBlocks.Api.Contracts;
using Identity.Application.Permissions;
using Identity.Application.Roles;
using Identity.Application.Users;
using Shouldly;
using Xunit;

namespace Identity.Tests;

/// <summary>
/// Walidator jest miejscem, w którym zapada decyzja „jakie reguły dla której operacji na
/// użytkownikach”. Testy pilnują, że reguły są niezależne (element zbiera WSZYSTKIE naruszenia
/// naraz) i że operacje „odbierz” nie wymagają istnienia referencji (patrz uzasadnienie w
/// <c>UserBatchValidator.ValidateRevokeRoleAsync</c>).
/// </summary>
public class UserBatchValidatorTests
{
    private static UserBatchValidator Build(
        FakeUserAccountQueries users,
        FakeRoleQueries? roles = null,
        FakePermissionCatalogQueries? permissions = null)
        => new(
            new UserMustExistRule(users),
            new ReferencedRoleMustExistRule(roles ?? new FakeRoleQueries()),
            new PermissionCodeMustExistRule(permissions ?? new FakePermissionCatalogQueries()));

    [Fact]
    public async Task Nadanie_roli_nieistniejacemu_uzytkownikowi_jest_odrzucane()
    {
        var missing = Guid.NewGuid();
        var role = Guid.NewGuid();
        var validator = Build(new FakeUserAccountQueries(), new FakeRoleQueries { ExistingUuids = { role } });

        var tracker = await validator.ValidateAssignRoleAsync(
            [new BatchTarget<UserAssignRoleCommand>(missing, new UserAssignRoleCommand { Uuid = missing, RoleUuid = role })],
            CancellationToken.None);

        tracker.Errors[missing][0].ErrorCode.ShouldBe("aggregate_not_found");
    }

    [Fact]
    public async Task Nadanie_nieistniejacej_roli_jest_odrzucane()
    {
        var user = Guid.NewGuid();
        var missingRole = Guid.NewGuid();
        var validator = Build(new FakeUserAccountQueries { ExistingUuids = { user } });

        var tracker = await validator.ValidateAssignRoleAsync(
            [new BatchTarget<UserAssignRoleCommand>(user, new UserAssignRoleCommand { Uuid = user, RoleUuid = missingRole })],
            CancellationToken.None);

        tracker.Errors[user][0].ErrorCode.ShouldBe("aggregate_not_found");
    }

    [Fact]
    public async Task Nadanie_roli_istniejacemu_uzytkownikowi_z_istniejaca_rola_przechodzi()
    {
        var user = Guid.NewGuid();
        var role = Guid.NewGuid();
        var validator = Build(
            new FakeUserAccountQueries { ExistingUuids = { user } },
            new FakeRoleQueries { ExistingUuids = { role } });

        var tracker = await validator.ValidateAssignRoleAsync(
            [new BatchTarget<UserAssignRoleCommand>(user, new UserAssignRoleCommand { Uuid = user, RoleUuid = role })],
            CancellationToken.None);

        tracker.Errors.ShouldBeEmpty();
    }

    /// <summary>Odbieranie roli nie wymaga, żeby rola sama w sobie istniała —
    /// <c>UserAccount.RevokeRole</c> jest bezpiecznym no-opem dla nieznanego grantu.</summary>
    [Fact]
    public async Task Odebranie_roli_nieistniejacej_referencyjnie_wciaz_przechodzi_dla_istniejacego_uzytkownika()
    {
        var user = Guid.NewGuid();
        var validator = Build(new FakeUserAccountQueries { ExistingUuids = { user } });

        var tracker = await validator.ValidateRevokeRoleAsync([user], CancellationToken.None);

        tracker.Errors.ShouldBeEmpty();
    }

    [Fact]
    public async Task Nadanie_uprawnienia_nieznanym_kodem_jest_odrzucane()
    {
        var user = Guid.NewGuid();
        var validator = Build(new FakeUserAccountQueries { ExistingUuids = { user } });

        var tracker = await validator.ValidateGrantPermissionAsync(
            [new BatchTarget<UserGrantPermissionCommand>(
                user, new UserGrantPermissionCommand { Uuid = user, PermissionCode = "literowka.w.kodzie", Reason = "test" })],
            CancellationToken.None);

        tracker.Errors[user][0].ErrorCode.ShouldBe("permission_code_unknown");
    }

    [Fact]
    public async Task Nadanie_uprawnienia_znanym_kodem_przechodzi()
    {
        var user = Guid.NewGuid();
        const string code = "catalog.product.read";
        var validator = Build(
            new FakeUserAccountQueries { ExistingUuids = { user } },
            permissions: new FakePermissionCatalogQueries { ExistingCodes = { code } });

        var tracker = await validator.ValidateGrantPermissionAsync(
            [new BatchTarget<UserGrantPermissionCommand>(
                user, new UserGrantPermissionCommand { Uuid = user, PermissionCode = code, Reason = "test" })],
            CancellationToken.None);

        tracker.Errors.ShouldBeEmpty();
    }

    /// <summary>Element naruszający obie reguły naraz (użytkownik nieznany, kod nieznany)
    /// zbiera oba błędy — reguły są płaskie, nie łańcuchowe.</summary>
    [Fact]
    public async Task Element_naruszajacy_obie_reguly_nadania_uprawnienia_zbiera_oba_bledy()
    {
        var missing = Guid.NewGuid();
        var validator = Build(new FakeUserAccountQueries());

        var tracker = await validator.ValidateGrantPermissionAsync(
            [new BatchTarget<UserGrantPermissionCommand>(
                missing, new UserGrantPermissionCommand { Uuid = missing, PermissionCode = "nieznany.kod", Reason = "test" })],
            CancellationToken.None);

        var codes = tracker.Errors[missing].Select(e => e.ErrorCode).ToList();
        codes.ShouldBe(["aggregate_not_found", "permission_code_unknown"]);
    }

    [Fact]
    public async Task Wymuszenie_wylogowania_nieistniejacego_uzytkownika_jest_odrzucane()
    {
        var missing = Guid.NewGuid();
        var validator = Build(new FakeUserAccountQueries());

        var tracker = await validator.ValidateForceLogoutAsync([missing], CancellationToken.None);

        tracker.Errors[missing][0].ErrorCode.ShouldBe("aggregate_not_found");
    }
}

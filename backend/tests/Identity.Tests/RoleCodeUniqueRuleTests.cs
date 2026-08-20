using Erp.BuildingBlocks.Validation;
using Identity.Application.Roles;
using Shouldly;
using Xunit;

namespace Identity.Tests;

/// <summary>
/// Reguła jest pre-checkiem dla masowego tworzenia ról: bez niej zadanie tworzące dwie role
/// o tym samym kodzie przeszłoby pre-check w całości i rozbiłoby się dopiero o unikalny indeks
/// <c>ix_role_code</c>, element po elemencie, w trybie izolacji <c>BulkCommandRunnera</c>.
/// </summary>
public class RoleCodeUniqueRuleTests
{
    private static async Task<ValidationTracker> RunAsync(FakeRoleQueries queries, params RoleCreateTarget[] targets)
    {
        var tracker = new ValidationTracker();
        await new RoleCodeUniqueRule(queries).ExecuteAsync(targets, t => t.Uuid, tracker, CancellationToken.None);
        return tracker;
    }

    [Fact]
    public async Task Kod_juz_istniejacy_w_bazie_jest_odrzucany()
    {
        var candidate = Guid.NewGuid();
        var queries = new FakeRoleQueries { ExistingCodes = { "warehouse-manager" } };

        var tracker = await RunAsync(queries, new RoleCreateTarget(candidate, "warehouse-manager"));

        tracker.HasError(candidate).ShouldBeTrue();
        tracker.Errors[candidate][0].ErrorCode.ShouldBe("role_code_duplicate");
    }

    /// <summary>Kod w bazie jest zawsze przycięty i pisany małymi literami (<c>Role.ValidateCode</c>)
    /// — reguła musi porównywać po tej samej znormalizowanej formie.</summary>
    [Fact]
    public async Task Porownanie_ignoruje_wielkosc_liter_i_biale_znaki()
    {
        var candidate = Guid.NewGuid();
        var queries = new FakeRoleQueries { ExistingCodes = { "warehouse-manager" } };

        var tracker = await RunAsync(queries, new RoleCreateTarget(candidate, "  Warehouse-Manager  "));

        tracker.HasError(candidate).ShouldBeTrue();
    }

    [Fact]
    public async Task Nowy_unikalny_kod_przechodzi()
    {
        var candidate = Guid.NewGuid();
        var queries = new FakeRoleQueries { ExistingCodes = { "warehouse-manager" } };

        var tracker = await RunAsync(queries, new RoleCreateTarget(candidate, "sales-rep"));

        tracker.Errors.ShouldBeEmpty();
    }

    /// <summary>Sedno reguły: bez tego wsad tworzący dwie role o tym samym kodzie przeszedłby
    /// pre-check w całości (żadna nie koliduje z bazą) i rozbiłby się dopiero o unikalny indeks.</summary>
    [Fact]
    public async Task Kolizja_wewnatrz_wsadu_przepuszcza_pierwszy_element()
    {
        var first = Guid.NewGuid();
        var second = Guid.NewGuid();

        var tracker = await RunAsync(
            new FakeRoleQueries(),
            new RoleCreateTarget(first, "sales-rep"),
            new RoleCreateTarget(second, "sales-rep"));

        tracker.HasError(first).ShouldBeFalse();
        tracker.HasError(second).ShouldBeTrue();
        tracker.Errors[second][0].ErrorCode.ShouldBe("role_code_duplicate");
    }

    [Fact]
    public async Task Kolizja_wewnatrz_wsadu_ignoruje_wielkosc_liter()
    {
        var first = Guid.NewGuid();
        var second = Guid.NewGuid();

        var tracker = await RunAsync(
            new FakeRoleQueries(),
            new RoleCreateTarget(first, "sales-rep"),
            new RoleCreateTarget(second, "Sales-Rep"));

        tracker.HasError(second).ShouldBeTrue();
    }

    [Fact]
    public async Task Rozne_kody_w_jednym_wsadzie_przechodza()
    {
        var first = Guid.NewGuid();
        var second = Guid.NewGuid();

        var tracker = await RunAsync(
            new FakeRoleQueries(),
            new RoleCreateTarget(first, "sales-rep"),
            new RoleCreateTarget(second, "warehouse-reader"));

        tracker.Errors.ShouldBeEmpty();
    }
}

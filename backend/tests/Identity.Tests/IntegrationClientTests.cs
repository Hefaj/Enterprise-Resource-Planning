using Identity.Domain.Users;
using Shouldly;
using Xunit;

namespace Identity.Tests;

/// <summary>
/// API-003 — klucz integracyjny jako klient Keycloaka z własnym zestawem uprawnień. Patrz
/// <c>docs/backend/identity-authz.md</c> §2.
///
/// <para><c>IntegrationClientCreateCommandHandler</c> (który zawija <c>UserAccount.CreateServiceAccount</c>
/// w <c>CommandHandler&lt;,&gt;</c>) nie da się skonstruować w izolowanym unit teście — bazowa
/// klasa FastEndpoints <c>CommandHandlerBase</c> inicjalizuje <c>ValidationContext</c>, który
/// wymaga zarejestrowanego <c>ServiceResolver</c> (czyli hosta FastEndpoints). Dlatego handler
/// jest pokryty pośrednio przez zachowanie agregatu tutaj, wprost — przez
/// <see cref="Erp.IntegrationTests.IdentityUserProvisioningTests"/>, który buduje pełne DI.</para>
/// </summary>
public class IntegrationClientTests
{
    [Fact]
    public void CreateServiceAccount_ustawia_Kind_Service_i_syntetyczny_email_z_uuid()
    {
        var uuid = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;

        var account = UserAccount.CreateServiceAccount(uuid, "Klucz integracyjny — eksport", "Do czego służy", now);

        account.Kind.ShouldBe(UserAccountKind.Service);
        account.Description.ShouldBe("Do czego służy");
        account.Email.ShouldBe($"integration+{uuid:N}@erp.local");
        account.Email.ShouldContain('@');
        account.DisplayName.ShouldBe("Klucz integracyjny — eksport");
        account.IsActive.ShouldBeTrue();
    }

    /// <summary>Regresja: bootstrap pierwszego administratora liczy WYŁĄCZNIE konta Human
    /// (patrz poprawka w <c>UserProvisioningService</c>) — ta ścieżka (logowanie człowieka)
    /// musi nadal ustawiać Kind = Human, nie Service.</summary>
    [Fact]
    public void ProvisionFromToken_nadal_ustawia_Kind_Human()
    {
        var uuid = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;

        var account = UserAccount.ProvisionFromToken(uuid, "jan.kowalski@example.com", "Jan Kowalski", now);

        account.Kind.ShouldBe(UserAccountKind.Human);
        account.Description.ShouldBeNull();
    }
}

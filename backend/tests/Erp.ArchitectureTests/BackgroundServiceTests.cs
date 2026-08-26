using System.Reflection;
using Erp.BuildingBlocks.Application.Abstractions;
using Microsoft.Extensions.Hosting;
using Shouldly;
using Xunit;

namespace Erp.ArchitectureTests;

/// <summary>
/// Wymusza świadomą odpowiedź na pytanie <b>„co ta usługa tła robi, gdy chodzą dwie instancje"</b>.
///
/// <para>To jest ta sama wymiana, którą robią <see cref="LayeringTests"/> i
/// <see cref="CommandNamingTests"/>: reguła zapisana wyłącznie w
/// <c>docs/backend/multi-instance.md</c> przestaje obowiązywać przy pierwszej usłudze tła pisanej
/// pod presją czasu. Tutaj przestaje przechodzić build, i to <b>w momencie dopisania klasy</b>,
/// a nie po wdrożeniu drugiej instancji.</para>
///
/// <para><b>Test nie ocenia, czy uzasadnienie jest prawdziwe</b> — nie da się tego zrobić
/// automatem. Wymusza jedynie, żeby ktoś je napisał w miejscu, w którym następna osoba je
/// zobaczy: w <see cref="ClusterSafeAttribute"/> nad klasą.</para>
/// </summary>
public class BackgroundServiceTests
{
    /// <summary>
    /// Zestawy zawierające usługi tła. Wyliczone jawnie, bo <c>AppDomain.CurrentDomain</c> widzi
    /// tylko to, co zostało już załadowane — zestaw, z którego nikt nic nie dotknął, po prostu
    /// nie istnieje i test cicho przechodziłby dla całego modułu.
    /// </summary>
    private static readonly Assembly[] ScannedAssemblies =
    [
        typeof(BuildingBlocks.Persistence.ErpDbContext).Assembly,
        typeof(BuildingBlocks.Jobs.Job).Assembly,
        typeof(BuildingBlocks.Api.ErpModuleRegistrationExtensions).Assembly,
        typeof(BuildingBlocks.Artifacts.ErpArtifactExtensions).Assembly,
        typeof(Catalog.Infrastructure.Jobs.ExportRunner).Assembly,
        typeof(Identity.Infrastructure.Jobs.ExpiredGrantCleanupService).Assembly,
        typeof(Sales.Infrastructure.Seed.SalesSeedInitializer).Assembly,
        typeof(Notification.Infrastructure.NotificationInfrastructureExtensions).Assembly,
        typeof(Catalog.Products.Command.ProductSetPriceMultipleCommandEndpoint).Assembly,
        typeof(Identity.Users.Command.UserAddRoleMultipleCommandEndpoint).Assembly,
        typeof(Sales.Customers.Command.CustomerSetNameMultipleCommandEndpoint).Assembly,
    ];

    /// <summary>
    /// Usługi, którym świadomie odpuszczamy atrybut.
    ///
    /// <para>Lista jest <b>pusta i taka ma zostać</b>. Jest tu, bo alternatywą dla wyjątku
    /// jawnego jest wyjątek ukryty — ktoś, kto nie umie uzasadnić bezpieczeństwa swojej usługi,
    /// rozluźni sam warunek testu. Dopisanie się tutaj wymaga zmiany w pliku, który czyta się
    /// przy przeglądzie; oznaczenie <c>[ClusterSafe]</c> nieprawdą — nie.</para>
    /// </summary>
    private static readonly HashSet<string> Waived = new(StringComparer.Ordinal);

    private static IReadOnlyList<Type> HostedServices() =>
    [
        .. ScannedAssemblies
            .Distinct()
            .SelectMany(assembly => assembly.GetTypes())
            .Where(type => type is { IsClass: true, IsAbstract: false })
            .Where(type => typeof(IHostedService).IsAssignableFrom(type))
            .OrderBy(type => type.FullName, StringComparer.Ordinal),
    ];

    [Fact]
    public void Kazda_usluga_tla_deklaruje_zachowanie_przy_wielu_instancjach()
    {
        var undeclared = HostedServices()
            .Where(type => type.GetCustomAttribute<ClusterSafeAttribute>() is null)
            .Where(type => !Waived.Contains(type.FullName ?? type.Name))
            .Select(type => type.FullName ?? type.Name)
            .ToList();

        undeclared.ShouldBeEmpty(
            "Usługi tła bez deklaracji [ClusterSafe]:"
            + Environment.NewLine
            + string.Join(Environment.NewLine, undeclared.Select(name => "  - " + name))
            + Environment.NewLine
            + "Dopisz [ClusterSafe(\"…\")] z konkretnym mechanizmem (dzierżawa, SKIP LOCKED, "
            + "naturalna idempotencja) albo — jeśli usługa NIE jest bezpieczna — zatrzymaj ją "
            + "konfiguracją i opisz to w docs/backend/multi-instance.md.");
    }

    /// <summary>
    /// Uzasadnienie „bo tak" jest gorsze od jego braku: wygląda jak przemyślana decyzja.
    /// Wymóg długości nie sprawdza treści, ale odsiewa wpisy stawiane wyłącznie po to,
    /// żeby build przeszedł.
    /// </summary>
    [Fact]
    public void Uzasadnienie_jest_konkretne()
    {
        var vague = HostedServices()
            .Select(type => (Type: type, Attribute: type.GetCustomAttribute<ClusterSafeAttribute>()))
            .Where(pair => pair.Attribute is not null)
            .Where(pair => (pair.Attribute!.Reason?.Trim().Length ?? 0) < 20)
            .Select(pair => pair.Type.FullName ?? pair.Type.Name)
            .ToList();

        vague.ShouldBeEmpty(
            "Uzasadnienia [ClusterSafe] są zbyt ogólne, żeby cokolwiek znaczyły: "
            + string.Join(", ", vague));
    }
}

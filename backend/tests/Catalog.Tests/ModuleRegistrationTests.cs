using Catalog.Application.Products;
using Erp.BuildingBlocks.Api;
using Erp.BuildingBlocks.Jobs;
using Microsoft.Extensions.DependencyInjection;
using Shouldly;
using Xunit;

namespace Catalog.Tests;

/// <summary>
/// Sprawdza, czy skan zestawu (<c>AddErpModule</c>) faktycznie widzi to, co w module istnieje.
///
/// <para>Testy w <c>Erp.ArchitectureTests</c> opisują same konwencje na typach wzorcowych; tutaj
/// idzie o coś innego — o KRZYŻOWE sprawdzenie konwencji nazewniczej z implementowanym
/// interfejsem. Klasa nazwana <c>XxxCommandHandler</c>, która (po refaktorze klasy bazowej,
/// przez literówkę w sygnaturze) przestała implementować <c>ICommandHandler</c>, zniknęłaby
/// z kontenera bez jednego ostrzeżenia kompilatora — a przy ręcznych rejestracjach wywaliłaby
/// build. Ten test przywraca tamten sygnał.</para>
/// </summary>
public class ModuleRegistrationTests
{
    private static readonly ServiceCollection Registrations = Scan();

    private static ServiceCollection Scan()
    {
        var services = new ServiceCollection();
        services.AddErpModule(typeof(ProductSetNameCommand).Assembly);
        return services;
    }

    [Fact]
    public void Kazdy_handler_komendy_jest_zarejestrowany()
    {
        var handlers = typeof(ProductSetNameCommand).Assembly.GetTypes()
            .Where(t => t is { IsClass: true, IsAbstract: false } && t.Name.EndsWith("CommandHandler", StringComparison.Ordinal))
            .ToList();

        handlers.ShouldNotBeEmpty();

        foreach (var handler in handlers)
        {
            Registrations.ShouldContain(
                d => d.ImplementationType == handler,
                $"Handler {handler.Name} nie został wykryty przez AddErpModule — " +
                "czy na pewno implementuje ICommandHandler<,>?");
        }
    }

    /// <summary>
    /// Brak egzekutora nie wywala się przy starcie ani przy kompilacji — wychodzi dopiero, gdy
    /// runner odczyta z bazy zadanie z tą nazwą komendy. Czyli na produkcji, w środku operacji
    /// masowej, po tym jak użytkownik zobaczył już „przyjęto do realizacji".
    /// </summary>
    [Fact]
    public void Kazda_komenda_produktu_ma_egzekutora_pod_swoja_nazwa()
    {
        string[] expected =
        [
            nameof(ProductSetNameCommand),
            nameof(ProductSetPriceCommand),
            nameof(ProductSetClassificationCommand),
        ];

        foreach (var commandType in expected)
        {
            Registrations.ShouldContain(
                d => d.ServiceType == typeof(IBulkCommandExecutor) && (d.ServiceKey as string) == commandType,
                $"Brak egzekutora zadań masowych dla komendy {commandType}.");
        }
    }

    [Fact]
    public void Reguly_wsadowe_i_walidator_sa_zarejestrowane()
    {
        Registrations.ShouldContain(d => d.ServiceType == typeof(ProductMustExistRule));
        Registrations.ShouldContain(d => d.ServiceType == typeof(ProductDuplicateRule));
        Registrations.ShouldContain(d => d.ServiceType == typeof(ProductBatchValidator));
    }
}

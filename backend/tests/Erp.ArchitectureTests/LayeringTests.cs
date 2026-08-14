using System.Reflection;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using NetArchTest.Rules;
using Shouldly;
using Xunit;

namespace Erp.ArchitectureTests;

/// <summary>
/// Egzekwuje granice Clean Architecture — świadomy odpowiednik
/// <c>@nx/enforce-module-boundaries</c>, którym pilnowane są warstwy na frontendzie.
///
/// Sens jest ten sam po obu stronach: złamanie granicy ma wywalić build, a nie zostać wyłapane
/// (albo i nie) w code review. Reguła zapisana wyłącznie w dokumentacji jest regułą, która
/// prędzej czy później przestaje obowiązywać.
/// </summary>
public class LayeringTests
{
    private static readonly Assembly DomainAssembly = typeof(AggregateRoot).Assembly;
    private static readonly Assembly ApplicationAssembly = typeof(IUnitOfWork).Assembly;
    private static readonly Assembly ContractsAssembly = typeof(BuildingBlocks.Contracts.AggregateChanged).Assembly;

    /// <summary>
    /// Domena jest czysta: żadnego EF, ASP.NET, Wolverine'a. Gdyby agregat mógł sięgnąć
    /// do <c>DbContext</c>, reguły biznesowe zaczęłyby zależeć od tego, co akurat jest
    /// załadowane — i przestałyby dać się przetestować bez bazy.
    /// </summary>
    [Fact]
    public void Domain_nie_zalezy_od_infrastruktury()
    {
        var result = Types.InAssembly(DomainAssembly)
            .ShouldNot()
            .HaveDependencyOnAny(
                "Microsoft.EntityFrameworkCore",
                "Microsoft.AspNetCore",
                "Wolverine",
                "FastEndpoints",
                "Npgsql")
            .GetResult();

        result.IsSuccessful.ShouldBeTrue(FormatFailure(result));
    }

    /// <summary>
    /// Domena nie zna nawet kontraktów integracyjnych — te są publicznym API modułu,
    /// a nie językiem, w którym opisany jest model. Tłumaczenie jednego na drugie
    /// należy do <see cref="IDomainEventTranslator"/>.
    /// </summary>
    [Fact]
    public void Domain_nie_zalezy_od_kontraktow_integracyjnych()
    {
        var result = Types.InAssembly(DomainAssembly)
            .ShouldNot()
            .HaveDependencyOn(ContractsAssembly.GetName().Name)
            .GetResult();

        result.IsSuccessful.ShouldBeTrue(FormatFailure(result));
    }

    /// <summary>
    /// Application zna wyłącznie abstrakcje. Wpuszczenie tu EF Core albo FastEndpoints
    /// oznaczałoby, że logika aplikacyjna zaczyna zależeć od sposobu dostarczenia żądania
    /// — i tego samego handlera nie dałoby się wywołać z zadania w tle.
    /// </summary>
    [Fact]
    public void Application_nie_zalezy_od_infrastruktury()
    {
        var result = Types.InAssembly(ApplicationAssembly)
            .ShouldNot()
            .HaveDependencyOnAny(
                "Microsoft.EntityFrameworkCore",
                "Microsoft.AspNetCore",
                "Wolverine",
                "FastEndpoints",
                "Npgsql")
            .GetResult();

        result.IsSuccessful.ShouldBeTrue(FormatFailure(result));
    }

    /// <summary>
    /// Kontrakty integracyjne muszą być samodzielne — konsumuje je każdy mikroserwis,
    /// więc dociągnięcie tu czegokolwiek poza BCL zmusiłoby wszystkich konsumentów
    /// do tej samej zależności.
    /// </summary>
    [Fact]
    public void Kontrakty_sa_samodzielne()
    {
        var referenced = ContractsAssembly
            .GetReferencedAssemblies()
            .Select(a => a.Name!)
            .Where(name => !name.StartsWith("System", StringComparison.Ordinal)
                        && !string.Equals(name, "netstandard", StringComparison.Ordinal))
            .ToList();

        referenced.ShouldBeEmpty(
            $"Erp.BuildingBlocks.Contracts musi zależeć wyłącznie od BCL, a zależy od: {string.Join(", ", referenced)}");
    }

    /// <summary>
    /// Korzenie agregatów muszą mieć bezparametrowy konstruktor dla EF Core (materializacja)
    /// — inaczej zapytanie kończy się błędem dopiero w czasie działania, przy pierwszym odczycie.
    /// </summary>
    [Fact]
    public void Agregaty_maja_konstruktor_dla_EF()
    {
        var aggregates = Types.InAssembly(typeof(BuildingBlocks.Jobs.Job).Assembly)
            .That()
            .Inherit(typeof(AggregateRoot))
            .GetTypes();

        foreach (var aggregate in aggregates)
        {
            var hasParameterlessCtor = aggregate.GetConstructors(
                    BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic)
                .Any(c => c.GetParameters().Length == 0);

            hasParameterlessCtor.ShouldBeTrue(
                $"Agregat {aggregate.Name} nie ma bezparametrowego konstruktora wymaganego przez EF Core.");
        }
    }

    private static string FormatFailure(NetArchTest.Rules.TestResult result)
        => result.FailingTypeNames is null
            ? "Naruszenie granicy warstw."
            : $"Naruszenie granicy warstw przez: {string.Join(", ", result.FailingTypeNames)}";
}

using System.Reflection;
using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Jobs;
using Erp.BuildingBlocks.Validation;
using FastEndpoints;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Erp.BuildingBlocks.Api;

/// <summary>
/// Rejestruje w kontenerze te usługi modułu, których istnienie jednoznacznie wynika z kodu:
/// handlery komend, reguły i walidatory wsadowe, egzekutory zadań masowych oraz implementacje
/// nazwane po swoim interfejsie (<c>IProductQueries</c> → <c>ProductQueries</c>).
///
/// <para><b>Po co.</b> Każda z tych rejestracji jest mechaniczna — nie ma w niej decyzji, tylko
/// powtórzenie faktu, że klasa istnieje. Wpisywane ręcznie rosły liniowo z każdą nową komendą
/// i regułą (Identity: 25 linii samych handlerów i egzekutorów), a pominięcie jednej z nich
/// jest niewykrywalne przy kompilacji: brak egzekutora wychodzi dopiero wtedy, gdy runner
/// sięgnie po niego dla konkretnego zadania — czyli na produkcji, przy operacji masowej.</para>
///
/// <para><b>Czego to NIE zastępuje.</b> Rejestracji, które są decyzją: nadpisania
/// <c>IPermissionProvider</c> w Identity, usług hostowanych, seedów, map sygnatur, cyklu życia
/// innego niż scoped. Te zostają jawne w <c>Program.cs</c> albo w <c>Add{Modul}Infrastructure</c>,
/// bo wpis niesie tam informację, której nie da się wyprowadzić z istnienia klasy.</para>
///
/// <para><b>Furtka.</b> Konwencje używają <c>TryAdd</c>, więc rejestracja wykonana WCZEŚNIEJ
/// (np. w <c>Add{Modul}Infrastructure</c>) wygrywa. Rejestracja jawna wykonana PÓŹNIEJ też
/// wygrywa, bo w kontenerze Microsoftu liczy się ostatni wpis dla danego typu usługi.
/// Klasa wymagająca innego cyklu życia niż scoped nie musi więc uciekać od konwencji —
/// wystarczy, że moduł zarejestruje ją po swojemu.</para>
///
/// <para><b>Rejestracje są typowe, nie lambdowe</b> (<c>AddScoped(serviceType, implType)</c>),
/// bo Wolverine od v6 statycznie analizuje graf zależności handlerów i odrzuca fabryki lambda
/// jako <c>ServiceLocationPolicy.NotAllowed</c> — patrz uzasadnienie przy
/// <c>IExecutionContext</c> w <see cref="ErpApiExtensions.AddErpApi"/>.</para>
///
/// <para>Błędy konwencji (klasa nazwana niezgodnie, brak znacznika) łapie walidacja kontenera,
/// którą <c>WebApplicationBuilder</c> włącza automatycznie w środowisku Development —
/// host nie wstanie, jeśli któraś zależność nie da się rozwiązać.</para>
/// </summary>
public static class ErpModuleRegistrationExtensions
{
    private static readonly Type CommandHandlerWithResult = typeof(ICommandHandler<,>);
    private static readonly Type CommandHandlerWithoutResult = typeof(ICommandHandler<>);
    private static readonly Type BatchRuleDefinition = typeof(IBatchRule<>);
    private static readonly Type ValidatorDefinition = typeof(IValidator<>);

    /// <summary>
    /// Skanuje zestawy modułu i rejestruje wykryte usługi jako <c>Scoped</c>.
    /// </summary>
    /// <param name="services">Kolekcja usług.</param>
    /// <param name="moduleAssemblies">Zestawy modułu — zwykle <c>{Modul}.Application</c>
    /// (komendy, handlery, reguły, walidatory) i <c>{Modul}.Infrastructure</c> (repozytoria,
    /// zapytania). Kolejność nie ma znaczenia; typy są zbierane ze wszystkich naraz, więc
    /// komenda może mieszkać w innym zestawie niż jej handler.</param>
    public static IServiceCollection AddErpModule(
        this IServiceCollection services,
        params Assembly[] moduleAssemblies)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(moduleAssemblies);

        if (moduleAssemblies.Length == 0)
        {
            throw new ArgumentException("Wymagany co najmniej jeden zestaw do skanowania.", nameof(moduleAssemblies));
        }

        var types = moduleAssemblies
            .SelectMany(assembly => assembly.GetTypes())
            .Where(type => type is { IsClass: true, IsAbstract: false, IsGenericTypeDefinition: false })
            .ToArray();

        // Zbiór komend, dla których w ogóle istnieje handler — tylko one dostaną egzekutora.
        // Rejestrowanie egzekutora dla komendy bez handlera dawałoby wpis, który wybucha
        // dopiero przy rozwiązywaniu, czyli w środku zadania masowego.
        var handledCommands = new HashSet<Type>();

        foreach (var type in types)
        {
            RegisterCommandHandlers(services, type, handledCommands);
            RegisterBatchValidation(services, type);
            RegisterCommandValidators(services, type);
            RegisterMatchingInterface(services, type);
        }

        foreach (var command in handledCommands.Where(IsAggregateCommand))
        {
            // Klucz musi się zgadzać z `BulkCommandExecutor.CommandType` i `Job.CommandType` —
            // to po nim runner odnajduje egzekutora dla zadania odczytanego z bazy.
            services.AddKeyedScoped(
                typeof(IBulkCommandExecutor),
                command.Name,
                typeof(BulkCommandExecutor<>).MakeGenericType(command));
        }

        return services;
    }

    /// <summary>
    /// Handler pod ZAMKNIĘTYM interfejsem <c>ICommandHandler&lt;TCommand, TResult&gt;</c>.
    /// FastEndpoints trzyma handlery we własnym rejestrze i tworzy je z root providera, przez co
    /// poza żądaniem HTTP nie da się wstrzyknąć niczego scoped — wpis w kontenerze sprawia,
    /// że handler powstaje w scope'ie runnera, razem z DbContextem tej samej transakcji.
    /// </summary>
    private static void RegisterCommandHandlers(
        IServiceCollection services,
        Type type,
        HashSet<Type> handledCommands)
    {
        foreach (var contract in type.GetInterfaces())
        {
            if (!contract.IsGenericType)
            {
                continue;
            }

            var definition = contract.GetGenericTypeDefinition();

            if (definition != CommandHandlerWithResult && definition != CommandHandlerWithoutResult)
            {
                continue;
            }

            services.TryAddScoped(contract, type);
            handledCommands.Add(contract.GetGenericArguments()[0]);
        }
    }

    /// <summary>
    /// Reguły wsadowe i ich kompozytory rejestrują się pod WŁASNYM typem, nie pod interfejsem:
    /// walidator wstrzykuje konkretne reguły (<c>ProductMustExistRule</c>), bo kolejność
    /// i dobór reguł dla operacji to decyzja przypadku użycia, a nie coś, co da się wyrazić
    /// przez <c>IEnumerable&lt;IBatchRule&lt;T&gt;&gt;</c>.
    /// </summary>
    private static void RegisterBatchValidation(IServiceCollection services, Type type)
    {
        var isRule = type.GetInterfaces()
            .Any(contract => contract.IsGenericType && contract.GetGenericTypeDefinition() == BatchRuleDefinition);

        if (isRule || typeof(IBatchValidator).IsAssignableFrom(type))
        {
            services.TryAddScoped(type);
        }
    }

    /// <summary>
    /// Walidatory wejścia komend (FluentValidation) pod ZAMKNIĘTYM <c>IValidator&lt;TCommand&gt;</c> —
    /// stąd bierze je <c>ValidationCommandMiddleware</c>.
    ///
    /// <para><c>TryAddEnumerable</c>, a nie <c>TryAddScoped</c>: dla jednej komendy może istnieć
    /// kilka walidatorów (np. reguły wspólne dla rodziny komend obok reguł tej jednej), a każdy
    /// z nich ma się wykonać. Wariant <c>TryAdd</c> zostawiłby po cichu pierwszy z brzegu —
    /// i nikt by nie zauważył, że druga połowa reguł nie działa.</para>
    ///
    /// <para>Walidator <b>abstrakcyjnej klasy bazowej</b> komend nie zostanie tu wykryty dla jej
    /// potomków: rozstrzyga zamknięty typ generyczny, a nie hierarchia. To jest świadome —
    /// middleware szuka dokładnie <c>IValidator&lt;TCommand&gt;</c> dla wysłanego typu.</para>
    /// </summary>
    private static void RegisterCommandValidators(IServiceCollection services, Type type)
    {
        foreach (var contract in type.GetInterfaces())
        {
            if (contract.IsGenericType && contract.GetGenericTypeDefinition() == ValidatorDefinition)
            {
                services.TryAddEnumerable(ServiceDescriptor.Scoped(contract, type));
            }
        }
    }

    /// <summary>
    /// Konwencja <c>I{Nazwa}</c> → <c>{Nazwa}</c>: <c>ProductRepository</c> rejestruje się jako
    /// <c>IProductRepository</c>. Świadomie wąska — dopasowuje wyłącznie interfejs o dokładnie
    /// tej nazwie, więc klasa implementująca <c>IHostedService</c> czy <c>IDisposable</c>
    /// nie zostanie przypadkiem wciągnięta pod obcy kontrakt.
    /// </summary>
    private static void RegisterMatchingInterface(IServiceCollection services, Type type)
    {
        var contract = Array.Find(
            type.GetInterfaces(),
            candidate => string.Equals(candidate.Name, "I" + type.Name, StringComparison.Ordinal));

        if (contract is not null)
        {
            services.TryAddScoped(contract, type);
        }
    }

    /// <summary>
    /// Czy komenda nadaje się na wsad — dokładnie ograniczenia
    /// <c>BulkCommandExecutor&lt;TCommand&gt;</c>. Komenda nieagregatowa (bez <c>Uuid</c>)
    /// albo bez konstruktora bezparametrowego nie da się odtworzyć z JSON-a elementu zadania,
    /// więc nie ma dla niej egzekutora — i nie powinno być.
    /// </summary>
    private static bool IsAggregateCommand(Type type)
        => typeof(IAggregateCommand).IsAssignableFrom(type)
           && typeof(ICommand<Guid>).IsAssignableFrom(type)
           && type is { IsClass: true, IsAbstract: false }
           && type.GetConstructor(Type.EmptyTypes) is not null;
}

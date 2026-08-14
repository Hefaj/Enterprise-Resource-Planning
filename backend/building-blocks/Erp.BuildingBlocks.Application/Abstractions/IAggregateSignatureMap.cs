using Erp.BuildingBlocks.Contracts;

namespace Erp.BuildingBlocks.Application.Abstractions;

/// <summary>
/// Mapa: typ CLR korzenia agregatu → sygnatura kanału synchronizacji
/// (<see cref="AggregateSignatures"/>).
///
/// Dzięki niej zdarzenie <see cref="AggregateChanged"/> powstaje <b>automatycznie z ChangeTrackera
/// EF Core</b>, a nie z ręcznie pisanego mapowania per zdarzenie domenowe. To świadoma decyzja:
/// gdyby każda komenda musiała pamiętać o wypchnięciu „ten uuid się zmienił”, prędzej czy później
/// ktoś by o tym zapomniał przy nowej komendzie — i objawiłoby się to jako cicho nieodświeżający
/// się interfejs u użytkownika, czyli najgorszy rodzaj błędu: bez wyjątku, bez logu, bez testu,
/// który by go złapał.
///
/// Przy podejściu z ChangeTrackera zapis agregatu <i>z definicji</i> generuje powiadomienie —
/// nie da się tego pominąć, nie pomijając zapisu.
///
/// Zdarzenia domenowe (<see cref="Erp.BuildingBlocks.Domain.IDomainEvent"/>) zostają dla
/// reakcji biznesowych („zmieniła się cena → przelicz X”), a nie dla samego faktu „coś się zmieniło”.
/// </summary>
public interface IAggregateSignatureMap
{
    /// <summary>Zwraca sygnaturę dla typu agregatu albo <c>false</c>, jeśli dany agregat
    /// nie jest synchronizowany do klientów (np. byt czysto wewnętrzny).</summary>
    bool TryGetSignature(Type aggregateType, out string signature);
}

/// <summary>
/// Prosta implementacja oparta o słownik — moduł rejestruje w niej swoje agregaty przy starcie.
/// </summary>
public sealed class AggregateSignatureMap : IAggregateSignatureMap
{
    private readonly Dictionary<Type, string> _signatures = [];

    /// <summary>Rejestruje agregat pod daną sygnaturą.</summary>
    /// <exception cref="ArgumentException">Sygnatura spoza <see cref="AggregateSignatures.All"/>
    /// — literówka w sygnaturze oznaczałaby rozgłaszanie na kanał, którego nikt nie słucha,
    /// więc odrzucamy ją przy starcie, a nie w czasie działania.</exception>
    public AggregateSignatureMap Register<TAggregate>(string signature)
        where TAggregate : Erp.BuildingBlocks.Domain.AggregateRoot
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(signature);

        if (!AggregateSignatures.All.Contains(signature))
        {
            throw new ArgumentException(
                $"Sygnatura '{signature}' nie jest znana. Dodaj ją do {nameof(AggregateSignatures)} " +
                "i upewnij się, że zgadza się z `signalrSignature` odpowiedniego orkiestratora na frontendzie.",
                nameof(signature));
        }

        _signatures[typeof(TAggregate)] = signature;
        return this;
    }

    /// <inheritdoc />
    public bool TryGetSignature(Type aggregateType, out string signature)
    {
        ArgumentNullException.ThrowIfNull(aggregateType);

        // Typy proxy EF Core dziedziczą po encji — dlatego szukamy też w górę hierarchii.
        for (var type = aggregateType; type is not null; type = type.BaseType)
        {
            if (_signatures.TryGetValue(type, out var found))
            {
                signature = found;
                return true;
            }
        }

        signature = string.Empty;
        return false;
    }
}

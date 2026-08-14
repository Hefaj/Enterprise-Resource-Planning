namespace Erp.BuildingBlocks.Application.Abstractions;

/// <summary>
/// Źródło czasu. Istnieje po to, żeby żaden kod domenowy ani aplikacyjny nie wołał
/// <c>DateTimeOffset.UtcNow</c> bezpośrednio — inaczej reguły zależne od czasu
/// (wygaśnięcie zadania, <c>AvailableFrom</c> produktu, okna ważności) są nietestowalne
/// bez czekania albo bez zmiany zegara systemowego.
/// </summary>
public interface IClock
{
    /// <summary>Bieżący czas UTC.</summary>
    DateTimeOffset UtcNow { get; }
}

/// <summary>Implementacja produkcyjna — czas systemowy.</summary>
public sealed class SystemClock : IClock
{
    /// <inheritdoc />
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}

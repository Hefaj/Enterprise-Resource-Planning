namespace Notification.Infrastructure.Realtime;

/// <summary>
/// Trwały licznik sekwencji realtime — patrz <see cref="SignatureSequence"/>.
///
/// <para>Interfejs, a nie sama klasa, bo korzystają z niego dwie strony o różnych rolach:
/// przekaźnik (zwiększa) i hub (odczytuje przy <c>Subscribe</c>). Po rozdzieleniu ról
/// każda z nich może chodzić w innym procesie.</para>
/// </summary>
public interface ISignatureSequenceStore
{
    /// <summary>Zwiększa licznik sygnatury o jeden i zwraca nową wartość.</summary>
    Task<long> NextAsync(string signature, CancellationToken cancellationToken);

    /// <summary>Aktualna wartość licznika; <c>0</c>, gdy dla tej sygnatury nic jeszcze nie nadeszło.</summary>
    Task<long> CurrentAsync(string signature, CancellationToken cancellationToken);
}

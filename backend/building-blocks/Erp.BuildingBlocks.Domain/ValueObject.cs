namespace Erp.BuildingBlocks.Domain;

/// <summary>
/// Value object — byt bez tożsamości, porównywany po wartości (kwota z walutą, adres, zakres dat).
/// Odwrotność <see cref="Entity"/>: dwie instancje o tych samych składowych SĄ tym samym.
///
/// Kiedy value object, a kiedy encja: jeśli zmiana pola oznacza „to teraz co innego” — value object
/// (jest niemutowalny, podmienia się go w całości). Jeśli oznacza „to samo, tylko zmienione” — encja.
///
/// Po stronie EF mapowane zwykle jako owned entity (<c>OwnsOne</c>/<c>OwnsMany</c>), więc nie mają
/// własnej tabeli ani własnego klucza — to jest właśnie ten przypadek, o którym mówi sekcja 9
/// `docs/guides/frontend/orchestrators.md`: własne ID w bazie nie czyni z czegoś agregatu.
/// </summary>
public abstract class ValueObject : IEquatable<ValueObject>
{
    /// <summary>Składowe decydujące o równości — w stałej kolejności.</summary>
    protected abstract IEnumerable<object?> GetEqualityComponents();

    public bool Equals(ValueObject? other)
    {
        if (other is null)
        {
            return false;
        }

        if (ReferenceEquals(this, other))
        {
            return true;
        }

        return GetType() == other.GetType()
            && GetEqualityComponents().SequenceEqual(other.GetEqualityComponents());
    }

    public override bool Equals(object? obj) => Equals(obj as ValueObject);

    public override int GetHashCode()
    {
        var hash = new HashCode();
        hash.Add(GetType());
        foreach (var component in GetEqualityComponents())
        {
            hash.Add(component);
        }

        return hash.ToHashCode();
    }

    public static bool operator ==(ValueObject? left, ValueObject? right) => Equals(left, right);

    public static bool operator !=(ValueObject? left, ValueObject? right) => !Equals(left, right);
}

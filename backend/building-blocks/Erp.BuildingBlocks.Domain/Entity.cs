namespace Erp.BuildingBlocks.Domain;

/// <summary>
/// Baza dla wszystkich encji domenowych. Tożsamość niesie <see cref="Uuid"/> — celowo
/// <c>Guid</c>, a nie sztuczny klucz <c>int</c>, bo identyfikator agregatu jest częścią
/// kontraktu z frontendem (orkiestratory adresują agregaty po <c>uuid</c>: `IdentityMapStore`,
/// `SearchResponse.Uuids`, sygnatury SignalR).
///
/// Nowe identyfikatory generuje <see cref="NewUuid"/> jako <b>UUID v7</b> — sekwencyjny po czasie,
/// więc wstawki nie fragmentują indeksu B-tree tak jak losowy v4. Przy tabelach rzędu setek tysięcy
/// wierszy to różnica między zdrowym a rozjeżdżającym się indeksem klucza głównego.
///
/// Równość jest po tożsamości, nie po wartości: dwie instancje tego samego agregatu wczytane
/// w dwóch miejscach to ten sam byt domenowy. Value objecty mają odwrotną semantykę — patrz
/// <see cref="ValueObject"/>.
/// </summary>
public abstract class Entity : IEquatable<Entity>
{
    /// <summary>Tożsamość encji. <c>protected set</c>, żeby ustawiał ją wyłącznie konstruktor
    /// agregatu albo materializacja EF — nigdy kod aplikacyjny z zewnątrz.</summary>
    public Guid Uuid { get; protected set; }

    protected Entity(Guid uuid)
    {
        if (uuid == Guid.Empty)
        {
            throw new ArgumentException("Uuid encji nie może być pusty.", nameof(uuid));
        }

        Uuid = uuid;
    }

    /// <summary>Konstruktor dla EF Core (materializacja z bazy) — nie używać w kodzie domenowym.</summary>
    protected Entity()
    {
    }

    /// <summary>Generuje nowy, sekwencyjny identyfikator (UUID v7).</summary>
    public static Guid NewUuid() => Guid.CreateVersion7();

    public bool Equals(Entity? other)
    {
        if (other is null)
        {
            return false;
        }

        if (ReferenceEquals(this, other))
        {
            return true;
        }

        // Encje różnych typów o tym samym Uuid to różne byty — porównanie typu jest istotne.
        if (GetType() != other.GetType())
        {
            return false;
        }

        // Encja nieutrwalona (Uuid == Empty) jest równa wyłącznie samej sobie referencyjnie.
        return Uuid != Guid.Empty && Uuid == other.Uuid;
    }

    public override bool Equals(object? obj) => Equals(obj as Entity);

    public override int GetHashCode() => HashCode.Combine(GetType(), Uuid);

    public static bool operator ==(Entity? left, Entity? right) => Equals(left, right);

    public static bool operator !=(Entity? left, Entity? right) => !Equals(left, right);
}

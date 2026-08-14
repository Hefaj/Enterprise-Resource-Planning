using Erp.BuildingBlocks.Domain;

namespace Catalog.Domain.Categories;

/// <summary>
/// Kategoria katalogu — węzeł drzewa o dowolnej głębokości.
///
/// Hierarchia jest tu wyrażona pojedynczym <see cref="ParentUuid"/>, a nie referencją do obiektu
/// rodzica ani kolekcją dzieci. To celowe: drzewo kategorii liczy w tym systemie setki tysięcy
/// węzłów, więc nawigacja obiektowa oznaczałaby albo lazy loading (N+1 przy każdym przejściu),
/// albo ładowanie poddrzewa do pamięci. Zapytania o strukturę (dzieci, potomkowie, przodkowie)
/// obsługuje tabela domknięcia po stronie infrastruktury — patrz <c>CategoryClosureEntry</c>.
/// </summary>
public class Category : AggregateRoot
{
    /// <summary>Konstruktor dla EF Core.</summary>
    protected Category()
    {
    }

    private Category(Guid uuid, string name, Guid? parentUuid) : base(uuid)
    {
        Name = name;
        ParentUuid = parentUuid;
    }

    public string Name { get; private set; } = string.Empty;

    /// <summary>Rodzic w drzewie; <c>null</c> dla korzenia.</summary>
    public Guid? ParentUuid { get; private set; }

    public static Category Create(string name, Guid? parentUuid = null)
        => new(NewUuid(), Validate(name), parentUuid);

    /// <summary>Odtwarza kategorię o znanym identyfikatorze — wyłącznie dla seedera,
    /// który musi wygenerować powtarzalne dane między resetami bazy.</summary>
    public static Category CreateWithUuid(Guid uuid, string name, Guid? parentUuid = null)
        => new(uuid, Validate(name), parentUuid);

    public void Rename(string name)
    {
        var validated = Validate(name);
        if (string.Equals(Name, validated, StringComparison.Ordinal))
        {
            return;
        }

        Name = validated;
    }

    /// <summary>
    /// Przenosi kategorię pod innego rodzica.
    ///
    /// Wykrycie cyklu (przeniesienie węzła pod własnego potomka) NIE należy do agregatu —
    /// wymaga znajomości całego poddrzewa, której pojedynczy węzeł nie ma i mieć nie powinien.
    /// Sprawdza to handler komendy, odpytując tabelę domknięcia jednym zapytaniem.
    /// </summary>
    public void MoveTo(Guid? newParentUuid)
    {
        if (newParentUuid == Uuid)
        {
            throw new DomainException("category_self_parent", "Kategoria nie może być własnym rodzicem.");
        }

        ParentUuid = newParentUuid;
    }

    private static string Validate(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainException("category_name_empty", "Nazwa kategorii nie może być pusta.");
        }

        return name.Trim();
    }
}

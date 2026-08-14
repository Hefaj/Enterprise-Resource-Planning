using Erp.BuildingBlocks.Domain;

namespace Catalog.Domain.Warranties;

/// <summary>
/// Pozycja katalogu gwarancji — definicja gwarancji ze standardowym okresem.
///
/// Uwaga na rozróżnienie: <see cref="DurationMonths"/> to okres <i>katalogowy</i>. Okres
/// faktycznie przypisany do konkretnego produktu żyje w <c>ProductWarranty</c> i bywa inny
/// (np. wydłużony w promocji). Dlatego produkt nie odwołuje się do tej wartości, tylko trzyma
/// własną kopię — inaczej zmiana definicji w katalogu po cichu przepisałaby historię
/// wszystkich produktów, które ją kiedykolwiek dostały.
/// </summary>
public class Warranty : AggregateRoot
{
    /// <summary>Konstruktor dla EF Core.</summary>
    protected Warranty()
    {
    }

    private Warranty(Guid uuid, string name, int durationMonths, string description) : base(uuid)
    {
        Name = name;
        DurationMonths = durationMonths;
        Description = description;
    }

    public string Name { get; private set; } = string.Empty;

    /// <summary>Standardowy okres gwarancji w miesiącach.</summary>
    public int DurationMonths { get; private set; }

    public string Description { get; private set; } = string.Empty;

    public static Warranty Create(string name, int durationMonths, string description)
        => new(NewUuid(), Validate(name), ValidateDuration(durationMonths), description ?? string.Empty);

    /// <inheritdoc cref="Categories.Category.CreateWithUuid"/>
    public static Warranty CreateWithUuid(Guid uuid, string name, int durationMonths, string description)
        => new(uuid, Validate(name), ValidateDuration(durationMonths), description ?? string.Empty);

    private static string Validate(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainException("warranty_name_empty", "Nazwa gwarancji nie może być pusta.");
        }

        return name.Trim();
    }

    private static int ValidateDuration(int durationMonths)
    {
        if (durationMonths <= 0)
        {
            throw new DomainException("warranty_duration_invalid", "Okres gwarancji musi być dodatni.");
        }

        return durationMonths;
    }
}

using Erp.BuildingBlocks.Domain;

namespace Catalog.Domain.Models;

/// <summary>
/// Model produktu — słownikowa pozycja grupująca warianty (np. „iPhone 15” dla wielu SKU).
///
/// Nazwa klasy to <c>ProductModel</c>, a nie <c>Model</c>, mimo że kontrakt API mówi
/// <c>ModelDto</c>/<c>searchModel</c>: samo „Model” zderza się z pojęciem modelu EF Core
/// (<c>ModelBuilder</c>, <c>IModel</c>) i w warstwie infrastruktury byłoby stale mylące.
/// Kontrakt HTTP pozostaje nietknięty.
/// </summary>
public class ProductModel : AggregateRoot
{
    /// <summary>Konstruktor dla EF Core.</summary>
    protected ProductModel()
    {
    }

    private ProductModel(Guid uuid, string name) : base(uuid) => Name = name;

    public string Name { get; private set; } = string.Empty;

    public static ProductModel Create(string name) => new(NewUuid(), Validate(name));

    /// <inheritdoc cref="Categories.Category.CreateWithUuid"/>
    public static ProductModel CreateWithUuid(Guid uuid, string name) => new(uuid, Validate(name));

    public void Rename(string name) => Name = Validate(name);

    private static string Validate(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainException("model_name_empty", "Nazwa modelu nie może być pusta.");
        }

        return name.Trim();
    }
}

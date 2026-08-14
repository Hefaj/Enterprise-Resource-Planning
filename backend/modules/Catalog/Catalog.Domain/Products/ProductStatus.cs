namespace Catalog.Domain.Products;

/// <summary>
/// Status produktu w katalogu.
///
/// W kontrakcie HTTP <c>ProductDto.Status</c> jest stringiem („Draft”/„Aktywny”) i taki zostaje —
/// projekcja zapytania tłumaczy enum na tę wartość. W domenie enum, bo status steruje regułami
/// (produkt w wersji roboczej nie jest dostępny do sprzedaży), a reguła oparta na porównywaniu
/// napisów jest regułą, którą prędzej czy później rozjedzie literówka.
/// </summary>
public enum ProductStatus
{
    /// <summary>Wersja robocza — niewidoczna w sprzedaży.</summary>
    Draft = 0,

    /// <summary>Aktywny — dostępny w sprzedaży.</summary>
    Active = 1,
}

/// <summary>Tłumaczenie <see cref="ProductStatus"/> na wartości kontraktu HTTP.</summary>
public static class ProductStatusNames
{
    /// <summary>Etykieta statusu roboczego w kontrakcie API.</summary>
    public const string Draft = "Draft";

    /// <summary>Etykieta statusu aktywnego w kontrakcie API.</summary>
    public const string Active = "Aktywny";

    /// <summary>Zamienia status na wartość zwracaną w <c>ProductDto.Status</c>.</summary>
    public static string ToContract(this ProductStatus status)
        => status == ProductStatus.Active ? Active : Draft;
}

namespace Sales.Infrastructure.Seed;

/// <summary>Konfiguracja danych startowych; sekcja <c>Seed</c> w appsettings.</summary>
public sealed class SalesSeedOptions
{
    /// <summary>Nazwa sekcji konfiguracji.</summary>
    public const string SectionName = "Seed";

    /// <summary>Czy zasilać bazę danymi przykładowymi. Domyślnie włączone tylko w Development.</summary>
    public bool Enabled { get; set; }
}

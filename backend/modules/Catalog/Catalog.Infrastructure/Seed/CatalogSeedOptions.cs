namespace Catalog.Infrastructure.Seed;

/// <summary>Rozmiar syntetycznej gałęzi drzewa kategorii.</summary>
public enum CategoryTreeProfile
{
    /// <summary>Bez gałęzi syntetycznej — tylko ~90 ręcznie nazwanych kategorii.</summary>
    None = 0,

    /// <summary>
    /// ~180 tys. węzłów (50 × 600 × 5). Domyślny profil deweloperski.
    ///
    /// Środkowy poziom (600 dzieci) świadomie przekracza domyślny <c>pageSize</c> = 50
    /// w <c>getCategoryChildren</c>, więc wymusza scenariusz „load more” w <c>erp-tree</c> —
    /// a to on jest przedmiotem testu, nie liczba liści.
    /// </summary>
    Small = 1,

    /// <summary>
    /// ~9,03 mln węzłów (50 × 600 × 300) — wolumen, jaki generował poprzedni mock in-memory.
    /// Wyłącznie do testów wydajnościowych: tabela domknięcia urasta do dziesiątek milionów
    /// wierszy, a seed liczy się w minutach.
    /// </summary>
    Stress = 2,
}

/// <summary>Konfiguracja danych startowych; sekcja <c>Seed</c> w appsettings.</summary>
public sealed class CatalogSeedOptions
{
    /// <summary>Nazwa sekcji konfiguracji.</summary>
    public const string SectionName = "Seed";

    /// <summary>Czy zasilać bazę danymi przykładowymi. Domyślnie włączone tylko w Development.</summary>
    public bool Enabled { get; set; }

    /// <summary>Profil syntetycznej gałęzi drzewa kategorii.</summary>
    public CategoryTreeProfile TreeProfile { get; set; } = CategoryTreeProfile.Small;

    public int ProductCount { get; set; } = 1500;

    public int ModelCount { get; set; } = 15;

    public int WarrantyCount { get; set; } = 150;

    /// <summary>
    /// Ziarno generatora losowego. Stała wartość jest celowa: poprzedni mock używał
    /// <c>Guid.NewGuid()</c> i <c>new Random()</c>, więc każdy restart procesu dawał inne
    /// identyfikatory i inne dane. Przy realnej bazie oznaczałoby to, że zakładka przeglądarki
    /// otwarta przed resetem wskazuje na produkty, których już nie ma, a testów nie da się
    /// oprzeć na konkretnym rekordzie.
    /// </summary>
    public int RandomSeed { get; set; } = 20260814;
}

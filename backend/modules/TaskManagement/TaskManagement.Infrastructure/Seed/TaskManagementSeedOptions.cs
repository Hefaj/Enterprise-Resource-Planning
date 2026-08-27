namespace TaskManagement.Infrastructure.Seed;

/// <summary>Konfiguracja danych startowych; sekcja <c>Seed</c> w appsettings.</summary>
public sealed class TaskManagementSeedOptions
{
    /// <summary>Nazwa sekcji konfiguracji.</summary>
    public const string SectionName = "Seed";

    /// <summary>Czy zasilać bazę danymi przykładowymi. Domyślnie włączone tylko w Development.</summary>
    public bool Enabled { get; set; }

    /// <summary>
    /// Użytkownik dopisywany jako <c>Lead</c> obu projektów przykładowych.
    ///
    /// <para>Bez tego seed daje projekty, których nikt nie widzi: predykat widoczności wymaga
    /// członkostwa albo projektu publicznego, a świeżo zalogowany użytkownik nie jest członkiem
    /// niczego. Projekty przykładowe są dlatego publiczne, a ta opcja pozwala dodatkowo wskazać
    /// konkretną osobę — przydatne przy sprawdzaniu zakresu „Moje”.</para>
    /// </summary>
    public Guid? LeadUserUuid { get; set; }
}

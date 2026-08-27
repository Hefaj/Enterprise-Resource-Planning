namespace TaskManagement.Domain.Projects;

/// <summary>
/// Licznik numeracji zgłoszeń projektu — jedyne miejsce w tej architekturze, gdzie potrzebna
/// jest monotoniczna sekwencja per encja (<c>docs/backend/task-management.md</c> §4).
///
/// <para><b>Celowo nie jest agregatem.</b> Nie ma reguł biznesowych i nie wolno go czytać
/// przez śledzenie zmian EF: numer nadaje się jednym <c>UPDATE … RETURNING</c> w tej samej
/// transakcji, co zapis zgłoszenia. Wczytanie licznika do pamięci i zapisanie go z powrotem
/// jest dokładnie tym wyścigiem, przed którym ta konstrukcja chroni — dwie instancje wyliczą
/// ten sam numer, a druga dostanie naruszenie unikalności na <c>issue.key</c>.</para>
///
/// <para>Prefiks jest tu skopiowany z projektu, a nie czytany z niego przez join, bo zmiana
/// kodu projektu <b>nie przenumerowuje</b> istniejących zgłoszeń — nowe dostają nowy prefiks,
/// stare zachowują swoje klucze.</para>
/// </summary>
public sealed class ProjectKeyCounter
{
    /// <summary>Konstruktor dla EF Core.</summary>
    private ProjectKeyCounter()
    {
    }

    private ProjectKeyCounter(Guid projectUuid, string prefix, int nextNumber)
    {
        ProjectUuid = projectUuid;
        Prefix = prefix;
        NextNumber = nextNumber;
    }

    public Guid ProjectUuid { get; private set; }

    public string Prefix { get; private set; } = string.Empty;

    /// <summary>Numer, który dostanie <b>następne</b> zgłoszenie. Zmieniany wyłącznie
    /// zapytaniem <c>UPDATE … RETURNING</c> po stronie infrastruktury.</summary>
    public int NextNumber { get; private set; }

    public static ProjectKeyCounter Create(Guid projectUuid, string prefix)
        => new(projectUuid, prefix, 1);
}

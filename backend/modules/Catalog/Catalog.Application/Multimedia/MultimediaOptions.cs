namespace Catalog.Application.Multimedia;

/// <summary>
/// Polityka modułu wobec plików wgrywanych przez użytkownika, sekcja <c>Multimedia</c>.
///
/// <para><b>Dlaczego tutaj, a nie w opcjach magazynu.</b> „Jak duże może być zdjęcie produktu"
/// jest decyzją katalogu, a nie magazynu — inny moduł trzymający skany faktur odpowie na to
/// pytanie inaczej, choć korzysta z tej samej biblioteki.</para>
/// </summary>
public sealed class MultimediaOptions
{
    /// <summary>Nazwa sekcji konfiguracji.</summary>
    public const string SectionName = "Multimedia";

    /// <summary>
    /// Górny limit rozmiaru jednego pliku, w bajtach.
    ///
    /// <para><b>Sprawdzany po transferze, nie przed nim</b> — i to jest cena wgrywania prosto
    /// do magazynu. Presigned <c>PUT</c> nie da się ograniczyć nagłówkiem
    /// <c>content-length-range</c>; potrafi to wyłącznie presigned <c>POST</c> z polityką.
    /// Plik ponad limit trafia więc na dysk magazynu, ale nigdy nie zostaje zarejestrowany
    /// w katalogu ani przeniesiony spod prefiksu postojowego — komenda kasuje go od razu,
    /// nie czekając na regułę wygasania.</para>
    /// </summary>
    public long MaxFileSizeBytes { get; set; } = 256L * 1024 * 1024;

    /// <summary>Górna granica jednej paczki biletów wgrywania i jednej paczki rejestracji.</summary>
    public int MaxFilesPerRequest { get; set; } = 100;
}

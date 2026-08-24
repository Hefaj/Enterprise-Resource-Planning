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

    /// <summary>Dłuższa krawędź miniaturki — rozmiar komórki tabeli z zapasem na ekrany HiDPI.</summary>
    public int ThumbnailMaxEdge { get; set; } = 256;

    /// <summary>Dłuższa krawędź podglądu — tyle, ile potrzebuje modal z powiększeniem.</summary>
    public int PreviewMaxEdge { get; set; } = 1024;

    /// <summary>Jakość kompresji wariantów (WebP), 1–100.</summary>
    public int DerivativeQuality { get; set; } = 80;

    /// <summary>
    /// Powyżej jakiego rozmiaru oryginału odpuszczamy generowanie wariantów.
    ///
    /// <para>Dekoder musi mieć cały obraz w pamięci, a rozpakowana bitmapa jest **wielokrotnie
    /// większa niż plik** — 100 MB skompresowanego TIFF-a to kilka gigabajtów pikseli. Bez tego
    /// progu jeden nietypowy plik potrafi wywrócić proces API, w którym akurat leci generowanie.
    /// Zasób ponad próg dostaje w UI ikonę typu zamiast miniaturki, tak jak wideo.</para>
    /// </summary>
    public long MaxDerivativeSourceBytes { get; set; } = 48L * 1024 * 1024;
}

/// <summary>
/// Nazwy wariantów pochodnych. Wchodzą do klucza obiektu w magazynie i do trasy endpointu,
/// więc są <b>kontraktem</b> — zmiana nazwy osierociłaby wszystkie dotychczas wygenerowane pliki.
/// </summary>
public static class MultimediaVariants
{
    /// <summary>Miniaturka do komórki tabeli i kafelka galerii.</summary>
    public const string Thumb = "thumb";

    /// <summary>Podgląd do modalu — większy niż miniaturka, mniejszy niż oryginał.</summary>
    public const string Preview = "preview";

    /// <summary>Warianty dopuszczone przez endpoint zawartości.</summary>
    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        Thumb,
        Preview,
    };
}

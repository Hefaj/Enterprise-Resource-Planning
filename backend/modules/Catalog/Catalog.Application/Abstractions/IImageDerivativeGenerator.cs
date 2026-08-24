namespace Catalog.Application.Abstractions;

/// <summary>Gotowy wariant pochodny obrazu.</summary>
/// <param name="Content">Zakodowana zawartość — warianty są małe, więc mieszczą się w pamięci.</param>
/// <param name="ContentType">Typ MIME wariantu, niekoniecznie ten sam co oryginału.</param>
/// <param name="Width">Szerokość po przeskalowaniu.</param>
/// <param name="Height">Wysokość po przeskalowaniu.</param>
public sealed record ImageDerivative(byte[] Content, string ContentType, int Width, int Height);

/// <summary>
/// Skalowanie obrazów do wariantów pochodnych (miniaturka, podgląd).
///
/// <para>Abstrakcja istnieje po to, żeby warstwa <c>Application</c> nie zależała od biblioteki
/// graficznej — tak samo jak nie zależy od EF Core czy Wolverine'a. Implementacja
/// (<c>SkiaSharp</c>) żyje w <c>Catalog.Infrastructure</c>.</para>
///
/// <para><b>Synchroniczne celowo.</b> Skalowanie to praca procesora, nie oczekiwanie na I/O —
/// opakowanie go w <c>Task</c> udawałoby asynchroniczność, której tu nie ma, i zaciemniało
/// fakt, że ta metoda zajmuje rdzeń na cały czas wykonania.</para>
/// </summary>
public interface IImageDerivativeGenerator
{
    /// <summary>
    /// Skaluje obraz tak, by dłuższa krawędź nie przekraczała <paramref name="maxEdge"/>,
    /// zachowując proporcje. Zwraca <c>null</c>, gdy zawartości nie da się zdekodować jako obrazu.
    ///
    /// <para><b>Obraz mniejszy niż <paramref name="maxEdge"/> też jest przetwarzany</b> —
    /// nie po to, żeby go powiększyć (nie jest powiększany), tylko żeby wariant zawsze istniał
    /// i zawsze był w tym samym formacie. Wariant warunkowy zmuszałby każdego konsumenta do
    /// obsługi obu przypadków.</para>
    /// </summary>
    /// <param name="source">Zawartość oryginału. Bufor, a nie strumień: dekoder i tak potrzebuje
    /// dostępu swobodnego, a wołający musiał wcześniej ściągnąć plik z magazynu w całości —
    /// przyjmowanie strumienia udawałoby, że da się tu pracować przyrostowo.</param>
    /// <param name="maxEdge">Górna granica dłuższej krawędzi w pikselach.</param>
    /// <param name="quality">Jakość kompresji stratnej, 1–100.</param>
    ImageDerivative? Create(ReadOnlyMemory<byte> source, int maxEdge, int quality);
}

using Catalog.Infrastructure.Media;
using Shouldly;
using SkiaSharp;
using Xunit;

namespace Catalog.Tests;

/// <summary>
/// Generator miniaturek na SkiaSharp.
///
/// <para>Te testy robią przy okazji rzecz, której nie robi żaden inny: <b>dowodzą, że natywna
/// biblioteka Skii w ogóle się ładuje</b>. Brakujące <c>libSkiaSharp.so</c> nie objawia się przy
/// starcie modułu ani przy kompilacji — dopiero przy pierwszym wgranym zdjęciu, w konsumencie
/// działającym w tle, czyli tam, gdzie nikt nie patrzy.</para>
/// </summary>
public class ImageDerivativeGeneratorTests
{
    private static readonly ImageDerivativeGenerator Generator = new();

    /// <summary>Obraz testowy o zadanych wymiarach, zakodowany jako PNG.</summary>
    private static byte[] Png(int width, int height)
    {
        using var bitmap = new SKBitmap(width, height);
        using var canvas = new SKCanvas(bitmap);

        canvas.Clear(SKColors.CornflowerBlue);

        // Plama w rogu: bez niej obraz jest jednolity i każdy błąd obrotu wygląda tak samo
        // jak poprawny wynik.
        using var paint = new SKPaint { Color = SKColors.Orange };
        canvas.DrawRect(0, 0, width / 4f, height / 4f, paint);
        canvas.Flush();

        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(SKEncodedImageFormat.Png, 100);

        return data.ToArray();
    }

    [Fact]
    public void Obraz_jest_skalowany_do_zadanej_dluzszej_krawedzi()
    {
        var result = Generator.Create(Png(3840, 2160), maxEdge: 256, quality: 80);

        result.ShouldNotBeNull();
        result.Width.ShouldBe(256);

        // Proporcje 16:9 zachowane — miniaturka nie jest przycinana ani rozciągana.
        result.Height.ShouldBe(144);
        result.ContentType.ShouldBe("image/webp");
    }

    /// <summary>
    /// Miniaturka ma być ułamkiem oryginału — to jest cały powód, dla którego ten kod istnieje.
    /// Test na konkretnej liczbie, a nie na „mniejsza niż", bo regres tego rodzaju (np. zapis
    /// bez kompresji) dałby plik wciąż mniejszy od oryginału i przeszedłby niezauważony.
    /// </summary>
    [Fact]
    public void Miniaturka_wazy_ulamek_oryginalu()
    {
        var original = Png(3840, 2160);

        var result = Generator.Create(original, maxEdge: 256, quality: 80);

        result.ShouldNotBeNull();
        result.Content.Length.ShouldBeLessThan(original.Length / 20);
    }

    [Fact]
    public void Obraz_mniejszy_niz_limit_nie_jest_powiekszany()
    {
        var result = Generator.Create(Png(64, 48), maxEdge: 256, quality: 80);

        result.ShouldNotBeNull();
        result.Width.ShouldBe(64);
        result.Height.ShouldBe(48);
    }

    /// <summary>
    /// Panorama 8000×20 przy limicie 256 daje wysokość 0,64 px. Bez podłogi na 1 px wymiar
    /// zaokrągliłby się do zera, a <c>Resize</c> zwróciłby <c>null</c> — czyli zasób bez
    /// miniaturki i ostrzeżenie w logu zamiast obrazka.
    /// </summary>
    [Fact]
    public void Skrajnie_wydluzony_obraz_nie_daje_wymiaru_zerowego()
    {
        var result = Generator.Create(Png(8000, 20), maxEdge: 256, quality: 80);

        result.ShouldNotBeNull();
        result.Width.ShouldBe(256);
        result.Height.ShouldBeGreaterThanOrEqualTo(1);
    }

    [Fact]
    public void Zawartosc_ktorej_nie_da_sie_zdekodowac_nie_wywraca_generatora()
    {
        var result = Generator.Create("to nie jest obraz"u8.ToArray(), maxEdge: 256, quality: 80);

        result.ShouldBeNull();
    }

    [Fact]
    public void Pusta_zawartosc_nie_wywraca_generatora()
    {
        Generator.Create(ReadOnlyMemory<byte>.Empty, maxEdge: 256, quality: 80).ShouldBeNull();
    }
}

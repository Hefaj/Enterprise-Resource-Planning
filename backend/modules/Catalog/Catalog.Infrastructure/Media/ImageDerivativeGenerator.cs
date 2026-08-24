using Catalog.Application.Abstractions;
using SkiaSharp;

namespace Catalog.Infrastructure.Media;

/// <summary>
/// <see cref="IImageDerivativeGenerator"/> na SkiaSharp.
///
/// <para><b>Dlaczego SkiaSharp, a nie ImageSharp.</b> ImageSharp od v3 chodzi na Six Labors
/// Split License z progiem przychodowym — czyli tej samej klasie zależności, którą ten projekt
/// odrzucił już dwa razy (MassTransit v9, MediatR v13; patrz
/// <c>docs/backend/architecture.md</c> §4). SkiaSharp to MIT nad Skia na BSD-3, utrzymywane
/// przez Microsoft.</para>
///
/// <para><b>WebP, nie JPEG.</b> Przy tej samej postrzeganej jakości daje ok. 30% mniejszy plik,
/// a miniaturka jest pobierana raz na wiersz tabeli — to jest dokładnie ten rozmiar, na którym
/// procent robi różnicę. Wariantu nie pobiera nikt poza naszym UI, więc zgodność wstecz
/// z bardzo starymi przeglądarkami nie jest tu argumentem.</para>
/// </summary>
public sealed class ImageDerivativeGenerator : IImageDerivativeGenerator
{
    private const string WebpContentType = "image/webp";

    /// <inheritdoc />
    public ImageDerivative? Create(ReadOnlyMemory<byte> source, int maxEdge, int quality)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(maxEdge);

        if (source.IsEmpty)
        {
            return null;
        }

        using var data = SKData.CreateCopy(source.Span);

        // Orientację czytamy z kodeka, a nie z bitmapy: `SKBitmap.Decode` NIE stosuje obrotu
        // z EXIF-a. Bez tego kroku każde zdjęcie z telefonu trzymanego pionowo daje miniaturkę
        // położoną na boku — przy oryginale wyświetlanym poprawnie, bo EXIF honoruje przeglądarka.
        // Objaw wygląda wtedy na błąd skalowania, a jest błędem odczytu.
        using var codec = SKCodec.Create(data);

        if (codec is null)
        {
            return null;
        }

        using var decoded = SKBitmap.Decode(codec);

        if (decoded is null)
        {
            return null;
        }

        using var upright = ApplyOrigin(decoded, codec.EncodedOrigin);
        var (width, height) = Scale(upright.Width, upright.Height, maxEdge);

        using var resized = upright.Resize(
            new SKImageInfo(width, height, upright.ColorType, upright.AlphaType),
            new SKSamplingOptions(SKCubicResampler.Mitchell));

        if (resized is null)
        {
            return null;
        }

        using var image = SKImage.FromBitmap(resized);
        using var encoded = image.Encode(SKEncodedImageFormat.Webp, Math.Clamp(quality, 1, 100));

        return encoded is null
            ? null
            : new ImageDerivative(encoded.ToArray(), WebpContentType, width, height);
    }

    /// <summary>
    /// Skaluje w dół do <paramref name="maxEdge"/> na dłuższej krawędzi. <b>Nigdy nie powiększa</b>:
    /// rozciągnięty obraz waży więcej i wygląda gorzej niż oryginał, a użytkownik dostałby
    /// „miniaturkę" większą od tego, co wgrał.
    /// </summary>
    private static (int Width, int Height) Scale(int width, int height, int maxEdge)
    {
        var longest = Math.Max(width, height);

        if (longest <= maxEdge)
        {
            return (width, height);
        }

        var ratio = (double)maxEdge / longest;

        // Co najmniej 1 px: przy skrajnie wydłużonym obrazie (panorama 8000×20) krótsza krawędź
        // zaokrągliłaby się do zera, a `Resize` na wymiarze zerowym zwraca null.
        return (Math.Max(1, (int)Math.Round(width * ratio)), Math.Max(1, (int)Math.Round(height * ratio)));
    }

    /// <summary>
    /// Sprowadza bitmapę do orientacji „na wprost", stosując obrót i odbicie z EXIF-a.
    /// Cztery z ośmiu orientacji zamieniają osie, więc wynik ma zamienione wymiary.
    /// </summary>
    private static SKBitmap ApplyOrigin(SKBitmap source, SKEncodedOrigin origin)
    {
        if (origin == SKEncodedOrigin.TopLeft)
        {
            return source.Copy();
        }

        var swapsAxes = origin is SKEncodedOrigin.LeftTop
            or SKEncodedOrigin.RightTop
            or SKEncodedOrigin.RightBottom
            or SKEncodedOrigin.LeftBottom;

        var targetWidth = swapsAxes ? source.Height : source.Width;
        var targetHeight = swapsAxes ? source.Width : source.Height;

        var target = new SKBitmap(targetWidth, targetHeight, source.ColorType, source.AlphaType);

        using var canvas = new SKCanvas(target);
        canvas.SetMatrix(OriginMatrix(origin, targetWidth, targetHeight));

        // `Nearest`: to jest czysty obrót/odbicie o wielokrotność 90°, więc każdy piksel źródła
        // ląduje dokładnie na pikselu celu. Filtrowanie nie miałoby czego wygładzać, a rozmyłoby
        // obraz przed właściwym skalowaniem.
        canvas.DrawBitmap(source, 0, 0, new SKSamplingOptions(SKFilterMode.Nearest), paint: null);
        canvas.Flush();

        return target;
    }

    /// <summary>
    /// Macierz dla każdej z ośmiu orientacji EXIF (tag <c>Orientation</c>, 0x0112) — cztery obroty
    /// i cztery obroty z odbiciem lustrzanym.
    ///
    /// <para>Wymiary w argumentach to wymiary <b>docelowe</b>, czyli już po ewentualnej zamianie
    /// osi. Podanie tu wymiarów źródła daje przy orientacjach transponowanych obraz przesunięty
    /// poza płótno — pusty, a nie przekrzywiony, więc łatwo wziąć to za błąd dekodowania.</para>
    /// </summary>
    private static SKMatrix OriginMatrix(SKEncodedOrigin origin, int width, int height) => origin switch
    {
        SKEncodedOrigin.TopRight => new SKMatrix(-1, 0, width, 0, 1, 0, 0, 0, 1),
        SKEncodedOrigin.BottomRight => new SKMatrix(-1, 0, width, 0, -1, height, 0, 0, 1),
        SKEncodedOrigin.BottomLeft => new SKMatrix(1, 0, 0, 0, -1, height, 0, 0, 1),
        SKEncodedOrigin.LeftTop => new SKMatrix(0, 1, 0, 1, 0, 0, 0, 0, 1),
        SKEncodedOrigin.RightTop => new SKMatrix(0, -1, width, 1, 0, 0, 0, 0, 1),
        SKEncodedOrigin.RightBottom => new SKMatrix(0, -1, width, -1, 0, height, 0, 0, 1),
        SKEncodedOrigin.LeftBottom => new SKMatrix(0, 1, 0, -1, 0, height, 0, 0, 1),
        _ => SKMatrix.Identity,
    };
}

using Shouldly;
using TaskManagement.Infrastructure.RichText;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>
/// Opis zgłoszenia jest HTML-em wpisanym przez użytkownika w edytorze, więc sanityzacja przy
/// zapisie jest kontrolą bezpieczeństwa, a nie kosmetyką. Bez testów cichnie przy pierwszym
/// refaktorze białej listy — objaw pojawia się dopiero u kogoś, kto otworzy cudze zgłoszenie.
/// </summary>
public class RichTextSanitizerTests
{
    private readonly RichTextSanitizer _sanitizer = new();

    [Fact]
    public void Zostawia_formatowanie_ktore_produkuje_edytor()
    {
        const string html =
            "<p>Trzeba opisać <strong>endpointy</strong> i <em>przykłady</em>.</p>"
            + "<ul><li>pole A</li><li>pole B</li></ul>"
            + "<blockquote>cytat</blockquote><pre><code>kod()</code></pre>";

        var result = _sanitizer.Sanitize(html);

        result.ShouldBe(html);
    }

    [Theory]
    [InlineData("<script>alert(1)</script>", "script")]
    [InlineData("<p onclick=\"alert(1)\">tekst</p>", "onclick")]
    [InlineData("<img src=\"x\" onerror=\"alert(1)\">", "onerror")]
    [InlineData("<iframe src=\"http://zly.example\"></iframe>", "iframe")]
    [InlineData("<object data=\"zly.swf\"></object>", "object")]
    [InlineData("<p style=\"background:url(javascript:alert(1))\">tekst</p>", "javascript")]
    public void Wycina_wrogie_znaczniki_i_atrybuty(string html, string forbidden)
    {
        var result = _sanitizer.Sanitize(html) ?? string.Empty;

        result.ShouldNotContain(forbidden, Case.Insensitive);
    }

    [Fact]
    public void Odrzuca_odnosnik_ze_schematem_javascript()
    {
        var result = _sanitizer.Sanitize("<a href=\"javascript:alert(1)\">klik</a>") ?? string.Empty;

        result.ShouldNotContain("javascript", Case.Insensitive);
        result.ShouldContain("klik");
    }

    [Fact]
    public void Odrzuca_obrazek_wklejony_jako_data_uri()
    {
        // Obrazek w treści musi przejść przez magazyn plików i referencję, po której da się
        // posprzątać — `data:` omija jedno i drugie, a przy okazji puchnie w każdej odpowiedzi.
        var result = _sanitizer.Sanitize("<img src=\"data:image/png;base64,AAAA\">") ?? string.Empty;

        result.ShouldNotContain("data:", Case.Insensitive);
    }

    [Fact]
    public void Dokleja_noopener_do_odnosnika_otwieranego_w_nowej_karcie()
    {
        var result = _sanitizer.Sanitize("<a href=\"https://example.com\" target=\"_blank\">klik</a>") ?? string.Empty;

        result.ShouldContain("noopener");
    }

    [Fact]
    public void Przepuszcza_obrazek_wskazany_wzglednym_adresem_endpointu()
    {
        // Na tym stoi cały front obrazków w opisie: w treści zapisuje się adres WZGLĘDNY
        // (`/issue/attachment/content/{uuid}`), a nie `blob:` ani adres bezwzględny.
        // `blob:` żyje tyle, co karta przeglądarki; adres bezwzględny zamroziłby w treści
        // `localhost:5290` i przestałby działać po wdrożeniu. Gdyby sanitizer wycinał adresy
        // względne, cała ta droga byłaby ślepa — stąd ten test.
        const string html = "<p><img src=\"/issue/attachment/content/0198f000-0000-7000-8000-000000000001\" alt=\"zrzut\"></p>";

        var result = _sanitizer.Sanitize(html) ?? string.Empty;

        result.ShouldContain("/issue/attachment/content/0198f000-0000-7000-8000-000000000001");
        result.ShouldContain("alt=\"zrzut\"");
    }

    [Fact]
    public void Zachowuje_tabele_owinieta_przez_wrapper_edytora()
    {
        // Edytor renderuje każdą tabelę jako `<div class="tui-table-wrapper"><table>...
        // <colgroup><col>...</colgroup>...</table></div>`. `div`/`colgroup`/`col` nie były na
        // białej liście, a `HtmlSanitizer` domyślnie (`KeepChildNodes = false`) po napotkaniu
        // niedozwolonego tagu kasuje całe jego poddrzewo — czyli `<table>` w środku razem z
        // treścią komórek, nie tylko samo opakowanie.
        const string html =
            "<div class=\"tui-table-wrapper\">"
            + "<table style=\"width: 200px\">"
            + "<colgroup><col style=\"width: 100px\"><col style=\"width: 100px\"></colgroup>"
            + "<tbody><tr><td>A1</td><td>B1</td></tr></tbody>"
            + "</table></div>";

        var result = _sanitizer.Sanitize(html) ?? string.Empty;

        result.ShouldContain("<table");
        result.ShouldContain("<colgroup");
        result.ShouldContain("<col ");
        result.ShouldContain("A1");
        result.ShouldContain("B1");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("<p></p>")]
    [InlineData("<p><br></p>")]
    [InlineData("<script>alert(1)</script>")]
    public void Pusta_tresc_ma_jedna_reprezentacje(string? html)
    {
        // „Opis pusty" musi w bazie wyglądać zawsze tak samo — inaczej porównanie „czy opis
        // się zmienił" (historia zmian, faza 1) kłamie przy pustym akapicie z edytora.
        _sanitizer.Sanitize(html).ShouldBeNull();
    }
}

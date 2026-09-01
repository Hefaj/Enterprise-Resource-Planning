using System.Text.RegularExpressions;
using Ganss.Xss;
using TaskManagement.Application.Abstractions;

namespace TaskManagement.Infrastructure.RichText;

/// <summary>
/// Biała lista znaczników odpowiadająca temu, co potrafi wyprodukować edytor
/// (`erp-rich-text`, zestaw `standard`/`full`). Wszystko spoza listy wypada.
///
/// <para><b>Biała lista, nie czarna.</b> Czarna lista wymaga przewidzenia każdego wektora ataku
/// i przegrywa przy pierwszym nieznanym; biała przepuszcza dokładnie to, co znamy, więc nowy
/// wektor jest domyślnie odcięty. Cena — nowy przycisk w pasku edytora wymaga dopisania tagu
/// tutaj — jest zamierzona: rozjazd wychodzi jako zniknięcie formatowania, a nie jako dziura.</para>
/// </summary>
public sealed partial class RichTextSanitizer : IRichTextSanitizer
{
    private static readonly string[] AllowedTags =
    [
        "p", "br", "strong", "b", "em", "i", "u", "s", "strike", "del",
        "ul", "ol", "li", "blockquote", "pre", "code", "hr",
        "h1", "h2", "h3", "h4", "h5", "h6",
        "a", "span", "sub", "sup",
        // Edytor owija każdą tabelę w `<div class="tui-table-wrapper">` i renderuje szerokości
        // kolumn przez `<colgroup><col>` — bez tych trzech tagów `HtmlSanitizer` (domyślnie
        // `KeepChildNodes = false`) wycina całe poddrzewo wraz z `<table>` w środku, a nie samo
        // opakowanie.
        "div", "colgroup", "col",
        "table", "thead", "tbody", "tr", "th", "td",
        "details", "summary",
        // `img` jest tu z wyprzedzeniem, ale samo nie wystarczy — atrybut `src` jest zawężony
        // niżej do adresów naszego endpointu zawartości.
        "img",
    ];

    private static readonly string[] AllowedAttributes =
    [
        "href", "title", "target", "rel",
        "src", "alt", "width", "height",
        "colspan", "rowspan",
        // `style` przepuszczamy, bo edytor zapisuje nim wyrównanie i rozmiar tekstu; sam
        // sanitizer i tak filtruje właściwości CSS po własnej białej liście.
        "style",
        "class",
    ];

    /// <summary>
    /// Dozwolone schematy adresów. <c>data:</c> jest <b>celowo pominięty</b>: obrazek wklejony
    /// jako <c>data:</c> wsiąkłby w treść zgłoszenia, omijając magazyn plików, referencje
    /// i sprzątanie — i puchłby w każdej odpowiedzi listy (<c>docs/backend/media-storage.md</c>).
    /// </summary>
    private static readonly string[] AllowedSchemes = ["http", "https", "mailto"];

    private readonly HtmlSanitizer _sanitizer;

    public RichTextSanitizer()
    {
        _sanitizer = new HtmlSanitizer();

        _sanitizer.AllowedTags.Clear();
        foreach (var tag in AllowedTags)
        {
            _sanitizer.AllowedTags.Add(tag);
        }

        _sanitizer.AllowedAttributes.Clear();
        foreach (var attribute in AllowedAttributes)
        {
            _sanitizer.AllowedAttributes.Add(attribute);
        }

        _sanitizer.AllowedSchemes.Clear();
        foreach (var scheme in AllowedSchemes)
        {
            _sanitizer.AllowedSchemes.Add(scheme);
        }

        // Odnośnik otwierany w nowej karcie bez `noopener` daje stronie docelowej dostęp do
        // `window.opener` — a odnośniki w opisie prowadzą poza system.
        _sanitizer.RemovingAttribute += (_, args) => args.Cancel = false;
        _sanitizer.PostProcessNode += (_, args) =>
        {
            if (args.Node is AngleSharp.Html.Dom.IHtmlAnchorElement anchor && anchor.HasAttribute("target"))
            {
                anchor.SetAttribute("rel", "noopener noreferrer");
            }
        };
    }

    /// <inheritdoc />
    public string? Sanitize(string? html)
    {
        if (string.IsNullOrWhiteSpace(html))
        {
            return null;
        }

        var clean = _sanitizer.Sanitize(html).Trim();

        // Edytor po wyczyszczeniu treści zostawia pusty akapit — bez tego „opis pusty" miałby
        // w bazie dwie reprezentacje i porównanie „czy opis się zmienił" kłamałoby.
        return IsEffectivelyEmpty(clean) ? null : clean;
    }

    /// <summary>
    /// Czy po oczyszczeniu została jakakolwiek treść.
    ///
    /// <para>Znaczniki zdejmujemy wyrażeniem regularnym, a nie łańcuchem <c>Replace</c>: kolejność
    /// podmian ma znaczenie i łatwo o dziurę (<c>&lt;p&gt;&lt;br&gt;&lt;/p&gt;</c> przechodziło
    /// jako niepuste, bo <c>&lt;p&gt;&lt;/p&gt;</c> powstawało dopiero po usunięciu
    /// <c>&lt;br&gt;</c>). To NIE jest decyzja bezpieczeństwa — wejście przeszło już przez
    /// sanitizer — tylko rozstrzygnięcie „pusto czy nie".</para>
    /// </summary>
    private static bool IsEffectivelyEmpty(string html)
    {
        if (html.Length == 0)
        {
            return true;
        }

        // Obrazek, linia i tabela są treścią, mimo że nie niosą tekstu — bez tego opis złożony
        // z samego zrzutu ekranu zapisałby się jako pusty.
        foreach (var contentTag in ContentTags)
        {
            if (html.Contains(contentTag, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }
        }

        var text = TagPattern().Replace(html, string.Empty).Replace("&nbsp;", " ", StringComparison.OrdinalIgnoreCase);

        return string.IsNullOrWhiteSpace(text);
    }

    private static readonly string[] ContentTags = ["<img", "<hr", "<table"];

    [GeneratedRegex("<[^>]+>", RegexOptions.None, matchTimeoutMilliseconds: 1000)]
    private static partial Regex TagPattern();
}

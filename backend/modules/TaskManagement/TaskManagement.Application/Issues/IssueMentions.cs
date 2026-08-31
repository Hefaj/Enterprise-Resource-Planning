using System.Globalization;
using System.Text.RegularExpressions;

namespace TaskManagement.Application.Issues;

/// <summary>
/// Wyciąga wzmianki (<c>@user</c>) z treści komentarza.
///
/// <para><b>Wzmianka jest w treści, nie w osobnym polu komendy.</b> Osobna lista odbiorców
/// rozjechałaby się z tekstem przy pierwszej edycji komentarza — użytkownik skasowałby „@Jan",
/// a Jan nadal dostawałby powiadomienia o wątku, w którym już nie występuje. Źródłem prawdy jest
/// to, co widać.</para>
///
/// <para>Znacznikiem jest <c>data-mention-uuid</c> na dowolnym elemencie — edytor zapisuje
/// wzmiankę jako <c>&lt;span data-mention-uuid="…"&gt;@Jan Kowalski&lt;/span&gt;</c>, a sanitizer
/// ten atrybut przepuszcza. Parsowanie po samym tekście („@Jan") odpadło: imion powtarzalnych
/// jest w firmie mnóstwo, a powiadomienie wysłane nie tej osobie jest gorsze niż brak.</para>
/// </summary>
public static partial class IssueMentions
{
    public static IReadOnlyList<Guid> Extract(string? html)
    {
        if (string.IsNullOrWhiteSpace(html))
        {
            return [];
        }

        var result = new List<Guid>();

        foreach (Match match in MentionPattern().Matches(html))
        {
            if (Guid.TryParse(match.Groups["uuid"].Value, CultureInfo.InvariantCulture, out var uuid)
                && uuid != Guid.Empty
                && !result.Contains(uuid))
            {
                result.Add(uuid);
            }
        }

        return result;
    }

    [GeneratedRegex("""data-mention-uuid\s*=\s*["'](?<uuid>[0-9a-fA-F-]{36})["']""", RegexOptions.None, matchTimeoutMilliseconds: 1000)]
    private static partial Regex MentionPattern();
}

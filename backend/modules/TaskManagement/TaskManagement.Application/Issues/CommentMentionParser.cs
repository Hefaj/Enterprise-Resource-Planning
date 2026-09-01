using System.Text.RegularExpressions;

namespace TaskManagement.Application.Issues;

/// <summary>
/// Wyciąga wzmianki <c>@</c> z sanityzowanej treści komentarza (HTML).
///
/// <para>Format jest kontraktem z edytorem: wzmianka renderuje się jako
/// <c>&lt;span data-mention-user-uuid="…"&gt;@Imię&lt;/span&gt;</c> — atrybut, nie tekst, żeby
/// zmiana wyświetlanego imienia (front rozwiązuje uuid na nazwisko przez
/// <c>ERP_USER_DIRECTORY</c>, <c>docs/frontend/user-directory.md</c>) nie gubiła wzmianki.
/// Parsowanie idzie PO sanityzacji: <c>data-*</c> jest na białej liście sanitizera tak samo,
/// jak atrybuty obrazka wklejanego ze schowka (faza 4).</para>
/// </summary>
public static partial class CommentMentionParser
{
    public static IReadOnlyList<Guid> ExtractMentionedUsers(string sanitizedBody)
    {
        if (string.IsNullOrEmpty(sanitizedBody))
        {
            return [];
        }

        var result = new List<Guid>();

        foreach (Match match in MentionPattern().Matches(sanitizedBody))
        {
            if (Guid.TryParse(match.Groups[1].Value, out var userUuid) && userUuid != Guid.Empty)
            {
                result.Add(userUuid);
            }
        }

        return result.Count == 0 ? [] : [.. result.Distinct()];
    }

    [GeneratedRegex("""data-mention-user-uuid=["']([0-9a-fA-F-]{36})["']""")]
    private static partial Regex MentionPatternRaw();

    private static Regex MentionPattern() => MentionPatternRaw();
}

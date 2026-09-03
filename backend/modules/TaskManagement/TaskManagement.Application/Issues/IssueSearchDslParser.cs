namespace TaskManagement.Application.Issues;

/// <summary>Jedna para <c>pole: wartość</c> z DSL wyszukiwania, w kolejności wystąpienia
/// w tekście. <see cref="Position"/> wskazuje token pola — używany w komunikatach błędów
/// semantycznych zgłaszanych przez rozwiązywanie (<see cref="IIssueSearchDslResolver"/>).</summary>
public sealed record IssueSearchDslPair(string Field, string Value, int Position);

/// <summary>
/// Parser wąskiego DSL wyszukiwania zgłoszeń (SRCH-005) — <c>project: ERP state: Open
/// assignee: me</c>. Produkuje wyłącznie listę par <c>pole: wartość</c>, w kolejności
/// wystąpienia; nie zna znaczenia pól — to jest zadanie <see cref="IIssueSearchDslResolver"/>.
///
/// <para><b>Węższy niż <c>AutomationConditionParser</c>, świadomie.</b> Brak <c>and</c>/<c>or</c>
/// i nawiasów — DSL wyszukiwania ma być prostszy niż język warunków automatyzacji, nie ten sam.
/// Sekwencja par jest niejawnym AND (dokładnie tak samo jak formularz filtra łączy swoje pola).</para>
///
/// <para><b>AC1</b> — parser nie generuje SQL-a i nie wykonuje kodu: wyłącznie tokenizuje
/// i składa listę par. Nieznane pole rozpoznaje dopiero <see cref="IIssueSearchDslResolver"/>
/// (parser nie zna zbioru dozwolonych pól), ale pozycja tokenu, którą tu zapisujemy, jest tym,
/// czego resolver używa w komunikacie błędu.</para>
/// </summary>
public static class IssueSearchDslParser
{
    public static IReadOnlyList<IssueSearchDslPair> Parse(string text)
    {
        ArgumentNullException.ThrowIfNull(text);

        var tokens = Tokenize(text);
        var pairs = new List<IssueSearchDslPair>();
        var seenFields = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var position = 0;

        while (position < tokens.Count)
        {
            var fieldToken = Expect(tokens, ref position, TokenKind.Identifier, "nazwy pola");
            Expect(tokens, ref position, TokenKind.Colon, "`:` po nazwie pola");
            var valueToken = ExpectValue(tokens, ref position);

            // Powtórzenie pola innego niż `tag` jest błędem, nie cichym nadpisaniem —
            // jednoznaczność jest tu ważniejsza niż wygoda (DSL jest z założenia wąski).
            if (!string.Equals(fieldToken.Text, "tag", StringComparison.OrdinalIgnoreCase)
                && !seenFields.Add(fieldToken.Text))
            {
                throw new IssueSearchDslParseException(
                    $"Pole `{fieldToken.Text}` podane więcej niż raz.", fieldToken.Position);
            }

            pairs.Add(new IssueSearchDslPair(fieldToken.Text, valueToken.Text, fieldToken.Position));
        }

        return pairs;
    }

    private static Token Expect(IReadOnlyList<Token> tokens, ref int position, TokenKind kind, string expected)
    {
        if (position >= tokens.Count)
        {
            throw new IssueSearchDslParseException(
                $"Oczekiwano {expected}, ale zapytanie się skończyło.", tokens.Count == 0 ? 0 : tokens[^1].Position);
        }

        var token = tokens[position];

        if (token.Kind != kind)
        {
            throw new IssueSearchDslParseException($"Oczekiwano {expected}, otrzymano `{token.Text}`.", token.Position);
        }

        position++;

        return token;
    }

    private static Token ExpectValue(IReadOnlyList<Token> tokens, ref int position)
    {
        if (position >= tokens.Count)
        {
            throw new IssueSearchDslParseException(
                "Oczekiwano wartości, ale zapytanie się skończyło.", tokens.Count == 0 ? 0 : tokens[^1].Position);
        }

        var token = tokens[position];

        if (token.Kind is not (TokenKind.Identifier or TokenKind.Literal))
        {
            throw new IssueSearchDslParseException($"Oczekiwano wartości, otrzymano `{token.Text}`.", token.Position);
        }

        position++;

        return token;
    }

    private static List<Token> Tokenize(string text)
    {
        var tokens = new List<Token>();
        var i = 0;

        while (i < text.Length)
        {
            var c = text[i];

            if (char.IsWhiteSpace(c))
            {
                i++;
                continue;
            }

            if (c == ':')
            {
                tokens.Add(new Token(TokenKind.Colon, ":", i));
                i++;
                continue;
            }

            if (c is '"' or '\'')
            {
                var start = i;
                var quote = c;
                i++;
                var value = new System.Text.StringBuilder();

                while (i < text.Length && text[i] != quote)
                {
                    value.Append(text[i]);
                    i++;
                }

                if (i >= text.Length)
                {
                    throw new IssueSearchDslParseException("Brakujący cudzysłów zamykający.", start);
                }

                i++; // zamykający cudzysłów
                tokens.Add(new Token(TokenKind.Literal, value.ToString(), start));
                continue;
            }

            if (char.IsLetterOrDigit(c) || c is '_' or '-' or '.' or '@')
            {
                var start = i;

                while (i < text.Length && (char.IsLetterOrDigit(text[i]) || text[i] is '_' or '-' or '.' or '@'))
                {
                    i++;
                }

                tokens.Add(new Token(TokenKind.Identifier, text[start..i], start));
                continue;
            }

            throw new IssueSearchDslParseException($"Nieoczekiwany znak `{c}`.", i);
        }

        return tokens;
    }

    private enum TokenKind
    {
        Identifier,
        Colon,
        Literal,
    }

    private readonly record struct Token(TokenKind Kind, string Text, int Position);
}

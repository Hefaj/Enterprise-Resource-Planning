using TaskManagement.Domain.Automation.Conditions;

namespace TaskManagement.Application.Automation;

/// <summary>
/// Parser postaci tekstowej wąskiego warunku — <c>priority = "High" and state.category = "Done"
/// or tag = "…"</c>. Produkuje ten sam AST (<see cref="AutomationCondition"/>), co budowniczy
/// formularza w UI (patrz test równoważności w <c>AutomationConditionParserTests</c>). Grunt pod
/// przyszłe `guard` (WF-003) i SRCH-005 — <b>nie jest głównym interfejsem</b> edycji reguły;
/// UI buduje warunek strukturalnie zgodnie z <c>docs/modules/task-management/requirements.md</c>.
///
/// <para>Nie generuje SQL-a i nie wykonuje kodu — wyłącznie tokenizuje i składa AST, tak samo
/// jak wymaga tego SRCH-005 AC1 dla języka wyszukiwania.</para>
/// </summary>
public static class AutomationConditionParser
{
    public static AutomationCondition Parse(string text)
    {
        ArgumentNullException.ThrowIfNull(text);

        var tokens = Tokenize(text);
        var position = 0;

        if (tokens.Count == 0)
        {
            return AutomationCondition.Always;
        }

        var groups = new List<IReadOnlyList<AutomationComparison>> { ParseAndGroup(tokens, ref position) };

        while (position < tokens.Count && IsKeyword(tokens[position], "or"))
        {
            position++;
            groups.Add(ParseAndGroup(tokens, ref position));
        }

        if (position < tokens.Count)
        {
            throw new AutomationConditionParseException(
                $"Nieoczekiwany token `{tokens[position].Text}`.", tokens[position].Position);
        }

        return new AutomationCondition(groups);
    }

    private static List<AutomationComparison> ParseAndGroup(IReadOnlyList<Token> tokens, ref int position)
    {
        var comparisons = new List<AutomationComparison> { ParseComparison(tokens, ref position) };

        while (position < tokens.Count && IsKeyword(tokens[position], "and"))
        {
            position++;
            comparisons.Add(ParseComparison(tokens, ref position));
        }

        return comparisons;
    }

    private static AutomationComparison ParseComparison(IReadOnlyList<Token> tokens, ref int position)
    {
        var field = Expect(tokens, ref position, TokenKind.Identifier, "ścieżki do pola");
        var op = ParseOperator(tokens, ref position);
        var literal = ExpectLiteral(tokens, ref position);

        return new AutomationComparison(field.Text, op, literal.Text);
    }

    private static AutomationComparisonOperator ParseOperator(IReadOnlyList<Token> tokens, ref int position)
    {
        var token = Expect(tokens, ref position, TokenKind.Operator, "operatora (= != > >= < <=)");

        return token.Text switch
        {
            "=" => AutomationComparisonOperator.Eq,
            "!=" => AutomationComparisonOperator.Ne,
            ">" => AutomationComparisonOperator.Gt,
            ">=" => AutomationComparisonOperator.Gte,
            "<" => AutomationComparisonOperator.Lt,
            "<=" => AutomationComparisonOperator.Lte,
            _ => throw new AutomationConditionParseException($"Nieznany operator `{token.Text}`.", token.Position),
        };
    }

    /// <summary>Literał przyjmuje słowo bez cudzysłowu (liczba, uuid, nazwa enuma) albo tekst
    /// w cudzysłowie — obie postaci niosą tę samą treść, cudzysłów jest potrzebny tylko wtedy,
    /// gdy wartość ma spację.</summary>
    private static Token ExpectLiteral(IReadOnlyList<Token> tokens, ref int position)
    {
        if (position >= tokens.Count)
        {
            throw new AutomationConditionParseException(
                "Oczekiwano wartości, ale warunek się skończył.", tokens.Count == 0 ? 0 : tokens[^1].Position);
        }

        var token = tokens[position];

        if (token.Kind is not (TokenKind.Identifier or TokenKind.Literal))
        {
            throw new AutomationConditionParseException($"Oczekiwano wartości, otrzymano `{token.Text}`.", token.Position);
        }

        position++;

        return token;
    }

    private static Token Expect(IReadOnlyList<Token> tokens, ref int position, TokenKind kind, string expected)
    {
        if (position >= tokens.Count)
        {
            throw new AutomationConditionParseException(
                $"Oczekiwano {expected}, ale warunek się skończył.", tokens.Count == 0 ? 0 : tokens[^1].Position);
        }

        var token = tokens[position];

        if (token.Kind != kind)
        {
            throw new AutomationConditionParseException($"Oczekiwano {expected}, otrzymano `{token.Text}`.", token.Position);
        }

        position++;

        return token;
    }

    private static bool IsKeyword(Token token, string keyword)
        => token.Kind == TokenKind.Identifier && string.Equals(token.Text, keyword, StringComparison.OrdinalIgnoreCase);

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
                    throw new AutomationConditionParseException("Brakujący cudzysłów zamykający.", start);
                }

                i++; // zamykający cudzysłów
                tokens.Add(new Token(TokenKind.Literal, value.ToString(), start));
                continue;
            }

            if (c is '!' or '>' or '<' or '=')
            {
                var start = i;
                var op = c.ToString();
                i++;

                if (i < text.Length && text[i] == '=' && c is '!' or '>' or '<')
                {
                    op += "=";
                    i++;
                }

                if (op == "!" )
                {
                    throw new AutomationConditionParseException("Niepełny operator `!`.", start);
                }

                tokens.Add(new Token(TokenKind.Operator, op, start));
                continue;
            }

            if (char.IsLetterOrDigit(c) || c is '_' or '-' or '.')
            {
                var start = i;

                while (i < text.Length && (char.IsLetterOrDigit(text[i]) || text[i] is '_' or '-' or '.'))
                {
                    i++;
                }

                var word = text[start..i];

                // Bez cudzysłowów token jest jednocześnie ważnym polem/słowem kluczowym I
                // ważnym literałem (np. uuid, liczba) — rozstrzyga to dopiero parser wg pozycji
                // w gramatyce, tokenizer nadaje mu oba znaczenia naraz przez `TokenKind.Identifier`.
                tokens.Add(new Token(TokenKind.Identifier, word, start));
                continue;
            }

            throw new AutomationConditionParseException($"Nieoczekiwany znak `{c}`.", i);
        }

        return tokens;
    }

    private enum TokenKind
    {
        Identifier,
        Operator,
        Literal,
    }

    private readonly record struct Token(TokenKind Kind, string Text, int Position);
}

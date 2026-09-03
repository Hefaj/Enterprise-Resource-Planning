namespace TaskManagement.Application.Automation;

/// <summary>Błąd parsowania postaci tekstowej warunku — niesie pozycję w tekście (SRCH-005 AC1
/// stawia ten sam wymóg dla języka wyszukiwania; ten parser dzieli z nim ducha, choć nie kod).</summary>
public sealed class AutomationConditionParseException : Exception
{
    public AutomationConditionParseException(string message, int position) : base(message) => Position = position;

    public int Position { get; }
}

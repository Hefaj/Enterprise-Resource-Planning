namespace TaskManagement.Domain.IssueTypes;

/// <summary>
/// Kategoria typu zgłoszenia — rozstrzyga o miejscu w hierarchii (<c>Issue.SetParent</c>),
/// nie nazwa typu. Dwa projekty mogą nazwać swój typ najwyższego poziomu inaczej niż „Epik”
/// i reguła „epik nie ma rodzica, podzadanie nie ma dzieci” ma nadal działać (§8.1,
/// <c>docs/backend/task-management-requirements.md</c> TYP-001).
/// </summary>
public enum IssueTypeCategory
{
    /// <summary>Szczyt hierarchii — nie może mieć rodzica.</summary>
    Epic = 0,

    /// <summary>Zwykły typ — może być i rodzicem, i dzieckiem.</summary>
    Standard = 1,

    /// <summary>Liść hierarchii — nie może być rodzicem.</summary>
    Subtask = 2,
}

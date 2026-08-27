namespace TaskManagement.Domain.Issues;

/// <summary>Priorytet zgłoszenia. Kolejność wartości jest znacząca — po niej sortuje lista.</summary>
public enum IssuePriority
{
    Lowest = 0,
    Low = 1,
    Normal = 2,
    High = 3,
    Critical = 4,
}

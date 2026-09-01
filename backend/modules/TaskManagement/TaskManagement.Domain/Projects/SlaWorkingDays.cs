namespace TaskManagement.Domain.Projects;

/// <summary>Dni robocze polityki SLA — flagi, bo kalendarz roboczy projektu bywa niestandardowy
/// (dział wsparcia pracujący w weekendy). Minimalny model (faza 5): bez świąt i bez wyjątków
/// dziennych — to zostaje przyszłym rozszerzeniem, gdyby dane pokazały taką potrzebę.</summary>
[Flags]
public enum SlaWorkingDays
{
    None = 0,
    Monday = 1,
    Tuesday = 2,
    Wednesday = 4,
    Thursday = 8,
    Friday = 16,
    Saturday = 32,
    Sunday = 64,
}

namespace TaskManagement.Domain.WorkTypes;

/// <summary>
/// Cztery rodzaje pracy globalne (TIME-001 AC2) — identyfikatory stałe, uzgadniane przy starcie
/// tak samo jak rozwiązania systemowe (<c>ResolutionDefaults</c>): istniejący wiersz zostaje
/// nietknięty, seed tylko dokłada brakujące.
/// </summary>
public static class WorkTypeDefaults
{
    public static readonly Guid DevelopmentUuid = new("0198f000-0000-7000-8000-0000000000d1");
    public static readonly Guid TestingUuid = new("0198f000-0000-7000-8000-0000000000d2");
    public static readonly Guid AnalysisUuid = new("0198f000-0000-7000-8000-0000000000d3");
    public static readonly Guid MeetingUuid = new("0198f000-0000-7000-8000-0000000000d4");

    public static IReadOnlyList<WorkType> Build() =>
    [
        WorkType.CreateWithUuid(DevelopmentUuid, null, "Rozwój"),
        WorkType.CreateWithUuid(TestingUuid, null, "Testy"),
        WorkType.CreateWithUuid(AnalysisUuid, null, "Analiza"),
        WorkType.CreateWithUuid(MeetingUuid, null, "Spotkanie"),
    ];
}

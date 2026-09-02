namespace TaskManagement.Domain.Resolutions;

/// <summary>
/// Cztery rozwiązania systemowe (ISS-007) — identyfikatory stałe, uzgadniane przy starcie
/// tak samo jak schemat systemowy stanów (<c>WorkflowSchemeDefaults</c>): istniejący wiersz
/// zostaje nietknięty, seed tylko dokłada brakujące.
/// </summary>
public static class ResolutionDefaults
{
    public static readonly Guid DoneUuid = new("0198f000-0000-7000-8000-0000000000c1");
    public static readonly Guid DuplicateUuid = new("0198f000-0000-7000-8000-0000000000c2");
    public static readonly Guid WontFixUuid = new("0198f000-0000-7000-8000-0000000000c3");
    public static readonly Guid CannotReproduceUuid = new("0198f000-0000-7000-8000-0000000000c4");

    public static IReadOnlyList<Resolution> Build() =>
    [
        Resolution.CreateWithUuid(DoneUuid, null, "Zrobione", "taskManagement.resolutions.done", isSystem: true, orderNo: 0),
        Resolution.CreateWithUuid(DuplicateUuid, null, "Duplikat", "taskManagement.resolutions.duplicate", isSystem: true, orderNo: 1),
        Resolution.CreateWithUuid(WontFixUuid, null, "Nie zrobimy", "taskManagement.resolutions.wontFix", isSystem: true, orderNo: 2),
        Resolution.CreateWithUuid(CannotReproduceUuid, null, "Nie da się odtworzyć", "taskManagement.resolutions.cannotReproduce", isSystem: true, orderNo: 3),
    ];
}

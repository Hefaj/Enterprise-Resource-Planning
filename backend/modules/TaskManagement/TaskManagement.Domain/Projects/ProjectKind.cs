namespace TaskManagement.Domain.Projects;

/// <summary>
/// <c>Delivery</c> to projekt wykonawczy (dział ma swoją tablicę i sprinty), <c>Intake</c>
/// to rejestr zleceń działu zamawiającego. <b>Ten sam agregat</b>, inny domyślny schemat stanów
/// i inne domyślne uprawnienia — nie dwa typy w kodzie
/// (<c>docs/modules/task-management/domain.md</c> §3).
/// </summary>
public enum ProjectKind
{
    Delivery = 0,
    Intake = 1,
}

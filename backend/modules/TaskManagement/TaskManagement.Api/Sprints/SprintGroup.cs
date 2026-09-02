using FastEndpoints;

namespace TaskManagement.Sprints;

/// <summary>Prefiks tras sprintów. Trasa endpointu <b>nie powtarza</b> nazwy grupy —
/// pilnuje tego <c>CommandNamingTests</c>.</summary>
public class SprintGroup : Group
{
    public SprintGroup()
    {
        Configure("sprint", ep =>
        {
        });
    }
}

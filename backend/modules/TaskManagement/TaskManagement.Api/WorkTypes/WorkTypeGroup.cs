using FastEndpoints;

namespace TaskManagement.WorkTypes;

/// <summary>Prefiks tras słownika rodzajów pracy, wzorem <c>TagGroup</c>.</summary>
public class WorkTypeGroup : Group
{
    public WorkTypeGroup()
    {
        Configure("work-type", ep =>
        {
        });
    }
}

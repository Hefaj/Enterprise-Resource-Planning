using FastEndpoints;

namespace TaskManagement.SavedViews;

/// <summary>Prefiks tras zapisanych widoków. Trasa endpointu nie powtarza nazwy grupy — pilnuje
/// tego <c>CommandNamingTests</c>.</summary>
public class SavedViewGroup : Group
{
    public SavedViewGroup()
    {
        Configure("saved-view", ep =>
        {
        });
    }
}

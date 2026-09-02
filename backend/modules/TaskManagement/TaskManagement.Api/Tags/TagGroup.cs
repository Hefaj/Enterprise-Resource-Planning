using FastEndpoints;

namespace TaskManagement.Tags;

/// <summary>Prefiks tras tagów. Trasa endpointu nie powtarza nazwy grupy — pilnuje tego
/// <c>CommandNamingTests</c>.</summary>
public class TagGroup : Group
{
    public TagGroup()
    {
        Configure("tag", ep =>
        {
        });
    }
}

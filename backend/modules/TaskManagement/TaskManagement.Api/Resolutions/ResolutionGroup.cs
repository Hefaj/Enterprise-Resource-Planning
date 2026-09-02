using FastEndpoints;

namespace TaskManagement.Resolutions;

/// <summary>Prefiks tras rozwiązań. Trasa endpointu nie powtarza nazwy grupy — pilnuje tego
/// <c>CommandNamingTests</c>.</summary>
public class ResolutionGroup : Group
{
    public ResolutionGroup()
    {
        Configure("resolution", ep =>
        {
        });
    }
}

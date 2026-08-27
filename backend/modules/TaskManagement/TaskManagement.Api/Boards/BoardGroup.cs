using FastEndpoints;

namespace TaskManagement.Boards;

/// <summary>Prefiks tras tablic. Trasa endpointu <b>nie powtarza</b> nazwy grupy —
/// pilnuje tego <c>CommandNamingTests</c>.</summary>
public class BoardGroup : Group
{
    public BoardGroup()
    {
        Configure("board", ep =>
        {
        });
    }
}

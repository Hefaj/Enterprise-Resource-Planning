using FastEndpoints;

namespace TaskManagement.Issues;

/// <summary>Prefiks tras zgłoszeń. Trasa endpointu <b>nie powtarza</b> nazwy grupy —
/// pilnuje tego <c>CommandNamingTests</c>.</summary>
public class IssueGroup : Group
{
    public IssueGroup()
    {
        Configure("issue", ep =>
        {
        });
    }
}

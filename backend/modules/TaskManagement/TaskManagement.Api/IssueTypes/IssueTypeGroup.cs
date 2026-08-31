using FastEndpoints;

namespace TaskManagement.IssueTypes;

/// <summary>Prefiks tras schematów typów zgłoszeń. Trasa endpointu <b>nie powtarza</b> nazwy
/// grupy — pilnuje tego <c>CommandNamingTests</c>.</summary>
public class IssueTypeGroup : Group
{
    public IssueTypeGroup()
    {
        Configure("issue-type-scheme", ep =>
        {
        });
    }
}

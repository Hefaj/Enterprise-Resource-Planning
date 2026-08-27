using FastEndpoints;

namespace TaskManagement.FieldSchemes;

/// <summary>Prefiks tras schematów pól. Trasa endpointu <b>nie powtarza</b> nazwy grupy —
/// pilnuje tego <c>CommandNamingTests</c>.</summary>
public class FieldSchemeGroup : Group
{
    public FieldSchemeGroup()
    {
        Configure("field-scheme", ep =>
        {
        });
    }
}

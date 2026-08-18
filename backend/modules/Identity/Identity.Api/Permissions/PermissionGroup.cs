using FastEndpoints;

namespace Identity.Permissions;

public class PermissionGroup : Group
{
    public PermissionGroup()
    {
        Configure("permission", ep =>
        {
        });
    }
}

using FastEndpoints;

namespace Identity.Roles;

public class RoleGroup : Group
{
    public RoleGroup()
    {
        Configure("role", ep =>
        {
        });
    }
}

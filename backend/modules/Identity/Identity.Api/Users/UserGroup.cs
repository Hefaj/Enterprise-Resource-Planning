using FastEndpoints;

namespace Identity.Users;

public class UserGroup : Group
{
    public UserGroup()
    {
        Configure("user", ep =>
        {
        });
    }
}

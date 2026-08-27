using FastEndpoints;

namespace TaskManagement.Projects;

/// <summary>Prefiks tras projektów.</summary>
public class ProjectGroup : Group
{
    public ProjectGroup()
    {
        Configure("project", ep =>
        {
        });
    }
}

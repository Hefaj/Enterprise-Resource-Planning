using FastEndpoints;

namespace TaskManagement.Sprints;

public class SprintGroup : Group
{
    public SprintGroup() => Configure("sprint", _ => { });
}

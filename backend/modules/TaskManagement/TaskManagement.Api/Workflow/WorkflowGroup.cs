using FastEndpoints;

namespace TaskManagement.Workflow;

/// <summary>Prefiks tras konfiguracji obiegu (schematy stanów).</summary>
public class WorkflowGroup : Group
{
    public WorkflowGroup()
    {
        Configure("workflow", ep =>
        {
        });
    }
}

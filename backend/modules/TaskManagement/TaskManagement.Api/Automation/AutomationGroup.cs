using FastEndpoints;

namespace TaskManagement.Automation;

/// <summary>Prefiks tras reguł automatyzacji.</summary>
public class AutomationGroup : Group
{
    public AutomationGroup()
    {
        Configure("automation-rule", ep =>
        {
        });
    }
}

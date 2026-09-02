using FastEndpoints;

namespace TaskManagement.Reports;

/// <summary>Prefiks tras przebiegów raportu.</summary>
public class ReportRunGroup : Group
{
    public ReportRunGroup()
    {
        Configure("reportRun", ep =>
        {
        });
    }
}

using FastEndpoints;

namespace Catalog.ExportRuns;

/// <summary>Prefiks tras przebiegów eksportu.</summary>
public class ExportRunGroup : Group
{
    public ExportRunGroup()
    {
        Configure("exportRun", ep =>
        {
        });
    }
}

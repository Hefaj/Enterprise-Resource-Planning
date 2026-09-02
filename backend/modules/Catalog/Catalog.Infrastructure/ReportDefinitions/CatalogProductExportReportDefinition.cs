using System.Runtime.CompilerServices;
using Catalog.Infrastructure.Persistence;
using Erp.BuildingBlocks.Reporting;
using Microsoft.EntityFrameworkCore;

namespace Catalog.Infrastructure.ReportDefinitions;

/// <summary>
/// Eksport katalogu produktów do pliku — pierwsza (i dziś jedyna) definicja raportu Catalog.
///
/// <para>Uogólnienie dawnego <c>ExportRunner.WriteProductsXmlAsync</c> (patrz
/// <c>docs/backend/reporting.md</c> §3): eksport nie jest już osobnym runnerem, tylko definicją
/// zarejestrowaną pod <see cref="IReportDefinition"/> — samą serializację XML/CSV robi wspólny
/// <see cref="ReportFormatWriter"/>.</para>
///
/// <para>Wykrywana skanem zestawów w <c>AddErpModule</c> (patrz
/// <c>Erp.BuildingBlocks.Api.ErpModuleRegistrationExtensions</c>) — nie ma tu i nie może być
/// żadnego jawnego <c>AddScoped</c>.</para>
/// </summary>
public sealed class CatalogProductExportReportDefinition : IReportDefinition
{
    /// <inheritdoc />
    public string Key => "catalog.product-export";

    /// <inheritdoc />
    public IReadOnlySet<string> Formats { get; } = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "xml" };

    private readonly CatalogDbContext _dbContext;

    public CatalogProductExportReportDefinition(CatalogDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <inheritdoc />
    /// <remarks>
    /// Eksport całego katalogu nie ma dziś naturalnego progu niebezpieczeństwa — jeden produkt to
    /// jeden wiersz XML bez agregacji, więc koszt rośnie liniowo i strumieniowanie
    /// (<see cref="StreamAsync"/>) trzyma pamięć płaską niezależnie od rozmiaru katalogu.
    /// </remarks>
    public Task<ReportEstimate> EstimateAsync(ReportParameters parameters, CancellationToken cancellationToken)
        => Task.FromResult(ReportEstimate.Unbounded);

    /// <inheritdoc />
    public async IAsyncEnumerable<ReportRow> StreamAsync(
        ReportParameters parameters,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var source = _dbContext.Products
            .AsNoTracking()
            .OrderBy(p => p.Uuid)
            .Select(p => new { p.Uuid, p.Name, p.Price, p.Status })
            .AsAsyncEnumerable();

        await foreach (var product in source.WithCancellation(cancellationToken).ConfigureAwait(false))
        {
            yield return ReportRow.Of(
                ("uuid", product.Uuid),
                ("name", product.Name),
                ("price", product.Price),
                ("status", product.Status.ToString()));
        }
    }
}

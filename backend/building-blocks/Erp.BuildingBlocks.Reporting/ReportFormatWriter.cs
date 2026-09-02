using System.Globalization;
using System.Text;
using System.Xml;

namespace Erp.BuildingBlocks.Reporting;

/// <summary>
/// Zamienia strumień <see cref="ReportRow"/> na bajty w jednym ze wspólnych formatów.
///
/// <para>Świadomie generyczne po module: definicja raportu produkuje wiersze o dowolnym
/// kształcie (nazwa kolumny → wartość), a serializacja XML/CSV nie zależy od tego, co jest
/// agregowane — to samo rozwiązuje problem, który dziś <c>ExportRunner</c> ma zaszyty wprost
/// w <c>WriteProductsXmlAsync</c>.</para>
/// </summary>
public static class ReportFormatWriter
{
    /// <summary>Formaty obsługiwane bezpośrednio przez runnera bez udziału definicji.</summary>
    public static IReadOnlySet<string> SupportedFormats { get; } =
        new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "xml", "csv" };

    public static string ContentTypeFor(string format) => format.ToLowerInvariant() switch
    {
        "xml" => "application/xml",
        "csv" => "text/csv",
        _ => "application/octet-stream",
    };

    /// <summary>
    /// Zapisuje strumień wierszy do <paramref name="output"/> w formacie <paramref name="format"/>,
    /// wołając <paramref name="onRowWritten"/> co wiersz — wołający decyduje, co ile z tego zrobić
    /// bicie serca i zapis postępu (patrz <see cref="ReportRunner{TContext}"/>).
    /// </summary>
    /// <returns>Liczba zapisanych wierszy.</returns>
    public static async Task<int> WriteAsync(
        string format,
        IAsyncEnumerable<ReportRow> rows,
        Stream output,
        Func<int, CancellationToken, Task> onRowWritten,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(rows);
        ArgumentNullException.ThrowIfNull(output);
        ArgumentNullException.ThrowIfNull(onRowWritten);

        return format.ToLowerInvariant() switch
        {
            "xml" => await WriteXmlAsync(rows, output, onRowWritten, cancellationToken).ConfigureAwait(false),
            "csv" => await WriteCsvAsync(rows, output, onRowWritten, cancellationToken).ConfigureAwait(false),
            _ => throw new NotSupportedException(
                $"Format '{format}' nie jest obsługiwany przez wspólny writer — obsługiwane: "
                + string.Join(", ", SupportedFormats) + "."),
        };
    }

    private static async Task<int> WriteXmlAsync(
        IAsyncEnumerable<ReportRow> rows,
        Stream output,
        Func<int, CancellationToken, Task> onRowWritten,
        CancellationToken cancellationToken)
    {
        var settings = new XmlWriterSettings
        {
            Async = true,
            Indent = true,
            Encoding = new UTF8Encoding(false),
        };

        await using var writer = XmlWriter.Create(output, settings);

        await writer.WriteStartDocumentAsync().ConfigureAwait(false);
        await writer.WriteStartElementAsync(prefix: null, "rows", ns: null).ConfigureAwait(false);

        var count = 0;

        await foreach (var row in rows.WithCancellation(cancellationToken).ConfigureAwait(false))
        {
            await writer.WriteStartElementAsync(prefix: null, "row", ns: null).ConfigureAwait(false);

            foreach (var cell in row.Cells)
            {
                await writer.WriteAttributeStringAsync(
                    null, XmlConvert.EncodeLocalName(cell.Key), null, FormatValue(cell.Value))
                    .ConfigureAwait(false);
            }

            await writer.WriteEndElementAsync().ConfigureAwait(false);
            count++;

            await onRowWritten(count, cancellationToken).ConfigureAwait(false);
        }

        await writer.WriteEndElementAsync().ConfigureAwait(false);
        await writer.WriteEndDocumentAsync().ConfigureAwait(false);
        await writer.FlushAsync().ConfigureAwait(false);

        return count;
    }

    private static async Task<int> WriteCsvAsync(
        IAsyncEnumerable<ReportRow> rows,
        Stream output,
        Func<int, CancellationToken, Task> onRowWritten,
        CancellationToken cancellationToken)
    {
        await using var writer = new StreamWriter(output, new UTF8Encoding(false), leaveOpen: true);
        writer.NewLine = "\r\n";

        var count = 0;
        string[]? header = null;

        await foreach (var row in rows.WithCancellation(cancellationToken).ConfigureAwait(false))
        {
            if (header is null)
            {
                header = row.Cells.Select(c => c.Key).ToArray();
                await writer.WriteLineAsync(string.Join(',', header.Select(EscapeCsv))).ConfigureAwait(false);
            }

            await writer.WriteLineAsync(string.Join(',', row.Cells.Select(c => EscapeCsv(FormatValue(c.Value)))))
                .ConfigureAwait(false);

            count++;
            await onRowWritten(count, cancellationToken).ConfigureAwait(false);
        }

        await writer.FlushAsync(cancellationToken).ConfigureAwait(false);

        return count;
    }

    private static string FormatValue(object? value) => value switch
    {
        null => string.Empty,
        DateTimeOffset dto => dto.ToString("O", CultureInfo.InvariantCulture),
        DateTime dt => dt.ToString("O", CultureInfo.InvariantCulture),
        IFormattable formattable => formattable.ToString(null, CultureInfo.InvariantCulture),
        _ => value.ToString() ?? string.Empty,
    };

    private static string EscapeCsv(string value)
    {
        if (value.IndexOfAny([',', '"', '\n', '\r']) < 0)
        {
            return value;
        }

        return "\"" + value.Replace("\"", "\"\"", StringComparison.Ordinal) + "\"";
    }
}

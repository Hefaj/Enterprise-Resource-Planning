namespace Erp.BuildingBlocks.Reporting;

/// <summary>
/// Parametry przekazane definicji raportu — filtr źródła i opcje, nieprzezroczyste dla runnera.
/// </summary>
/// <param name="ParametersJson">Blob JSON z <see cref="ReportRun.ParametersJson"/>; definicja
/// deserializuje go do własnego, typowanego kształtu filtra.</param>
/// <param name="Format">Format wyjściowy zlecony przez klienta — musi należeć do
/// <see cref="IReportDefinition.Formats"/>.</param>
public sealed record ReportParameters(string? ParametersJson, string Format);

/// <summary>
/// Wynik pre-checku kosztu — patrz <c>docs/architecture/reporting.md</c> §5.4. Odmowa PRZED
/// założeniem przebiegu jest tańsza dla użytkownika niż czterdzieści minut mielenia zakończone
/// timeoutem.
/// </summary>
/// <param name="Allowed">Czy przebieg wolno założyć.</param>
/// <param name="EstimatedRowCount">Przybliżona liczba wierszy źródłowych, jeśli policzona.</param>
/// <param name="ErrorCode">Kod błędu w <c>snake_case</c>, gdy <paramref name="Allowed"/> jest
/// <c>false</c> — tekst dla użytkownika buduje z niego frontend przez Transloco.</param>
public sealed record ReportEstimate(bool Allowed, long? EstimatedRowCount, string? ErrorCode)
{
    /// <summary>Skrót dla definicji, które nie liczą kosztu — raport zawsze dozwolony.</summary>
    public static ReportEstimate Unbounded { get; } = new(true, null, null);

    /// <summary>Skrót dla odmowy z konkretnym kodem błędu.</summary>
    public static ReportEstimate Denied(string errorCode) => new(false, null, errorCode);
}

/// <summary>
/// Jeden wiersz wyjściowy raportu — para (nazwa kolumny, wartość), w kolejności, w jakiej mają
/// się pojawić w pliku. Lista, nie słownik: kolejność kolumn jest częścią kontraktu wyjścia,
/// a <see cref="Dictionary{TKey,TValue}"/> jej nie gwarantuje.
/// </summary>
public sealed class ReportRow
{
    public ReportRow(IReadOnlyList<KeyValuePair<string, object?>> cells)
    {
        ArgumentNullException.ThrowIfNull(cells);
        Cells = cells;
    }

    public IReadOnlyList<KeyValuePair<string, object?>> Cells { get; }

    /// <summary>Buduje wiersz z par (kolumna, wartość) — wygodniejsze w definicjach niż
    /// ręczne składanie <see cref="KeyValuePair{TKey,TValue}"/>.</summary>
    public static ReportRow Of(params (string Column, object? Value)[] cells)
    {
        ArgumentNullException.ThrowIfNull(cells);
        return new ReportRow(cells.Select(c => new KeyValuePair<string, object?>(c.Column, c.Value)).ToList());
    }
}

/// <summary>
/// Jedyne, co pisze autor raportu — patrz <c>docs/architecture/reporting.md</c> §4.
///
/// <para>Implementacje wyłapuje skan zestawów w <c>AddErpModule</c> (rejestracja pod
/// <see cref="IReportDefinition"/>, wieloznaczna — jeden moduł może mieć kilka definicji).
/// Nowa definicja nie dopisuje <c>AddScoped</c> nigdzie, ma tylko leżeć w
/// <c>{Modul}.Application</c> i implementować ten interfejs.</para>
///
/// <para><see cref="ReportRunner{TContext}"/> jest jeden dla wszystkich definicji
/// wszystkich modułów i robi dokładnie to, co dziś <c>ExportRunner</c>: krótka transakcja
/// przejęcia pod <c>SKIP LOCKED</c>, bicie serca, postęp co 500 rekordów, artefakt zapisany
/// PRZED zmianą statusu.</para>
/// </summary>
public interface IReportDefinition
{
    /// <summary>Klucz definicji, np. <c>"catalog.product-export"</c>, <c>"sales.revenue-by-month"</c>.
    /// Unikalny w obrębie całego systemu (idzie do <see cref="ReportRun.ReportKey"/>).</summary>
    string Key { get; }

    /// <summary>Formaty wyjściowe, jakie ta definicja umie wyprodukować.</summary>
    IReadOnlySet<string> Formats { get; }

    /// <summary>
    /// Pre-check kosztu — wołany PRZED założeniem przebiegu, w wątku żądania HTTP. Musi być
    /// szybki (typowo <c>COUNT</c> z limitem albo walidacja zakresu parametrów), nie strumieniuje
    /// wyniku.
    /// </summary>
    Task<ReportEstimate> EstimateAsync(ReportParameters parameters, CancellationToken cancellationToken);

    /// <summary>
    /// Strumień wierszy wyjściowych. Runner nigdy nie zobaczy całego wyniku naraz — źródłem musi
    /// być zapytanie <c>AsNoTracking</c> materializowane wiersz po wierszu
    /// (<c>AsAsyncEnumerable</c>), a agregacja (<c>GROUP BY</c>, sumy) ma się dziać w SQL, nie
    /// w pętli C#.
    /// </summary>
    IAsyncEnumerable<ReportRow> StreamAsync(ReportParameters parameters, CancellationToken cancellationToken);
}

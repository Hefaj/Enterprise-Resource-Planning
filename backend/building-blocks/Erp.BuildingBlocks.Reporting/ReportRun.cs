using Erp.BuildingBlocks.Domain;
using Microsoft.EntityFrameworkCore;

namespace Erp.BuildingBlocks.Reporting;

/// <summary>
/// Przebieg raportu — jedna operacja „zrób plik z tego, co pasuje do definicji". Uogólnienie
/// dawnego <c>Catalog.Domain.ExportRuns.ExportRun</c> (patrz <c>docs/backend/reporting.md</c> §3):
/// eksport katalogu jest dziś jedną z definicji (<c>catalog.product-export</c>), nie osobnym
/// agregatem obok.
///
/// <para><b>Dlaczego ta klasa mieszka w building blocku, a nie w <c>{Modul}.Domain</c>.</b>
/// Dokładnie z tego samego powodu co <see cref="Jobs.Job"/>: generalizacja z
/// <c>docs/backend/reporting.md</c> §2 dotyczy KODU, nie DANYCH. Każdy moduł mapuje tę SAMĄ
/// klasę do WŁASNEJ tabeli we własnym schemacie (<c>catalog.report_run</c>,
/// <c>taskmgmt.report_run</c>) przez własny <c>DbContext</c> —
/// <see cref="ReportRunConfiguration"/> aplikuje się tam przez
/// <c>modelBuilder.ApplyConfiguration(new ReportRunConfiguration())</c>, tak samo jak
/// <c>JobConfiguration</c>. Nie ma jednej tabeli <c>report_run</c> współdzielonej przez moduły —
/// to złamałoby zakaz joinów cross-schema równie mocno jak wspólna tabela <c>job</c>.
/// Gdyby ten agregat mieszkał w <c>Catalog.Domain</c>, złamałby też regułę „Domena zna wyłącznie
/// fundament domenowy" — potrzebuje <see cref="ReportRunner{TContext}"/>, magazynu artefaktów
/// i EF Core, które są warstwą infrastruktury.</para>
/// </summary>
public class ReportRun : AggregateRoot
{
    /// <summary>Konstruktor dla EF Core.</summary>
    protected ReportRun()
    {
    }

    private ReportRun(Guid uuid, string reportKey, string format, string? parametersJson, DateTimeOffset createdAt)
        : base(uuid)
    {
        ReportKey = reportKey;
        Format = format;
        ParametersJson = parametersJson;
        CreatedAt = createdAt;
        Status = ReportRunStatus.Pending;
    }

    /// <summary>Klucz definicji raportu, np. <c>"catalog.product-export"</c> — po nim
    /// <see cref="ReportRunner{TContext}"/> odnajduje <see cref="IReportDefinition"/>
    /// zarejestrowaną w module.</summary>
    public string ReportKey { get; private set; } = string.Empty;

    /// <summary>Format wyjściowy, np. <c>xml</c>, <c>csv</c>.</summary>
    public string Format { get; private set; } = string.Empty;

    /// <summary>Serializowany filtr źródła i parametry raportu — dla backendu nieprzezroczysty
    /// blob, przekazywany definicji jako <see cref="ReportParameters"/>.</summary>
    public string? ParametersJson { get; private set; }

    public ReportRunStatus Status { get; private set; }

    /// <summary>Zadanie niosące ten przebieg do powiadomień; <c>job.uuid</c> = <c>trackingID</c>.</summary>
    public Guid JobUuid { get; private set; }

    /// <summary>
    /// Artefakt w magazynie. Wypełniane <b>dopiero</b> po tym, jak plik faktycznie się zapisał —
    /// odwrotna kolejność dawałaby użytkownikowi przycisk „Pobierz" prowadzący w pustkę.
    /// </summary>
    public Guid? ArtifactUuid { get; private set; }

    /// <summary>Liczba wierszy zapisanych do artefaktu.</summary>
    public int RecordCount { get; private set; }

    /// <summary>Kod błędu w <c>snake_case</c>, gdy przebieg poległ — tekst dla użytkownika
    /// buduje z niego frontend przez Transloco.</summary>
    public string? ErrorCode { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? FinishedAt { get; private set; }

    /// <summary>
    /// Ostatni znak życia runnera wykonującego ten przebieg.
    ///
    /// <para><b>Dlaczego akurat tu bicie serca, a nie blokada wiersza jak przy zadaniach masowych.</b>
    /// Przebieg raportu strumieniuje potencjalnie dziesiątki tysięcy wierszy do magazynu
    /// artefaktów. Trzymanie transakcji Postgresa przez cały ten czas oznaczałoby długowieczny
    /// snapshot blokujący <c>VACUUM</c>. Wyłączność jest więc dwuczęściowa: krótka transakcja
    /// przejęcia (<see cref="MarkStarted"/>) i znacznik czasu odświeżany w trakcie pracy.</para>
    /// </summary>
    public DateTimeOffset? HeartbeatAt { get; private set; }

    /// <summary>Kiedy artefakt przestaje być dostępny — spójne z <c>job.expire_on</c>.</summary>
    public DateTimeOffset? ExpireOn { get; private set; }

    /// <summary>Zlecenie raportu. Uuid generuje klient (patrz <c>docs/backend/endpoint-naming.md</c> §4).</summary>
    /// <exception cref="DomainException">Gdy klucz definicji albo format jest pusty.</exception>
    public static ReportRun Create(
        Guid uuid, string reportKey, string format, string? parametersJson, DateTimeOffset createdAt)
    {
        if (string.IsNullOrWhiteSpace(reportKey))
        {
            throw new DomainException("report_run_key_empty", "Klucz definicji raportu jest wymagany.");
        }

        if (string.IsNullOrWhiteSpace(format))
        {
            throw new DomainException("report_run_format_empty", "Format raportu jest wymagany.");
        }

        return new ReportRun(uuid, reportKey.Trim(), format.Trim().ToLowerInvariant(), parametersJson, createdAt);
    }

    /// <summary>Wiąże przebieg z zadaniem, które niesie go do powiadomień.</summary>
    public void AttachJob(Guid jobUuid, DateTimeOffset? expireOn)
    {
        JobUuid = jobUuid;
        ExpireOn = expireOn;
    }

    /// <summary>Oznacza podjęcie przez runnera i zapala pierwszy znak życia.</summary>
    public void MarkStarted(DateTimeOffset now)
    {
        if (Status != ReportRunStatus.Pending)
        {
            return;
        }

        Status = ReportRunStatus.Running;
        HeartbeatAt = now;
    }

    /// <summary>Odświeża znak życia. Wołane przy okazji zapisu postępu, więc nie dokłada
    /// ruchu do bazy — dopisuje pole do <c>UPDATE</c>, który i tak leci co porcję wierszy.</summary>
    public void Heartbeat(DateTimeOffset now)
    {
        if (Status != ReportRunStatus.Running)
        {
            return;
        }

        HeartbeatAt = now;
    }

    /// <summary>Oddaje przebieg do puli po runnerze, który przestał dawać znaki życia.</summary>
    public void ReturnToPending()
    {
        if (Status != ReportRunStatus.Running)
        {
            return;
        }

        Status = ReportRunStatus.Pending;
        HeartbeatAt = null;
    }

    /// <summary>Zamyka przebieg powodzeniem. Wymaga artefaktu — przebieg „udany, ale bez pliku"
    /// nie istnieje, bo plik JEST jego wynikiem.</summary>
    /// <exception cref="DomainException">Gdy przebieg nie jest w toku.</exception>
    public void Complete(Guid artifactUuid, int recordCount, DateTimeOffset finishedAt)
    {
        if (Status is ReportRunStatus.Completed or ReportRunStatus.Failed)
        {
            throw new DomainException("report_run_already_finished", "Przebieg raportu jest już zakończony.");
        }

        ArgumentOutOfRangeException.ThrowIfNegative(recordCount);

        ArtifactUuid = artifactUuid;
        RecordCount = recordCount;
        Status = ReportRunStatus.Completed;
        FinishedAt = finishedAt;
    }

    /// <summary>Zamyka przebieg niepowodzeniem. Nie ma statusu pośredniego: nie istnieje raport
    /// udany w 96%, więc wiersz, którego nie da się zserializować, przerywa całość.</summary>
    public void Fail(string errorCode, DateTimeOffset finishedAt)
    {
        if (Status is ReportRunStatus.Completed or ReportRunStatus.Failed)
        {
            return;
        }

        ErrorCode = string.IsNullOrWhiteSpace(errorCode) ? "report_run_failed" : errorCode;
        Status = ReportRunStatus.Failed;
        FinishedAt = finishedAt;
    }
}

/// <summary>Mapowanie EF dla <see cref="ReportRun"/> — aplikowane przez KAŻDY moduł osobno,
/// w jego własnym schemacie (patrz komentarz przy klasie).</summary>
public sealed class ReportRunConfiguration : Microsoft.EntityFrameworkCore.IEntityTypeConfiguration<ReportRun>
{
    public void Configure(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<ReportRun> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("report_run");
        builder.HasKey(r => r.Uuid);

        builder.Property(r => r.ReportKey).HasMaxLength(128).IsRequired();
        builder.Property(r => r.Format).HasMaxLength(32).IsRequired();
        builder.Property(r => r.ParametersJson).HasColumnType("jsonb");
        builder.Property(r => r.ErrorCode).HasMaxLength(128);

        // Jak przy Job: status jako liczba, bo kolejność wartości jest kontraktem, a filtrowanie
        // po int jest tańsze niż po tekście.
        builder.Property(r => r.Status).HasConversion<int>();

        // Predykat, którym ReportRunner szuka pracy.
        builder.HasIndex(r => new { r.Status, r.CreatedAt });

        // Wyszukiwanie przebiegu po zadaniu, z którym jest związany.
        builder.HasIndex(r => r.JobUuid);

        // Filtr listy przebiegów po definicji, z której powstały.
        builder.HasIndex(r => r.ReportKey);
    }
}

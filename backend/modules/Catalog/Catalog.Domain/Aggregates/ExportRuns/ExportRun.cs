using Erp.BuildingBlocks.Domain;

namespace Catalog.Domain.ExportRuns;

/// <summary>Stan przebiegu eksportu.</summary>
public enum ExportRunStatus
{
    /// <summary>Zlecony, czeka na podjęcie przez runnera.</summary>
    Pending = 0,

    /// <summary>W trakcie — rekordy lecą do artefaktu.</summary>
    Running = 1,

    /// <summary>Zakończony, artefakt gotowy do pobrania.</summary>
    Completed = 2,

    /// <summary>Przerwany błędem; artefakt nie powstał.</summary>
    Failed = 3,
}

/// <summary>
/// Przebieg eksportu — jedna operacja „zrób plik z tego, co pasuje do filtra".
///
/// <para><b>Dlaczego to jest agregat, a nie komenda <c>Exec</c> na produkcie.</b> Eksport jest
/// operacją typu <i>reduce</i>: N rekordów źródłowych daje JEDEN artefakt, więc nie ma czego
/// raportować per produkt ani czego ponawiać per produkt. Osobny agregat daje mu za darmo
/// wszystko, czego taka operacja potrzebuje — status, historię, realtime ze skanu ChangeTrackera,
/// uprawnienie w konwencji <c>{moduł}.{zasób}.{akcja}</c> i miejsce na referencję do artefaktu.
/// Szerzej: <c>docs/backend/exports-artifacts.md</c> §1-2.</para>
///
/// <para>Wiersz w tabeli <c>job</c> (rodzaju <see cref="Erp.BuildingBlocks.Contracts.JobKind.Reduce"/>)
/// istnieje obok i pełni inną rolę: to on niesie zadanie do dzwonka powiadomień i historii zadań,
/// bo tam żyje adresat (<c>user_id</c>) i kanał <c>jobs</c>. Ten agregat opisuje eksport,
/// tamten wiersz — jego widoczność dla użytkownika.</para>
/// </summary>
public class ExportRun : AggregateRoot
{
    /// <summary>Konstruktor dla EF Core.</summary>
    protected ExportRun()
    {
    }

    private ExportRun(Guid uuid, string format, string? parametersJson, DateTimeOffset createdAt) : base(uuid)
    {
        Format = format;
        ParametersJson = parametersJson;
        CreatedAt = createdAt;
        Status = ExportRunStatus.Pending;
    }

    /// <summary>Format wyjściowy, np. <c>xml</c>.</summary>
    public string Format { get; private set; } = string.Empty;

    /// <summary>Serializowany filtr źródła i opcje formatu — dla backendu nieprzezroczysty blob.</summary>
    public string? ParametersJson { get; private set; }

    public ExportRunStatus Status { get; private set; }

    /// <summary>Zadanie niosące ten przebieg do powiadomień; <c>job.uuid</c> = <c>trackingID</c>.</summary>
    public Guid JobUuid { get; private set; }

    /// <summary>
    /// Artefakt w magazynie. Wypełniane <b>dopiero</b> po tym, jak plik faktycznie się zapisał —
    /// odwrotna kolejność dawałaby użytkownikowi przycisk „Pobierz" prowadzący w pustkę.
    /// </summary>
    public Guid? ArtifactUuid { get; private set; }

    /// <summary>Liczba rekordów zapisanych do artefaktu.</summary>
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
    /// Przebieg eksportu strumieniuje dziesiątki tysięcy rekordów do magazynu artefaktów. Trzymanie
    /// transakcji Postgresa przez cały ten czas oznaczałoby długowieczny snapshot blokujący
    /// <c>VACUUM</c> — lekarstwo gorsze od choroby. Wyłączność jest więc dwuczęściowa: krótka
    /// transakcja przejęcia (<see cref="MarkStarted"/>) i znacznik czasu odświeżany w trakcie pracy.</para>
    ///
    /// <para>Przebieg w stanie <see cref="ExportRunStatus.Running"/> ze starym znacznikiem to
    /// przebieg po martwym runnerze — wraca do <see cref="ExportRunStatus.Pending"/> przez
    /// <see cref="ReturnToPending"/>. Bez tego padnięcie runnera w połowie eksportu zostawiało
    /// przebieg w stanie „w toku" na zawsze; było to prawdą także przy jednej instancji.</para>
    /// </summary>
    public DateTimeOffset? HeartbeatAt { get; private set; }

    /// <summary>Kiedy artefakt przestaje być dostępny — spójne z <c>job.expire_on</c>.</summary>
    public DateTimeOffset? ExpireOn { get; private set; }

    /// <summary>Zlecenie eksportu. Uuid generuje klient (patrz <c>docs/backend/endpoint-naming.md</c> §4).</summary>
    /// <exception cref="DomainException">Gdy format jest pusty.</exception>
    public static ExportRun Create(Guid uuid, string format, string? parametersJson, DateTimeOffset createdAt)
    {
        if (string.IsNullOrWhiteSpace(format))
        {
            throw new DomainException("export_run_format_empty", "Format eksportu jest wymagany.");
        }

        return new ExportRun(uuid, format.Trim().ToLowerInvariant(), parametersJson, createdAt);
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
        if (Status != ExportRunStatus.Pending)
        {
            return;
        }

        Status = ExportRunStatus.Running;
        HeartbeatAt = now;
    }

    /// <summary>
    /// Odświeża znak życia. Wołane przy okazji zapisu postępu, więc <b>nie dokłada ruchu
    /// do bazy</b> — dopisuje pole do <c>UPDATE</c>, który i tak leci co porcję rekordów.
    /// </summary>
    public void Heartbeat(DateTimeOffset now)
    {
        if (Status != ExportRunStatus.Running)
        {
            return;
        }

        HeartbeatAt = now;
    }

    /// <summary>
    /// Oddaje przebieg do puli po runnerze, który przestał dawać znaki życia.
    ///
    /// <para>Przebieg zakończony (powodzeniem albo błędem) jest nietykalny — odzysk dotyczy
    /// wyłącznie pracy porzuconej w trakcie.</para>
    /// </summary>
    public void ReturnToPending()
    {
        if (Status != ExportRunStatus.Running)
        {
            return;
        }

        Status = ExportRunStatus.Pending;
        HeartbeatAt = null;
    }

    /// <summary>
    /// Zamyka przebieg powodzeniem. Wymaga artefaktu — przebieg „udany, ale bez pliku"
    /// nie istnieje, bo plik JEST jego wynikiem.
    /// </summary>
    /// <exception cref="DomainException">Gdy przebieg nie jest w toku.</exception>
    public void Complete(Guid artifactUuid, int recordCount, DateTimeOffset finishedAt)
    {
        if (Status is ExportRunStatus.Completed or ExportRunStatus.Failed)
        {
            throw new DomainException("export_run_already_finished", "Przebieg eksportu jest już zakończony.");
        }

        ArgumentOutOfRangeException.ThrowIfNegative(recordCount);

        ArtifactUuid = artifactUuid;
        RecordCount = recordCount;
        Status = ExportRunStatus.Completed;
        FinishedAt = finishedAt;
    }

    /// <summary>
    /// Zamyka przebieg niepowodzeniem. Nie ma statusu pośredniego: nie istnieje plik udany
    /// w 96%, więc rekord, którego nie da się zserializować, przerywa całość.
    /// </summary>
    public void Fail(string errorCode, DateTimeOffset finishedAt)
    {
        if (Status is ExportRunStatus.Completed or ExportRunStatus.Failed)
        {
            return;
        }

        ErrorCode = string.IsNullOrWhiteSpace(errorCode) ? "export_run_failed" : errorCode;
        Status = ExportRunStatus.Failed;
        FinishedAt = finishedAt;
    }
}

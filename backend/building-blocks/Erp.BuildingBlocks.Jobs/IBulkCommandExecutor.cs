namespace Erp.BuildingBlocks.Jobs;

/// <summary>
/// Wykonuje komendę zadania masowego dla pojedynczego agregatu.
///
/// To jest jedyny punkt styku generycznego silnika zadań z konkretną domeną: silnik wie,
/// jak kolejkować, dzielić na chunki, ponawiać i raportować, ale nie ma pojęcia, czym jest
/// produkt ani cena. Moduł rejestruje implementację per typ komendy, a runner odnajduje ją
/// po <see cref="CommandType"/> zapisanym w wierszu <c>job</c>.
///
/// Implementacja NIE zapisuje zmian sama — <c>SaveChanges</c> woła runner raz na chunk.
/// Ma wyłącznie załadować agregat i wywołać na nim metodę domenową; naruszenie reguły
/// zgłasza wyjątkiem <see cref="Domain.DomainException"/>, którego <c>ErrorCode</c> trafi
/// wprost do <c>job_item.error_code</c>.
/// </summary>
public interface IBulkCommandExecutor
{
    /// <summary>Nazwa typu komendy, którą ta implementacja obsługuje —
    /// musi zgadzać się z <see cref="Job.CommandType"/>.</summary>
    string CommandType { get; }

    /// <summary>
    /// Nakłada komendę na wskazany agregat w bieżącej jednostce pracy.
    /// </summary>
    /// <param name="aggregateUuid">Agregat do zmiany.</param>
    /// <param name="commandJson">Serializowana komenda-szablon.</param>
    /// <param name="cancellationToken">Token anulowania.</param>
    Task ExecuteAsync(Guid aggregateUuid, string? commandJson, CancellationToken cancellationToken);

    /// <summary>
    /// Wczytuje z góry agregaty całego chunka, zanim runner zacznie wykonywać jego elementy —
    /// jedno zapytanie zamiast jednego na element (N+1).
    ///
    /// <para>Domyślnie nie robi nic, więc egzekutory i moduły, które tego nie potrzebują,
    /// nie zauważają zmiany. Faktyczną robotę wykonuje handler komendy, jeśli implementuje
    /// <see cref="Application.Abstractions.IBulkPreloadingHandler"/> — to on wie, ile agregatu
    /// wymaga jego metoda domenowa.</para>
    ///
    /// <para><b>Optymalizacja, nie warunek poprawności.</b> <see cref="ExecuteAsync"/> musi
    /// działać tak samo, gdy tej metody nikt nie wywołał — tak dzieje się przy pojedynczej
    /// komendzie z endpointu HTTP i przy elemencie powtarzanym w trybie izolacji.</para>
    /// </summary>
    /// <param name="aggregateUuids">Agregaty chunka, odduplikowane przez runnera.</param>
    /// <param name="cancellationToken">Token anulowania.</param>
    Task PreloadAsync(IReadOnlyCollection<Guid> aggregateUuids, CancellationToken cancellationToken)
        => Task.CompletedTask;
}

namespace Erp.BuildingBlocks.Persistence.Concurrency;

/// <summary>
/// Wyłączność na nazwany zasób między instancjami serwisu.
///
/// <para><b>Po co.</b> Usługi tła chodzące cyklicznie (audyt mediów, sprzątanie wygasłych nadań,
/// uzgadnianie katalogu uprawnień) przy dwóch instancjach wykonują tę samą pracę dwa razy.
/// Sama praca bywa idempotentna, ale jej ślad — wpisy audytowe, zdarzenia integracyjne — już nie.</para>
///
/// <para><b>Dlaczego advisory lock, a nie kolumna <c>locked_until</c> w tabeli.</b> Dzierżawa
/// z terminem wymaga odpowiedzi na pytanie „co, gdy właściciel padł, a termin jeszcze nie minął" —
/// czyli bicia serca, tolerancji na rozjazd zegarów i procedury odzysku osieroconych dzierżaw.
/// Advisory lock nie ma tego problemu z definicji: właściciel przestaje istnieć razem ze swoją
/// sesją TCP, więc Postgres zwalnia lock <b>sam</b>. Kolumna jest potrzebna dokładnie tam, gdzie
/// praca trwa dłużej, niż wolno trzymać otwarte połączenie w wyłączności — czyli w raporcie
/// (<c>report_run.heartbeat_at</c>) i nigdzie indziej.</para>
///
/// <para><b>Dlaczego Postgres, a nie Redis.</b> Zewnętrzny lock obok <c>job.status</c> byłby drugim
/// źródłem prawdy, zdolnym rozjechać się z pierwszym. Postgres i tak jest transakcyjnym źródłem
/// prawdy tego systemu — patrz <c>docs/architecture/multi-instance.md</c> §1.</para>
/// </summary>
public interface IExclusiveLease
{
    /// <summary>
    /// Próbuje wziąć wyłączność na nazwany zasób i wraca natychmiast.
    ///
    /// <para>Dla pracy cyklicznej: gdy dzierżawę trzyma ktoś inny, przebieg należy <b>pominąć</b>,
    /// nie kolejkować — następny cykl i tak nadejdzie.</para>
    /// </summary>
    /// <param name="resource">Nazwa zasobu, np. <c>catalog:media-reconciliation</c>. Konwencja:
    /// <c>{moduł}:{zadanie}</c>. Nazwa jest hashowana, więc jej długość nie ma znaczenia — ale
    /// kolizja hashy oznacza dwie usługi wykluczające się nawzajem bez powodu.</param>
    /// <param name="cancellationToken">Token anulowania.</param>
    /// <returns>Token dzierżawy do zwolnienia przez <c>DisposeAsync</c>, albo <c>null</c>,
    /// gdy zasób jest zajęty.</returns>
    Task<IAsyncDisposable?> TryAcquireAsync(string resource, CancellationToken cancellationToken);

    /// <summary>
    /// Czeka na wyłączność na nazwany zasób.
    ///
    /// <para>Dla pracy startowej (seedy, uzgadnianie katalogu uprawnień): instancja B ma
    /// <b>zobaczyć uzgodniony stan</b>, a nie pominąć krok, więc czeka na swoją kolej i zastaje
    /// robotę już zrobioną. Praca jest krótka, więc czekanie jest tanie.</para>
    /// </summary>
    /// <param name="resource">Nazwa zasobu — jak w <see cref="TryAcquireAsync"/>.</param>
    /// <param name="cancellationToken">Token anulowania.</param>
    /// <returns>Token dzierżawy do zwolnienia przez <c>DisposeAsync</c>.</returns>
    Task<IAsyncDisposable> AcquireAsync(string resource, CancellationToken cancellationToken);
}

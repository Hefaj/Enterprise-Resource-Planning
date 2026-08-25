namespace Erp.BuildingBlocks.Application.Commands;

/// <summary>Ustawienia pipeline'u komend; sekcja <c>Commands</c> w konfiguracji hosta.</summary>
public sealed class CommandPipelineOptions
{
    /// <summary>Nazwa sekcji w <c>appsettings.json</c>.</summary>
    public const string SectionName = "Commands";

    /// <summary>
    /// Jak długo pamiętany jest wynik operacji wykonanej z danym <c>X-Request-Id</c>.
    ///
    /// <para>Okno ma pokryć ponowienia klienta — sieciowe, użytkownika i po odzyskaniu
    /// połączenia — a nie służyć za historię operacji. Doba jest kompromisem: dłuższe okno
    /// nie chroni już przed niczym realnym, a rozrasta tabelę, którą trzeba sprzątać.</para>
    /// </summary>
    public TimeSpan IdempotencyRetention { get; set; } = TimeSpan.FromDays(1);

    /// <summary>Co ile sprzątane są wygasłe klucze idempotencji.</summary>
    public TimeSpan IdempotencyCleanupInterval { get; set; } = TimeSpan.FromHours(1);
}

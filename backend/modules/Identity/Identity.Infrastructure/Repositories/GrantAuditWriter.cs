using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Application.Messaging;
using Identity.Application.Abstractions;
using Identity.Domain.Audit;
using Identity.Infrastructure.Persistence;

namespace Identity.Infrastructure.Repositories;

/// <inheritdoc cref="IGrantAuditWriter" />
///
/// <remarks>
/// <para><b>Ten writer jest też jedynym miejscem, z którego wychodzi sygnał unieważnienia
/// cache'u uprawnień</b> (<see cref="PermissionsInvalidated"/>) — i to nie jest doklejenie
/// obcej odpowiedzialności, tylko wykorzystanie niezmiennika, który już obowiązuje: <i>każda
/// zmiana tego, kto co może, zostawia wpis w <c>grant_audit</c></i>. Nadanie roli, odebranie
/// uprawnienia, dodanie członka do roli, wygaśnięcie nadania, wymuszone wylogowanie — wszystkie
/// przechodzą tędy. Alternatywą było dopisanie publikacji do ośmiu handlerów, czyli osiem
/// miejsc, w których dziewiąty handler może o niej zapomnieć.</para>
///
/// <para><b>Sygnał idzie przez outbox, w tej samej transakcji co wpis.</b> Publikacja poza
/// transakcją mogłaby wyprzedzić commit — instancje wyczyściłyby cache, po czym natychmiast
/// wczytały z powrotem STARY stan, bo zmiana jeszcze nie byłaby widoczna. Outbox wyklucza
/// zarówno to, jak i sytuację odwrotną: rollback zabiera sygnał ze sobą.</para>
/// </remarks>
public sealed class GrantAuditWriter : IGrantAuditWriter
{
    private readonly IdentityDbContext _dbContext;
    private readonly IIntegrationEventPublisher _publisher;
    private readonly IClock _clock;

    public GrantAuditWriter(
        IdentityDbContext dbContext,
        IIntegrationEventPublisher publisher,
        IClock clock)
    {
        _dbContext = dbContext;
        _publisher = publisher;
        _clock = clock;
    }

    public async Task RecordAsync(GrantAuditEntry entry, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(entry);

        // Wyłącznie Add() — SaveChangesAsync robi wołający (IUnitOfWork), żeby wpis audytowy
        // zapisał się w TEJ SAMEJ transakcji co zmiana, którą opisuje.
        _dbContext.GrantAuditEntries.Add(entry);

        // Zmiana na roli dotyka wszystkich jej członków, a ich lista nie jest tutaj znana —
        // i nie warto jej tu poznawać: przy kilkuset członkach kilkaset sygnałów byłoby gorsze
        // niż jedno pełne czyszczenie cache'u, który i tak odbudowuje się leniwie.
        var userId = string.Equals(entry.SubjectType, "user", StringComparison.Ordinal)
            ? entry.SubjectUuid.ToString()
            : null;

        await _publisher
            .PublishAsync(new PermissionsInvalidated(userId, _clock.UtcNow), cancellationToken)
            .ConfigureAwait(false);
    }
}

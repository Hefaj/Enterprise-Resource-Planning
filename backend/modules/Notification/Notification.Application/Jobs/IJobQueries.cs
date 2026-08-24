using Erp.BuildingBlocks.Api.Contracts;

namespace Notification.Application.Jobs;

/// <summary>
/// Odczyty repliki zadań. Implementacja w <c>Notification.Infrastructure</c>.
///
/// <para><b>Właściciel jest parametrem, nie filtrem z żądania.</b> Obie metody przyjmują
/// <c>ownerUserId</c> osobno, bo feed powiadomień pokazuje wyłącznie zadania zalogowanego
/// użytkownika. Endpoint bierze tę wartość z <c>IExecutionContext</c> (czyli z claimu <c>sub</c>
/// tokenu), nigdy z ciała żądania — inaczej dowolny klient odczytałby cudzy feed, podając obce
/// <c>userId</c>. Endpointy zadań są świadomie bez <c>Permissions(...)</c> (własny feed, nie
/// zasób uprzywilejowany), więc to zawężenie jest tu jedyną kontrolą dostępu.</para>
/// </summary>
public interface IJobQueries
{
    Task<SearchResponse> SearchAsync(SearchJobRequest request, string ownerUserId, CancellationToken cancellationToken);

    Task<List<JobDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, string ownerUserId, CancellationToken cancellationToken);
}

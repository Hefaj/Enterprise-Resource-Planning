using TaskManagement.Domain.Workflow;

namespace TaskManagement.Application.Issues;

/// <summary>
/// Utrzymuje denormalizowany postęp realizacji zlecenia. Implementacja czyta powiązania i stany
/// przez SQL, ale zmienia docelowe <c>Issue</c> w tej samej transakcji co komenda źródłowa.
/// </summary>
public interface IRequestDeliveryStateRecalculator
{
    Task RecalculateRequestAsync(Guid requestUuid, DateTimeOffset now, CancellationToken cancellationToken);

    Task RecalculateForDeliveryAsync(Guid deliveryIssueUuid, DateTimeOffset now, CancellationToken cancellationToken);
}

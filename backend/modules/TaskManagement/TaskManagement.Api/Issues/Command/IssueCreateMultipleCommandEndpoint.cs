using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Command;

/// <summary>
/// Seryjne zakładanie zgłoszeń. Tryby „szablon + filtr” i „szablon + identyfikatory” nie mają tu
/// zastosowania (cel jeszcze nie istnieje) — odrzuca je <see cref="CreateBatchEndpointBase{TCommand, TFilter}"/>
/// błędem 400. Sensowny jest wyłącznie tryb <c>Commands[]</c>.
/// </summary>
public sealed class IssueCreateMultipleCommandEndpoint
    : CreateBatchEndpointBase<IssueCreateCommand, SearchIssueRequest>
{
    public override void Configure()
    {
        Post("batch-create");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueCreate);
        Description(d => d
            .WithSummary("Seryjne zakładanie zgłoszeń z obsługą błędów cząstkowych")
            .WithDescription(
                "Klucz czytelny (`DEV-123`) nadaje serwer z licznika projektu — nie przekazuje "
                + "się go w komendzie."));
    }
}

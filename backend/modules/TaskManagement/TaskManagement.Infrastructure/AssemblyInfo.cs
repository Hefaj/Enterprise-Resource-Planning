using System.Runtime.CompilerServices;

// PERM-005 (docs/modules/task-management/requirements.md) — test regresyjny w
// Erp.IntegrationTests dowodzi przez wykonanie, że `IssueVisibility.VisibleTo` nigdy nie
// przyjmuje informacji o uprawnieniach (predykat widoczności zgłoszeń jest ślepy na
// `taskmgmt.report.read.all` strukturalnie, nie przez konwencję). Przepisanie predykatu w teście
// sprawdzałoby kopię mechanizmu, nie mechanizm — ten sam argument co przy `Erp.BuildingBlocks
// .Reporting.AssemblyInfo`.
[assembly: InternalsVisibleTo("Erp.IntegrationTests")]

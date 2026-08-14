using Microsoft.EntityFrameworkCore;

namespace Erp.BuildingBlocks.Jobs;

/// <summary>
/// Kontrakt, który musi spełnić <c>DbContext</c> modułu, żeby móc wykonywać zadania masowe.
/// Tabele <c>job</c>/<c>job_item</c> żyją w schemacie modułu wykonującego, bo to on jest
/// właścicielem zadania i to on musi je wznowić po restarcie.
/// </summary>
public interface IJobDbContext
{
    DbSet<Job> Jobs { get; }

    DbSet<JobItem> JobItems { get; }
}

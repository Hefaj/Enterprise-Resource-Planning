using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Persistence.Concurrency;
using Identity.Application.Abstractions;
using Identity.Domain.Audit;
using Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Identity.Infrastructure.Jobs;

/// <summary>
/// Sprząta nadania ról, którym minął termin ważności (<c>user_role.expires_at</c>) — bez tego
/// wygasłe nadanie zostaje w bazie i nadal trafia do efektywnych uprawnień, dopóki ktoś ręcznie
/// go nie odbierze (patrz <c>docs/backend/identity-authz.md</c> Faza 6).
///
/// <para><b>Wiele instancji.</b> Przebieg bierze dzierżawę <c>identity:expired-grant-cleanup</c>;
/// instancja bez niej pomija tykniecie i wraca za pięć minut. Samo odbieranie ról zniosłoby
/// współbieżność bez szkody (<c>RemoveRole</c> jest idempotentne) — ale <b>wpisy w
/// <c>grant_audit</c> już nie</b>: bez dzierżawy audyt dostawałby duplikaty, czyli kłamałby
/// o tym, co się faktycznie wydarzyło. To audyt, a nie sama operacja, wymusza tu wyłączność.</para>
/// </summary>
[ClusterSafe("Dzierżawa identity:expired-grant-cleanup na advisory locku Postgresa — odbieranie ról "
    + "jest idempotentne, ale wpisy w grant_audit nie, więc audyt bez niej dostawałby duplikaty.")]
public sealed partial class ExpiredGrantCleanupService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(5);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ExpiredGrantCleanupService> _logger;

    public ExpiredGrantCleanupService(IServiceScopeFactory scopeFactory, ILogger<ExpiredGrantCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);

        do
        {
            try
            {
                await CleanupOnceAsync(stoppingToken).ConfigureAwait(false);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                LogCleanupFailed(_logger, ex);
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken).ConfigureAwait(false));
    }

    private async Task CleanupOnceAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();

        var lease = scope.ServiceProvider.GetRequiredService<IExclusiveLease>();
        await using var held = await lease
            .TryAcquireAsync("identity:expired-grant-cleanup", ct)
            .ConfigureAwait(false);

        if (held is null)
        {
            return;
        }

        var dbContext = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
        var clock = scope.ServiceProvider.GetRequiredService<IClock>();
        var auditWriter = scope.ServiceProvider.GetRequiredService<IGrantAuditWriter>();
        var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

        var now = clock.UtcNow;

        // Owned collection (user_role) odpytana przez właściciela — EF tłumaczy Any() na
        // podzapytanie EXISTS, nie ma potrzeby osobnego DbSet dla typu własnego.
        var usersWithExpiredGrants = await dbContext.UserAccounts
            .Where(u => u.RoleGrants.Any(g => g.ExpiresAt != null && g.ExpiresAt <= now))
            .ToListAsync(ct)
            .ConfigureAwait(false);

        if (usersWithExpiredGrants.Count == 0)
        {
            return;
        }

        var expiredCount = 0;
        foreach (var user in usersWithExpiredGrants)
        {
            var expiredRoleUuids = user.RoleGrants
                .Where(g => g.ExpiresAt != null && g.ExpiresAt <= now)
                .Select(g => g.RoleUuid)
                .ToList();

            foreach (var roleUuid in expiredRoleUuids)
            {
                // Guid.Empty jako sprawca: to zdarzenie systemowe bez ludzkiego inicjatora —
                // pierwotny "granted_by" nadania jest już widoczny na wcześniejszym wpisie
                // role_assigned, jeśli ktoś potrzebuje dociec, kto nadał wygasłą rolę.
                await auditWriter.RecordAsync(
                    GrantAuditEntry.Create(
                        now, Guid.Empty, "user", user.Uuid,
                        "role_grant_expired", roleUuid.ToString(), reason: null, source: "cleanup-job"),
                    ct).ConfigureAwait(false);

                user.RemoveRole(roleUuid);
                expiredCount++;
            }
        }

        await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        LogCleanupCompleted(_logger, expiredCount);
    }

    [LoggerMessage(
        EventId = 1,
        Level = LogLevel.Information,
        Message = "Sprzątanie wygasłych nadań ról: {ExpiredCount} nadań odebranych.")]
    private static partial void LogCleanupCompleted(ILogger logger, int expiredCount);

    [LoggerMessage(
        EventId = 2,
        Level = LogLevel.Error,
        Message = "Sprzątanie wygasłych nadań ról nie powiodło się w tym cyklu — spróbuję ponownie za 5 minut.")]
    private static partial void LogCleanupFailed(ILogger logger, Exception ex);
}

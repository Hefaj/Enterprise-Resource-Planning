using Erp.BuildingBlocks.Application.Abstractions;
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
/// <para><b>Jedna instancja procesu.</b> Zakłada brak współbieżnego drugiego tickera (patrz
/// <c>docs/backend/architecture.md</c> §7 — założenia jednoinstancyjne) — przy skalowaniu
/// poziomym dwie instancje próbowałyby odebrać te same nadania w tym samym oknie 5 minut, co
/// jest nieszkodliwe (<c>RevokeRole</c> jest idempotentne), ale zdublowałoby wpisy audytowe.</para>
/// </summary>
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

                user.RevokeRole(roleUuid);
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

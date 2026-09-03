using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using FastEndpoints;
using Identity.Application.Abstractions;
using Identity.Domain.Users;

namespace Identity.Application.IntegrationClients;

/// <summary>
/// Rejestruje konto serwisowe (<see cref="UserAccountKind.Service"/>) dla poufnego klienta
/// Keycloaka z <c>client_credentials</c> — API-003, patrz <c>docs/backend/identity-authz.md</c>
/// §2. ERP nie zakłada klienta w Keycloaku — admin robi to ręcznie, wkleja tu <c>sub</c>
/// service-accounta jako <see cref="Uuid"/>. Wzorowane dosłownie na
/// <see cref="Identity.Application.Roles.RoleCreateCommand"/>.
/// </summary>
public sealed class IntegrationClientCreateCommand : ICommand<Guid>, IAggregateCommand
{
    /// <summary><c>sub</c> service-accounta klienta Keycloaka — wklejony przez admina, nie
    /// generowany lokalnie. Kolizja to zwykły PK-conflict (tak samo jak przy
    /// <c>RoleCreateCommand</c> z kolidującym uuid) — bez osobnej reguły unikalności.</summary>
    public Guid Uuid { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }
}

public sealed class IntegrationClientCreateCommandHandler : CommandHandler<IntegrationClientCreateCommand, Guid>
{
    private readonly IUserAccountRepository _repository;
    private readonly IClock _clock;

    public IntegrationClientCreateCommandHandler(IUserAccountRepository repository, IClock clock)
    {
        _repository = repository;
        _clock = clock;
    }

    public override Task<Guid> ExecuteAsync(IntegrationClientCreateCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var user = UserAccount.CreateServiceAccount(command.Uuid, command.Name, command.Description, _clock.UtcNow);
        _repository.Add(user);

        return Task.FromResult(user.Uuid);
    }
}

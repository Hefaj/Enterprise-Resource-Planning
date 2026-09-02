using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Tags;

namespace TaskManagement.Application.Tags;

/// <summary>
/// Zakłada tag w locie (TAG-002) — kto wolno, decyduje uprawnienie na endpointcie
/// (<c>taskmgmt.tag.manage</c>), nie handler.
/// </summary>
public sealed class TagCreateCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid? ProjectUuid { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Color { get; set; }
}

public sealed class TagCreateCommandHandler : CommandHandler<TagCreateCommand, Guid>
{
    private readonly ITagRepository _tags;

    public TagCreateCommandHandler(ITagRepository tags) => _tags = tags;

    public override Task<Guid> ExecuteAsync(TagCreateCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var tag = Tag.CreateWithUuid(command.Uuid, command.ProjectUuid, command.Name, command.Color);

        _tags.Add(tag);

        return Task.FromResult(tag.Uuid);
    }
}

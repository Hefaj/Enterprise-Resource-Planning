using System;

namespace Erp.BuildingBlocks.Api.Contracts;

public interface IAggregateCommand
{
    Guid Uuid { get; set; }
}

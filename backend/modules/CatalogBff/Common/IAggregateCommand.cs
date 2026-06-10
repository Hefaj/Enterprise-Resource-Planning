using System;

namespace CatalogBff.Common;

public interface IAggregateCommand
{
    Guid Uuid { get; }
}

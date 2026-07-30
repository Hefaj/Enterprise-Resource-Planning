using System;

namespace Catalog.Common;

public interface IAggregateCommand
{
    Guid Uuid { get; set; }
}

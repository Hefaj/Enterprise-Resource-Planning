using System.Collections.Generic;

namespace CatalogBff.Common;

public class BatchCommand<TCommand> where TCommand : IAggregateCommand
{
    public List<TCommand> Commands { get; set; } = new();
}

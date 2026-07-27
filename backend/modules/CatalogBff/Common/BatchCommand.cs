using System;
using System.Collections.Generic;

namespace CatalogBff.Common;

public class BatchCommand<TCommand, TFilter> where TCommand : IAggregateCommand
{
    public List<TCommand>? Commands { get; set; }
    public TCommand? TemplateCommand { get; set; }
    public List<Guid>? TargetUuids { get; set; }
    public TFilter? TargetFilter { get; set; }
}

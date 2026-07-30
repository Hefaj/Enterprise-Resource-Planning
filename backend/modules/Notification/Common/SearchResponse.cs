using System;
using System.Collections.Generic;

namespace Notification.Common;

public class SearchResponse
{
    public List<Guid> Uuids { get; set; } = new();
    public int TotalCount { get; set; }
}

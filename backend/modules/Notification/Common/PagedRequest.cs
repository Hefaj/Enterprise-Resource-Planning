using System.Collections.Generic;

namespace Notification.Common;

public class SortOption
{
    public string Field { get; set; } = string.Empty;
    public int Order { get; set; } = 1; // 1 = Ascending, -1 = Descending
}

public class PagedRequest
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 10;
    public List<SortOption>? Sorts { get; set; }
}

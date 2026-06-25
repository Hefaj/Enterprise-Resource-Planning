namespace NotificationBff.Common;

public class PagedRequest
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 10;
    public string? SortField { get; set; }
    public int? SortOrder { get; set; } // 1 = Ascending, -1 = Descending
}

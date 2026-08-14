using System;
using System.Collections.Generic;

namespace Erp.BuildingBlocks.Api.Contracts;

public class SearchResponse
{
    public List<Guid> Uuids { get; set; } = new();
    public int TotalCount { get; set; }
}

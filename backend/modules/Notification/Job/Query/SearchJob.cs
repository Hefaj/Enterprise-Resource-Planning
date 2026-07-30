using FastEndpoints;
using System;
using System.Collections.Generic;
using System.Linq;
using Notification.Common;

namespace Notification.Job.Query;

public class SearchJobRequest : PagedRequest
{
    public string? QueueId { get; set; }
    public string? TrackingId { get; set; }
    public bool? IsComplete { get; set; }
    public string? UserId { get; set; }
}

public class SearchJobEndpoint : Endpoint<SearchJobRequest, SearchResponse>
{
    public override void Configure()
    {
        Post("searchJob");
        Group<JobGroup>();
    }

    public override async Task HandleAsync(SearchJobRequest req, CancellationToken ct)
    {
        var query = NotificationMockData.Jobs.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(req.QueueId))
        {
            query = query.Where(j => j.QueueId != null && j.QueueId.Contains(req.QueueId, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(req.TrackingId))
        {
            query = query.Where(j => j.TrackingId != null && j.TrackingId.Contains(req.TrackingId, StringComparison.OrdinalIgnoreCase));
        }

        if (req.IsComplete.HasValue)
        {
            query = query.Where(j => j.IsComplete == req.IsComplete.Value);
        }

        if (!string.IsNullOrWhiteSpace(req.UserId))
        {
            query = query.Where(j => j.UserId != null && j.UserId.Contains(req.UserId, StringComparison.OrdinalIgnoreCase));
        }

        if (req.Sorts != null && req.Sorts.Any())
        {
            var firstSort = req.Sorts.First();
            var isDesc = firstSort.Order == -1;
            var orderedQuery = firstSort.Field.ToLower() switch
            {
                "queueid" => isDesc ? query.OrderByDescending(j => j.QueueId) : query.OrderBy(j => j.QueueId),
                "trackingid" => isDesc ? query.OrderByDescending(j => j.TrackingId) : query.OrderBy(j => j.TrackingId),
                "iscomplete" => isDesc ? query.OrderByDescending(j => j.IsComplete) : query.OrderBy(j => j.IsComplete),
                "userid" => isDesc ? query.OrderByDescending(j => j.UserId) : query.OrderBy(j => j.UserId),
                "executeafter" => isDesc ? query.OrderByDescending(j => j.ExecuteAfter) : query.OrderBy(j => j.ExecuteAfter),
                "expireon" => isDesc ? query.OrderByDescending(j => j.ExpireOn) : query.OrderBy(j => j.ExpireOn),
                _ => query.OrderBy(j => 0)
            };

            foreach (var sort in req.Sorts.Skip(1))
            {
                var desc = sort.Order == -1;
                orderedQuery = sort.Field.ToLower() switch
                {
                    "queueid" => desc ? orderedQuery.ThenByDescending(j => j.QueueId) : orderedQuery.ThenBy(j => j.QueueId),
                    "trackingid" => desc ? orderedQuery.ThenByDescending(j => j.TrackingId) : orderedQuery.ThenBy(j => j.TrackingId),
                    "iscomplete" => desc ? orderedQuery.ThenByDescending(j => j.IsComplete) : orderedQuery.ThenBy(j => j.IsComplete),
                    "userid" => desc ? orderedQuery.ThenByDescending(j => j.UserId) : orderedQuery.ThenBy(j => j.UserId),
                    "executeafter" => desc ? orderedQuery.ThenByDescending(j => j.ExecuteAfter) : orderedQuery.ThenBy(j => j.ExecuteAfter),
                    "expireon" => desc ? orderedQuery.ThenByDescending(j => j.ExpireOn) : orderedQuery.ThenBy(j => j.ExpireOn),
                    _ => orderedQuery.ThenBy(j => 0)
                };
            }
            query = orderedQuery;
        }

        var totalCount = query.Count();

        var uuids = query
            .Skip((req.Page - 1) * req.PageSize)
            .Take(req.PageSize)
            .Select(j => j.Uuid)
            .ToList();

        await Send.OkAsync(new SearchResponse { Uuids = uuids, TotalCount = totalCount }, ct);
    }
}

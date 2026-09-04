# Troubleshooting

Most problems come from project scope, permissions, workflow rules, concurrency, or background processing.

## Who can perform the operation

Any user with access to the affected screen can begin diagnosis.

## Where to find the feature

Check the action message, issue history, and the jobs panel in the header.

## How to perform the operation

Refresh data, verify the active project and filter, then check the required permission. For a bulk action or report, open job details and inspect the item error code.

## Result

You can distinguish missing access, a disallowed transition, a concurrency conflict, and a failed item in a batch.

## Limitations and special cases

Do not repeatedly retry the same operation with a new request identifier. For a persistent error, send the administrator the time, screen, and correlation identifier.

## Related topics

See [Permissions](doc:task-management.permissions), the [Issue list](doc:task-management.issues.list), and the [Hours report](doc:task-management.reports.hours).

# Working on a board

The board displays issues in workflow columns and changes their state or order with drag and drop.

## Who can perform the operation

Reading requires issue access. Moving a card requires update permission and an allowed transition.

## Where to find the feature

Choose Board in the menu, then open a specific board.

## How to perform the operation

Drag a card to the required position. Disallowed columns are disabled. Complete the displayed form when the transition requires data.

## Result

The card receives a new state or rank, and the view updates optimistically and through realtime synchronization.

## Limitations and special cases

Concurrent reordering can refresh positions. A board is a view of issues, not a separate source of truth.

## Related topics

See [Backlog and sprints](doc:task-management.boards.backlog) and [Issue details](doc:task-management.issues.detail).

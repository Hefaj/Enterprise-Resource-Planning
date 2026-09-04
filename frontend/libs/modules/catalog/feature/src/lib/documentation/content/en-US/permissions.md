# Catalog permissions

Permissions determine which Catalog screens and actions are available to a user.

## Who can perform the operation

An Identity administrator grants permissions through roles or, exceptionally, as a direct grant with a reason.

## Where to find the feature

Role and user management is available in Identity. Catalog only enforces the resulting permissions.

## How to perform the operation

Grant a role containing product read access. Add dictionary read access for the media library and the relevant change, delete, or generation permission for mutations.

## Result

After permissions refresh, menus, route guards, and screen actions expose only available operations.

## Limitations and special cases

Hiding a button does not replace API authorization. A permission change can require navigating to the protected route again.

## Related topics

Return to the [Catalog overview](doc:catalog.overview).

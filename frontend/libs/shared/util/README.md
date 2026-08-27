# shared-util

Kontrakty współdzielone przez `shared/ui` i `shared/data-access`.

Biblioteka istnieje z jednego powodu: reguła `@nx/enforce-module-boundaries` pozwala
`type:ui` zależeć wyłącznie od `type:ui` i `type:util`, a `type:data-access` — od
`type:data-access` i `type:util`. `type:util` jest więc **jedynym miejscem, które widzą obie
strony naraz** i dlatego tutaj leżą porty (interfejs + token DI) implementowane w
`data-access`, a konsumowane w `ui` — np. katalog użytkowników.

Nie ma tu logiki HTTP ani komponentów. Sam kontrakt.

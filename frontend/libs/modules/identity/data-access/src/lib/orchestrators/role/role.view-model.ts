import { RoleDto } from '../../api-client';

/**
 * Rola wzbogacona o rozwiązane role składowe. `memberRoleUuids` (DTO) to prosty przypadek
 * z `docs/guides/frontend/orchestrators.md` §4 — inna nazwa pola, brak konfliktu z DTO.
 *
 * Odwrotny kierunek (role-kontenery, w których ta rola jest składową) NIE jest polem VM —
 * to nie jest coś, co przychodzi z `RoleDto` konkretnej roli, tylko wynik przeszukania całego
 * załadowanego zbioru ról. Patrz `RoleOrchestrator.getContainerRoles()`.
 */
export interface RoleVM extends RoleDto {
  readonly members: RoleVM[];
}

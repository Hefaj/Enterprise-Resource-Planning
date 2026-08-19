import { GrantAuditDto } from '../../api-client';

/**
 * Wpis w dzienniku audytu nadań (append-only, wyłącznie do odczytu — patrz
 * `docs/backend/events-outbox.md` / grant_audit). Bez wzbogaceń — DTO wystarcza tabeli.
 */
export type GrantAuditVM = GrantAuditDto;

import {
  ASSIGN_USER_ROLE_MODAL_ID,
  GRANT_USER_PERMISSION_MODAL_ID,
  CREATE_ROLE_MODAL_ID,
  ADD_ROLE_PERMISSION_MODAL_ID,
  ADD_ROLE_MEMBER_MODAL_ID,
} from '@erp/identity/util';

/**
 * Identyfikatory modali tego modułu.
 *
 * Lekka tablica stringów (zero importów z feature) ładowana przy STARTUP
 * razem z menu. Służy do budowy globalnej mapy `modalId → modulePrefix`
 * w ErpModalService, aby wiedzieć skąd załadować modal na żądanie.
 */
export const remoteModalIds: string[] = [
  ASSIGN_USER_ROLE_MODAL_ID,
  GRANT_USER_PERMISSION_MODAL_ID,
  CREATE_ROLE_MODAL_ID,
  ADD_ROLE_PERMISSION_MODAL_ID,
  ADD_ROLE_MEMBER_MODAL_ID,
];

/**
 * Asynchronicznie ładuje i zwraca tokeny DI definicji modali tego modułu.
 *
 * Używa dynamic import() aby NIE ściągać ciężkich zależności z feature
 * przy starcie aplikacji (contract jest ładowany przy STARTUP dla menu).
 *
 * @returns Tablica tokenów DI (klas ModalDefinition) do zarejestrowania przez inject()
 */
export async function registerModals(): Promise<any[]> {
  const {
    AssignRoleModalDefinition,
    GrantPermissionModalDefinition,
    CreateRoleModalDefinition,
    AddPermissionModalDefinition,
    AddMemberModalDefinition,
  } = await import('@erp/identity/feature');
  return [
    AssignRoleModalDefinition,
    GrantPermissionModalDefinition,
    CreateRoleModalDefinition,
    AddPermissionModalDefinition,
    AddMemberModalDefinition,
  ];
}

export async function getModalProviders(): Promise<any[]> {
  const { provideIdentityTranslations } = await import('@erp/identity/feature');
  return provideIdentityTranslations();
}

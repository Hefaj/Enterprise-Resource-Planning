import {
  USER_ADD_ROLE_MODAL_ID,
  USER_ADD_PERMISSION_MODAL_ID,
  ROLE_CREATE_MODAL_ID,
  ROLE_ADD_PERMISSION_MODAL_ID,
  ROLE_ADD_MEMBER_MODAL_ID,
  INTEGRATION_CLIENT_CREATE_MODAL_ID,
} from '@erp/identity/util';

/**
 * Identyfikatory modali tego modułu.
 *
 * Lekka tablica stringów (zero importów z feature) ładowana przy STARTUP
 * razem z menu. Służy do budowy globalnej mapy `modalId → modulePrefix`
 * w ErpModalService, aby wiedzieć skąd załadować modal na żądanie.
 */
export const remoteModalIds: string[] = [
  USER_ADD_ROLE_MODAL_ID,
  USER_ADD_PERMISSION_MODAL_ID,
  ROLE_CREATE_MODAL_ID,
  ROLE_ADD_PERMISSION_MODAL_ID,
  ROLE_ADD_MEMBER_MODAL_ID,
  INTEGRATION_CLIENT_CREATE_MODAL_ID,
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
    UserAddRoleModalDefinition,
    UserAddPermissionModalDefinition,
    RoleCreateModalDefinition,
    RoleAddPermissionModalDefinition,
    RoleAddMemberModalDefinition,
    IntegrationClientCreateModalDefinition,
  } = await import('@erp/identity/feature');
  return [
    UserAddRoleModalDefinition,
    UserAddPermissionModalDefinition,
    RoleCreateModalDefinition,
    RoleAddPermissionModalDefinition,
    RoleAddMemberModalDefinition,
    IntegrationClientCreateModalDefinition,
  ];
}

export async function getModalProviders(): Promise<any[]> {
  const { provideIdentityTranslations } = await import('@erp/identity/feature');
  return provideIdentityTranslations();
}

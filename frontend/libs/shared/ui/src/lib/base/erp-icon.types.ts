export const ERP_ICONS = {
  menu: '@tui.menu',
  arrowLeft: '@tui.arrow-left',
  arrowRight: '@tui.arrow-right',
  check: '@tui.check',
  x: '@tui.x',
  maximize: '@tui.maximize',
  minimize: '@tui.minimize',
  ellipsisVertical: '@tui.ellipsis-vertical',
  bell: '@tui.bell',
  bellOff: '@tui.bell-off',
  plus: '@tui.plus',
  pencil: '@tui.pencil',
  trash: '@tui.trash',
  search: '@tui.search',
  filter: '@tui.filter',
  user: '@tui.user',
  settings: '@tui.settings',
  logOut: '@tui.log-out',
  calendar: '@tui.calendar',
} as const;

export type ErpIcon = (typeof ERP_ICONS)[keyof typeof ERP_ICONS];

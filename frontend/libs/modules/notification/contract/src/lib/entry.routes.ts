import { Route } from '@angular/router';
import { erpAuthGuard } from '@erp/shared/auth';
import { JOBS_ROUTE } from '@erp/notification/util';

export const remoteRoutes: Route[] = [
  {
    path: '',
    data: { breadcrumb: 'Notyfikacje' },
    canActivate: [erpAuthGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: JOBS_ROUTE,
      },
      {
        path: JOBS_ROUTE,
        // `loadChildren`, a nie `loadComponent`, właśnie po to, żeby providery scope'u
        // tłumaczeń dało się dołożyć PO doładowaniu modułu: `providers` na trasie muszą być
        // znane synchronicznie, a `provideJobTranslations` przyjeżdża dopiero z importu.
        // Statyczny import kontraktu wciągałby całą warstwę `ui` do bundla ładowanego
        // przy STARTUP — tego chcemy uniknąć.
        //
        // Scope rejestrowany na trasie, nie w dekoratorze komponentu (child injector
        // przesłoniłby scope nadrzędny — patrz docs/frontend/translations.md).
        loadChildren: async (): Promise<Route[]> => {
          const [{ JobComponent }, { provideJobTranslations }] = await Promise.all([
            import('@erp/notification/feature'),
            import('@erp/notification/ui'),
          ]);

          return [
            {
              path: '',
              component: JobComponent,
              providers: provideJobTranslations(),
              data: { breadcrumb: 'Historia zadań' },
            },
          ];
        },
      },
    ],
  },
];

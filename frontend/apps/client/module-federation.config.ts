import { ModuleFederationConfig } from '@nx/module-federation';

const config: ModuleFederationConfig = {
  name: 'client',

  // 1. DEFINICJA REMOTÓW
  // Jeśli ładujesz mikrofrontendy statycznie w Nx, musisz je tu wymienić.
  // UWAGA: W dojrzałych systemach Enterprise zostawiamy to puste (remotes: [])
  // i ładujemy aplikacje DYNAMICZNIE z pliku manifest.json (tzw. Dynamic Module Federation).
  remotes: [],

  additionalShared: [
    // 2. AUTORYZACJA I STAN GLOBALNY
    {
      libraryName: '@erp/shared/auth',
      sharedConfig: {
        singleton: true,
        strictVersion: false,
        requiredVersion: false,
      },
    },
    {
      libraryName: '@erp/shared/data-access',
      sharedConfig: {
        singleton: true,
        strictVersion: false,
        requiredVersion: false,
      },
    },

    // 3. WSPÓŁDZIELONE KOMPONENTY UI
    // Gwarantuje, że nasze dynamiczne zakładki, wrappery i layouty nie będą
    // duplikowane w paczkach dla każdego mikrofrontendu (oszczędność KB!).
    {
      libraryName: '@erp/shared/ui',
      sharedConfig: {
        singleton: true,
        strictVersion: false,
        requiredVersion: false,
      },
    },

    // 4. PRIMENG (KRYTYCZNE!)
    // Bez tego serwisy PrimeNG takie jak DialogService (dla modali),
    // MessageService (dla toastów) i ConfirmationService będą miały
    // osobną instancję w każdym MFE. To powoduje zepsucie UI.
    {
      libraryName: 'primeng',
      sharedConfig: {
        singleton: true,
        strictVersion: true,
        requiredVersion: 'auto',
      },
    },
  ],
};

export default config;

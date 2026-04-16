import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { inject } from '@angular/core';
import { CatalogBffClient, ProductDto } from './api-client';
import { pipe, switchMap, tap } from 'rxjs';
import { tapResponse } from '@ngrx/operators';

type ProductState = {
  products: ProductDto[];
  isLoading: boolean;
};

const initialState: ProductState = {
  products: [],
  isLoading: false,
};

export const ProductStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, api = inject(CatalogBffClient)) => ({
    load: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { isLoading: true })),
        switchMap(() => {
          return api.getProduct({}).pipe(
            tapResponse({
              next: (products) => patchState(store, { products: products }),
              error: (err) => console.error(err),
              finalize: () => patchState(store, { isLoading: false }),
            }),
          );
        }),
      ),
    ),
  })),
);

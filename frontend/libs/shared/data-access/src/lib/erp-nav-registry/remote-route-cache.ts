import { Route } from '@angular/router';

const cache = new Map<string, Route[]>();

export function cacheRemoteRoutes(id: string, routes: Route[]): void {
  cache.set(id, routes);
}

export function getCachedRemoteRoutes(id: string): Route[] | undefined {
  return cache.get(id);
}

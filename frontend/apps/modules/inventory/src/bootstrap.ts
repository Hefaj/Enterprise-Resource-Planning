import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { RemoteEntry } from '@erp/inventory/feature';

bootstrapApplication(RemoteEntry, appConfig).catch((err) => console.error(err));

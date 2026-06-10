import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { RemoteEntry } from '@erp/task-management/feature';

bootstrapApplication(RemoteEntry, appConfig).catch((err) => console.error(err));

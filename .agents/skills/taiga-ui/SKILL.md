---
name: taiga-ui-developer
description: Guidelines and best practices for developing with Taiga UI library (v5+) in Angular applications. Trigger when implementing UI components, migrating from PrimeNG, or working with Taiga UI features.
---

# Taiga UI Developer Skill (v5+)

This skill provides context, standards, and practices for implementing and maintaining UI components using **Taiga UI** (specifically v5+) in our Angular monorepo.

## 1. Core Resources
Whenever you need detailed information about a component API or design token, refer to:
- **LLM-optimized docs**: https://taiga-ui.dev/llms.txt
- **AI Support Guide**: https://taiga-ui.dev/ai-support
- **Official Documentation**: https://taiga-ui.dev

---

## 2. Fundamental Patterns in Taiga UI v5

### Standard Imports and Standalone Setup
Taiga UI components in v5+ are fully tree-shakable standalone components. 
- Avoid legacy module imports.
- Key modules/directives should be imported directly from `@taiga-ui/core`, `@taiga-ui/kit`, or `@taiga-ui/layout`.

### Application Root Setup (`provideTaiga()`)
Ensure the host application bootstrap includes the necessary providers:
```typescript
import { provideTaiga } from '@taiga-ui/core';

export const appConfig: ApplicationConfig = {
  providers: [
    // ... other providers
    provideTaiga({
      // Configuration overrides if needed
    })
  ]
};
```

### Polymorphic Templates (`Polymorpheus`)
Taiga UI heavily relies on `@taiga-ui/polymorpheus` for content projection (e.g., custom options in dropdowns, custom labels, dynamic headers).
- **Static text**: Just pass a string.
- **Custom HTML template**: Use `PolymorpheusContent`.
- **Component**: Use a custom class/component mapping with `PolymorpheusComponent`.

Example using standard Angular template:
```html
<tui-select [valueContent]="content">
  Select option
  <ng-template #content let-item>
    <strong>{{ item }}</strong>
  </ng-template>
</tui-select>
```

---

## 3. Styling and Customization (Monorepo Context)

Our project uses **PrimeNG in Unstyled Mode** and pure **CSS/SCSS** for styling. When migrating or integrating Taiga UI:
1. **Never import global Taiga UI default themes** directly inside remote libraries.
2. Styling overrides must be scoped or leverage Taiga UI's global CSS variables (`--tui-*`).
3. Leverage Pass-Through properties or custom CSS variables for custom styling rather than deep-nested selectors.

---

## 4. Best Practices for Common Components

### Inputs & Textfields
In Taiga UI v5, textfields and inputs use a modernized declarative layout structure:
```html
<tui-textfield>
  <label tuiLabel>Label Text</label>
  <input tuiTextfield type="text" [formControl]="control" />
  <span tuiTextfieldEl>Custom suffix/icon</span>
</tui-textfield>
```

### Selects & Comboboxes
Ensure data lists are nested properly within dropdowns:
```html
<tui-select [formControl]="control">
  Choose option
  <tui-data-list-wrapper
    *tuiDataList
    [items]="items"
  ></tui-data-list-wrapper>
</tui-select>
```

### Dialogs (`TuiDialogService`)
Never use inline modal states if they can be dynamically opened via service:
```typescript
import { TuiDialogService } from '@taiga-ui/core';

constructor(private readonly dialogs: TuiDialogService) {}

showDialog(): void {
  this.dialogs.open('Content to display', { label: 'Dialog title' }).subscribe();
}
```

---

## 5. Architectural Monorepo Constraints (Nx)
Keep in mind our monorepo boundaries specified in `@nx/enforce-module-boundaries`:
- **contract**: Exposes routing and shared configuration.
- **feature**: Smart components (logic).
- **ui**: Dumb/presentation components.
- Make sure components from Taiga UI are correctly localized using our **Transloco** setup (registering keys in translation files and using `erpTranslate` where appropriate).

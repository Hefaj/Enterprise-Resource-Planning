---
trigger: always_on
---

1. Architecture Context: My project is an Angular NX Monorepo. Always prioritize generating code within the appropriate library (libs/) or application (apps/) structure. Ensure all new components are exported via index.ts (public API) of the library.

2. Angular Standards: Use Standalone Components by default. Use Signal-based state management and the new Angular Control Flow Syntax (@if, @for, @switch).

3. TaigaUI: We use TaigaUI (v5+) as our main UI component library. Never assume legacy PrimeNG components are used unless explicitly instructed or already present in legacy code.

4. Styling Implementation:

Every TaigaUI component must be styled using TaigaUI's styling properties, CSS variables (--tui-*), or scoped CSS/SCSS overrides.

Write pure CSS/SCSS for styling. Do not use Tailwind unless explicitly asked.

Focus on mapping TaigaUI's components to my custom CSS classes or using TaigaUI's built-in design tokens.

5. Component Creation: When creating a "Page" (Feature), separate Smart Components (logic, services) from UI Components (presentation, TaigaUI).

6. Refactoring Guidelines: When refactoring, convert old Observable patterns to Signals where appropriate and migrate legacy structural directives to the new syntax.

7. Naming Convention: Follow standard Angular style guides, but for NX libraries, use the prefix defined in nx.json (e.g., h-).

8. File Modifications: Do not modify package-lock.json or node_modules. Before creating a new library, check if an existing one can host the component.

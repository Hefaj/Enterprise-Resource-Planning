import { Directive, ElementRef, Renderer2, OnInit, OnDestroy, inject, input, ApplicationRef } from '@angular/core';

@Directive({
  selector: '[erpPopout]',
  standalone: true,
})
export class ErpPopoutDirective implements OnInit, OnDestroy {
  private readonly el = inject(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly appRef = inject(ApplicationRef);

  /** Title of the detached window */
  public erpPopoutTitle = input<string>('System ERP - Okno pomocnicze');

  private externalWindow: Window | null = null;
  private placeholderEl: HTMLElement | null = null;
  private popoutBtn: HTMLButtonElement | null = null;
  private originalParent: ParentNode | null = null;
  private originalNextSibling: ChildNode | null = null;
  private isDetached = false;
  private eventForwarder: ((e: MouseEvent) => void) | null = null;

  public ngOnInit(): void {
    // Ensure the host element is relative so the absolute button aligns correctly
    const hostStyle = window.getComputedStyle(this.el.nativeElement);
    if (hostStyle.position === 'static') {
      this.renderer.setStyle(this.el.nativeElement, 'position', 'relative');
    }

    // Create the popout trigger button
    this.popoutBtn = this.renderer.createElement('button');
    if (this.popoutBtn) {
      this.popoutBtn.type = 'button';
      this.popoutBtn.className =
        'absolute top-2 right-2 z-50 flex items-center justify-center p-1.5 rounded-md bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 shadow-xs cursor-pointer opacity-60 hover:opacity-100 transition-all duration-200';
      this.popoutBtn.title = 'Wypnij do nowego okna';

      const icon = this.renderer.createElement('i');
      icon.className = 'pi pi-external-link text-xs';
      this.renderer.appendChild(this.popoutBtn, icon);

      this.renderer.appendChild(this.el.nativeElement, this.popoutBtn);

      this.renderer.listen(this.popoutBtn, 'click', (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        this.popout();
      });
    }
  }

  private popout(): void {
    if (this.isDetached) return;

    const title = this.erpPopoutTitle();
    this.externalWindow = window.open(
      '',
      `erp_popout_${Date.now()}`,
      'width=1000,height=700,menubar=no,status=no,toolbar=no'
    );

    if (!this.externalWindow) {
      alert('Nie można otworzyć okna. Sprawdź ustawienia blokowania wyskakujących okienek w przeglądarce.');
      return;
    }

    this.isDetached = true;

    const doc = this.externalWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            body {
              margin: 0;
              padding: 16px;
              height: 100vh;
              box-sizing: border-box;
              background-color: #f8fafc;
            }
            .dark body {
              background-color: #0f172a;
              color: #f1f5f9;
            }
          </style>
        </head>
        <body>
          <div id="popout-content-root" class="h-full"></div>
        </body>
      </html>
    `);
    doc.close();

    // Mirror HTML and Body classes/attributes for themes (e.g. dark mode)
    const mainHtml = document.documentElement;
    Array.from(mainHtml.attributes).forEach((attr) => {
      doc.documentElement.setAttribute(attr.name, attr.value);
    });

    const mainBody = document.body;
    Array.from(mainBody.attributes).forEach((attr) => {
      doc.body.setAttribute(attr.name, attr.value);
    });

    // Copy stylesheet links and styles
    this.copyStylesheets(doc);

    // Patch MouseEvent prototype in the popup window to handle cross-window instanceof checks in libraries (like PrimeNG)
    try {
      const popupWin = this.externalWindow as any;
      if (popupWin.MouseEvent && popupWin.MouseEvent.prototype) {
        Object.defineProperty(popupWin.MouseEvent.prototype, 'changedTouches', {
          get() {
            return [{
              pageX: this.pageX,
              pageY: this.pageY,
              clientX: this.clientX,
              clientY: this.clientY
            }];
          },
          configurable: true
        });
        
        Object.defineProperty(popupWin.MouseEvent.prototype, 'touches', {
          get() {
            return [{
              pageX: this.pageX,
              pageY: this.pageY,
              clientX: this.clientX,
              clientY: this.clientY
            }];
          },
          configurable: true
        });
      }
    } catch (e) {
      console.error('Failed to patch popup window MouseEvent', e);
    }

    // Forward document-level mouse events for splitters/drag-and-drop to work
    this.eventForwarder = (e: MouseEvent) => {
      const clonedEvent = new MouseEvent(e.type, {
        bubbles: true,
        cancelable: true,
        view: window,
        detail: e.detail,
        screenX: e.screenX,
        screenY: e.screenY,
        clientX: e.clientX,
        clientY: e.clientY,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        metaKey: e.metaKey,
        button: e.button,
        buttons: e.buttons,
        relatedTarget: e.relatedTarget,
      });

      // Ensure pageX/pageY are present on the cloned event
      Object.defineProperty(clonedEvent, 'pageX', { get: () => e.pageX });
      Object.defineProperty(clonedEvent, 'pageY', { get: () => e.pageY });

      document.dispatchEvent(clonedEvent);
      
      // Trigger Angular change detection tick so that the UI in the popout updates
      this.appRef.tick();
    };

    doc.addEventListener('mousemove', this.eventForwarder);
    doc.addEventListener('mouseup', this.eventForwarder);

    // Keep track of the original parent and sibling for restoration
    this.originalParent = this.el.nativeElement.parentNode;
    this.originalNextSibling = this.el.nativeElement.nextSibling;

    // Create the placeholder to display in the main application
    this.placeholderEl = this.renderer.createElement('div');
    if (this.placeholderEl) {
      this.placeholderEl.className =
        'flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-slate-400 dark:text-slate-600 bg-slate-50 dark:bg-slate-900/50 min-h-[200px] h-full w-full';

      const placeholderIcon = this.renderer.createElement('i');
      placeholderIcon.className = 'pi pi-window-maximize text-3xl mb-2';
      this.renderer.appendChild(this.placeholderEl, placeholderIcon);

      const placeholderText = this.renderer.createElement('span');
      placeholderText.innerText = 'Element został wypięty do osobnego okna';
      placeholderText.className = 'text-sm font-medium';
      this.renderer.appendChild(this.placeholderEl, placeholderText);

      const restoreBtn = this.renderer.createElement('button');
      restoreBtn.type = 'button';
      restoreBtn.className =
        'mt-4 px-3 py-1.5 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 cursor-pointer transition-colors';
      restoreBtn.innerText = 'Przywróć';
      this.renderer.listen(restoreBtn, 'click', () => {
        this.restore();
      });
      this.renderer.appendChild(this.placeholderEl, restoreBtn);

      // Insert placeholder in place of host
      this.renderer.insertBefore(this.originalParent, this.placeholderEl, this.el.nativeElement);
    }

    // Hide the popout button in the detached view
    if (this.popoutBtn) {
      this.renderer.setStyle(this.popoutBtn, 'display', 'none');
    }

    // Move the element to the new window
    const container = doc.getElementById('popout-content-root');
    if (container) {
      this.renderer.appendChild(container, this.el.nativeElement);
    }

    // Handle user closing the popup window manually
    this.externalWindow.addEventListener('beforeunload', () => {
      this.restore();
    });
  }

  private restore(): void {
    if (!this.isDetached) return;

    // Clean up event forwarders
    if (this.externalWindow && this.eventForwarder) {
      try {
        const doc = this.externalWindow.document;
        doc.removeEventListener('mousemove', this.eventForwarder);
        doc.removeEventListener('mouseup', this.eventForwarder);
      } catch (e) {
        // Child window might already be closed/destroyed
      }
    }
    this.eventForwarder = null;

    // Show the button again
    if (this.popoutBtn) {
      this.renderer.setStyle(this.popoutBtn, 'display', 'flex');
    }

    // Move the element back to its original location
    if (this.originalParent) {
      if (this.placeholderEl) {
        this.renderer.insertBefore(this.originalParent, this.el.nativeElement, this.placeholderEl);
        this.renderer.removeChild(this.originalParent, this.placeholderEl);
      } else if (this.originalNextSibling) {
        this.renderer.insertBefore(this.originalParent, this.el.nativeElement, this.originalNextSibling);
      } else {
        this.renderer.appendChild(this.originalParent, this.el.nativeElement);
      }
    }

    // Close window if it is still open
    if (this.externalWindow && !this.externalWindow.closed) {
      this.externalWindow.close();
    }

    this.externalWindow = null;
    this.placeholderEl = null;
    this.isDetached = false;
  }

  private copyStylesheets(targetDoc: Document): void {
    // Copy all link and style elements
    const headElements = document.head.querySelectorAll('link[rel="stylesheet"], style');
    headElements.forEach((el) => {
      const clonedEl = el.cloneNode(true) as HTMLElement;

      // If it's a relative link, make it absolute so the child window can resolve it
      if (clonedEl.tagName.toLowerCase() === 'link') {
        const href = clonedEl.getAttribute('href');
        if (href && !href.startsWith('http://') && !href.startsWith('https://')) {
          clonedEl.setAttribute('href', window.location.origin + href);
        }
      }

      targetDoc.head.appendChild(clonedEl);
    });

    // Copy dynamically loaded styles that don't have style tags (e.g. CSS-in-JS or dev mode stylesheets)
    Array.from(document.styleSheets).forEach((sheet) => {
      try {
        if (!sheet.ownerNode && sheet.cssRules) {
          const style = targetDoc.createElement('style');
          const rules = Array.from(sheet.cssRules)
            .map((rule) => rule.cssText)
            .join('\n');
          style.appendChild(targetDoc.createTextNode(rules));
          targetDoc.head.appendChild(style);
        }
      } catch (e) {
        // Cross-origin stylesheet reading exceptions are ignored
      }
    });
  }

  public ngOnDestroy(): void {
    this.restore();
  }
}

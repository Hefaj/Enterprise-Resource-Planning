import { __async, __spreadProps, __spreadValues } from "@nf-internal/chunk-Y5RQAIA6";
// frontend/libs/modules/catalog/feature/src/lib/product/page/product.ts
import { ChangeDetectionStrategy as ChangeDetectionStrategy7, Component as Component7 } from "@angular/core";
import { ErpPageLayoutBuilder, ErpPageLayoutComponent, ErpTabsBuilder, ErpTabsComponent } from "@erp/shared/ui";
import { noop } from "rxjs";
// frontend/libs/modules/catalog/feature/src/lib/product/page/product-list-view.store.ts
import { Injectable, signal, computed, effect, inject } from "@angular/core";
import { CatalogProductOrchestrator } from "@erp/catalog/data-access";
import * as i0 from "@angular/core";
var ProductListViewStore = class _ProductListViewStore {
    _orchestrator = inject(CatalogProductOrchestrator);
    // 1. Stan UI (Sygnały)
    filters = signal({}, ...ngDevMode ? [{ debugName: "filters" }] : (
    /* istanbul ignore next */
    []));
    page = signal(1, ...ngDevMode ? [{ debugName: "page" }] : (
    /* istanbul ignore next */
    []));
    pageSize = signal(20, ...ngDevMode ? [{ debugName: "pageSize" }] : (
    /* istanbul ignore next */
    []));
    sortField = signal(void 0, ...ngDevMode ? [{ debugName: "sortField" }] : (
    /* istanbul ignore next */
    []));
    sortOrder = signal(void 0, ...ngDevMode ? [{ debugName: "sortOrder" }] : (
    /* istanbul ignore next */
    []));
    // 2. Stan Danych (Wynik wyszukiwania)
    searchResultUuids = signal([], ...ngDevMode ? [{ debugName: "searchResultUuids" }] : (
    /* istanbul ignore next */
    []));
    totalCount = signal(0, ...ngDevMode ? [{ debugName: "totalCount" }] : (
    /* istanbul ignore next */
    []));
    // Niezbędne do paginacji w tabeli!
    isLoading = signal(false, ...ngDevMode ? [{ debugName: "isLoading" }] : (
    /* istanbul ignore next */
    []));
    // 3. Połączone parametry zapytania
    _currentQuery = computed(() => __spreadProps(__spreadValues({}, this.filters()), {
        page: this.page(),
        pageSize: this.pageSize(),
        sortField: this.sortField(),
        sortOrder: this.sortOrder()
    }), ...ngDevMode ? [{ debugName: "_currentQuery" }] : (
    /* istanbul ignore next */
    []));
    // Konfiguracja: Czy załadować dane przy inicjalizacji widoku?
    autoload = signal(false, ...ngDevMode ? [{ debugName: "autoload" }] : (
    /* istanbul ignore next */
    []));
    _isInitial = true;
    constructor() {
        effect(() => {
            const query = this._currentQuery();
            const shouldAutoload = this.autoload();
            if (this._isInitial) {
                this._isInitial = false;
                if (!shouldAutoload) {
                    return;
                }
            }
            this._fetchData(query);
        });
    }
    // 5. Metody mutujące stan dla komponentów
    updateFilters(newFilters) {
        this.filters.set(newFilters);
        this.page.set(1);
    }
    updatePagination(page, pageSize) {
        this.page.set(page);
        this.pageSize.set(pageSize);
    }
    updateSort(sortField, sortOrder) {
        this.sortField.set(sortField);
        this.sortOrder.set(sortOrder);
        this.page.set(1);
    }
    // 6. Główna logika komunikacji z Orkiestratorem
    _fetchData(query) {
        return __async(this, null, function* () {
            this.isLoading.set(true);
            try {
                const result = yield this._orchestrator.searchAsync(query, {
                    autoLoad: true,
                    loadOptions: { includeCategories: true, includeModel: true }
                });
                this.searchResultUuids.set(result.uuids ?? []);
                this.totalCount.set(result.totalCount ?? 0);
            }
            catch (err) {
                console.error("Product search failed:", err);
            }
            finally {
                this.isLoading.set(false);
            }
        });
    }
    static \u0275fac = function ProductListViewStore_Factory(__ngFactoryType__) {
        return new (__ngFactoryType__ || _ProductListViewStore)();
    };
    static \u0275prov = /* @__PURE__ */ i0.\u0275\u0275defineInjectable({ token: _ProductListViewStore, factory: _ProductListViewStore.\u0275fac });
};
(() => {
    (typeof ngDevMode === "undefined" || ngDevMode) && i0.\u0275setClassMetadata(ProductListViewStore, [{
            type: Injectable
        }], () => [], null);
})();
// frontend/libs/modules/catalog/feature/src/lib/product/translation/index.ts
import { provideTranslocoScope } from "@jsverse/transloco";
import { provideSharedTranslations } from "@erp/shared/ui";
// frontend/libs/modules/catalog/feature/src/lib/product/translation/keys.ts
var PRODUCT_KEYS = {
    base: {
        tabs: {
            products: "product.base.tabs.products",
            multimedia: "product.base.tabs.multimedia",
            salesOffer: "product.base.tabs.salesOffer",
            warranties: "product.base.tabs.warranties"
        },
        filters: {
            sku: {
                label: "product.base.filters.sku.label",
                placeholder: "product.base.filters.sku.placeholder"
            },
            name: {
                label: "product.base.filters.name.label",
                placeholder: "product.base.filters.name.placeholder"
            },
            price: {
                label: "product.base.filters.price.label",
                placeholder: "product.base.filters.price.placeholder"
            },
            availableFrom: {
                label: "product.base.filters.availableFrom.label",
                placeholder: "product.base.filters.availableFrom.placeholder"
            }
        },
        table: {
            columns: {
                sku: "product.base.table.columns.sku",
                name: "product.base.table.columns.name",
                category: "product.base.table.columns.category",
                modelName: "product.base.table.columns.modelName",
                price: "product.base.table.columns.price",
                availableFrom: "product.base.table.columns.availableFrom",
                status: "product.base.table.columns.status",
                available: "product.base.table.columns.available"
            },
            emptyMessage: "product.base.table.emptyMessage"
        },
        multimedia: {
            gallery: {
                title: "product.base.multimedia.gallery.title",
                subtitle: "product.base.multimedia.gallery.subtitle",
                description: "product.base.multimedia.gallery.description"
            },
            video: {
                title: "product.base.multimedia.video.title",
                subtitle: "product.base.multimedia.video.subtitle",
                description: "product.base.multimedia.video.description"
            }
        },
        delivery: {
            shipping: {
                title: "product.base.delivery.shipping.title",
                subtitle: "product.base.delivery.shipping.subtitle",
                description: "product.base.delivery.shipping.description"
            },
            packing: {
                title: "product.base.delivery.packing.title",
                subtitle: "product.base.delivery.packing.subtitle",
                description: "product.base.delivery.packing.description"
            }
        },
        exclusion: {
            title: "product.base.exclusion.title",
            subtitle: "product.base.exclusion.subtitle",
            description: "product.base.exclusion.description"
        },
        salesOffer: {
            tabs: {
                exclusion: "product.base.salesOffer.tabs.exclusion",
                delivery: "product.base.salesOffer.tabs.delivery"
            }
        },
        warranty: {
            terms: {
                title: "product.base.warranty.terms.title",
                subtitle: "product.base.warranty.terms.subtitle",
                description: "product.base.warranty.terms.description"
            },
            service: {
                title: "product.base.warranty.service.title",
                subtitle: "product.base.warranty.service.subtitle",
                description: "product.base.warranty.service.description"
            },
            steps: {
                terms: "product.base.warranty.steps.terms",
                service: "product.base.warranty.steps.service"
            }
        }
    },
    enums: {
        status: {
            active: "product.enums.status.active",
            draft: "product.enums.status.draft",
            withdrawn: "product.enums.status.withdrawn",
            archive: "product.enums.status.archive"
        }
    },
    commands: {
        setPrice: {
            label: "product.commands.setPrice.label",
            modalTitle: "product.commands.setPrice.modalTitle",
            priceLabel: "product.commands.setPrice.priceLabel",
            submitButton: "product.commands.setPrice.submitButton",
            cancelButton: "product.commands.setPrice.cancelButton",
            editMessage: "product.commands.setPrice.editMessage",
            productSuffixSingle: "product.commands.setPrice.productSuffixSingle",
            productSuffixPlural: "product.commands.setPrice.productSuffixPlural"
        },
        setName: {
            label: "product.commands.setName.label",
            modalTitle: "product.commands.setName.modalTitle",
            nameLabel: "product.commands.setName.nameLabel",
            namePlaceholder: "product.commands.setName.namePlaceholder",
            submitButton: "product.commands.setName.submitButton",
            cancelButton: "product.commands.setName.cancelButton",
            editMessage: "product.commands.setName.editMessage",
            productSuffixSingle: "product.commands.setName.productSuffixSingle",
            productSuffixPlural: "product.commands.setName.productSuffixPlural"
        }
    },
    validations: {
        priceRequired: "product.validations.priceRequired",
        priceMin: "product.validations.priceMin",
        nameRequired: "product.validations.nameRequired"
    }
};
// frontend/libs/modules/catalog/feature/src/lib/product/translation/index.ts
function provideProductTranslations() {
    return [
        provideTranslocoScope({
            scope: "product",
            alias: "product",
            loader: {
                "pl-PL": () => import("@nf-internal/pl-PL-UDIUVPHC"),
                "en-US": () => import("@nf-internal/en-US-C7KPSKXR")
            }
        }),
        provideSharedTranslations()
    ];
}
// frontend/libs/modules/catalog/feature/src/lib/product/page/tabs/product-tab.component.ts
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ErpMenuBarComponent, ErpMenuBarBuilder } from "@erp/shared/ui";
import * as i02 from "@angular/core";
var ProductTabComponent = class _ProductTabComponent {
    horizontalMenu = ErpMenuBarBuilder.create((b) => b.addItem((i) => i.setLabel("Dodaj produkt").setIconStart("@tui.plus")));
    static \u0275fac = function ProductTabComponent_Factory(__ngFactoryType__) {
        return new (__ngFactoryType__ || _ProductTabComponent)();
    };
    static \u0275cmp = /* @__PURE__ */ i02.\u0275\u0275defineComponent({ type: _ProductTabComponent, selectors: [["erp-product-tab"]], decls: 4, vars: 1, consts: [[2, "padding", "1rem", "display", "flex", "flex-direction", "column", "gap", "1.5rem"], [3, "config"]], template: function ProductTabComponent_Template(rf, ctx) {
            if (rf & 1) {
                i02.\u0275\u0275elementStart(0, "div", 0)(1, "h3");
                i02.\u0275\u0275text(2, "Test komponentu ErpMenuBar (Poziomy)");
                i02.\u0275\u0275elementEnd();
                i02.\u0275\u0275element(3, "erp-menu-bar", 1);
                i02.\u0275\u0275elementEnd();
            }
            if (rf & 2) {
                i02.\u0275\u0275advance(3);
                i02.\u0275\u0275property("config", ctx.horizontalMenu);
            }
        }, dependencies: [CommonModule, ErpMenuBarComponent], encapsulation: 2 });
};
(() => {
    (typeof ngDevMode === "undefined" || ngDevMode) && i02.\u0275setClassMetadata(ProductTabComponent, [{
            type: Component,
            args: [{
                    selector: "erp-product-tab",
                    standalone: true,
                    imports: [CommonModule, ErpMenuBarComponent],
                    template: `
    <div style="padding: 1rem; display: flex; flex-direction: column; gap: 1.5rem;">
      <h3>Test komponentu ErpMenuBar (Poziomy)</h3>
      <erp-menu-bar [config]="horizontalMenu" />
    </div>
  `,
                    changeDetection: ChangeDetectionStrategy.OnPush
                }]
        }], null, null);
})();
(() => {
    (typeof ngDevMode === "undefined" || ngDevMode) && i02.\u0275setClassDebugInfo(ProductTabComponent, { className: "ProductTabComponent", filePath: "frontend/libs/modules/catalog/feature/src/lib/product/page/tabs/product-tab.component.ts", lineNumber: 17 });
})();
// frontend/libs/modules/catalog/feature/src/lib/product/page/tabs/multimedia-tab.component.ts
import { ChangeDetectionStrategy as ChangeDetectionStrategy2, Component as Component2 } from "@angular/core";
import { CommonModule as CommonModule2 } from "@angular/common";
import * as i03 from "@angular/core";
var MultimediaTabComponent = class _MultimediaTabComponent {
    static \u0275fac = function MultimediaTabComponent_Factory(__ngFactoryType__) {
        return new (__ngFactoryType__ || _MultimediaTabComponent)();
    };
    static \u0275cmp = /* @__PURE__ */ i03.\u0275\u0275defineComponent({ type: _MultimediaTabComponent, selectors: [["erp-multimedia-tab"]], decls: 2, vars: 0, consts: [[2, "padding", "1rem"]], template: function MultimediaTabComponent_Template(rf, ctx) {
            if (rf & 1) {
                i03.\u0275\u0275domElementStart(0, "div", 0);
                i03.\u0275\u0275text(1, "Multimedia Tab Content");
                i03.\u0275\u0275domElementEnd();
            }
        }, dependencies: [CommonModule2], encapsulation: 2 });
};
(() => {
    (typeof ngDevMode === "undefined" || ngDevMode) && i03.\u0275setClassMetadata(MultimediaTabComponent, [{
            type: Component2,
            args: [{
                    selector: "erp-multimedia-tab",
                    standalone: true,
                    imports: [CommonModule2],
                    template: `<div style="padding: 1rem;">Multimedia Tab Content</div>`,
                    changeDetection: ChangeDetectionStrategy2.OnPush
                }]
        }], null, null);
})();
(() => {
    (typeof ngDevMode === "undefined" || ngDevMode) && i03.\u0275setClassDebugInfo(MultimediaTabComponent, { className: "MultimediaTabComponent", filePath: "frontend/libs/modules/catalog/feature/src/lib/product/page/tabs/multimedia-tab.component.ts", lineNumber: 11 });
})();
// frontend/libs/modules/catalog/feature/src/lib/product/page/tabs/sales-offer-tabs/exclusion-tab.component.ts
import { ChangeDetectionStrategy as ChangeDetectionStrategy3, Component as Component3 } from "@angular/core";
import { CommonModule as CommonModule3 } from "@angular/common";
import * as i04 from "@angular/core";
var ExclusionTabComponent = class _ExclusionTabComponent {
    static \u0275fac = function ExclusionTabComponent_Factory(__ngFactoryType__) {
        return new (__ngFactoryType__ || _ExclusionTabComponent)();
    };
    static \u0275cmp = /* @__PURE__ */ i04.\u0275\u0275defineComponent({ type: _ExclusionTabComponent, selectors: [["erp-exclusion-tab"]], decls: 2, vars: 0, consts: [[2, "padding", "1rem"]], template: function ExclusionTabComponent_Template(rf, ctx) {
            if (rf & 1) {
                i04.\u0275\u0275domElementStart(0, "div", 0);
                i04.\u0275\u0275text(1, "Exclusion Tab Content");
                i04.\u0275\u0275domElementEnd();
            }
        }, dependencies: [CommonModule3], encapsulation: 2 });
};
(() => {
    (typeof ngDevMode === "undefined" || ngDevMode) && i04.\u0275setClassMetadata(ExclusionTabComponent, [{
            type: Component3,
            args: [{
                    selector: "erp-exclusion-tab",
                    standalone: true,
                    imports: [CommonModule3],
                    template: `<div style="padding: 1rem;">Exclusion Tab Content</div>`,
                    changeDetection: ChangeDetectionStrategy3.OnPush
                }]
        }], null, null);
})();
(() => {
    (typeof ngDevMode === "undefined" || ngDevMode) && i04.\u0275setClassDebugInfo(ExclusionTabComponent, { className: "ExclusionTabComponent", filePath: "frontend/libs/modules/catalog/feature/src/lib/product/page/tabs/sales-offer-tabs/exclusion-tab.component.ts", lineNumber: 11 });
})();
// frontend/libs/modules/catalog/feature/src/lib/product/page/tabs/sales-offer-tabs/delivery-tab.component.ts
import { ChangeDetectionStrategy as ChangeDetectionStrategy4, Component as Component4 } from "@angular/core";
import { CommonModule as CommonModule4 } from "@angular/common";
import * as i05 from "@angular/core";
var DeliveryTabComponent = class _DeliveryTabComponent {
    static \u0275fac = function DeliveryTabComponent_Factory(__ngFactoryType__) {
        return new (__ngFactoryType__ || _DeliveryTabComponent)();
    };
    static \u0275cmp = /* @__PURE__ */ i05.\u0275\u0275defineComponent({ type: _DeliveryTabComponent, selectors: [["erp-delivery-tab"]], decls: 2, vars: 0, consts: [[2, "padding", "1rem"]], template: function DeliveryTabComponent_Template(rf, ctx) {
            if (rf & 1) {
                i05.\u0275\u0275domElementStart(0, "div", 0);
                i05.\u0275\u0275text(1, "Delivery Tab Content");
                i05.\u0275\u0275domElementEnd();
            }
        }, dependencies: [CommonModule4], encapsulation: 2 });
};
(() => {
    (typeof ngDevMode === "undefined" || ngDevMode) && i05.\u0275setClassMetadata(DeliveryTabComponent, [{
            type: Component4,
            args: [{
                    selector: "erp-delivery-tab",
                    standalone: true,
                    imports: [CommonModule4],
                    template: `<div style="padding: 1rem;">Delivery Tab Content</div>`,
                    changeDetection: ChangeDetectionStrategy4.OnPush
                }]
        }], null, null);
})();
(() => {
    (typeof ngDevMode === "undefined" || ngDevMode) && i05.\u0275setClassDebugInfo(DeliveryTabComponent, { className: "DeliveryTabComponent", filePath: "frontend/libs/modules/catalog/feature/src/lib/product/page/tabs/sales-offer-tabs/delivery-tab.component.ts", lineNumber: 11 });
})();
// frontend/libs/modules/catalog/feature/src/lib/product/page/tabs/warranty-tab.component.ts
import { ChangeDetectionStrategy as ChangeDetectionStrategy5, Component as Component5 } from "@angular/core";
import { CommonModule as CommonModule5 } from "@angular/common";
import * as i06 from "@angular/core";
var WarrantyTabComponent = class _WarrantyTabComponent {
    static \u0275fac = function WarrantyTabComponent_Factory(__ngFactoryType__) {
        return new (__ngFactoryType__ || _WarrantyTabComponent)();
    };
    static \u0275cmp = /* @__PURE__ */ i06.\u0275\u0275defineComponent({ type: _WarrantyTabComponent, selectors: [["erp-warranty-tab"]], decls: 2, vars: 0, consts: [[2, "padding", "1rem"]], template: function WarrantyTabComponent_Template(rf, ctx) {
            if (rf & 1) {
                i06.\u0275\u0275domElementStart(0, "div", 0);
                i06.\u0275\u0275text(1, "Warranty Tab Content");
                i06.\u0275\u0275domElementEnd();
            }
        }, dependencies: [CommonModule5], encapsulation: 2 });
};
(() => {
    (typeof ngDevMode === "undefined" || ngDevMode) && i06.\u0275setClassMetadata(WarrantyTabComponent, [{
            type: Component5,
            args: [{
                    selector: "erp-warranty-tab",
                    standalone: true,
                    imports: [CommonModule5],
                    template: `<div style="padding: 1rem;">Warranty Tab Content</div>`,
                    changeDetection: ChangeDetectionStrategy5.OnPush
                }]
        }], null, null);
})();
(() => {
    (typeof ngDevMode === "undefined" || ngDevMode) && i06.\u0275setClassDebugInfo(WarrantyTabComponent, { className: "WarrantyTabComponent", filePath: "frontend/libs/modules/catalog/feature/src/lib/product/page/tabs/warranty-tab.component.ts", lineNumber: 11 });
})();
// frontend/libs/modules/catalog/feature/src/lib/product/page/filters/product-filter.component.ts
import { ChangeDetectionStrategy as ChangeDetectionStrategy6, Component as Component6 } from "@angular/core";
import { CommonModule as CommonModule6 } from "@angular/common";
import * as i07 from "@angular/core";
var ProductFilterComponent = class _ProductFilterComponent {
    static \u0275fac = function ProductFilterComponent_Factory(__ngFactoryType__) {
        return new (__ngFactoryType__ || _ProductFilterComponent)();
    };
    static \u0275cmp = /* @__PURE__ */ i07.\u0275\u0275defineComponent({ type: _ProductFilterComponent, selectors: [["erp-product-filter"]], decls: 2, vars: 0, consts: [[2, "padding", "1rem"]], template: function ProductFilterComponent_Template(rf, ctx) {
            if (rf & 1) {
                i07.\u0275\u0275domElementStart(0, "div", 0);
                i07.\u0275\u0275text(1, "Product Filter Content");
                i07.\u0275\u0275domElementEnd();
            }
        }, dependencies: [CommonModule6], encapsulation: 2 });
};
(() => {
    (typeof ngDevMode === "undefined" || ngDevMode) && i07.\u0275setClassMetadata(ProductFilterComponent, [{
            type: Component6,
            args: [{
                    selector: "erp-product-filter",
                    standalone: true,
                    imports: [CommonModule6],
                    template: `<div style="padding: 1rem;">Product Filter Content</div>`,
                    changeDetection: ChangeDetectionStrategy6.OnPush
                }]
        }], null, null);
})();
(() => {
    (typeof ngDevMode === "undefined" || ngDevMode) && i07.\u0275setClassDebugInfo(ProductFilterComponent, { className: "ProductFilterComponent", filePath: "frontend/libs/modules/catalog/feature/src/lib/product/page/filters/product-filter.component.ts", lineNumber: 11 });
})();
// frontend/libs/modules/catalog/feature/src/lib/product/page/product.ts
import * as i08 from "@angular/core";
var ProductComponent = class _ProductComponent {
    tabsConfig = ErpTabsBuilder.create((b) => b.addTab(PRODUCT_KEYS.base.tabs.products, "products", {
        component: ProductTabComponent,
        icon: "@tui.shopping-bag"
    }).addTab(PRODUCT_KEYS.base.tabs.multimedia, "multimedia", {
        component: MultimediaTabComponent,
        icon: "@tui.image"
    }).addTab(PRODUCT_KEYS.base.tabs.salesOffer, "sales-offer", {
        icon: "@tui.percent",
        children: [
            {
                label: PRODUCT_KEYS.base.salesOffer.tabs.exclusion,
                id: "exclusion",
                component: ExclusionTabComponent,
                icon: "@tui.ban"
            },
            {
                label: PRODUCT_KEYS.base.salesOffer.tabs.delivery,
                id: "delivery",
                component: DeliveryTabComponent,
                icon: "@tui.truck"
            }
        ]
    }).addTab(PRODUCT_KEYS.base.tabs.warranties, "warranties", {
        component: WarrantyTabComponent,
        icon: "@tui.shield-check"
    }).setInitialValue("products").setOnTabChange(noop));
    pageConfig = ErpPageLayoutBuilder.create((b) => b.setLeftSidebar(ProductFilterComponent).setMain(ErpTabsComponent, { config: this.tabsConfig }));
    static \u0275fac = function ProductComponent_Factory(__ngFactoryType__) {
        return new (__ngFactoryType__ || _ProductComponent)();
    };
    static \u0275cmp = /* @__PURE__ */ i08.\u0275\u0275defineComponent({ type: _ProductComponent, selectors: [["ng-component"]], features: [i08.\u0275\u0275ProvidersFeature([ProductListViewStore, provideProductTranslations()])], decls: 1, vars: 1, consts: [[3, "config"]], template: function ProductComponent_Template(rf, ctx) {
            if (rf & 1) {
                i08.\u0275\u0275element(0, "erp-page-layout", 0);
            }
            if (rf & 2) {
                i08.\u0275\u0275property("config", ctx.pageConfig);
            }
        }, dependencies: [ErpPageLayoutComponent], styles: ["\n[_nghost-%COMP%] {\n  display: flex;\n  flex-direction: column;\n  flex: 1;\n  height: 100%;\n  min-height: 0;\n}\n/*# sourceMappingURL=product.css.map */"] });
};
(() => {
    (typeof ngDevMode === "undefined" || ngDevMode) && i08.\u0275setClassMetadata(ProductComponent, [{
            type: Component7,
            args: [{ standalone: true, imports: [ErpPageLayoutComponent], providers: [ProductListViewStore, provideProductTranslations()], template: `<erp-page-layout [config]="pageConfig" />`, changeDetection: ChangeDetectionStrategy7.OnPush, styles: ["/* angular:styles/component:css;bcbc92fe734b6b68a358d7e322bf0a0e1d3fdef7f8d95857dd93372c5df41238;/home/hefaj/Pulpit/git/Enterprise-Resource-Planning/frontend/libs/modules/catalog/feature/src/lib/product/page/product.ts */\n:host {\n  display: flex;\n  flex-direction: column;\n  flex: 1;\n  height: 100%;\n  min-height: 0;\n}\n/*# sourceMappingURL=product.css.map */\n"] }]
        }], null, null);
})();
(() => {
    (typeof ngDevMode === "undefined" || ngDevMode) && i08.\u0275setClassDebugInfo(ProductComponent, { className: "ProductComponent", filePath: "frontend/libs/modules/catalog/feature/src/lib/product/page/product.ts", lineNumber: 35 });
})();
export { PRODUCT_KEYS, ProductComponent, provideProductTranslations };
//# sourceMappingURL=_erp_catalog_feature.js.map

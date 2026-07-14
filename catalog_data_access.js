import { __async, __spreadProps, __spreadValues } from "@nf-internal/chunk-Y5RQAIA6";
// frontend/libs/modules/catalog/data-access/src/lib/api-client.ts
import { mergeMap as _observableMergeMap, catchError as _observableCatch } from "rxjs/operators";
import { Observable, throwError as _observableThrow, of as _observableOf } from "rxjs";
import { Injectable, Inject, Optional, InjectionToken } from "@angular/core";
import { HttpClient, HttpHeaders, HttpResponse, HttpResponseBase } from "@angular/common/http";
import * as i0 from "@angular/core";
import * as i1 from "@angular/common/http";
var API_BASE_URL = new InjectionToken("API_BASE_URL");
var CatalogBffClient = class _CatalogBffClient {
    http;
    baseUrl;
    jsonParseReviver = void 0;
    constructor(http, baseUrl) {
        this.http = http;
        this.baseUrl = baseUrl ?? "http://localhost:5149/";
    }
    /**
     * @return OK
     */
    getProduct(body) {
        let url_ = this.baseUrl + "/product/getProduct";
        url_ = url_.replace(/[?&]$/, "");
        const content_ = JSON.stringify(body);
        let options_ = {
            body: content_,
            observe: "response",
            responseType: "blob",
            headers: new HttpHeaders({
                "Content-Type": "application/json",
                "Accept": "application/json"
            })
        };
        return this.http.request("post", url_, options_).pipe(_observableMergeMap((response_) => {
            return this.processGetProduct(response_);
        })).pipe(_observableCatch((response_) => {
            if (response_ instanceof HttpResponseBase) {
                try {
                    return this.processGetProduct(response_);
                }
                catch (e) {
                    return _observableThrow(e);
                }
            }
            else
                return _observableThrow(response_);
        }));
    }
    processGetProduct(response) {
        const status = response.status;
        const responseBlob = response instanceof HttpResponse ? response.body : response.error instanceof Blob ? response.error : void 0;
        let _headers = {};
        if (response.headers) {
            for (let key of response.headers.keys()) {
                _headers[key] = response.headers.get(key);
            }
        }
        if (status === 200) {
            return blobToText(responseBlob).pipe(_observableMergeMap((_responseText) => {
                let result200 = null;
                result200 = _responseText === "" ? null : JSON.parse(_responseText, this.jsonParseReviver);
                return _observableOf(result200);
            }));
        }
        else if (status !== 200 && status !== 204) {
            return blobToText(responseBlob).pipe(_observableMergeMap((_responseText) => {
                return throwException("An unexpected server error occurred.", status, _responseText, _headers);
            }));
        }
        return _observableOf(null);
    }
    /**
     * @return OK
     */
    searchProduct(body) {
        let url_ = this.baseUrl + "/product/searchProduct";
        url_ = url_.replace(/[?&]$/, "");
        const content_ = JSON.stringify(body);
        let options_ = {
            body: content_,
            observe: "response",
            responseType: "blob",
            headers: new HttpHeaders({
                "Content-Type": "application/json",
                "Accept": "application/json"
            })
        };
        return this.http.request("post", url_, options_).pipe(_observableMergeMap((response_) => {
            return this.processSearchProduct(response_);
        })).pipe(_observableCatch((response_) => {
            if (response_ instanceof HttpResponseBase) {
                try {
                    return this.processSearchProduct(response_);
                }
                catch (e) {
                    return _observableThrow(e);
                }
            }
            else
                return _observableThrow(response_);
        }));
    }
    processSearchProduct(response) {
        const status = response.status;
        const responseBlob = response instanceof HttpResponse ? response.body : response.error instanceof Blob ? response.error : void 0;
        let _headers = {};
        if (response.headers) {
            for (let key of response.headers.keys()) {
                _headers[key] = response.headers.get(key);
            }
        }
        if (status === 200) {
            return blobToText(responseBlob).pipe(_observableMergeMap((_responseText) => {
                let result200 = null;
                result200 = _responseText === "" ? null : JSON.parse(_responseText, this.jsonParseReviver);
                return _observableOf(result200);
            }));
        }
        else if (status !== 200 && status !== 204) {
            return blobToText(responseBlob).pipe(_observableMergeMap((_responseText) => {
                return throwException("An unexpected server error occurred.", status, _responseText, _headers);
            }));
        }
        return _observableOf(null);
    }
    /**
     * Seryjna aktualizacja nazw produktów z obsługą błędów cząstkowych
     * @return OK
     */
    productSetNameMultipleCommand(body) {
        let url_ = this.baseUrl + "/product/product/batch-set-name";
        url_ = url_.replace(/[?&]$/, "");
        const content_ = JSON.stringify(body);
        let options_ = {
            body: content_,
            observe: "response",
            responseType: "blob",
            headers: new HttpHeaders({
                "Content-Type": "application/json",
                "Accept": "application/json"
            })
        };
        return this.http.request("post", url_, options_).pipe(_observableMergeMap((response_) => {
            return this.processProductSetNameMultipleCommand(response_);
        })).pipe(_observableCatch((response_) => {
            if (response_ instanceof HttpResponseBase) {
                try {
                    return this.processProductSetNameMultipleCommand(response_);
                }
                catch (e) {
                    return _observableThrow(e);
                }
            }
            else
                return _observableThrow(response_);
        }));
    }
    processProductSetNameMultipleCommand(response) {
        const status = response.status;
        const responseBlob = response instanceof HttpResponse ? response.body : response.error instanceof Blob ? response.error : void 0;
        let _headers = {};
        if (response.headers) {
            for (let key of response.headers.keys()) {
                _headers[key] = response.headers.get(key);
            }
        }
        if (status === 200) {
            return blobToText(responseBlob).pipe(_observableMergeMap((_responseText) => {
                let result200 = null;
                result200 = _responseText === "" ? null : JSON.parse(_responseText, this.jsonParseReviver);
                return _observableOf(result200);
            }));
        }
        else if (status !== 200 && status !== 204) {
            return blobToText(responseBlob).pipe(_observableMergeMap((_responseText) => {
                return throwException("An unexpected server error occurred.", status, _responseText, _headers);
            }));
        }
        return _observableOf(null);
    }
    /**
     * Seryjna aktualizacja cen produktów z obsługą błędów cząstkowych
     * @return OK
     */
    productSetPriceMultipleCommand(body) {
        let url_ = this.baseUrl + "/product/product/batch-set-price";
        url_ = url_.replace(/[?&]$/, "");
        const content_ = JSON.stringify(body);
        let options_ = {
            body: content_,
            observe: "response",
            responseType: "blob",
            headers: new HttpHeaders({
                "Content-Type": "application/json",
                "Accept": "application/json"
            })
        };
        return this.http.request("post", url_, options_).pipe(_observableMergeMap((response_) => {
            return this.processProductSetPriceMultipleCommand(response_);
        })).pipe(_observableCatch((response_) => {
            if (response_ instanceof HttpResponseBase) {
                try {
                    return this.processProductSetPriceMultipleCommand(response_);
                }
                catch (e) {
                    return _observableThrow(e);
                }
            }
            else
                return _observableThrow(response_);
        }));
    }
    processProductSetPriceMultipleCommand(response) {
        const status = response.status;
        const responseBlob = response instanceof HttpResponse ? response.body : response.error instanceof Blob ? response.error : void 0;
        let _headers = {};
        if (response.headers) {
            for (let key of response.headers.keys()) {
                _headers[key] = response.headers.get(key);
            }
        }
        if (status === 200) {
            return blobToText(responseBlob).pipe(_observableMergeMap((_responseText) => {
                let result200 = null;
                result200 = _responseText === "" ? null : JSON.parse(_responseText, this.jsonParseReviver);
                return _observableOf(result200);
            }));
        }
        else if (status !== 200 && status !== 204) {
            return blobToText(responseBlob).pipe(_observableMergeMap((_responseText) => {
                return throwException("An unexpected server error occurred.", status, _responseText, _headers);
            }));
        }
        return _observableOf(null);
    }
    /**
     * @return OK
     */
    getModel(body) {
        let url_ = this.baseUrl + "/model/getModel";
        url_ = url_.replace(/[?&]$/, "");
        const content_ = JSON.stringify(body);
        let options_ = {
            body: content_,
            observe: "response",
            responseType: "blob",
            headers: new HttpHeaders({
                "Content-Type": "application/json",
                "Accept": "application/json"
            })
        };
        return this.http.request("post", url_, options_).pipe(_observableMergeMap((response_) => {
            return this.processGetModel(response_);
        })).pipe(_observableCatch((response_) => {
            if (response_ instanceof HttpResponseBase) {
                try {
                    return this.processGetModel(response_);
                }
                catch (e) {
                    return _observableThrow(e);
                }
            }
            else
                return _observableThrow(response_);
        }));
    }
    processGetModel(response) {
        const status = response.status;
        const responseBlob = response instanceof HttpResponse ? response.body : response.error instanceof Blob ? response.error : void 0;
        let _headers = {};
        if (response.headers) {
            for (let key of response.headers.keys()) {
                _headers[key] = response.headers.get(key);
            }
        }
        if (status === 200) {
            return blobToText(responseBlob).pipe(_observableMergeMap((_responseText) => {
                let result200 = null;
                result200 = _responseText === "" ? null : JSON.parse(_responseText, this.jsonParseReviver);
                return _observableOf(result200);
            }));
        }
        else if (status !== 200 && status !== 204) {
            return blobToText(responseBlob).pipe(_observableMergeMap((_responseText) => {
                return throwException("An unexpected server error occurred.", status, _responseText, _headers);
            }));
        }
        return _observableOf(null);
    }
    /**
     * @return OK
     */
    searchModel(body) {
        let url_ = this.baseUrl + "/model/searchModel";
        url_ = url_.replace(/[?&]$/, "");
        const content_ = JSON.stringify(body);
        let options_ = {
            body: content_,
            observe: "response",
            responseType: "blob",
            headers: new HttpHeaders({
                "Content-Type": "application/json",
                "Accept": "application/json"
            })
        };
        return this.http.request("post", url_, options_).pipe(_observableMergeMap((response_) => {
            return this.processSearchModel(response_);
        })).pipe(_observableCatch((response_) => {
            if (response_ instanceof HttpResponseBase) {
                try {
                    return this.processSearchModel(response_);
                }
                catch (e) {
                    return _observableThrow(e);
                }
            }
            else
                return _observableThrow(response_);
        }));
    }
    processSearchModel(response) {
        const status = response.status;
        const responseBlob = response instanceof HttpResponse ? response.body : response.error instanceof Blob ? response.error : void 0;
        let _headers = {};
        if (response.headers) {
            for (let key of response.headers.keys()) {
                _headers[key] = response.headers.get(key);
            }
        }
        if (status === 200) {
            return blobToText(responseBlob).pipe(_observableMergeMap((_responseText) => {
                let result200 = null;
                result200 = _responseText === "" ? null : JSON.parse(_responseText, this.jsonParseReviver);
                return _observableOf(result200);
            }));
        }
        else if (status !== 200 && status !== 204) {
            return blobToText(responseBlob).pipe(_observableMergeMap((_responseText) => {
                return throwException("An unexpected server error occurred.", status, _responseText, _headers);
            }));
        }
        return _observableOf(null);
    }
    /**
     * @return OK
     */
    getCategory(body) {
        let url_ = this.baseUrl + "/category/getCategory";
        url_ = url_.replace(/[?&]$/, "");
        const content_ = JSON.stringify(body);
        let options_ = {
            body: content_,
            observe: "response",
            responseType: "blob",
            headers: new HttpHeaders({
                "Content-Type": "application/json",
                "Accept": "application/json"
            })
        };
        return this.http.request("post", url_, options_).pipe(_observableMergeMap((response_) => {
            return this.processGetCategory(response_);
        })).pipe(_observableCatch((response_) => {
            if (response_ instanceof HttpResponseBase) {
                try {
                    return this.processGetCategory(response_);
                }
                catch (e) {
                    return _observableThrow(e);
                }
            }
            else
                return _observableThrow(response_);
        }));
    }
    processGetCategory(response) {
        const status = response.status;
        const responseBlob = response instanceof HttpResponse ? response.body : response.error instanceof Blob ? response.error : void 0;
        let _headers = {};
        if (response.headers) {
            for (let key of response.headers.keys()) {
                _headers[key] = response.headers.get(key);
            }
        }
        if (status === 200) {
            return blobToText(responseBlob).pipe(_observableMergeMap((_responseText) => {
                let result200 = null;
                result200 = _responseText === "" ? null : JSON.parse(_responseText, this.jsonParseReviver);
                return _observableOf(result200);
            }));
        }
        else if (status !== 200 && status !== 204) {
            return blobToText(responseBlob).pipe(_observableMergeMap((_responseText) => {
                return throwException("An unexpected server error occurred.", status, _responseText, _headers);
            }));
        }
        return _observableOf(null);
    }
    /**
     * @return OK
     */
    searchCategory(body) {
        let url_ = this.baseUrl + "/category/searchCategory";
        url_ = url_.replace(/[?&]$/, "");
        const content_ = JSON.stringify(body);
        let options_ = {
            body: content_,
            observe: "response",
            responseType: "blob",
            headers: new HttpHeaders({
                "Content-Type": "application/json",
                "Accept": "application/json"
            })
        };
        return this.http.request("post", url_, options_).pipe(_observableMergeMap((response_) => {
            return this.processSearchCategory(response_);
        })).pipe(_observableCatch((response_) => {
            if (response_ instanceof HttpResponseBase) {
                try {
                    return this.processSearchCategory(response_);
                }
                catch (e) {
                    return _observableThrow(e);
                }
            }
            else
                return _observableThrow(response_);
        }));
    }
    processSearchCategory(response) {
        const status = response.status;
        const responseBlob = response instanceof HttpResponse ? response.body : response.error instanceof Blob ? response.error : void 0;
        let _headers = {};
        if (response.headers) {
            for (let key of response.headers.keys()) {
                _headers[key] = response.headers.get(key);
            }
        }
        if (status === 200) {
            return blobToText(responseBlob).pipe(_observableMergeMap((_responseText) => {
                let result200 = null;
                result200 = _responseText === "" ? null : JSON.parse(_responseText, this.jsonParseReviver);
                return _observableOf(result200);
            }));
        }
        else if (status !== 200 && status !== 204) {
            return blobToText(responseBlob).pipe(_observableMergeMap((_responseText) => {
                return throwException("An unexpected server error occurred.", status, _responseText, _headers);
            }));
        }
        return _observableOf(null);
    }
    static \u0275fac = function CatalogBffClient_Factory(__ngFactoryType__) {
        return new (__ngFactoryType__ || _CatalogBffClient)(i0.\u0275\u0275inject(HttpClient), i0.\u0275\u0275inject(API_BASE_URL, 8));
    };
    static \u0275prov = /* @__PURE__ */ i0.\u0275\u0275defineInjectable({ token: _CatalogBffClient, factory: _CatalogBffClient.\u0275fac, providedIn: "root" });
};
(() => {
    (typeof ngDevMode === "undefined" || ngDevMode) && i0.\u0275setClassMetadata(CatalogBffClient, [{
            type: Injectable,
            args: [{
                    providedIn: "root"
                }]
        }], () => [{ type: i1.HttpClient, decorators: [{
                    type: Inject,
                    args: [HttpClient]
                }] }, { type: void 0, decorators: [{
                    type: Optional
                }, {
                    type: Inject,
                    args: [API_BASE_URL]
                }] }], null);
})();
var ApiException = class extends Error {
    message;
    status;
    response;
    headers;
    result;
    constructor(message, status, response, headers, result) {
        super();
        this.message = message;
        this.status = status;
        this.response = response;
        this.headers = headers;
        this.result = result;
    }
    isApiException = true;
    static isApiException(obj) {
        return obj.isApiException === true;
    }
};
function throwException(message, status, response, headers, result) {
    if (result !== null && result !== void 0)
        return _observableThrow(result);
    else
        return _observableThrow(new ApiException(message, status, response, headers, null));
}
function blobToText(blob) {
    return new Observable((observer) => {
        if (!blob) {
            observer.next("");
            observer.complete();
        }
        else {
            let reader = new FileReader();
            reader.onload = (event) => {
                observer.next(event.target.result);
                observer.complete();
            };
            reader.readAsText(blob);
        }
    });
}
// frontend/libs/modules/catalog/data-access/src/lib/product.store.ts
import { patchState, signalStore, withMethods, withState } from "@ngrx/signals";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { inject } from "@angular/core";
import { pipe, switchMap, tap } from "rxjs";
import { tapResponse } from "@ngrx/operators";
var initialState = {
    products: [],
    isLoading: false
};
var ProductStore = signalStore({ providedIn: "root" }, withState(initialState), withMethods((store, api = inject(CatalogBffClient)) => ({
    load: rxMethod(pipe(tap(() => patchState(store, { isLoading: true })), switchMap(() => {
        return api.getProduct({}).pipe(tapResponse({
            next: (products) => patchState(store, { products }),
            error: (err) => console.error(err),
            finalize: () => patchState(store, { isLoading: false })
        }));
    })))
})));
// frontend/libs/modules/catalog/data-access/src/lib/orchestrators/product/catalog-product.orchestrator.ts
import { Injectable as Injectable4, inject as inject4, Injector } from "@angular/core";
import { map } from "rxjs/operators";
import { BaseOrchestrator as BaseOrchestrator3 } from "@erp/shared/data-access";
// frontend/libs/modules/catalog/data-access/src/lib/orchestrators/category/catalog-category.orchestrator.ts
import { Injectable as Injectable2, inject as inject2 } from "@angular/core";
import { BaseOrchestrator } from "@erp/shared/data-access";
import * as i02 from "@angular/core";
var MAX_PARENT_DEPTH = 3;
var CatalogCategoryOrchestrator = class _CatalogCategoryOrchestrator extends BaseOrchestrator {
    _api = inject2(CatalogBffClient);
    signature = "catalog.category";
    orchestratorConfig = {
        signalrSignature: "catalog.category",
        maxCacheSize: 500
        // Kategorie są zazwyczaj mniej liczne niż produkty
    };
    // ────────────────────────────────────────────────────────────────
    // Abstrakcyjne implementacje
    // ────────────────────────────────────────────────────────────────
    fetchByUuids(uuids) {
        return this._api.getCategory({ uuids });
    }
    searchByFilters(filters) {
        return this._api.searchCategory(filters);
    }
    mapToViewModel(dto, _resolvedDeps) {
        return this._mapWithDepthGuard(dto, 0);
    }
    // ────────────────────────────────────────────────────────────────
    // Eager Loading: Rozwiązywanie łańcucha nadrzędnego
    // ────────────────────────────────────────────────────────────────
    /**
     * Po załadowaniu kategorii, natychmiast załaduj ich łańcuch nadrzędny
     * do poziomu MAX_PARENT_DEPTH.
     */
    resolveEagerDependencies(uuids, _options) {
        return __async(this, null, function* () {
            yield this._loadParentChain(uuids, 0);
        });
    }
    /**
     * Rekurencyjne ładowanie kategorii nadrzędnych do maksymalnej głębokości.
     */
    _loadParentChain(uuids, depth) {
        return __async(this, null, function* () {
            if (depth >= MAX_PARENT_DEPTH)
                return;
            const parentUuids = /* @__PURE__ */ new Set();
            for (const uuid of uuids) {
                const dto = this.identityMap.peek(uuid);
                if (dto?.parentUuid) {
                    parentUuids.add(dto.parentUuid);
                }
            }
            if (parentUuids.size === 0)
                return;
            const missingParents = [...parentUuids].filter((uuid) => !this.identityMap.has(uuid));
            if (missingParents.length > 0) {
                yield this.dataLoader.loadAsync(missingParents);
            }
            yield this._loadParentChain([...parentUuids], depth + 1);
        });
    }
    // ────────────────────────────────────────────────────────────────
    // Wewnętrzne: Rekurencyjne mapowanie DTO → VM z zabezpieczeniem głębokości
    // ────────────────────────────────────────────────────────────────
    _mapWithDepthGuard(dto, depth) {
        let parent = null;
        if (dto.parentUuid && depth < MAX_PARENT_DEPTH) {
            const parentDto = this.identityMap.peek(dto.parentUuid);
            if (parentDto) {
                parent = this._mapWithDepthGuard(parentDto, depth + 1);
            }
        }
        return __spreadProps(__spreadValues({}, dto), {
            parent
        });
    }
    // ────────────────────────────────────────────────────────────────
    // Publiczne: Metoda pomocnicza dla zewnętrznych orkiestratorów
    // ────────────────────────────────────────────────────────────────
    /**
     * Rozwiąż listę UUID kategorii do obiektów CategoryVM.
     * Używane przez CatalogProductOrchestrator do uzupełnienia Product.categories.
     * Zwraca tylko te kategorie, które są już w pamięci podręcznej (cache).
     */
    resolveCategoryVMs(uuids) {
        const result = [];
        for (const uuid of uuids) {
            const dto = this.identityMap.peek(uuid);
            if (dto) {
                result.push(this._mapWithDepthGuard(dto, 0));
            }
        }
        return result;
    }
    static \u0275fac = /* @__PURE__ */ (() => {
        let \u0275CatalogCategoryOrchestrator_BaseFactory;
        return function CatalogCategoryOrchestrator_Factory(__ngFactoryType__) {
            return (\u0275CatalogCategoryOrchestrator_BaseFactory || (\u0275CatalogCategoryOrchestrator_BaseFactory = i02.\u0275\u0275getInheritedFactory(_CatalogCategoryOrchestrator)))(__ngFactoryType__ || _CatalogCategoryOrchestrator);
        };
    })();
    static \u0275prov = /* @__PURE__ */ i02.\u0275\u0275defineInjectable({ token: _CatalogCategoryOrchestrator, factory: _CatalogCategoryOrchestrator.\u0275fac, providedIn: "root" });
};
(() => {
    (typeof ngDevMode === "undefined" || ngDevMode) && i02.\u0275setClassMetadata(CatalogCategoryOrchestrator, [{
            type: Injectable2,
            args: [{ providedIn: "root" }]
        }], null, null);
})();
// frontend/libs/modules/catalog/data-access/src/lib/orchestrators/model/catalog-model.orchestrator.ts
import { Injectable as Injectable3, inject as inject3 } from "@angular/core";
import { BaseOrchestrator as BaseOrchestrator2 } from "@erp/shared/data-access";
import * as i03 from "@angular/core";
var CatalogModelOrchestrator = class _CatalogModelOrchestrator extends BaseOrchestrator2 {
    _api = inject3(CatalogBffClient);
    signature = "catalog.model";
    orchestratorConfig = {
        signalrSignature: "catalog.model",
        maxCacheSize: 500
        // Modele są zazwyczaj mniej liczne niż produkty
    };
    // ────────────────────────────────────────────────────────────────
    // Abstrakcyjne implementacje
    // ────────────────────────────────────────────────────────────────
    fetchByUuids(uuids) {
        return this._api.getModel({ uuids });
    }
    searchByFilters(filters) {
        return this._api.searchModel(filters);
    }
    mapToViewModel(dto, _resolvedDeps) {
        return __spreadValues({}, dto);
    }
    static \u0275fac = /* @__PURE__ */ (() => {
        let \u0275CatalogModelOrchestrator_BaseFactory;
        return function CatalogModelOrchestrator_Factory(__ngFactoryType__) {
            return (\u0275CatalogModelOrchestrator_BaseFactory || (\u0275CatalogModelOrchestrator_BaseFactory = i03.\u0275\u0275getInheritedFactory(_CatalogModelOrchestrator)))(__ngFactoryType__ || _CatalogModelOrchestrator);
        };
    })();
    static \u0275prov = /* @__PURE__ */ i03.\u0275\u0275defineInjectable({ token: _CatalogModelOrchestrator, factory: _CatalogModelOrchestrator.\u0275fac, providedIn: "root" });
};
(() => {
    (typeof ngDevMode === "undefined" || ngDevMode) && i03.\u0275setClassMetadata(CatalogModelOrchestrator, [{
            type: Injectable3,
            args: [{ providedIn: "root" }]
        }], null, null);
})();
// frontend/libs/modules/catalog/data-access/src/lib/orchestrators/product/catalog-product.orchestrator.ts
import * as i04 from "@angular/core";
var CatalogProductOrchestrator = class _CatalogProductOrchestrator extends BaseOrchestrator3 {
    _api = inject4(CatalogBffClient);
    _injector = inject4(Injector);
    // Leniwie ładowane sąsiednie orkiestratorzy w celu uniknięcia kołowej zależności
    _categoryOrchestrator = null;
    _modelOrchestrator = null;
    signature = "catalog.product";
    orchestratorConfig = {
        signalrSignature: "catalog.product",
        // Produkty są najcięższym agregatem — maksymalny cache
        maxCacheSize: 1e3,
        maxChunkSize: 100,
        bufferTimeMs: 50
    };
    // ────────────────────────────────────────────────────────────────
    // Leniwe wstrzykiwanie (Zapobieganie kołowej zależności)
    // ────────────────────────────────────────────────────────────────
    get _categorySiblingOrchestrator() {
        if (!this._categoryOrchestrator) {
            this._categoryOrchestrator = this._injector.get(CatalogCategoryOrchestrator);
        }
        return this._categoryOrchestrator;
    }
    get _modelSiblingOrchestrator() {
        if (!this._modelOrchestrator) {
            this._modelOrchestrator = this._injector.get(CatalogModelOrchestrator);
        }
        return this._modelOrchestrator;
    }
    // ────────────────────────────────────────────────────────────────
    // Abstrakcyjne implementacje
    // ────────────────────────────────────────────────────────────────
    fetchByUuids(uuids) {
        return this._api.getProduct({ uuids });
    }
    searchByFilters(filters) {
        return this._api.searchProduct(filters);
    }
    mapToViewModel(dto, resolvedDeps) {
        const deps = resolvedDeps;
        return __spreadProps(__spreadValues({}, dto), {
            categories: deps.categories ?? [],
            model: deps.model ?? null
        });
    }
    // ────────────────────────────────────────────────────────────────
    // Eager Loading: Rozwiązywanie zależności produktu
    // ────────────────────────────────────────────────────────────────
    /**
     * Po załadowaniu produktów, natychmiast załaduj ich kategorie i modele.
     *
     * 1. Zbierz wszystkie unikalne categoryUuids i modelUuid z załadowanych produktów
     * 2. Przekaż żądanie do odpowiednich sąsiednich orkiestratorów
     * 3. Produkty są uważane za "gotowe" tylko wtedy, gdy wszystkie zależności zostaną rozwiązane
     */
    resolveEagerDependencies(uuids, options) {
        return __async(this, null, function* () {
            const promises = [];
            const categoryUuids = /* @__PURE__ */ new Set();
            const modelUuids = /* @__PURE__ */ new Set();
            for (const uuid of uuids) {
                const dto = this.identityMap.peek(uuid);
                if (!dto)
                    continue;
                if (options.includeCategories && dto.categoryUuids) {
                    for (const catUuid of dto.categoryUuids) {
                        categoryUuids.add(catUuid);
                    }
                }
                if (options.includeModel && dto.modelUuid) {
                    modelUuids.add(dto.modelUuid);
                }
            }
            if (categoryUuids.size > 0) {
                promises.push(this._categorySiblingOrchestrator.loadAsync([...categoryUuids], { includeParent: true }));
            }
            if (modelUuids.size > 0) {
                promises.push(this._modelSiblingOrchestrator.loadAsync([...modelUuids]));
            }
            yield Promise.all(promises);
        });
    }
    /**
     * Rozwiąż aktualne zależności dla pojedynczego DTO produktu.
     * Wywoływane synchronicznie podczas ewaluacji Signal/computed.
     * Używa już zapamiętanych danych z sąsiednich orkiestratorów.
     */
    _resolveCurrentDeps(dto) {
        const categories = dto.categoryUuids ? this._categorySiblingOrchestrator.resolveCategoryVMs(dto.categoryUuids) : [];
        let model = null;
        if (dto.modelUuid) {
            const modelDto = this._modelSiblingOrchestrator["identityMap"].peek(dto.modelUuid);
            if (modelDto) {
                model = __spreadValues({}, modelDto);
            }
        }
        return { categories, model };
    }
    /**
     * Wykonaj seryjne polecenie aktualizacji ceny dla wybranych produktów.
     */
    setPriceMultiple(command, queueID) {
        return __async(this, null, function* () {
            const apiCall = () => this._api.productSetPriceMultipleCommand(command).pipe(map((res) => res.jobUuid || ""));
            return this.executeCommand("Ustawianie cen produkt\xF3w", apiCall, void 0, queueID);
        });
    }
    /**
     * Wykonaj seryjne polecenie aktualizacji nazwy dla wybranych produktów.
     */
    setNameMultiple(command, queueID) {
        return __async(this, null, function* () {
            const apiCall = () => this._api.productSetNameMultipleCommand(command).pipe(map((res) => res.jobUuid || ""));
            return this.executeCommand("Ustawianie nazw produkt\xF3w", apiCall, void 0, queueID);
        });
    }
    static \u0275fac = /* @__PURE__ */ (() => {
        let \u0275CatalogProductOrchestrator_BaseFactory;
        return function CatalogProductOrchestrator_Factory(__ngFactoryType__) {
            return (\u0275CatalogProductOrchestrator_BaseFactory || (\u0275CatalogProductOrchestrator_BaseFactory = i04.\u0275\u0275getInheritedFactory(_CatalogProductOrchestrator)))(__ngFactoryType__ || _CatalogProductOrchestrator);
        };
    })();
    static \u0275prov = /* @__PURE__ */ i04.\u0275\u0275defineInjectable({ token: _CatalogProductOrchestrator, factory: _CatalogProductOrchestrator.\u0275fac, providedIn: "root" });
};
(() => {
    (typeof ngDevMode === "undefined" || ngDevMode) && i04.\u0275setClassMetadata(CatalogProductOrchestrator, [{
            type: Injectable4,
            args: [{ providedIn: "root" }]
        }], null, null);
})();
export { API_BASE_URL, ApiException, CatalogBffClient, CatalogCategoryOrchestrator, CatalogModelOrchestrator, CatalogProductOrchestrator, ProductStore };
//# sourceMappingURL=_erp_catalog_data_access.js.map

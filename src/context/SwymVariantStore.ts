// tokens for swym-product-calculus.entities.products

export const UPDATED = "updated";
export const DELETED = "deleted";
export const UNPUBLISHED = "unpublished";
export const DEFAULT_PRODUCTS_FETCH_LIMIT = 3;
export const CUSTOM_ITEM_TYPE = "custom"; // use to refer a custom item not listed on platform. Ref - https://swymcorp.atlassian.net/wiki/x/DoANrQ

// Note: The Clojure deftable definition translates to a conceptual data structure.
// In TypeScript, this would likely be represented by interfaces or classes
// depending on how you interact with your data store.
// The specific MongoDB index creations are database-level operations and
// don't directly translate to TypeScript code.

export interface SwymVariantsStore {
    epi: string; // hash-key
    pid: string; // range-key
    empi?: string; // index
    pmi?: string; // Market id for products active in different markets, null for non markets merchants
    vtype?: "custom"; // variant type: "custom" - custom item
    currency?: string; // Currency that pr and compareatprice are in
    pr?: number;
    compareatprice?: number;
    iqty?: number;
    oldiqty?: number;
    title?: string; // search
    sku?: string; // index search
    vendor?: string; // index search
    prodtype?: string; // index search
    tags?: string; // index search
    uri?: string;
    du?: any; // Type needs clarification based on swym-core.date-utils
    iu?: string;
    vkey1?: string;
    vval1?: string;
    vkey2?: string;
    vval2?: string;
    vkey3?: string;
    vval3?: string;
    published?: boolean; // index
    inactive?: boolean; // index
    deleted?: boolean; // index
    prodstatus?: "active" | "draft" | "archived";
    mprodstatus?: "included" | "excluded";
    pubscope?: "global" | "web"; // published scope - global / web - published to POS / not
    UpdateTS?: number; // index
    _hv?: any; // Type needs clarification
    uts?: number; // swym updated datetime
    extras?: any; // Type needs clarification
    _ttl?: number; // ttl
}

// The following Clojure functions would likely be implemented as
// asynchronous functions in TypeScript that interact with your data store.
// The exact implementation depends on your data access layer.

// export async function updateShopDomain(product: SwymVariantsStore): Promise<SwymVariantsStore> { ... }
// export async function getProduct(pid: string, epi: string, empi?: string, pmi?: string): Promise<SwymVariantsStore | undefined> { ... }
// export async function getProductForTrigger(pid: string, epi: string, empi: string): Promise<SwymVariantsStore | undefined> { ... }
// export async function getProductVariants(pid: string, empi: string): Promise<SwymVariantsStore[]> { ... }
// export async function getVariantsForTrigger(pid: string, empi: string): Promise<Omit<SwymVariantsStore, 'desc'>[]> { ... }
// export async function getProductQty(pid: string, epi: string, empi: string): Promise<number | undefined> { ... }
// export async function getProductCurrentTs(pid: string, epi: string, empi: string): Promise<number | undefined> { ... }
// export async function updateProductQty(pid: string, epi: string, empi: string, qty: number): Promise<number> { ... }
// export async function upsertMarketProductVariant(pid: string, marketProduct: Partial<SwymVariantsStore>): Promise<any> { ... }
// export async function updateMarketProductStatus(pid: string, pmi: string, empi: string, mprodstatus: "included" | "excluded"): Promise<any> { ... }
// export async function deleteMarketProductVariant(pid: string, pmi: string, epi: string, empi: string): Promise<any> { ... }
// export async function deleteProductVariants(pid: string, empis: string[], soft?: boolean): Promise<void> { ... }
// export async function deleteAllProducts(pid: string): Promise<void> { ... }
// export async function insertProducts(pid: string, productRows: Omit<SwymVariantsStore, 'uts'>[]): Promise<void> { ... }
// export async function insertSingleProduct(pid: string, productRow: Omit<SwymVariantsStore, 'uts'>): Promise<void> { ... }
// export async function upsertProduct(pid: string, productRow: Partial<SwymVariantsStore>): Promise<any> { ... }
// export async function upsertExtras(pid: string, empi: string, epi: string, extras: any): Promise<any> { ... }
// export async function upsertProductFields(pid: string, productRow: Partial<SwymVariantsStore>): Promise<any> { ... }
// export async function countProducts(query: any): Promise<number> { ... }
// export async function queryMultipleProducts(pid: string, productlist: string[], removeoos?: boolean): Promise<SwymVariantsStore[]> { ... }
// export async function querySkuInventoryEpiEmpi(pid: string, key: ":epi" | ":empi", valueList: string[]): Promise<Pick<SwymVariantsStore, 'epi' | 'empi' | 'iqty' | 'UpdateTS' | 'sku'>[]> { ... }
// export async function searchProducts(query: any): Promise<SwymVariantsStore[]> { ... }
// export async function deleteProductMasterVariant(pid: string, epi: string, empi: string): Promise<void> { ... }
// export async function getProductsByMaster(query: any, options?: { limit?: number; offset?: number; skip?: number; sortby?: any; fieldlist?: (keyof SwymVariantsStore)[] }): Promise<SwymVariantsStore[]> { ... }
// export async function queryProducts(query: any, options?: { limit?: number; offset?: number; skip?: number; sortby?: any; fieldlist?: (keyof SwymVariantsStore)[] }): Promise<SwymVariantsStore[]> { ... }
// export function isDeleted(product?: SwymVariantsStore | null): boolean { ... }
// export async function deleteProduct(pid: string, epi: string, empi: string, soft?: boolean): Promise<void> { ... }
// export async function getProductWithDelCheck(pid: string, epi: string, empi: string): Promise<SwymVariantsStore | undefined> { ... }
// export function getDiff(pid: string, oldProduct: SwymVariantsStore, newProduct: SwymVariantsStore): string[] { ... }
// export function createProductTitle(title?: string, val?: string): string { ... }
// export async function getProductsForEmailTemplate(pid: string): Promise<Pick<SwymVariantsStore, 'empi' | 'epi' | 'prodtype' | 'pr' | 'uri' | 'iu' | 'title' | 'iqty' | 'sku'>[]> { ... }
// export async function getProductData(pid: string, productList: { epi: string; empi?: string }[], fieldList: (keyof SwymVariantsStore)[]): Promise<SwymVariantsStore[]> { ... }
// export async function productExists(pid: string, empi: string, epi?: string): Promise<boolean> { ... }
// export async function addCustomItem(pid: string, customItemInput: { epi: string; empi: string; title?: string; price?: number; sku?: string; uri?: string; iqty?: number; iu?: string }): Promise<any> { ... }

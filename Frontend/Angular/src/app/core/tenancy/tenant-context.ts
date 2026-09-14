// TODO(SAAS-02): Populate only after organization discovery and authenticated API validation.
// Physical placement and storage tier must never be exposed to the browser.
export interface TenantContext {
  readonly tenantId: string;
  readonly displayName: string;
}

// TODO(SAAS-04): Implement an injectable store; cancel requests and clear state on tenant changes.
export interface TenantContextStore {
  current(): TenantContext | null;
  clear(): void;
}

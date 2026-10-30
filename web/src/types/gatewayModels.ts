/**
 * A model the CPA gateway advertises for one client key.
 *
 * Shared by every model selector, because a second copy of this shape is how two selectors
 * would come to disagree about what a "call point" is.
 */
export interface GatewayModelItem {
  id: string;
  call_point?: string;
  vision: string;
}

/**
 * The label a request must name, and the label the selector shows.
 *
 * CPA advertises a routing label (`call_point`) for a model that is reached through one; a model
 * without one is called by its own id. Showing the upstream id where the gateway expects a call
 * point would make the diagnostics name a model the request never asked for.
 */
export function gatewayCallPointOf(item: GatewayModelItem): string {
  return item.call_point ?? item.id;
}

/** Whether stored market data may be shown to users. */
export enum PriceStatus {
  PUBLISHED = 'published',
  /** Held for an admin to inspect; never shown to users. */
  PENDING_REVIEW = 'pending_review',
}

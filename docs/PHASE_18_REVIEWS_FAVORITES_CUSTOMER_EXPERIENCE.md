# SHAKH 2027 — Phase 18
## Reviews/Ratings + Favorites/Wishlist + Customer Experience

Phase 18 connects the customer-facing product detail and account experience to live Supabase data for favorites and verified-purchase reviews.

### Favorites / Wishlist
- `favorite_products` stores one saved product per user with a composite primary key.
- Direct table grants remain revoked from `anon`/`authenticated`; clients use controlled RPCs.
- `toggle_product_favorite()` validates that the product and vendor are active before changing the user's wishlist.
- `list_my_favorite_ids()` and the existing `list_my_favorite_products()` power real-time-in-session wishlist state without browser storage.
- Marketplace product cards and the product detail panel expose the same server-owned favorite state.

### Reviews / Ratings
- `product_reviews` requires a delivered order containing the product before a review can be created.
- One review per user/product is enforced by a unique constraint.
- Customers can submit 1–5 star ratings, optional title/body, and verified-purchase status is server-assigned.
- Published reviews are publicly readable; the reviewer can also see their own non-published review.
- Moderation is permission-gated with `reviews.manage`.
- Product `rating` and `review_count` are recalculated from published reviews via database triggers; no client-side rating totals are trusted.
- Review submission emits `review_submitted` into the existing analytics stream.

### Frontend
- Product cards include a wishlist heart control.
- Product detail includes favorite state plus live reviews.
- Account → Wishlist loads the real saved-product list from Supabase and can remove items.
- Account → Reviews shows only eligible delivered purchases and submits verified reviews through RPCs.

### Security boundary
Supabase remains the source of truth. Business state is not persisted in localStorage/sessionStorage. Direct access to favorites/reviews write tables is restricted and client mutation goes through authenticated RPCs.

### Remaining scope
Review media/photos, vendor-level reviews, review replies, and advanced moderation analytics remain candidates for a later trust/safety phase.

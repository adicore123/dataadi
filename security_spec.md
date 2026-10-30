# Firestore Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Default-Deny Catch-All**: All paths not explicitly matched (`/{document=**}`) deny all reads and writes.
2. **Verified Owner Isolation**: Every document in `/photo_albums/{albumId}` and `/vault_items/{itemId}` belongs strictly to a single authenticated user (`ownerId == request.auth.uid`) with `request.auth.token.email_verified == true`.
3. **Strict Key & Schema Validation**:
   - `PhotoAlbum` requires and allows only `['ownerId', 'name', 'createdAtIso', 'createdAt', 'updatedAt']`.
   - `VaultItem` requires and allows only `['ownerId', 'title', 'module', 'albumId', 'albumName', 'createdAtIso', 'formattedDate', 'formattedTime', 'fileName', 'fileSize', 'mimeType', 'dataUrl', 'durationSec', 'notes', 'source', 'createdAt', 'updatedAt']`.
4. **Immutability & Temporal Integrity**:
   - On `create`: `createdAt == request.time && updatedAt == request.time`.
   - On `update`: `ownerId == resource.data.ownerId && createdAt == resource.data.createdAt && updatedAt == request.time`.
5. **Query Enforcer (`allow list`)**:
   - `allow list` explicitly checks `resource.data.ownerId == request.auth.uid`.

## 2. The "Dirty Dozen" Payloads
1. Unauthenticated read/write to `/vault_items/item_1`.
2. Unverified email (`email_verified: false`) attempting to create a `VaultItem`.
3. Identity spoofing: User A creating a `VaultItem` with `ownerId: "user_B"`.
4. Shadow field injection: Creating a `PhotoAlbum` with extra field `isAdmin: true`.
5. Missing required field: Creating a `VaultItem` without `title`.
6. Empty title violation: `title: ""` (`size() < 1`).
7. Invalid module enum: `module: "hacked_module"`.
8. Oversized payload attack: `title` with 500 characters (`> 200`).
9. ID poisoning attack: `itemId` containing slashes or special characters (`!@#$`).
10. Timestamp spoofing on create: `createdAt` not matching `request.time`.
11. Immutable field mutation on update: Changing `ownerId` or `createdAt` during an update.
12. Cross-tenant query scraping: User A listing `/vault_items` without filtering `ownerId == request.auth.uid`.

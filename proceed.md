<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# proceed

Proceeding with the finalized PRD next.

## SwiftDrop Flash Sale Platform PRD v3

### 1. Executive Summary

SwiftDrop is a high-concurrency flash-sale marketplace where customers compete to purchase limited-stock imported products the moment an event goes live. The main challenge is not authentication or browsing; it is guaranteeing inventory correctness, fairness, and platform stability when 500 to 1,000 users attempt to purchase at the same time. The rebuilt platform must prevent overselling, handle burst traffic gracefully, and keep the buying experience clear and responsive under pressure.[^11]

### 2. Product Vision

Build a resilient flash-sale platform that safely handles synchronized demand while maintaining strict stock integrity, real-time updates, and a smooth purchase flow. The system should behave like a production-grade event-driven commerce platform, not a simple marketplace.[^11]

### 3. Product Goals

The platform should:

- Support secure customer and admin access.[^11]
- Prevent overselling completely during concurrent purchases.[^11]
- Provide real-time stock and event status updates without full page reloads.[^11]
- Keep the purchase path atomic from reservation to confirmation.[^11]
- Remain responsive under burst traffic and return structured errors instead of crashing.[^11]


### 4. Roles and Access

#### Customer

Customers can register, log in, browse events, view stock, attempt purchases, manage their profile, and view order history.[^11]

#### Admin

Admins can create and manage events, monitor sales, manage customer accounts, and view analytics. Admin accounts must be seeded in the database or created by an existing admin; there must be no public route for self-promotion to admin.[^11]

### 5. Scope

#### In Scope

- Authentication and session handling.[^11]
- Admin-only event management.[^11]
- Live marketplace browsing with countdowns and stock updates.[^11]
- Atomic purchase reservation, confirmation, and cancellation.[^11]
- Order history and profile management.[^11]
- Load balancing, rate limiting, structured errors, and monitoring.[^11]


#### Out of Scope

- Public admin registration.[^11]
- Real payment gateway integration.[^11]
- Refunds, cart, waitlists, backorders, replenishment, coupons, reviews, wishlist, email notifications, and mobile apps.[^11]


### 6. Priority Summary

| Priority | Requirements |
| :-- | :-- |
| High | Register, login, logout, auth protection, admin authorization [^11] |
| High | Create locked events, edit locked events, browse events, countdown timer, real-time stock, sold-out handling, auto-close [^11] |
| High | Atomic reservation, out-of-stock rejection, confirmation flow, duplicate purchase prevention, button disable, clear outcome messages [^11] |
| High | Purchase history, event/item details, structured JSON errors, hashed passwords, atomic order creation, clean architecture [^11] |
| Medium | Change password, force open/close, deactivate customer, update display name, admin customer list [^11] |

### 7. Functional Requirements

#### 7.1 Authentication

- Register with unique email, display name, and password; reject duplicates.[^11]
- Log in with email and password; issue a secure session token.[^11]
- Log out and invalidate the session immediately.[^11]
- Require authentication for purchases, profile, and order history.[^11]
- Require admin role for admin endpoints.[^11]
- Allow password change with current password verification.[^11]


#### 7.2 Event Management

- Admin creates an event with name, cover photo, go-live time, and one or more items.[^11]
- Each item stock quantity must be between 100 and 500 at creation time.[^11]
- New events start in Locked state.[^11]
- Locked events may be edited, but Live or Closed events cannot be edited.[^11]
- Admin can force-open a locked event or force-close a live event.[^11]
- Admin dashboard must show event status, total units sold per item, and total revenue per event.[^11]
- Admin can deactivate customer accounts.[^11]


#### 7.3 Marketplace

- Customers can browse all events.[^11]
- Locked events show a live countdown to go-live.[^11]
- Live events show remaining stock in real time without full page reload.[^11]
- Sold-out items immediately show Sold Out and disable purchase.[^11]
- When all items are sold out, the event transitions to Closed / Sold Out.[^11]


#### 7.4 Purchase Flow

- Purchase begins with an atomic stock reservation.[^11]
- If stock is unavailable, reject immediately with a user-friendly message.[^11]
- After reservation, show a confirmation step.[^11]
- Confirm creates a confirmed order; cancel releases stock immediately.[^11]
- Prevent duplicate purchases for the same user, item, and event.[^11]
- Disable the Buy button immediately on click until the server responds.[^11]
- Communicate outcomes in plain language.[^11]


#### 7.5 Profile and Orders

- Show complete purchase history with event name, item name, quantity, price paid, date, and order status.[^11]
- Allow display-name updates.[^11]
- Allow admins to view a paginated list of customers with account status.[^11]


### 8. Non-Functional Requirements

| Category | Requirement | Target |
| :-- | :-- | :-- |
| Concurrency | Zero oversell under 1,000 simultaneous requests [^11] | Zero oversell |
| Availability | Responsive during 30-second load test [^11] | Uptime >= 95% |
| Traffic management | Excess requests handled gracefully [^11] | No 5xx under load |
| Response time | Purchase endpoint under normal load [^11] | p95 <= 2,000ms |
| Security | Hashed passwords and signed session tokens [^11] | No plaintext passwords |
| Error handling | Structured JSON errors only [^11] | No stack traces |
| Data integrity | Atomic reservation and order creation [^11] | Atomic order creation |
| Code quality | Clear separation of routing, service, and data access [^11] | Clean architecture |
| Documentation | README with setup, env, seed, and startup steps [^11] | Complete README |

### 9. Concurrency Strategy

This is the most important part of the platform. The architecture should explicitly control request bursts before they reach business logic, because judges will focus heavily on how the system handles synchronized traffic.[^11]

Recommended controls:

- Load balancer to distribute traffic across app instances.[^11]
- Rate limiter to protect purchase and auth endpoints.[^11]
- Database transaction with row locking for stock reservation.[^11]
- Unique constraint to prevent duplicate purchases.[^11]
- Redis-backed reservation or cache layer if needed for fast temporary holds.[^11]
- Structured rejection responses when capacity is exceeded.[^11]


### 10. Purchase State Machine

1. User clicks Buy and the frontend disables the button immediately.[^11]
2. Server checks authentication, event state, duplicate purchase, and stock.[^11]
3. If available, the server reserves stock atomically.[^11]
4. User confirms or cancels the reservation.[^11]
5. Confirm creates the order and finalizes the stock decrement.[^11]
6. Cancel releases the reserved stock immediately.[^11]
7. If all inventory reaches zero, the event becomes Closed / Sold Out.[^11]

### 11. Data Model

Recommended entities:

- **User**: id, email, password_hash, display_name, role, status, timestamps.[^11]
- **Event**: id, name, cover_photo, go_live_at, status, created_by, timestamps.[^11]
- **Item**: id, event_id, name, unit_price, stock_quantity, reserved_stock, sold_count, timestamps.[^11]
- **Reservation**: id, user_id, event_id, item_id, status, expires_at, timestamps.[^11]
- **Order**: id, user_id, event_id, item_id, quantity, price_paid, status, timestamps.[^11]

Important constraints:

- Event status enum should cover Locked, Live, Closed, and Sold Out.[^11]
- Reservation status should support Active, Expired, Confirmed, and Cancelled.[^11]
- Unique index should block duplicate purchase attempts by the same customer for the same item in the same event.[^11]


### 12. Real-Time Behavior

Real-time updates are required for live stock and sold-out transitions. WebSockets or an equivalent push mechanism should broadcast stock changes, sold-out status, and event state changes to connected clients.[^11]

### 13. Error Handling

All API errors should be returned as structured JSON only. The PRD should define clear user-facing outcomes such as:[^11]

- Invalid credentials.
- Unauthorized.
- Forbidden.
- Item sold out.
- Event not live.
- Already purchased.
- Rate limited.
- Validation error.
- Internal error.[^11]


### 14. Security

The system must hash passwords using an industry-standard algorithm and validate signed tokens on protected requests. Admin routes must be guarded with strict role-based access control, and no client-side role trust should be allowed.[^11]

### 15. Edge Cases

The PRD should explicitly list these:

- Two users buying the last unit simultaneously.[^11]
- Double-click or retry causing duplicate submissions.[^11]
- Request arriving exactly at go-live time.[^11]
- Event closing while a purchase is in flight.[^11]
- Reservation timeout expiration.[^11]
- Token expiration during purchase.[^11]
- Deactivated user attempting login.[^11]
- Temporary Redis or app restart during active reservations.[^11]


### 16. Architecture Diagram Requirements

The diagram must show the full request path:
Client → Load Balancer → Rate Limiter → API Server → Reservation Logic → Database/Redis → WebSocket Broadcast → Client.[^11]

It should clearly highlight:

- Where overload is absorbed.
- Where stock is locked atomically.
- Where duplicate purchases are blocked.
- Where real-time updates are broadcast.
- Where admin actions bypass customer-only paths through role checks.[^11]


### 17. Delivery Plan

A 6-hour build should prioritize:

1. Schema and auth.
2. Atomic purchase flow.
3. Event management.
4. Real-time stock updates.
5. Admin dashboard and profile.
6. Load handling, validation, and structured errors.
7. README, diagram, and test evidence.[^11]

### 18. Acceptance Criteria

The platform is complete only if:

- Customers can register, log in, and browse events.[^11]
- Admins can create locked events and manage them.[^11]
- Countdown timers and live stock updates work.[^11]
- Overselling never occurs, even under concurrency.[^11]
- Duplicate purchases are blocked.[^11]
- Orders, dashboard values, and sold-out states stay consistent.[^11]
- API errors are structured.[^11]
- The architecture can be explained clearly during demo.[^11]


### 19. Final Notes

The challenge is fundamentally about concurrency correctness and traffic control. The PRD should present load balancing, rate limiting, atomic transactions, reservation management, and real-time synchronization as core product requirements, not optional engineering extras.[^11]

Would you like me to turn this into a **polished final PRD document with a title page, numbering cleanup, and a cleaner enterprise tone**?
<span style="display:none">[^1][^10][^2][^3][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://www.oxfordlearnersdictionaries.com/definition/english/proceed

[^2]: https://www.merriam-webster.com/dictionary/proceed

[^3]: https://www.oxfordlearnersdictionaries.com/us/definition/english/proceed

[^4]: https://www.britannica.com/dictionary/proceed

[^5]: https://dictionary.cambridge.org/us/dictionary/english/proceed

[^6]: https://www.vocabulary.com/dictionary/proceed

[^7]: https://www.wordwebonline.com/en/PROCEED

[^8]: https://www.thesaurus.com/browse/proceed

[^9]: https://dictionary.cambridge.org/dictionary/english/proceed

[^10]: https://en.wiktionary.org/wiki/proceed

[^11]: Bitcode-Final-Task.pdf


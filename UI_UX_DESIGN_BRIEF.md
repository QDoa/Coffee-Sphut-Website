# Coffee Sphut — UI/UX Design Brief

Last reviewed: October 22, 2026

## Purpose

Define a consistent, welcoming experience for people discovering cafés, prospective partners, café staff using loyalty links, and the team maintaining Coffee Sphut. Use this brief alongside [APP_FLOW.md](APP_FLOW.md), which documents routes and current behavior.

This brief is grounded in the current source code. “Current” describes the inspected implementation; “Requirement” and “Proposed” describe design work to apply and verify. This is not a completed visual or accessibility audit, and it does not claim that proposed changes already exist.

## Product direction

Coffee Sphut connects coffee enthusiasts with cafés and curated coffee content, with an Africa-focused discovery message in its partner FAQs. “Sphut” is pronounced “spot.” The website should quickly explain the product, make café search useful without registration, encourage mobile-app downloads, and make joining as a partner straightforward.

The staff portal should help editors maintain accurate listings and content, while admins handle users, loyalty, and permissions with clear context and feedback.

Mobile app previews support the website's story. Consumer onboarding, favourites, article reading, and reward issuance are outside this web repository's implemented screen scope. Do not create navigation that implies those web destinations exist.

## Users and desired outcomes

| User | Need | Desired experience |
| --- | --- | --- |
| Coffee enthusiast | Find a café or understand the app | Useful search, recognizable locations, obvious next action |
| Prospective partner | Assess value and apply | Benefits, social proof, practical FAQs, clear external application |
| Café staff | Complete a loyalty action during service | Short form, clear customer context, decisive result |
| Account holder/subscriber | Manage a specific request | Minimal data entry and an accurate completion message |
| Editor | Maintain cafés and publish content | Predictable navigation, grouped forms, visible publishing state |
| Admin | Manage access and correct operational issues | Clear permissions, consequence-aware dialogs, traceable changes |

## Experience principles

1. **Put the next action in context.** Use Find Coffee for discovery, platform-specific download buttons for installation, and Join Our Partner Network for applications.
2. **Keep browsing useful without location access.** Explain the benefit of location and preserve manual search when permission is declined.
3. **State what happened accurately.** A deletion request is submitted; a reward is redeemed only after backend confirmation; a download click is not an installation.
4. **Make state visible.** Loading, selection, publishing, form errors, and completion should have clear text and visual treatment.
5. **Use the same interaction language throughout.** Reuse shared buttons, inputs, dialogs, cards, badges, and spacing while allowing the portal to be denser than the public site.

## Current visual foundation

### Brand and color

The current light theme uses warm cream surfaces, dark text, and a warm red-brown primary. Preserve this coffee-inspired direction. Use semantic tokens from `app/globals.css` through Tailwind utilities rather than introducing independent palettes per screen.

| Token | Current value | Intended role |
| --- | --- | --- |
| `background` | `oklch(0.97 0.02 80)` | Main cream canvas |
| `foreground` | `oklch(0.25 0.02 25)` | Primary text |
| `card` | `oklch(0.99 0.01 80)` | Raised/content surfaces |
| `primary` | `oklch(0.45 0.15 25)` | Main actions, emphasis, focus ring |
| `primary-foreground` | `oklch(0.99 0.01 80)` | Text on primary surfaces |
| `secondary` / `accent` | `oklch(0.92 0.02 75)` | Secondary surfaces and hover treatments |
| `muted` | `oklch(0.94 0.015 80)` | Quiet backgrounds and placeholders |
| `muted-foreground` | `oklch(0.5 0.02 25)` | Supporting text |
| `border` / `input` | `oklch(0.88 0.02 75)` | Dividers and control boundaries |
| `destructive` | `oklch(0.577 0.245 27.325)` | Destructive actions and errors |

Current map clusters use `#7B4B24`. Publishing controls use green for Published and amber for Scheduled. Requirement: pair status colors with text or icons and check contrast in every state. Dark-theme tokens exist, but there is no inspected user-facing theme switch; full dark-mode support is not an established deliverable.

### Typography, spacing, and shape

- **Typography:** Geist for interface text; Geist Mono for identifiers and technical values. Use weight and size for hierarchy without adding another font family.
- **Public headings:** Current hero scales from `text-5xl` to `lg:text-7xl`; section headings generally scale from `text-3xl` to `lg:text-5xl`. Keep body text readable and limit long text to a comfortable measure.
- **Portal headings:** Generally `text-2xl`, with smaller supporting copy and clear table labels.
- **Spacing:** Use the existing Tailwind scale. Public sections commonly use 64–96 px vertical padding; responsive horizontal gutters use 16, 24, and 32 px. Forms and tables should use tighter, consistent group spacing.
- **Shape:** Base radius is `0.75rem` (12 px), with related component radius tokens. Rounded cards and subtle borders suit the existing theme; shadows should support hierarchy sparingly.

### Images, icons, and motion

Use existing brand assets, genuine café imagery, and mobile-app screenshots. Preserve image proportions and provide meaningful alt text. Use Next.js `Image` with explicit dimensions for new images, following repository conventions; configure permitted remote hosts as needed.

Use Lucide icons consistently. Decorative icons should be hidden from assistive technology; icon-only actions need accessible names.

Current motion includes a five-second hero carousel with fades, a partner-logo marquee, screenshot hover scaling, and header transitions. Requirement: respect reduced-motion preferences, provide control over automatic movement, and avoid relying on animation to communicate content.

## Information architecture and screen requirements

### Public header and landing page

**Current:** Sticky header, Features/App/Partners/Download anchors, Find Coffee action, app-store buttons, and a mobile menu sheet. Landing content follows hero → features → app previews → partner benefits → partner logos → FAQs → download → optional jobs → footer.

**Requirements:**

- Keep discovery and download actions visible without crowding the navigation. Retain platform names alongside store icons where space permits.
- Preserve mobile menu focus handling, Escape dismissal, and closure after anchor navigation. Give the active destination a clear focus/hover treatment.
- Explain the value proposition in the hero and pair screenshots with clear captions. Proposed: add an in-hero discovery or download action so the message and next step sit together.
- Show partner benefits and FAQs before asking users to apply. Identify the application as an external form.
- Keep partner logos legible without distorting them. Pause or replace movement when reduced motion is requested.
- Label the footer's contact destination accurately. Current Contact Us points to the partner section; a general contact flow requires a defined destination.

### Store finder

**Current:** Search by name/address, result count, selected café card, linked Mapbox markers and popup, clustering, and optional location/distances. Desktop uses a list/map split; mobile places a 400 px map above the search and list.

**Requirements:**

- Make search easy to reach on the first mobile viewport. Proposed: move search above the map or introduce a clearly labelled List/Map switch while retaining query and selection.
- Keep selected list and map states synchronized. Expose selection to keyboard and assistive-technology users; the current clickable cards need semantic keyboard interaction.
- Show café name and address first, then distance when known. A missing photo should use a deliberate placeholder.
- Keep the list usable when the map fails. Replace configuration-specific visitor copy with a simple message such as “The map is unavailable. You can still browse the café list.”
- Distinguish no matches, no available cafés, and service failure. Provide Clear search or Retry when relevant.
- Explain location use briefly. Never block manual search after a permission denial or infer that fallback coordinates are the visitor's location.
- Use result-count announcements that are helpful without announcing every keystroke.

There is currently no public café-detail page, directions button, amenity filter, or web save/favourite action. Such additions need explicit product scope and corresponding routes/data.

### Loyalty utility pages

**Current:** Minimal centered forms on `/vendor_reward` and `/redeem_reward`, with query-based customer context, café-code entry, pending labels, and toast feedback.

**Requirements:**

- Show the Coffee Sphut identity, action title, customer context, and café/chain context when available above the form.
- Give Café code a persistent label and concise helper text. Validate missing or malformed link context before inviting submission.
- Disable submission while pending. Retain input on failure and provide a clear retry path.
- Render a persistent success state identifying the completed action; toasts can supplement it. Prevent accidental resubmission of a completed redemption.
- Differentiate an invalid link, unavailable reward, invalid café code, chain mismatch where safe to disclose, and temporary service failure. Do not assert that every unavailable reward was redeemed.
- Treat unexpected exceptions as visible failures with useful recovery guidance. Availability checks should settle into a stable state rather than repeatedly restarting.

### Account, privacy, and subscription pages

Use one focused task per page, a persistent field label, a short explanation, and a clear route back to a useful destination. Keep privacy-policy text readable with a sensible heading hierarchy and line length.

- **Deletion:** Explain that submission requests deletion. Keep consequence copy accurate and distinguish request receipt from completed deletion.
- **Unsubscribe:** Identify the waiting-list subscription being removed and confirm success on the page.
- **Password reset:** Show password requirements, appropriate autocomplete, pending/error feedback, and a successful completion state. Verify recovery-session handling and route the user to an implemented destination; the current `/home` redirect needs correction.
- **Password recovery:** Confirm that the request was accepted without implying that email delivery has been verified.

### Staff authentication and portal shell

**Current:** Email/password and Google login, forgot-password form, role badge, grouped desktop sidebar, top header, and sign-out controls. The sidebar is hidden below `lg` without equivalent collection navigation.

**Requirements:**

- Present both sign-in options clearly and explain access-denied states in plain language.
- Add a mobile navigation drawer that preserves the same permitted destinations and exposes the current page.
- Mark the active section visually and with appropriate navigation semantics.
- Keep role and signed-in identity visible without dominating the workspace.
- Preserve role checks on server routes/actions. Hiding a control is only the visual expression of permissions.
- Clearly identify a preview/staging environment when applicable; environment copy must match the actual configured backend.

### Management lists, forms, and publishing

Use a consistent list-page structure: title and description, primary create action, search/filters where supported, record count, table, and meaningful empty/error states. Keep row actions predictable and available without hover.

Group café form fields into identity, loyalty, location, contact, amenities/hours, media, and menu sections. Group editorial forms into content, metadata, media, and publishing. Show field-level validation and retain user input when saves fail.

Publishing state must always be visible as Draft, Scheduled, or Published. Show the scheduled date with an explicit timezone. Proposed: guard unsaved edits before publishing or navigating away, and distinguish Save changes from Publish now so users understand what each action persists.

Confirmation dialogs should name the target record and describe the consequence. Preserve audit-reason requirements for onboarding resets, punch adjustments, and reward voiding. Keep a safe Cancel action and return focus to the initiating control.

For waitlist export, state that the export contains all loaded entries, since current filtering affects only the visible table. Label incomplete or unavailable metrics rather than presenting missing data as a verified zero.

## Shared state and accessibility requirements

These are implementation acceptance targets, not verified properties of the current app.

| State or interaction | Required treatment |
| --- | --- |
| Initial loading | Stable skeleton or concise loading message with an accessible status |
| Background search/save | Pending label, appropriate busy state, preserved content/input |
| Successful action | Persistent, specific confirmation; toast optional |
| Validation failure | Associated field error, retained values, focus to the first relevant error |
| Service failure | Plain explanation and a retry path; no raw environment/configuration details |
| Empty collection | Explain absence and show the permitted create action where appropriate |
| No search results | Echo query and offer a clear/reset action |
| Destructive action | Named target, explicit consequence, Cancel, pending state, visible outcome |

- Target WCAG 2.2 AA in implementation and audit: verify text contrast, control boundaries, keyboard use, focus visibility, and status announcements.
- Use semantic landmarks, a logical heading order, visible form labels, and accessible names for all icon controls.
- Ensure dialogs trap focus appropriately, dismiss safely, and restore focus on close. Provide a skip-to-content link for repeated navigation.
- Aim for at least 44 × 44 px touch targets for primary mobile controls. Expand the hit area of small carousel indicators and utility icons.
- Keep content usable at 200% zoom and avoid page-wide horizontal scrolling on small screens. Contain wide admin tables within accessible scrolling regions.
- Provide a complete list-based alternative to map exploration. Do not make a pointer gesture or color the sole way to select or identify a café.
- Respect reduced-motion preferences and make automatically moving content pausable.

## Responsive expectations

| Context | Layout target |
| --- | --- |
| Small mobile, around 360 px | Single-column content, accessible search, full-width form controls, mobile navigation |
| Tablet, around 768 px | Adapt cards and navigation to available room; avoid cramped list/map panels |
| Desktop, around 1280–1440 px | Constrained public reading width, list/map split, persistent portal sidebar |

Review the actual transition points used by `sm`, `md`, and `lg`, including long café names, addresses, error messages, staff emails, and translated-length copy. Designs must remain usable between the sample viewport widths.

## Proposed priorities and design handoff

| Priority | Work | Acceptance outcome |
| --- | --- | --- |
| P0 | Password recovery and reset completion | Valid recovery link reaches a usable form; success returns to an implemented destination; invalid context has a recovery path |
| P0 | Stable loyalty checking and outcomes | Invalid links, pending actions, success, and failures are visible; completed redemption cannot be casually repeated |
| P1 | Mobile portal navigation | Editors and admins can reach every permitted section on small screens |
| P1 | Store-search resilience and keyboard access | Failure differs from no matches; list remains usable without map/location; keyboard selection works |
| P1 | Shared form/status accessibility | Visible labels, focus handling, readable feedback, and contrast verified across key tasks |
| P2 | Landing-page refinement and motion controls | Clear hero action, accurate contact link, accessible carousel and partner presentation |
| P2 | Portal editing clarity | Unsaved-change handling, publishing timezone, and accurate export/metric context |

Prepare responsive frames for the landing page, store finder, both loyalty pages, account utilities, staff login, portal shell, one representative list/detail editor, publishing controls, and a destructive/audited-action dialog. Include loading, empty, error, selected, disabled, and success variants rather than only the ideal populated screen.

Measure improvement using task completion and usability review: find a café with/without location, submit a partner application handoff, complete a loyalty action, recover a password, and edit/publish content. Existing analytics events are `Download`, `Find Coffee`, and `Signup`; any funnel expansion is proposed work. No conversion targets or usability results have been established in this brief.

## Implementation references

Use Tailwind utilities and the existing shadcn/Radix primitives in `components/ui/`; keep semantic theme tokens in `app/globals.css`. Follow `AGENTS.md` for image, component, and TypeScript conventions. Use `pnpm` for project commands.

Primary design references in source: `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `components/site-header.tsx`, `components/hero-carousel.tsx`, `components/store-*.tsx`, `components/admin/`, and `app/admin/(dashboard)/layout.tsx`.

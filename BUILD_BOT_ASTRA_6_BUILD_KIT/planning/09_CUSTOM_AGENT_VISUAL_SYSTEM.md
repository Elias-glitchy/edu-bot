# Custom agent visual system

## Identity rule

The eleven built-in employees keep permanent signature colors and approved robot portraits. This makes role recognition stable across conversations, workforce views, missions, approvals, reports, and live-computer sessions.

Custom agents receive a visibly separate identity system:

- User-uploaded avatar, organization-approved image, or neutral generated monogram/default bot symbol.
- Curated accent color selected during creation.
- Persistent `Custom` marker in profiles and administration views.
- Agent name and role always remain visible; color is never the only identifier.
- Accent color styles the avatar ring, small workspace highlights, message identity, and selected-state treatment. It does not tint entire pages or convey execution status.
- Success, warning, error, approval, and disabled colors remain semantic and cannot be overridden by the custom accent.

Do not recolor the eleven supplied workforce images for custom bots. That protects the recognition of built-in employees and avoids making a custom bot look like CHIEF or a manager.

## Curated palette

| Token | Hex |
| --- | --- |
| Midnight | `#1E293B` |
| Indigo | `#4F46E5` |
| Sapphire | `#2563EB` |
| Azure | `#0284C7` |
| Aqua | `#0891B2` |
| Mint | `#059669` |
| Forest | `#15803D` |
| Olive | `#4D7C0F` |
| Sunflower | `#CA8A04` |
| Amber | `#D97706` |
| Coral | `#EA580C` |
| Rose | `#E11D48` |
| Berry | `#BE185D` |
| Orchid | `#C026D3` |
| Violet | `#7C3AED` |
| Cocoa | `#92400E` |
| Slate | `#475569` |
| Platinum | `#71717A` |

The UI must calculate readable foreground/border treatments for both themes and meet WCAG AA contrast. Organizations may disable avatar uploads or restrict palette choices. Store the chosen token, not an arbitrary inline style, unless a future branding tier explicitly supports custom colors with contrast validation.

## Creation flow

1. Name and role.
2. Choose upload, monogram/default symbol, or an organization-provided avatar.
3. Choose a palette token with light/dark previews.
4. Preview workforce card and chat message identity.
5. Run accessibility/duplicate-name warnings.
6. Save as a versioned part of the agent configuration.


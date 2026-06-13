# Graph Report - .  (2026-06-10)

## Corpus Check
- 0 files · ~0 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 359 nodes · 538 edges · 33 communities (26 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_dispatcher.ts|dispatcher.ts]]
- [[_COMMUNITY_admin-manual-arriendo.ts|admin-manual-arriendo.ts]]
- [[_COMMUNITY_transport.ts|transport.ts]]
- [[_COMMUNITY_index.ts|index.ts]]
- [[_COMMUNITY_index.tsx|index.tsx]]
- [[_COMMUNITY_transporter|transporter]]
- [[_COMMUNITY_index.ts|index.ts]]
- [[_COMMUNITY_index.ts|index.ts]]
- [[_COMMUNITY_post-purchase-shared.ts|post-purchase-shared.ts]]
- [[_COMMUNITY_index.ts|index.ts]]
- [[_COMMUNITY_db-types.ts|db-types.ts]]
- [[_COMMUNITY_admin.ts|admin.ts]]
- [[_COMMUNITY_CookieBanner.tsx|CookieBanner.tsx]]
- [[_COMMUNITY_env.ts|env.ts]]
- [[_COMMUNITY_metadata.ts|metadata.ts]]
- [[_COMMUNITY_useConfirmDialog.tsx|useConfirmDialog.tsx]]
- [[_COMMUNITY_Modal.tsx|Modal.tsx]]
- [[_COMMUNITY_maquinaria-descripciones.ts|maquinaria-descripciones.ts]]
- [[_COMMUNITY_prerender-rules.ts|prerender-rules.ts]]
- [[_COMMUNITY_next-auth.d.ts|next-auth.d.ts]]
- [[_COMMUNITY_CommandPalette.tsx|CommandPalette.tsx]]
- [[_COMMUNITY_Breadcrumbs.tsx|Breadcrumbs.tsx]]
- [[_COMMUNITY_ViewItemTracker.tsx|ViewItemTracker.tsx]]
- [[_COMMUNITY_CrossLinksGrid.tsx|CrossLinksGrid.tsx]]
- [[_COMMUNITY_messages.ts|messages.ts]]
- [[_COMMUNITY_distancias.generated.ts|distancias.generated.ts]]

## God Nodes (most connected - your core abstractions)
1. `baseProps()` - 21 edges
2. `transporter` - 16 edges
3. `buildWhatsappUrl()` - 15 edges
4. `buildKlapEmailHtml()` - 14 edges
5. `maskEmail()` - 11 edges
6. `buildPostPurchaseHtml()` - 8 edges
7. `formatCLP()` - 8 edges
8. `sendPostPurchaseEmail()` - 7 edges
9. `KlapEmailVars` - 7 edges
10. `redactPII()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `sendCotizacionEmail()` --calls--> `formatCLP()`  [INFERRED]
  mail/templates/cotizacion.ts → format/index.ts
- `sendPaymentLinkEmail()` --calls--> `formatCLP()`  [INFERRED]
  mail/templates/payment-link.ts → format/index.ts
- `sendContraofertaEmail()` --calls--> `formatCLP()`  [INFERRED]
  mail/templates/contraoferta.ts → format/index.ts
- `sendCotizacionAdminEmail()` --calls--> `formatCLP()`  [INFERRED]
  mail/templates/cotizacion-admin.ts → format/index.ts
- `maskEmail()` --calls--> `maskEmailForNotif()`  [EXTRACTED]
  logging/index.ts → notifications/admin.ts

## Communities (33 total, 7 thin omitted)

### Community 0 - "dispatcher.ts"
Cohesion: 0.08
Nodes (21): generateOtpCode(), dispatchOtp(), PROVIDERS_BY_CANAL, TTL_DEFAULT_MIN, emailBody(), renderTemplate(), smsBody(), TemplateOptions (+13 more)

### Community 1 - "admin-manual-arriendo.ts"
Cohesion: 0.07
Nodes (30): CIUDADES, CiudadSEO, HQ, HQ_BARRACA, HQ_CONSTRUCTORA, LEGAL_INFO, ProductoBarracaSEO, TipoMaquinaSEO (+22 more)

### Community 2 - "transport.ts"
Cohesion: 0.1
Nodes (22): formatCLP(), KEEP_LOWER, KEEP_UPPER, maskEmail(), ADMIN_BCC_EMAILS, resend, sendMail(), SendMailOptions (+14 more)

### Community 3 - "index.ts"
Cohesion: 0.12
Nodes (20): authConfig, SCOPE, { handlers, signIn, signOut, auth }, hashIdAsync(), hid(), logSafe(), logSafeError(), maskIp() (+12 more)

### Community 4 - "index.tsx"
Cohesion: 0.16
Nodes (22): baseProps(), IconArrowRight(), IconArrowUpRight(), IconBolt(), IconCheck(), IconCheckCircle(), IconChevronDown(), IconChevronRight() (+14 more)

### Community 5 - "transporter"
Cohesion: 0.2
Nodes (13): transporter, sendCargoAplicadoEmail(), sendCargoTardioEmail(), sendGarantiaAutorizadaEmail(), sendGarantiaFalloRenovacionEmail(), sendGarantiaLiberadaEmail(), sendGarantiaRenovadaEmail(), buildKlapEmailHtml() (+5 more)

### Community 6 - "index.ts"
Cohesion: 0.12
Nodes (13): requirePermission(), Action, ALL_ACTIONS, ALL_BARRACA_MODULES, ALL_MODULES, BarracaModule, can(), ConstructoraModule (+5 more)

### Community 7 - "index.ts"
Cohesion: 0.19
Nodes (17): buildWhatsappUrl(), DEFAULT_PHONE, whatsappCtaBarracaCotizar(), whatsappCtaCiudad(), whatsappCtaCiudadTipo(), whatsappCtaConsultaCotizacion(), whatsappCtaContacto(), whatsappCtaCotizacionEnviada() (+9 more)

### Community 8 - "post-purchase-shared.ts"
Cohesion: 0.32
Nodes (9): BARRACA_URL, BuildEmailOptions, buildPostPurchaseHtml(), escapeHtml(), sendPostPurchaseEmail(), sendPurchaseThankYouEmail(), sendReplenishmentEmail(), ProductoSimple (+1 more)

### Community 9 - "index.ts"
Cohesion: 0.21
Nodes (7): ALLOWED_HOSTS, escapeLikePattern(), escapeOrFilter(), sanitizeRequired(), sanitizeString(), stripHtml(), ValidationError

### Community 10 - "db-types.ts"
Cohesion: 0.18
Nodes (10): CompositeTypes, Constants, Database, DatabaseWithoutInternals, DefaultSchema, Enums, Json, Tables (+2 more)

### Community 11 - "admin.ts"
Cohesion: 0.22
Nodes (9): findAdminPorSsoEmail(), createAdminNotification(), CreateAdminNotificationArgs, createAdminNotificationIfNew(), maskEmailForNotif(), NotificationKind, NotificationSeverity, supabaseAdmin (+1 more)

### Community 12 - "CookieBanner.tsx"
Cohesion: 0.2
Nodes (5): ConsentParams, ConsentRecord, ConsentValue, CookieBannerProps, Window

### Community 13 - "env.ts"
Cohesion: 0.32
Nodes (7): clientEnv, clientEnvSchema, env, formatErrors(), parseClient(), parseServer(), serverEnvSchema

### Community 14 - "metadata.ts"
Cohesion: 0.29
Nodes (5): BASE_URLS, Brand, BuildPageMetadataOptions, DEFAULT_OG_IMAGES, SITE_NAMES

### Community 16 - "Modal.tsx"
Cohesion: 0.47
Nodes (4): Modal(), ModalProps, FOCUSABLE_SELECTOR, useFocusTrap()

### Community 17 - "maquinaria-descripciones.ts"
Cohesion: 0.4
Nodes (3): DescripcionRich, FALLBACKS, Tipo

### Community 18 - "prerender-rules.ts"
Cohesion: 0.4
Nodes (3): BARRACA_PRERENDER_EXCLUDES, CONSTRUCTORA_PRERENDER_EXCLUDES, PrerenderRules

### Community 19 - "next-auth.d.ts"
Cohesion: 0.5
Nodes (3): JWT, Session, User

## Knowledge Gaps
- **108 isolated node(s):** `TOAST_MESSAGES`, `ToastMessages`, `Json`, `Database`, `DatabaseWithoutInternals` (+103 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `maskEmail()` connect `transport.ts` to `admin.ts`, `index.ts`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Why does `transporter` connect `transporter` to `dispatcher.ts`, `admin-manual-arriendo.ts`, `transport.ts`, `post-purchase-shared.ts`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `HQ` connect `admin-manual-arriendo.ts` to `transport.ts`, `index.ts`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **What connects `TOAST_MESSAGES`, `ToastMessages`, `Json` to the rest of the system?**
  _108 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `dispatcher.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `admin-manual-arriendo.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `transport.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
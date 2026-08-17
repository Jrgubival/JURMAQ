# Graph Report - /Users/jorgeubilla/Documents/Proyectos/JURMAQ.CL  (2026-08-12)

## Corpus Check
- Large corpus: 599 files · ~492,157 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 2837 nodes · 6539 edges · 240 communities (187 shown, 53 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- Community 114
- Community 115
- Community 116
- Community 117
- Community 118
- Community 119
- Community 120
- Community 121
- Community 122
- Community 123
- Community 124
- Community 125
- Community 126
- Community 127
- Community 128
- Community 129
- Community 130
- Community 131
- Community 132
- Community 134
- Community 135
- Community 136
- Community 137
- Community 138
- Community 139
- Community 140
- Community 141
- Community 143
- Community 144
- Community 145
- Community 146
- Community 147
- Community 148
- Community 149
- Community 150
- Community 151
- Community 153
- Community 154
- Community 155
- Community 156
- Community 159
- Community 160
- Community 161
- Community 162
- Community 163
- Community 164
- Community 165
- Community 166
- Community 167
- Community 168
- Community 169
- Community 170
- Community 175
- Community 176
- Community 177
- Community 178
- Community 179
- Community 180
- Community 181
- Community 182
- Community 183
- Community 184
- Community 196
- Community 197
- Community 198
- Community 199
- Community 218
- Community 236
- Community 237
- Community 238
- Community 239

## God Nodes (most connected - your core abstractions)
1. `isValidOrigin()` - 218 edges
2. `forbiddenResponse()` - 208 edges
3. `requirePermission()` - 204 edges
4. `supabaseAdmin` - 163 edges
5. `formatCLP()` - 135 edges
6. `getClientIp()` - 115 edges
7. `rateLimit()` - 114 edges
8. `sanitizeString()` - 85 edges
9. `safeJsonLd()` - 69 edges
10. `Env` - 57 edges

## Surprising Connections (you probably didn't know these)
- `TRIGGER combustible_iva_compras_trigger on combustible_facturas` --references--> `TABLE combustible_facturas`  [INFERRED]
  apps/constructora/scripts/migrate-iva-f29-02-triggers.sql → COMBUSTIBLE_SISTEMA.md
- `E-1 Usuario regular accediendo a admin` --conceptually_related_to--> `TABLE public.barraca_cotizacion_items (RLS enabled)`  [INFERRED]
  SECURITY_REQUIREMENTS.md → apps/barraca/scripts/migrate-rls-promociones-cotitems.sql
- `TABLE public.maquinarias (ALTER: tarifa_neta, unidad_tarifa, minimo_unidades, requiere_traslado)` --shares_data_with--> `TABLE combustible_facturas`  [INFERRED]
  apps/constructora/scripts/migrate-arriendo-v2-01-maquinarias.sql → COMBUSTIBLE_SISTEMA.md
- `Algoritmo de cotización (precio_uso + traslado + iva)` --implements--> `TABLE public.cotizaciones_arriendo`  [INFERRED]
  MAQUINARIAS_PRICING.md → apps/constructora/scripts/migrate-arriendo-v2-03-cotizaciones-arriendo.sql
- `E-2 IDOR en cotizaciones` --conceptually_related_to--> `POLICY cot_arriendo_anon_read_by_email (anon SELECT)`  [INFERRED]
  SECURITY_REQUIREMENTS.md → apps/constructora/scripts/migrate-arriendo-v2-03-cotizaciones-arriendo.sql

## Import Cycles
- None detected.

## Communities (240 total, 53 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (90): POST(), GET(), CategoriaConCount, CategoriaRow, GET(), POST(), GET(), POST() (+82 more)

### Community 1 - "Community 1"
Cohesion: 0.04
Nodes (82): CotItem, GET(), parseItems(), runtime, GET(), runtime, DELETE(), PUT() (+74 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (50): Body, POST(), GET(), isAuthorized(), maxDuration, POST(), runtime, maxDuration (+42 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (43): DashboardBarracaPage(), DashboardData, KpiDelta, Periodo, periodos, BarracaProductosPage(), Categoria, emptyForm (+35 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (30): GET(), maxDuration, runtime, maskEmail(), POST(), resolveIpGeolocation(), generateOtpCode(), esEmail() (+22 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (35): getTopMaestros(), MaestroRow, MaestrosIndexPage(), metadata, AREA_META, Estado, ESTADO_META, Item (+27 more)

### Community 6 - "Community 6"
Cohesion: 0.05
Nodes (47): Audit 1B H4+H5 (RLS missing on used tables), POLICY promociones_public_read, TABLE public.barraca_cotizacion_items (RLS enabled), TABLE public.barraca_promociones (RLS enabled), Audit 1B H6 (views default OWNER privileges), VIEW public.barraca_productos_public (security_invoker=true), PLAN_MAESTRO Fase 4.A.1 (Arriendo v2 base), TABLE public.maquinarias (ALTER: tarifa_neta, unidad_tarifa, minimo_unidades, requiere_traslado) (+39 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (38): POST(), runtime, PATCH(), runtime, extractToken(), generateTokenAsync(), parseTokenAsync(), POST() (+30 more)

### Community 8 - "Community 8"
Cohesion: 0.06
Nodes (36): CalculadoraCementoClient(), ElementoCemento, CalculadoraCementoPage(), ELEMENTOS_CEMENTO, metadata, CalculadoraFierroClient(), ElementoFierro, CalculadoraFierroPage() (+28 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (33): clients, divisions, formatPrice(), getStatusLabel(), HomePage(), metadata, metadata, ProyectosPage() (+25 more)

### Community 10 - "Community 10"
Cohesion: 0.10
Nodes (31): POST(), runtime, POST(), runtime, GET(), NotifRow, ReadRow, runtime (+23 more)

### Community 11 - "Community 11"
Cohesion: 0.05
Nodes (44): exports, ./a11y, ./a11y/Modal, ./a11y/reduced-motion, ./a11y/SkipLink, ./a11y/useEscapeKey, ./a11y/useFocusTrap, ./auth (+36 more)

### Community 12 - "Community 12"
Cohesion: 0.09
Nodes (36): findMaquinariaBySlug(), formatPrice(), fraseOperador(), generateMetadata(), generateStaticParams(), getStatusColor(), getStatusLabel(), getTipoLabel() (+28 more)

### Community 13 - "Community 13"
Cohesion: 0.07
Nodes (32): DELETE(), POST(), requireUsuario(), runtime, DELETE(), POST(), requireUsuario(), runtime (+24 more)

### Community 14 - "Community 14"
Cohesion: 0.09
Nodes (37): ChatMessage, POST(), tool_agregar_al_carrito(), tool_buscar_producto(), tool_calcular_cemento(), tool_calcular_fierro(), TOOL_DEFS, tool_derivar_humano() (+29 more)

### Community 15 - "Community 15"
Cohesion: 0.07
Nodes (29): Footer(), DEFAULT_VARS, extractPlaceholders(), PLACEHOLDER_GROUPS, renderPreview(), Template, TemplatesPage(), metadata (+21 more)

### Community 16 - "Community 16"
Cohesion: 0.07
Nodes (26): BarracaCategoriaRow, BarracaProductoRow, CategoriaRow, ProductoRow, SortOption, SubCat, BarracaEnCiudadPage(), Categoria (+18 more)

### Community 17 - "Community 17"
Cohesion: 0.10
Nodes (24): Action, ProductoForDiscount, runtime, runtime, Body, POST(), POST(), POST() (+16 more)

### Community 18 - "Community 18"
Cohesion: 0.08
Nodes (33): AsistenteWidget, Categoria, getSessionId(), Navbar(), NewsletterPopup, AsistenteWidget(), ChatMessage, ChatMessageUi (+25 more)

### Community 19 - "Community 19"
Cohesion: 0.10
Nodes (27): ArriendoEnCiudadPage(), formatPrice(), Maquinaria, CiudadTipoLanding(), dynamic, Maquinaria, revalidate, dynamic (+19 more)

### Community 20 - "Community 20"
Cohesion: 0.08
Nodes (31): BarracaShell(), BarracaLayout(), geist, geistMono, metadata, newsreader, oswald, viewport (+23 more)

### Community 21 - "Community 21"
Cohesion: 0.10
Nodes (30): GET(), loadMaquinaria(), loadTarifasVigentes(), POST(), TarifasVigentesConSnapshot, formatPrice(), getStatusLabel(), getTipoLabel() (+22 more)

### Community 22 - "Community 22"
Cohesion: 0.10
Nodes (22): GET(), getDefaultImages(), AdminLoginPage(), metadata, safeCallback(), buildSignatureEmailHtml(), POST(), publicBaseUrl() (+14 more)

### Community 23 - "Community 23"
Cohesion: 0.16
Nodes (23): buildRenderVars(), ContratoRow, injectFirmasIntoHtml(), JURMAQ_ARRENDADOR, MaquinariaRow, n(), parseEspec(), s() (+15 more)

### Community 24 - "Community 24"
Cohesion: 0.09
Nodes (19): CombustibleFacturaRow, CombustibleItemRow, FacturaConItems, FacturaDetailPage(), FacturaItemWithJoins, Contrato, currentDate(), emptyItem() (+11 more)

### Community 25 - "Community 25"
Cohesion: 0.10
Nodes (22): WhatsAppFloat(), BarracaCategoriaRow, BarracaHomePage(), BarracaProductoRow, Categoria, categoryImages, getCategoryImage(), metadata (+14 more)

### Community 26 - "Community 26"
Cohesion: 0.13
Nodes (23): ADMIN_MANUAL_EMAIL_KINDS, AdminManualEmailKind, AdminManualEmailVars, BuildArgs, buildHtml(), CONSTRUCTORA_URL, escapeHtml(), fmtCLP() (+15 more)

### Community 27 - "Community 27"
Cohesion: 0.13
Nodes (22): GET(), DELETE(), GET(), PUT(), CombustibleFacturaRow, CombustibleItemRow, FacturaItemInput, FacturaWithItems (+14 more)

### Community 28 - "Community 28"
Cohesion: 0.14
Nodes (19): CartItem, CotizarPage(), getSessionId(), AddToCartClient(), getSessionId(), Producto, Variante, categoryImages (+11 more)

### Community 29 - "Community 29"
Cohesion: 0.12
Nodes (19): ComoFuncionaPage(), FAQ, metadata, STEPS, CATEGORIA_DESCRIPCION, CATEGORIA_ORDER, metadata, RecursosIndexPage() (+11 more)

### Community 30 - "Community 30"
Cohesion: 0.08
Nodes (24): devDependencies, typescript, engines, node, typescript, name, next, next-auth (+16 more)

### Community 31 - "Community 31"
Cohesion: 0.08
Nodes (24): build, dist, dom, dom.iterable, esnext, compilerOptions, allowJs, esModuleInterop (+16 more)

### Community 32 - "Community 32"
Cohesion: 0.15
Nodes (20): FIELD_OPTIONS, STEP_LABELS, POST(), BarracaProductoRow, COLUMN_SYNONYMS, detectColumnMapping(), executeImport(), fetchAllProducts() (+12 more)

### Community 33 - "Community 33"
Cohesion: 0.09
Nodes (23): devDependencies, dotenv, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/bcryptjs, @types/node (+15 more)

### Community 34 - "Community 34"
Cohesion: 0.11
Nodes (17): daysUntil(), DocCard(), Documento, DocumentosClient(), formatBytes(), formatDate(), TIPO_ICONS, TIPO_LABELS (+9 more)

### Community 35 - "Community 35"
Cohesion: 0.29
Nodes (15): BRAND, OrderItem, renderButton(), renderEmailLayout(), renderOrderItems(), sendContraofertaEmail(), buildEmailHtml(), CotizacionArriendoEmailData (+7 more)

### Community 36 - "Community 36"
Cohesion: 0.15
Nodes (16): Categoria, PreciosPage(), Producto, Categoria, Promocion, PromocionesAdminPage(), formatCLP(), formatDate() (+8 more)

### Community 37 - "Community 37"
Cohesion: 0.15
Nodes (18): Carrito, GET(), isAuthorized(), maxDuration, POST(), renderRecoveryEmail(), runtime, GET() (+10 more)

### Community 38 - "Community 38"
Cohesion: 0.15
Nodes (18): ArrendatarioForm, computeUnits(), CondicionesForm, ContratoInsertPayload, defaultPrice(), Maquinaria, Modalidad, NuevoContratoPage() (+10 more)

### Community 39 - "Community 39"
Cohesion: 0.11
Nodes (20): dynamic, GET(), runtime, calcularFlete(), COSTO_HR, COSTO_KM, FLETE_MINIMO, FleteDesglose (+12 more)

### Community 40 - "Community 40"
Cohesion: 0.10
Nodes (21): devDependencies, dotenv, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node, @types/nodemailer (+13 more)

### Community 41 - "Community 41"
Cohesion: 0.15
Nodes (16): AlternativaPage(), generateMetadata(), generateStaticParams(), IMPORTANT: ningún competidor real "patrocina" esta página. Las menciones, metadata, BARRACA_KPIS, COMPARACION_KPIS, DEFAULT_KPIS (+8 more)

### Community 42 - "Community 42"
Cohesion: 0.11
Nodes (13): LoginPage(), RegistroPage(), EstadoServer, ExitoContent(), Props, Ga4Event, gtagAvailable(), GtagEventParams (+5 more)

### Community 43 - "Community 43"
Cohesion: 0.14
Nodes (15): GET(), maxDuration, runtime, ContratoDetailPage(), dynamic, ContratosPage(), dynamic, estadoColor (+7 more)

### Community 44 - "Community 44"
Cohesion: 0.10
Nodes (21): cmdk, dependencies, bcryptjs, cmdk, next-auth, nodemailer, react, resend (+13 more)

### Community 45 - "Community 45"
Cohesion: 0.21
Nodes (16): CotizacionRow, GET(), isAuthorized(), maxDuration, parseItems(), POST(), runtime, BARRACA_URL (+8 more)

### Community 46 - "Community 46"
Cohesion: 0.24
Nodes (16): GET(), DELETE(), ALLOWED_TIPOS, buildStoragePath(), detectFileFormat(), DOWNLOAD_TTL_SECONDS, formatToContentType(), getSignedUrl() (+8 more)

### Community 47 - "Community 47"
Cohesion: 0.11
Nodes (19): dependencies, @jurmaq/shared, next-auth, nodemailer, puppeteer-core, react, resend, server-only (+11 more)

### Community 48 - "Community 48"
Cohesion: 0.12
Nodes (17): BarracaCategoriaRow, Categoria, CategoriasPage(), categoryImages, getCategoryImage(), metadata, SubCategoria, CompositeTypes (+9 more)

### Community 49 - "Community 49"
Cohesion: 0.11
Nodes (18): compilerOptions, baseUrl, jsx, paths, plugins, exclude, extends, include (+10 more)

### Community 50 - "Community 50"
Cohesion: 0.11
Nodes (19): dependencies, bcryptjs, @jurmaq/shared, next, puppeteer-core, react, react-dom, resend (+11 more)

### Community 51 - "Community 51"
Cohesion: 0.11
Nodes (18): compilerOptions, baseUrl, jsx, paths, plugins, exclude, extends, include (+10 more)

### Community 52 - "Community 52"
Cohesion: 0.12
Nodes (15): BarracaCotizacionesPage(), ContraofertaEditItem, Cotizacion, CotizacionItem, EditableCotizacionItem, estadoConfig, ATAJOS, BarracaAdminDashboard() (+7 more)

### Community 53 - "Community 53"
Cohesion: 0.14
Nodes (14): ClienteRow, CotMin, GET(), runtime, GET(), isValidRut(), POST(), runtime (+6 more)

### Community 54 - "Community 54"
Cohesion: 0.14
Nodes (14): GET(), maxDuration, runtime, GET(), maxDuration, runtime, CotizacionesPage(), dynamic (+6 more)

### Community 55 - "Community 55"
Cohesion: 0.25
Nodes (15): buildDiagnostics(), maxDuration, POST(), coerceCodigo(), coerceFechaFin(), coercePrecio(), COLUMN_SYNONYMS, detectColumnMapping() (+7 more)

### Community 56 - "Community 56"
Cohesion: 0.16
Nodes (12): CategoriaRow, ProductoRow, revalidate, VarianteRow, ShareButtons(), categoryImages, ProductDetailImage(), ProductDetailImageProps (+4 more)

### Community 57 - "Community 57"
Cohesion: 0.15
Nodes (11): CardInfo, EstadoContrato, GarantiaPanel(), HoldInfo, Metodo, Contrato, ContratoDetailPage(), Estado (+3 more)

### Community 58 - "Community 58"
Cohesion: 0.17
Nodes (12): daysUntil(), DocCard(), Documento, DocumentosClient(), formatBytes(), formatDate(), TIPO_ICONS, TIPO_LABELS (+4 more)

### Community 59 - "Community 59"
Cohesion: 0.28
Nodes (14): ALLOWED_TIPOS, buildStoragePath(), detectFileFormat(), DOWNLOAD_TTL_SECONDS, formatToContentType(), getSignedUrl(), MAX_FILE_SIZE, parseNumericId() (+6 more)

### Community 60 - "Community 60"
Cohesion: 0.27
Nodes (13): attachSessionCookie(), BarracaProductoRow, CarritoItemConProducto, DELETE(), GET(), getSessionId(), POST(), PUT() (+5 more)

### Community 61 - "Community 61"
Cohesion: 0.22
Nodes (13): GET(), isAuthorized(), maxDuration, POST(), runtime, BACKOFF_SECONDS, dequeueEmails(), EmailQueueItem (+5 more)

### Community 62 - "Community 62"
Cohesion: 0.20
Nodes (14): base64UrlDecode(), base64UrlEncode(), getSecret(), purgeOldSessions(), revokeAllUserSessions(), revokeSession(), SessionPayload, SessionScope (+6 more)

### Community 63 - "Community 63"
Cohesion: 0.20
Nodes (9): ESTADO_COLOR, Review, ReviewForm(), RatingAgg, Review, ReviewsList(), Props, SIZE_PX (+1 more)

### Community 64 - "Community 64"
Cohesion: 0.22
Nodes (11): BuscarPage(), ProductoRow, BarracaProductoRow, expandWord(), flattenProducts(), mergeResults(), normalizeWord(), ProductoAplanado (+3 more)

### Community 65 - "Community 65"
Cohesion: 0.29
Nodes (13): AuthBody, handleForgot(), handleLogin(), handleLogout(), handleRegister(), handleReset(), maxDuration, POST() (+5 more)

### Community 66 - "Community 66"
Cohesion: 0.24
Nodes (11): buildSmsMessage(), CarritoAbandonadoSms, GET(), isAuthorized(), maxDuration, POST(), runtime, SHORT_URL (+3 more)

### Community 67 - "Community 67"
Cohesion: 0.23
Nodes (7): GuiasIndexPage(), metadata, generateMetadata(), GuiaPage(), getGuia(), GUIAS, GuiaSEO

### Community 68 - "Community 68"
Cohesion: 0.18
Nodes (10): MaquinariaCatalog, metadata, Desglose, etiquetaOperador(), MaquinariaCatalog, STEPS, WizardClient(), WizardPrefill (+2 more)

### Community 69 - "Community 69"
Cohesion: 0.15
Nodes (13): devDependencies, @types/bcryptjs, @types/node, @types/nodemailer, @types/react, @types/react-dom, typescript, @types/bcryptjs (+5 more)

### Community 70 - "Community 70"
Cohesion: 0.26
Nodes (7): Modal(), ModalProps, SkipLink(), usePrefersReducedMotion(), useEscapeKey(), FOCUSABLE_SELECTOR, useFocusTrap()

### Community 72 - "Community 72"
Cohesion: 0.20
Nodes (8): cot_arriendo_updated_at_trigger, public.cotizaciones_arriendo, public.tarifa_traslado_actual, public.tarifas_traslado, public.clientes, public.cot_arriendo_set_updated_at, public.maquinarias, public.users

### Community 73 - "Community 73"
Cohesion: 0.23
Nodes (9): SignaturePad, ContratoData, FirmarContratoPage(), formatDateTime(), maskPhone(), SignaturePad, Step, Props (+1 more)

### Community 74 - "Community 74"
Cohesion: 0.18
Nodes (9): CarritoAbandonado, Cliente, Cotizacion, Data360, ESTADO_COLOR, Review, Stats, TopProducto (+1 more)

### Community 75 - "Community 75"
Cohesion: 0.25
Nodes (9): CombustiblePage(), currentMonth(), estadoColor, Factura, formatLitros(), Item, Resumen, EstadoFactura (+1 more)

### Community 76 - "Community 76"
Cohesion: 0.22
Nodes (9): NavGroup, NavItem, navItems, NOTE: el array `barracaNavItems[]` vivía aquí porque el AdminShell, GlobalSearch(), SearchHit, tipoColor, tipoLabel (+1 more)

### Community 77 - "Community 77"
Cohesion: 0.18
Nodes (10): next, next, name, peerDependencies, next, private, scripts, typecheck (+2 more)

### Community 78 - "Community 78"
Cohesion: 0.18
Nodes (10): Action, ALL_ACTIONS, ALL_BARRACA_MODULES, ALL_MODULES, BarracaModule, ConstructoraModule, ROLE_OPTIONS, RoleDef (+2 more)

### Community 79 - "Community 79"
Cohesion: 0.18
Nodes (7): email, isoDate, nonNegativeInt, ParseResult, phone, positiveInt, rut

### Community 80 - "Community 80"
Cohesion: 0.25
Nodes (10): CIUDADES, __dirname, distanciasParaOrigen(), formatTiempo(), HQ_BARRACA, HQ_CONSTRUCTORA, main(), osrmRoute() (+2 more)

### Community 81 - "Community 81"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, lint, start, typecheck (+1 more)

### Community 82 - "Community 82"
Cohesion: 0.20
Nodes (9): background_color, description, display, icons, lang, name, short_name, start_url (+1 more)

### Community 83 - "Community 83"
Cohesion: 0.20
Nodes (9): background_color, description, display, icons, lang, name, short_name, start_url (+1 more)

### Community 84 - "Community 84"
Cohesion: 0.20
Nodes (6): CASOS, FAQ, metadata, PriceMatchPage(), RAZONES, STEPS

### Community 85 - "Community 85"
Cohesion: 0.24
Nodes (8): AdminShell(), NavGroup, NavItem, navItems, visibleModules(), CommandItem, CommandPalette(), Props

### Community 86 - "Community 86"
Cohesion: 0.24
Nodes (4): config, config, authConfig, SCOPE

### Community 87 - "Community 87"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, lint, start, typecheck (+1 more)

### Community 88 - "Community 88"
Cohesion: 0.20
Nodes (9): background_color, description, display, icons, lang, name, short_name, start_url (+1 more)

### Community 89 - "Community 89"
Cohesion: 0.22
Nodes (8): CotArriendoDetalle(), Cotizacion, ESTADOS_DISPONIBLES, KindMeta, KINDS, ManualEmailVars, Props, SendManualEmailModal()

### Community 90 - "Community 90"
Cohesion: 0.20
Nodes (5): CaptureRow, ChargeRow, GarantiasPanelPage(), GarantiasResp, HoldRow

### Community 91 - "Community 91"
Cohesion: 0.36
Nodes (7): Producto, SimilarProduct, buildImageQuery(), extractVqdToken(), ImageCandidate, searchDuckDuckGoImages(), searchImageCandidates()

### Community 92 - "Community 92"
Cohesion: 0.28
Nodes (7): CarritoPage(), CartItem, getSessionId(), CodigoMaestroInput(), MaestroInfo, Props, State

### Community 93 - "Community 93"
Cohesion: 0.28
Nodes (7): CategoriaEnCiudadPage(), CategoriaRow, generateStaticParams(), getEligibleCategoriaIds(), ProductoRow, CategoriaPage(), applyDailyPromosToProducts()

### Community 94 - "Community 94"
Cohesion: 0.22
Nodes (6): cot_arriendo_updated_at_trigger, public.cotizaciones_arriendo, public.clientes, public.cot_arriendo_set_updated_at, public.maquinarias, public.users

### Community 95 - "Community 95"
Cohesion: 0.28
Nodes (7): Ga4Event, gtagAvailable(), GtagEventParams, ItemBarraca, track(), trackCustom(), Window

### Community 96 - "Community 96"
Cohesion: 0.28
Nodes (9): Firma Electrónica Simple (FES, Ley 19.799), Ley 19.799 (firma electrónica Chile), OTP por email vía Resend (reemplaza Twilio), TABLE contratos_otp (OTP de 10 min), Ley 19.496 + SERNAC, Ley 21.719 (datos personales Chile), STRIDE × SecurityRequirement framework, S-1 Suplantación de firmante (CRITICAL) (+1 more)

### Community 97 - "Community 97"
Cohesion: 0.22
Nodes (8): compilerOptions, baseUrl, outDir, rootDir, extends, include, ../../tsconfig.base.json, src/**/*

### Community 98 - "Community 98"
Cohesion: 0.36
Nodes (8): barracaHtml(), constructoraHtml(), __dirname, execFileAsync, main(), renderToPng(), ROOT, toDataUri()

### Community 99 - "Community 99"
Cohesion: 0.68
Nodes (6): POST(), emailFooter(), emailHeader(), sendAbandonedCartEmail(), sendFollowUpEmail(), sendMonthlyOffersEmail()

### Community 100 - "Community 100"
Cohesion: 0.36
Nodes (6): categoryImages, getProductImage(), getSessionId(), ProductCard(), ProductCardProps, WishlistHeart()

### Community 101 - "Community 101"
Cohesion: 0.29
Nodes (7): emptyForm, formatDate(), roleBadge, RoleId, RoleOption, UserRow, UsuariosAdminPage()

### Community 102 - "Community 102"
Cohesion: 0.36
Nodes (7): GET(), isAuthorized(), maxDuration, POST(), ProximaRow, runtime, createAdminNotificationIfNew()

### Community 103 - "Community 103"
Cohesion: 0.29
Nodes (4): Comision, ESTADO_COLOR, ESTADO_LABEL, MaestroEmbed

### Community 104 - "Community 104"
Cohesion: 0.43
Nodes (5): MaestroLandingClient(), generateMetadata(), getMaestro(), MaestroLandingPage(), MaestroPublic

### Community 105 - "Community 105"
Cohesion: 0.33
Nodes (6): Contrato, ContratosListPage(), Estado, estadoConfig, filterChips, formatDate()

### Community 106 - "Community 106"
Cohesion: 0.33
Nodes (6): Cotizacion, CotizacionesPage(), emptyCotizacion, estadoColors, estadoFlow, formatDate()

### Community 107 - "Community 107"
Cohesion: 0.33
Nodes (6): emptyMaquinaria, estadoColors, Maquinaria, MaquinariasPage(), parseEspec(), TipoCombustible

### Community 108 - "Community 108"
Cohesion: 0.38
Nodes (6): DashboardPage(), DashboardStats, formatDate(), Proyecto, Solicitud, statusBadge()

### Community 109 - "Community 109"
Cohesion: 0.29
Nodes (5): canalColor, canalLabel, HealthResponse, ProviderStat, ProviderStatus

### Community 110 - "Community 110"
Cohesion: 0.33
Nodes (6): CotRow, GET(), MantencionRow, MaqRow, parseDate(), runtime

### Community 111 - "Community 111"
Cohesion: 0.47
Nodes (5): barraca_precio_historial, barraca_precio_historial_track(), precio_vigente_acumulado_dias(), trg_barraca_precio_historial, barraca_productos

### Community 112 - "Community 112"
Cohesion: 0.40
Nodes (3): dynamic, metadata, SessionWrapper()

### Community 113 - "Community 113"
Cohesion: 0.33
Nodes (4): Comision, ESTADO_COLOR, Maestro, Stats

### Community 114 - "Community 114"
Cohesion: 0.40
Nodes (5): KIND_LABEL, NotificacionesPage(), Notification, SEVERITY_BADGE, timeAgo()

### Community 115 - "Community 115"
Cohesion: 0.40
Nodes (5): Notification, NotificationsBell(), SEVERITY_COLOR, SEVERITY_ICON, timeAgo()

### Community 116 - "Community 116"
Cohesion: 0.40
Nodes (5): Counts, EmailQueuePage(), formatDate(), QueueItem, STATUS_TABS

### Community 117 - "Community 117"
Cohesion: 0.40
Nodes (3): dynamic, AdminShell(), SessionWrapper()

### Community 118 - "Community 118"
Cohesion: 0.40
Nodes (5): KIND_LABEL, NotificacionesPage(), Notification, SEVERITY_BADGE, timeAgo()

### Community 119 - "Community 119"
Cohesion: 0.40
Nodes (5): emptyProyecto, estadoColors, formatDate(), Proyecto, ProyectosPage()

### Community 120 - "Community 120"
Cohesion: 0.40
Nodes (5): fechaISO(), MaquinaReporte, PRESETS, RentabilidadPage(), Resumen

### Community 121 - "Community 121"
Cohesion: 0.40
Nodes (5): estadoColors, formatDate(), Solicitud, SolicitudesPage(), tabs

### Community 122 - "Community 122"
Cohesion: 0.47
Nodes (5): GET(), isAuthorized(), maxDuration, POST(), runtime

### Community 123 - "Community 123"
Cohesion: 0.40
Nodes (4): CuentaLayout(), metadata, navItems, LogoutButton()

### Community 124 - "Community 124"
Cohesion: 0.40
Nodes (4): LoginClient(), Mode, LoginPage(), metadata

### Community 125 - "Community 125"
Cohesion: 0.40
Nodes (4): dynamic, PerfilPage(), Perfil, PerfilClient()

### Community 126 - "Community 126"
Cohesion: 0.53
Nodes (5): buildImageQuery(), extractVqdToken(), ImageCandidate, searchDuckDuckGoImages(), searchImageCandidates()

### Community 127 - "Community 127"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 129 - "Community 129"
Cohesion: 0.40
Nodes (3): CuentaDashboard(), dynamic, estadoColor

### Community 131 - "Community 131"
Cohesion: 0.50
Nodes (4): Notification, NotificationsBell(), SEVERITY_ICON, timeAgo()

### Community 132 - "Community 132"
Cohesion: 0.40
Nodes (3): public.set_updated_at_constructora_testimonios, public.constructora_testimonios, trg_constructora_testimonios_updated_at

### Community 137 - "Community 137"
Cohesion: 0.50
Nodes (3): public.contratos_fotos, public.contratos, public.users

### Community 141 - "Community 141"
Cohesion: 0.50
Nodes (3): GET(), maxDuration, runtime

## Knowledge Gaps
- **975 isolated node(s):** `eslintConfig`, `nextConfig`, `name`, `version`, `private` (+970 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **53 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `formatCLP()` connect `Community 3` to `Community 0`, `Community 128`, `Community 129`, `Community 9`, `Community 12`, `Community 14`, `Community 16`, `Community 18`, `Community 19`, `Community 21`, `Community 23`, `Community 24`, `Community 25`, `Community 26`, `Community 28`, `Community 34`, `Community 35`, `Community 36`, `Community 38`, `Community 43`, `Community 52`, `Community 54`, `Community 56`, `Community 57`, `Community 68`, `Community 89`, `Community 90`, `Community 92`, `Community 99`, `Community 100`, `Community 106`, `Community 107`, `Community 108`, `Community 119`, `Community 120`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Why does `supabaseAdmin` connect `Community 17` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 128`, `Community 129`, `Community 7`, `Community 10`, `Community 13`, `Community 14`, `Community 141`, `Community 146`, `Community 147`, `Community 21`, `Community 22`, `Community 23`, `Community 27`, `Community 32`, `Community 34`, `Community 37`, `Community 38`, `Community 43`, `Community 45`, `Community 46`, `Community 53`, `Community 54`, `Community 55`, `Community 58`, `Community 59`, `Community 60`, `Community 61`, `Community 65`, `Community 66`, `Community 102`, `Community 110`, `Community 122`, `Community 125`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `Env` connect `Community 22` to `Community 0`, `Community 2`, `Community 3`, `Community 4`, `Community 10`, `Community 14`, `Community 17`, `Community 18`, `Community 20`, `Community 23`, `Community 26`, `Community 35`, `Community 37`, `Community 39`, `Community 42`, `Community 43`, `Community 45`, `Community 60`, `Community 61`, `Community 62`, `Community 65`, `Community 66`, `Community 76`, `Community 85`, `Community 86`, `Community 95`, `Community 99`, `Community 102`, `Community 104`, `Community 122`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `nextConfig`, `name` to the rest of the system?**
  _975 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.04203174603174603 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.04095004095004095 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07680491551459294 - nodes in this community are weakly interconnected._
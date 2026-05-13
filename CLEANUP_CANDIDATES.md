# Candidatos para cleanup (Fase 9)

> Generado automáticamente. **No borrar sin validar** — pueden tener dynamic imports o references no detectables vía rg.

## Componentes posiblemente sin usar

### apps/barraca/src/components/
- Analytics.tsx
- GSAPInit.tsx
- WhatsAppFloating.tsx
- animations/AnimatedCounter.tsx
- animations/AnimatedSection.tsx
- animations/AnimatedText.tsx
- animations/GSAPProvider.tsx
- animations/HeroSlideshow.tsx
- animations/ParallaxImage.tsx
- animations/ScrollProgress.tsx
- animations/StaggeredGrid.tsx

### apps/constructora/src/components/
- GSAPInit.tsx
- Toast.tsx
- TrustSignals.tsx
- WhatsAppFloating.tsx
- analytics/ViewItemTracker.tsx
- animations/AnimatedCounter.tsx
- animations/AnimatedText.tsx
- animations/GSAPProvider.tsx
- animations/ParallaxImage.tsx
- animations/ScrollProgress.tsx

## Cómo validar antes de borrar

Para cada candidato:
1. `rg "ComponentName" apps/{app}/src` — ¿solo aparece el archivo mismo?
2. `rg "['\"][^'\"]*ComponentName" apps/{app}/src` — busca import paths
3. `pnpm --filter @jurmaq/{app} build` después de borrar — ¿sigue build OK?
4. Manual: cargar páginas relevantes en dev. Si nada se rompe visualmente, ok borrar.

## Decisión recomendada

Diferir cleanup hasta DESPUÉS del primer deploy production en Oracle. Eso te
da observabilidad real: si algo se rompe en prod, debug es más fácil con todos
los archivos presentes. Cuando el sitio lleve 2 semanas estable, hacer cleanup
en PR aparte.

Borrar todos los candidatos arriba podría ahorrar ~3-5 MB en bundles, pero el
riesgo de romper algo sutil (component referenciado en JSON config, en
markdown render, etc) supera el ahorro hasta confirmar uso real en prod.

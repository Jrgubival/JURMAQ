import { auth } from '@jurmaq/shared/auth';
import { NextRequest, NextResponse } from 'next/server';

// Mapping of product keywords to curated Unsplash photo URLs
function getDefaultImages(productName: string): string[] {
  const name = productName.toLowerCase();

  // Fierros / Acero / Barras
  if (
    name.includes('fierro') ||
    name.includes('fe.estriado') ||
    name.includes('barra') ||
    name.includes('acero')
  ) {
    return [
      'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1565793298595-6a879b1d9492?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1530982011887-3cc11cc85693?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1513467535987-fd81bc7d62f8?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=400&h=300&fit=crop',
    ];
  }

  // Pintura / Esmalte / Latex
  if (
    name.includes('pintura') ||
    name.includes('esmalte') ||
    name.includes('latex') ||
    name.includes('barniz') ||
    name.includes('impermeabilizante')
  ) {
    return [
      'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1572296412498-6b19be03a063?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1525909002-1b05e0c869d8?w=400&h=300&fit=crop',
    ];
  }

  // Cemento / Concreto / Hormigon
  if (
    name.includes('cemento') ||
    name.includes('hormigon') ||
    name.includes('concreto') ||
    name.includes('mortero')
  ) {
    return [
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1590274853856-f22d5ee3d228?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1621155346337-1d19476ba7d6?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1541123603104-512919d6a96c?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
    ];
  }

  // Tubos / Canerias / PVC
  if (
    name.includes('tubo') ||
    name.includes('caneria') ||
    name.includes('pvc') ||
    name.includes('cano')
  ) {
    return [
      'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1597766659890-3f019befd880?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1621155346337-1d19476ba7d6?w=400&h=300&fit=crop',
    ];
  }

  // Clavos / Tornillos / Pernos / Fijaciones
  if (
    name.includes('clavo') ||
    name.includes('tornillo') ||
    name.includes('perno') ||
    name.includes('tuerca') ||
    name.includes('golilla') ||
    name.includes('fijacion')
  ) {
    return [
      'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1530982011887-3cc11cc85693?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1513467535987-fd81bc7d62f8?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=400&h=300&fit=crop',
    ];
  }

  // Madera / Tablas / Vigas / Listones
  if (
    name.includes('madera') ||
    name.includes('tabla') ||
    name.includes('viga') ||
    name.includes('liston') ||
    name.includes('pino') ||
    name.includes('terciado') ||
    name.includes('melamina')
  ) {
    return [
      'https://images.unsplash.com/photo-1541123603104-512919d6a96c?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1597766659890-3f019befd880?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1621155346337-1d19476ba7d6?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
    ];
  }

  // Herramientas
  if (
    name.includes('martillo') ||
    name.includes('destornillador') ||
    name.includes('llave') ||
    name.includes('herramienta') ||
    name.includes('alicate') ||
    name.includes('serrucho') ||
    name.includes('sierra')
  ) {
    return [
      'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1530982011887-3cc11cc85693?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1513467535987-fd81bc7d62f8?w=400&h=300&fit=crop',
    ];
  }

  // Electrico / Cable / Interruptor / Enchufe
  if (
    name.includes('cable') ||
    name.includes('electri') ||
    name.includes('interruptor') ||
    name.includes('enchufe') ||
    name.includes('foco') ||
    name.includes('ampolleta') ||
    name.includes('led')
  ) {
    return [
      'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1513467535987-fd81bc7d62f8?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1530982011887-3cc11cc85693?w=400&h=300&fit=crop',
    ];
  }

  // Ladrillos / Bloques
  if (
    name.includes('ladrillo') ||
    name.includes('bloque') ||
    name.includes('ceramica') ||
    name.includes('azulejo') ||
    name.includes('baldosa') ||
    name.includes('porcelanato')
  ) {
    return [
      'https://images.unsplash.com/photo-1590274853856-f22d5ee3d228?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1621155346337-1d19476ba7d6?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1541123603104-512919d6a96c?w=400&h=300&fit=crop',
    ];
  }

  // Techos / Calaminas / Zinc / Planchas / Zincalum
  if (
    name.includes('techo') ||
    name.includes('calamina') ||
    name.includes('zinc') ||
    name.includes('zincalum') ||
    name.includes('onda') ||
    name.includes('caballete') ||
    name.includes('plancha') ||
    name.includes('policarbonato') ||
    name.includes('cubierta')
  ) {
    return [
      'https://images.unsplash.com/photo-1632759145351-1d592919f522?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1513584684374-8bab748fbf90?w=400&h=300&fit=crop',
    ];
  }

  // Griferia / Sanitarios / Bano
  if (
    name.includes('grifo') ||
    name.includes('griferia') ||
    name.includes('sanitario') ||
    name.includes('inodoro') ||
    name.includes('lavamanos') ||
    name.includes('ducha') ||
    name.includes('bano')
  ) {
    return [
      'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1597766659890-3f019befd880?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1513467535987-fd81bc7d62f8?w=400&h=300&fit=crop',
    ];
  }

  // Default: general construction/hardware images
  return [
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1530982011887-3cc11cc85693?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1513467535987-fd81bc7d62f8?w=400&h=300&fit=crop',
  ];
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '6', 10);

    if (!q) {
      return NextResponse.json({ error: 'Parametro q es requerido' }, { status: 400 });
    }

    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;

    if (unsplashKey) {
      // Use Unsplash API
      const searchTerms = q
        .replace(/\d+\s*(mm|cm|mt|mts|m|kg|lt|pulg|pulgadas)/gi, '')
        .replace(/x\s*\d+/gi, '')
        .replace(/[^\w\s]/g, '')
        .trim();

      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
          searchTerms + ' construction hardware'
        )}&per_page=${limit}&client_id=${unsplashKey}`,
        { next: { revalidate: 3600 } }
      );

      if (response.ok) {
        const data = await response.json();
        const images = data.results.map(
          (photo: { urls: { small: string }; alt_description: string; user: { name: string } }) => ({
            url: photo.urls.small,
            alt: photo.alt_description || q,
            source: `Unsplash - ${photo.user.name}`,
          })
        );
        return NextResponse.json({ images });
      }
    }

    // DuckDuckGo Image Search (no API key needed)
    try {
      const cleanQuery = q
        .replace(/\d+\s*(mm|cm|mt|kg|lt|pulg)/gi, '')
        .replace(/[xX×]/g, ' ')
        .replace(/[^\w\sáéíóúñÁÉÍÓÚÑ]/g, '')
        .trim();
      const searchQuery = cleanQuery + ' ferreteria producto';

      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-CL,es;q=0.9,en;q=0.8',
        'Referer': 'https://duckduckgo.com/',
      };

      // Step 1: Get vqd token
      const tokenRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}&ia=images&iax=images`, {
        headers,
        redirect: 'follow',
      });
      const tokenHtml = await tokenRes.text();

      // Try multiple vqd patterns
      let vqd = '';
      const patterns = [
        /vqd=([\d-]+)&/,
        /vqd='([\d-]+)'/,
        /vqd="([\d-]+)"/,
        /vqd%3D([\d-]+)/,
      ];
      for (const pat of patterns) {
        const m = tokenHtml.match(pat);
        if (m) { vqd = m[1]; break; }
      }

      if (vqd) {
        // Step 2: Fetch images
        const imgUrl = `https://duckduckgo.com/i.js?l=cl&o=json&q=${encodeURIComponent(searchQuery)}&vqd=${vqd}&f=,,,,,&p=1`;
        const imgRes = await fetch(imgUrl, { headers });

        if (imgRes.ok) {
          const text = await imgRes.text();
          try {
            const imgData = JSON.parse(text);
            if (imgData.results?.length > 0) {
              const images = imgData.results.slice(0, limit).map((r: any) => ({
                url: r.image || r.thumbnail,
                alt: r.title || q,
                source: 'DuckDuckGo',
              }));
              return NextResponse.json({ images });
            }
          } catch { /* JSON parse failed */ }
        }
      }
    } catch { /* fallback below */ }

    // Fallback: use curated default images
    const urls = getDefaultImages(q).slice(0, limit);
    const images = urls.map((url, i) => ({
      url,
      alt: `${q} - opcion ${i + 1}`,
      source: 'Unsplash (curado)',
    }));

    return NextResponse.json({ images });
  } catch (error) {
    console.error('Error buscando imagenes:', error);
    return NextResponse.json({ error: 'Error al buscar imagenes' }, { status: 500 });
  }
}

/**
 * POST /api/asistente/chat
 *
 * Asistente conversacional híbrido: rule-based + Gemini Flash.
 *
 * Configuración requerida:
 *   GEMINI_API_KEY en .env.local (free tier: 15 req/min, 1.500 req/día)
 *   Conseguir en https://aistudio.google.com/apikey
 *
 * Si GEMINI_API_KEY no está configurada, retorna respuestas pre-programadas.
 *
 * Tools disponibles (server-side):
 *   - buscar_producto(query): busca en barraca_productos
 *   - calcular_cemento({m2, espesor_cm}): cement bags
 *   - calcular_fierro({m2}): kg fierro
 *   - derivar_humano(motivo): retorna mensaje "consultá WhatsApp"
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import { isValidOrigin, sanitizeString } from '@jurmaq/shared/sanitize';

const SYSTEM_PROMPT = `Eres el asistente de JURMAQ Barraca (barraca de fierros y materiales de construcción en Curicó, Chile).

REGLAS ESTRICTAS:
- NUNCA inventes precios. Si te preguntan precio, usa la tool buscar_producto.
- NUNCA prometes stock disponible. Si preguntan stock, deriva a WhatsApp con derivar_humano.
- Si la consulta es ambigua o sale del scope (construcción/materiales), responde brevemente y deriva.
- Tu rol PRINCIPAL es ayudar a calcular cuánto material necesita el cliente para su proyecto.
- Sé conciso. Máximo 3 párrafos cortos.
- Habla en español chileno informal pero profesional.

TOOLS DISPONIBLES:
- buscar_producto(query): busca productos por nombre o tipo
- calcular_cemento({m2, espesor_cm}): calcula sacos de cemento para una losa
- calcular_fierro({m2}): calcula kg de fierro para una losa armada
- derivar_humano(motivo): cuando no puedes responder o necesita atención humana

EJEMPLOS:
- Cliente: "cuánto cemento para un patio de 4x5 metros, espesor 8cm"
  → calcular_cemento({m2: 20, espesor_cm: 8})
- Cliente: "qué precio tiene el fierro estriado 10mm"
  → buscar_producto("fierro estriado 10mm")
- Cliente: "tienen disponibilidad de bolones?"
  → derivar_humano("consulta de stock en vivo")
`;

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ---------------------------------------------------------------------------
// Tools (server-side execution)
// ---------------------------------------------------------------------------

async function tool_buscar_producto(query: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('barraca_productos_public')
    .select('nombre, precio, precio_original, en_oferta, unidad, medida')
    .or(`nombre.ilike.%${query}%,descripcion.ilike.%${query}%`)
    .eq('activo', true)
    .limit(3);

  if (!data || data.length === 0) {
    return JSON.stringify({ error: 'No encontré productos que coincidan con esa búsqueda.' });
  }

  return JSON.stringify({
    productos: data.map((p) => ({
      nombre: p.nombre,
      precio: p.precio,
      precio_oferta: p.en_oferta ? p.precio_original : null,
      unidad: p.unidad,
      medida: p.medida,
    })),
  });
}

function tool_calcular_cemento(args: { m2: number; espesor_cm: number }): string {
  const { m2, espesor_cm } = args;
  if (!m2 || !espesor_cm || m2 <= 0 || espesor_cm <= 0) {
    return JSON.stringify({ error: 'Necesito m² y espesor en cm válidos.' });
  }
  // Dosificación típica radier 1:3:5: ~7 sacos cemento por m³
  const m3 = (m2 * espesor_cm) / 100;
  const sacos_base = Math.ceil(m3 * 7);
  const sacos_con_perdida = Math.ceil(sacos_base * 1.1); // 10% pérdida
  const arena_m3 = Math.round(m3 * 0.5 * 100) / 100;
  const gravilla_m3 = Math.round(m3 * 0.7 * 100) / 100;
  return JSON.stringify({
    m3,
    sacos_cemento_base: sacos_base,
    sacos_cemento_con_perdida: sacos_con_perdida,
    arena_m3,
    gravilla_m3,
    dosificacion: '1:3:5 (cemento : arena : gravilla)',
    notas: 'Cálculo para radier típico. Para hormigón estructural usar 1:2:4 (~9 sacos/m³).',
  });
}

function tool_calcular_fierro(args: { m2: number }): string {
  const { m2 } = args;
  if (!m2 || m2 <= 0) {
    return JSON.stringify({ error: 'Necesito m² válidos.' });
  }
  // Promedio armadura losa: ~10 kg/m² (fierro estriado 10mm en malla 20x20)
  const kg_base = Math.round(m2 * 10);
  const kg_con_perdida = Math.round(kg_base * 1.05); // 5% pérdida + amarres
  return JSON.stringify({
    kg_fierro_base: kg_base,
    kg_fierro_con_perdida: kg_con_perdida,
    armadura: 'Malla 20x20 cm con fierro 10mm estriado',
    notas: 'Estimación para losa estándar (1 capa). Losa estructural pesada necesita doble capa: x2.',
  });
}

function tool_derivar_humano(motivo: string): string {
  return JSON.stringify({
    mensaje: `Para esto necesitas hablar con un humano: ${motivo}. Contáctanos por WhatsApp +56 9 1234 5678 o llamá al teléfono de la barraca.`,
  });
}

// ---------------------------------------------------------------------------
// Gemini call
// ---------------------------------------------------------------------------

interface GeminiTool {
  function_declarations: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description?: string }>;
      required?: string[];
    };
  }[];
}

const GEMINI_TOOLS: GeminiTool[] = [{
  function_declarations: [
    {
      name: 'buscar_producto',
      description: 'Busca productos en la barraca por nombre o tipo. Usa cuando el cliente pregunta por precio, disponibilidad de un material.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Texto a buscar (ej: "fierro 10mm", "cemento")' },
        },
        required: ['query'],
      },
    },
    {
      name: 'calcular_cemento',
      description: 'Calcula sacos de cemento + arena + gravilla necesarios para una losa o radier.',
      parameters: {
        type: 'object',
        properties: {
          m2: { type: 'number', description: 'Superficie en metros cuadrados' },
          espesor_cm: { type: 'number', description: 'Espesor de la losa en centímetros' },
        },
        required: ['m2', 'espesor_cm'],
      },
    },
    {
      name: 'calcular_fierro',
      description: 'Calcula kg de fierro estriado necesarios para armar una losa.',
      parameters: {
        type: 'object',
        properties: {
          m2: { type: 'number', description: 'Superficie en metros cuadrados' },
        },
        required: ['m2'],
      },
    },
    {
      name: 'derivar_humano',
      description: 'Cuando la consulta requiere atención humana (stock real, condiciones especiales, problemas).',
      parameters: {
        type: 'object',
        properties: {
          motivo: { type: 'string', description: 'Por qué se deriva' },
        },
        required: ['motivo'],
      },
    },
  ],
}];

async function callGemini(messages: ChatMessage[], apiKey: string): Promise<string> {
  // Convert to Gemini format
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const body = {
    contents,
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    tools: GEMINI_TOOLS,
    generationConfig: {
      maxOutputTokens: 800,
      temperature: 0.3,
    },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini ${res.status}: ${errText.substring(0, 200)}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  if (!candidate) throw new Error('Gemini sin candidato');

  // Tool calls
  const funcCall = candidate.content?.parts?.find((p: { functionCall?: unknown }) => p.functionCall);
  if (funcCall?.functionCall) {
    const { name, args } = funcCall.functionCall as { name: string; args: Record<string, unknown> };
    let toolResult = '';
    if (name === 'buscar_producto') {
      toolResult = await tool_buscar_producto(String(args.query || ''));
    } else if (name === 'calcular_cemento') {
      toolResult = tool_calcular_cemento(args as { m2: number; espesor_cm: number });
    } else if (name === 'calcular_fierro') {
      toolResult = tool_calcular_fierro(args as { m2: number });
    } else if (name === 'derivar_humano') {
      toolResult = tool_derivar_humano(String(args.motivo || 'consulta general'));
    } else {
      toolResult = JSON.stringify({ error: `Tool ${name} no implementada` });
    }

    // Re-call Gemini with tool result
    const followUp = {
      ...body,
      contents: [
        ...contents,
        { role: 'model', parts: [{ functionCall: funcCall.functionCall }] },
        { role: 'user', parts: [{ functionResponse: { name, response: { result: toolResult } } }] },
      ],
    };
    const res2 = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(followUp) },
    );
    const data2 = await res2.json();
    const text = data2.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text;
    return text || 'No pude generar respuesta.';
  }

  // Plain text response
  const text = candidate.content?.parts?.find((p: { text?: string }) => p.text)?.text;
  return text || 'No pude generar respuesta.';
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    if (!isValidOrigin(request)) {
      return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
    }

    // Rate limit: 10 mensajes/min por sesión-IP (cae bien dentro del free tier Gemini)
    const ip = getClientIp(request);
    const limiter = rateLimit(`asistente:${ip}`, { maxAttempts: 10, windowSeconds: 60 });
    if (!limiter.success) {
      return NextResponse.json(
        { error: 'Demasiados mensajes. Espera un momento.' },
        { status: 429 },
      );
    }

    const body = await request.json();
    const userMessage = sanitizeString(body.message);
    if (!userMessage || userMessage.length < 1 || userMessage.length > 500) {
      return NextResponse.json({ error: 'Mensaje invalido (1-500 chars)' }, { status: 400 });
    }

    // Historial opcional (últimos 6 turns para context)
    const history: ChatMessage[] = Array.isArray(body.history)
      ? body.history
          .filter((h: unknown): h is ChatMessage =>
            typeof h === 'object' &&
            h !== null &&
            'role' in h &&
            'content' in h &&
            ['user', 'assistant'].includes((h as ChatMessage).role),
          )
          .slice(-6)
      : [];

    const messages: ChatMessage[] = [...history, { role: 'user', content: userMessage }];

    const apiKey = process.env.GEMINI_API_KEY;

    // Fallback: sin API key, respuesta canned
    if (!apiKey) {
      return NextResponse.json({
        reply: 'Aún no tengo IA configurada. Mientras tanto, contáctanos por WhatsApp al +56 9 1234 5678 para asistencia personalizada.',
        canned: true,
      });
    }

    const reply = await callGemini(messages, apiKey);

    return NextResponse.json({ reply });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[asistente-chat]', msg);
    return NextResponse.json(
      { error: 'Error procesando consulta. Intenta de nuevo o contáctanos por WhatsApp.' },
      { status: 500 },
    );
  }
}

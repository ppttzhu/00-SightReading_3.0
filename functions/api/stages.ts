interface Env {
  STAGES_KV: KVNamespace;
  CMS_SECRET: string;
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method === 'GET') {
    try {
      const data = await env.STAGES_KV.get('stages', 'text');
      return new Response(data || 'null', {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }

  if (request.method === 'POST') {
    const authToken = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (env.CMS_SECRET && authToken !== env.CMS_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    try {
      const data = await request.json();
      await env.STAGES_KV.put('stages', JSON.stringify(data));
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
};

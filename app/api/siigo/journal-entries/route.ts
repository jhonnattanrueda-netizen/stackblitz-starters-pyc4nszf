import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const username = process.env.SIIGO_USERNAME;
  const accessKey = process.env.SIIGO_ACCESS_KEY;
  const baseUrl = 'https://api.siigo.com';

  if (!username || !accessKey) {
    return NextResponse.json(
      { error: 'Credenciales de Siigo no configuradas en Vercel.' },
      { status: 401 }
    );
  }

  try {
    // 1. Autenticación con Siigo API
    const authRes = await fetch(`${baseUrl}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, access_key: accessKey }),
      cache: 'no-store',
    });

    const authData = await authRes.json();

    if (!authRes.ok) {
      return NextResponse.json(
        { error: 'Autenticación rechazada por Siigo.', detalle: authData },
        { status: authRes.status }
      );
    }

    const token = authData.access_token;

    // 2. Traer TODAS las páginas de comprobantes de Siigo (Paginación automática)
    let allResults: any[] = [];
    let currentPage = 1;
    let totalPages = 1;

    do {
      const entriesRes = await fetch(
        `${baseUrl}/v1/journals?page=${currentPage}&page_size=100`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Partner-Id': 'PortalConciliacion',
          },
          cache: 'no-store',
        }
      );

      if (!entriesRes.ok) break;

      const entriesData = await entriesRes.json();
      const pageResults = entriesData.results || [];
      allResults = [...allResults, ...pageResults];

      // Determinar total de páginas de la respuesta
      const totalResults = entriesData.pagination?.total_results || allResults.length;
      totalPages = Math.ceil(totalResults / 100);

      currentPage++;
    } while (currentPage <= totalPages && currentPage <= 10); // Límite de seguridad de 10 páginas (1000 registros)

    return NextResponse.json({
      pagination: { total_results: allResults.length },
      results: allResults,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Excepción de servidor', mensaje: error?.message || String(error) },
      { status: 500 }
    );
  }
}
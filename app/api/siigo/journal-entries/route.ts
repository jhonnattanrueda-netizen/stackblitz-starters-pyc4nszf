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

    // 2. Traer primera página filtrando directamente por fecha contable de documento (julio completo)
    const queryParams = 'date_start=2026-07-01&date_end=2026-07-31&page_size=100';
    const firstRes = await fetch(`${baseUrl}/v1/journals?page=1&${queryParams}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Partner-Id': 'PortalConciliacion',
      },
      cache: 'no-store',
    });

    if (!firstRes.ok) {
      return NextResponse.json({ pagination: { total_results: 0 }, results: [] });
    }

    const firstData = await firstRes.json();
    let allResults = firstData.results || [];
    const totalResults = firstData.pagination?.total_results || allResults.length;
    const totalPages = Math.ceil(totalResults / 100);

    // 3. Extracción paralela acelerada de todas las páginas restantes
    if (totalPages > 1) {
      const fetchPromises = [];
      for (let p = 2; p <= totalPages; p++) {
        fetchPromises.push(
          fetch(`${baseUrl}/v1/journals?page=${p}&${queryParams}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Partner-Id': 'PortalConciliacion',
            },
            cache: 'no-store',
          }).then((res) => (res.ok ? res.json() : { results: [] }))
        );
      }

      const pagesResponses = await Promise.all(fetchPromises);
      pagesResponses.forEach((pData) => {
        if (pData.results && Array.isArray(pData.results)) {
          allResults = [...allResults, ...pData.results];
        }
      });
    }

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
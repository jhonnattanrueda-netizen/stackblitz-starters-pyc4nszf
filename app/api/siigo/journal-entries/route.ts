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
    // 1. Autenticación en Siigo
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

    // 2. Primera petición para obtener total de páginas
    const firstRes = await fetch(
      `${baseUrl}/v1/journals?page=1&page_size=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Partner-Id': 'PortalConciliacion',
        },
        cache: 'no-store',
      }
    );

    if (!firstRes.ok) {
      return NextResponse.json({ pagination: { total_results: 0 }, results: [] });
    }

    const firstData = await firstRes.json();
    let allResults = firstData.results || [];
    const totalResults = firstData.pagination?.total_results || allResults.length;
    const totalPages = Math.ceil(totalResults / 100);

    // 3. Descarga de las páginas restantes
    if (totalPages > 1) {
      const pagePromises = [];
      for (let page = 2; page <= Math.min(totalPages, 25); page++) {
        pagePromises.push(
          fetch(`${baseUrl}/v1/journals?page=${page}&page_size=100`, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Partner-Id': 'PortalConciliacion',
            },
            cache: 'no-store',
          }).then((res) => (res.ok ? res.json() : { results: [] }))
        );
      }

      const pagesData = await Promise.all(pagePromises);
      pagesData.forEach((pData) => {
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
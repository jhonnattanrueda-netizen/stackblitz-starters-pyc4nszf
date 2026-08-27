import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const username = process.env.SIIGO_USERNAME;
  const accessKey = process.env.SIIGO_ACCESS_KEY;
  const baseUrl = 'https://api.siigo.com';

  if (!username || !accessKey) {
    return NextResponse.json(
      { error: 'Credenciales de Siigo no configuradas.' },
      { status: 401 }
    );
  }

  try {
    // 1. Autenticación directa
    const authRes = await fetch(`${baseUrl}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, access_key: accessKey }),
      cache: 'no-store',
    });

    const authData = await authRes.json();
    if (!authRes.ok) {
      return NextResponse.json({ error: 'Fallo de autenticación Siigo' }, { status: 401 });
    }

    const token = authData.access_token;
    let allResults: any[] = [];
    let currentPage = 1;
    let totalPages = 1;

    // 2. Extracción paginada sin caché
    do {
      const entriesRes = await fetch(
        `${baseUrl}/v1/journals?page=${currentPage}&page_size=100`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Partner-Id': 'PortalConciliacion',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
          cache: 'no-store',
        }
      );

      if (!entriesRes.ok) break;

      const entriesData = await entriesRes.json();
      const pageResults = entriesData.results || [];
      if (pageResults.length === 0) break;

      allResults = [...allResults, ...pageResults];
      const totalResults = entriesData.pagination?.total_results || allResults.length;
      totalPages = Math.ceil(totalResults / 100);

      currentPage++;
    } while (currentPage <= totalPages && currentPage <= 50);

    return NextResponse.json(
      { pagination: { total_results: allResults.length }, results: allResults },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Error del servidor', mensaje: error?.message || String(error) },
      { status: 500 }
    );
  }
}
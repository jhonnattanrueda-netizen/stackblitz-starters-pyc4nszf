import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isDebug = searchParams.get('debug') === 'true';

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
    const authRes = await fetch(`${baseUrl}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, access_key: accessKey }),
      cache: 'no-store',
    });

    const authData = await authRes.json();
    if (!authRes.ok) {
      return NextResponse.json({ error: 'Fallo de autenticación en Siigo' }, { status: 401 });
    }

    const token = authData.access_token;
    let allJournals: any[] = [];
    let currentPage = 1;
    let totalPages = 1;

    // Recorrido de todas las páginas de Siigo (2.142 registros)
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
      if (pageResults.length === 0) break;

      allJournals = [...allJournals, ...pageResults];
      const totalResults = entriesData.pagination?.total_results || allJournals.length;
      totalPages = Math.ceil(totalResults / 100);

      currentPage++;
    } while (currentPage <= totalPages && currentPage <= 35); // Trae hasta 3.500 comprobantes

    if (isDebug) {
      return NextResponse.json({
        total_obtenidos: allJournals.length,
        registros: allJournals,
      });
    }

    return NextResponse.json(
      { pagination: { total_results: allJournals.length }, results: allJournals },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Error interno en servidor', mensaje: error?.message || String(error) },
      { status: 500 }
    );
  }
}
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

    // 2. Traer un lote más amplio de comprobantes contables sin restringir por fecha de creación
    const entriesRes = await fetch(
      `${baseUrl}/v1/journals?page_size=250`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Partner-Id': 'PortalConciliacion',
        },
        cache: 'no-store',
      }
    );

    const entriesData = await entriesRes.json();
    return NextResponse.json(entriesData);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Excepción de servidor', mensaje: error?.message || String(error) },
      { status: 500 }
    );
  }
}
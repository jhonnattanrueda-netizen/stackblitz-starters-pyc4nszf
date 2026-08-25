import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const username = process.env.SIIGO_USERNAME;
  const accessKey = process.env.SIIGO_ACCESS_KEY;
  
  // URL base directa de Siigo sin depender de variables de entorno propensas a error
  const baseUrl = 'https://api.siigo.com';

  if (!username || !accessKey) {
    return NextResponse.json(
      { error: 'Credenciales de Siigo no configuradas en Vercel (SIIGO_USERNAME / SIIGO_ACCESS_KEY).' },
      { status: 401 }
    );
  }

  try {
    // 1. Autenticación con Siigo API
    const authRes = await fetch(`${baseUrl}/v1/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, access_key: accessKey }),
      cache: 'no-store',
    });

    const authData = await authRes.json();

    if (!authRes.ok) {
      return NextResponse.json(
        { error: 'Rechazado por Siigo Auth', detalle: authData },
        { status: authRes.status }
      );
    }

    const token = authData.access_token;

    // 2. Consulta de Comprobantes Contables
    const entriesRes = await fetch(
      `${baseUrl}/v1/journal-entries?created_start=2026-01-01&created_end=2026-12-31&page_size=100`,
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
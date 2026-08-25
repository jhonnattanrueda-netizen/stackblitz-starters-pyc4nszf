import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fechaInicio = searchParams.get('created_start') || '2026-01-01';
  const fechaFin = searchParams.get('created_end') || '2026-12-31';

  const username = process.env.SIIGO_USERNAME;
  const accessKey = process.env.SIIGO_ACCESS_KEY;
  const baseUrl = process.env.SIIGO_API_URL || 'https://api.siigo.com';

  // Si no existen variables en Vercel, la API responderá con un error claro
  if (!username || !accessKey) {
    return NextResponse.json(
      { error: 'Credenciales de Siigo no configuradas en el entorno (Vercel).' },
      { status: 500 }
    );
  }

  try {
    // 1. Obtener Token de autenticación de Siigo API
    const authRes = await fetch(`${baseUrl}/v1/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, access_key: accessKey }),
      cache: 'no-store',
    });

    if (!authRes.ok) {
      return NextResponse.json(
        { error: 'Falló la autenticación con las credenciales de Siigo.' },
        { status: authRes.status }
      );
    }

    const authData = await authRes.json();
    const token = authData.access_token;

    // 2. Traer Comprobantes de Siigo
    const entriesRes = await fetch(
      `${baseUrl}/v1/journal-entries?created_start=${fechaInicio}&created_end=${fechaFin}&page_size=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Partner-Id': 'PortalConciliacion',
        },
        cache: 'no-store',
      }
    );

    if (!entriesRes.ok) {
      return NextResponse.json(
        { error: 'No se pudieron consultar los comprobantes contables en Siigo.' },
        { status: entriesRes.status }
      );
    }

    const entriesData = await entriesRes.json();
    return NextResponse.json(entriesData);
  } catch (error) {
    return NextResponse.json(
      { error: 'Error de conexión interno con los servidores de Siigo.' },
      { status: 500 }
    );
  }
}
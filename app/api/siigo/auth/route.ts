import { NextResponse } from 'next/server';

interface SiigoAuthResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export async function POST() {
  const username = process.env.SIIGO_USERNAME;
  const accessKey = process.env.SIIGO_ACCESS_KEY;
  const baseUrl = process.env.SIIGO_API_URL || 'https://api.siigo.com';

  if (!username || !accessKey) {
    return NextResponse.json(
      { error: 'Faltan las credenciales de Siigo en las variables de entorno.' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(`${baseUrl}/v1/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        access_key: accessKey,
      }),
      // Evitamos cachear la respuesta de auth para obtener tokens válidos
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: 'Error al autenticar con Siigo',
          details: errorData,
        },
        { status: response.status }
      );
    }

    const data: SiigoAuthResponse = await response.json();

    return NextResponse.json({
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Error de conexión con el servidor de Siigo' },
      { status: 500 }
    );
  }
}
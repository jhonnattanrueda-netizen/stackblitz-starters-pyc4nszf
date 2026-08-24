export const getSiigoToken = async (): Promise<string> => {
  const res = await fetch('/api/siigo/auth', { method: 'POST' });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Error obteniendo el token');
  }

  return data.accessToken;
};

// Ejemplo de función para consultar comprobantes usando el token obtenido
export const fetchSiigoJournalEntries = async (
  token: string,
  fechaInicio: string,
  fechaFin: string
) => {
  const response = await fetch(
    `https://api.siigo.com/v1/journal-entries?created_start=${fechaInicio}&created_end=${fechaFin}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error('Error al consultar transacciones en Siigo');
  }

  return await response.json();
};
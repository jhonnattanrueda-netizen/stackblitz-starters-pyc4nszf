import { BankTransaction, SiigoTransaction, ConciliationItem, ConciliationSummary } from '../types/conciliacion';

export const conciliarMovimientos = (
  banco: BankTransaction[],
  siigo: SiigoTransaction[]
): { items: ConciliationItem[]; summary: ConciliationSummary } => {
  const items: ConciliationItem[] = [];
  const siigoUsados = new Set<string>();

  let exactos = 0;
  let parciales = 0;
  let discrepancias = 0;

  banco.forEach((b) => {
    // 1. Buscar coincidencia exacta en Monto
    const matchExacto = siigo.find((s) => {
      if (siigoUsados.has(s.id)) return false;
      
      const difMonto = Math.abs(b.monto - s.monto);
      return difMonto < 10; // Margen de tolerancia de 10 pesos por redondeos
    });

    if (matchExacto) {
      siigoUsados.add(matchExacto.id);
      exactos++;
      items.push({
        banco: b,
        siigo: matchExacto,
        estado: 'EXACTO',
        confianza: 100,
        observacion: 'Coincidencia exacta de monto con registro contable de Siigo.',
      });
      return;
    }

    // 2. Si no hay exacto, buscar coincidencia parcial por aproximación de monto
    const matchParcial = siigo.find((s) => {
      if (siigoUsados.has(s.id)) return false;
      
      const difMontoPct = Math.abs(b.monto - s.monto) / b.monto;
      return difMontoPct <= 0.02; // Tolerancia del 2%
    });

    if (matchParcial) {
      siigoUsados.add(matchParcial.id);
      parciales++;
      items.push({
        banco: b,
        siigo: matchParcial,
        estado: 'PARCIAL',
        confianza: 80,
        observacion: 'Diferencia menor en valor. Se requiere revisión manual.',
      });
      return;
    }

    // 3. Si no encuentra coincidencia contable
    discrepancias++;
    items.push({
      banco: b,
      siigo: null,
      estado: 'DISCREPANCIA',
      confianza: 0,
      observacion: 'Movimiento bancario no encontrado en los registros de Siigo.',
    });
  });

  const summary: ConciliationSummary = {
    exactos,
    parciales,
    discrepancias,
    pendientesBanco: banco.length - exactos - parciales,
    pendientesSiigo: siigo.length - siigoUsados.size,
  };

  return { items, summary };
};
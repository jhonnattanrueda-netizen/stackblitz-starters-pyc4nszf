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
    if (!b || isNaN(b.monto)) return;

    // 1. Coincidencia exacta de monto (tolerancia de $100 pesos)
    const matchExacto = siigo.find((s) => {
      if (siigoUsados.has(s.id) || isNaN(s.monto)) return false;
      return Math.abs(b.monto - s.monto) <= 100;
    });

    if (matchExacto) {
      siigoUsados.add(matchExacto.id);
      exactos++;
      items.push({
        banco: b,
        siigo: matchExacto,
        estado: 'EXACTO',
        confianza: 100,
        observacion: 'Coincidencia exacta de monto con registro de Siigo.',
      });
      return;
    }

    // 2. Coincidencia parcial por aproximación (tolerancia del 3%)
    const matchParcial = siigo.find((s) => {
      if (siigoUsados.has(s.id) || isNaN(s.monto) || b.monto === 0) return false;
      const difPct = Math.abs(b.monto - s.monto) / b.monto;
      return difPct <= 0.03;
    });

    if (matchParcial) {
      siigoUsados.add(matchParcial.id);
      parciales++;
      items.push({
        banco: b,
        siigo: matchParcial,
        estado: 'PARCIAL',
        confianza: 80,
        observacion: 'Monto cercano. Requiere revisión manual.',
      });
      return;
    }

    // 3. Movimiento no conciliado
    discrepancias++;
    items.push({
      banco: b,
      siigo: null,
      estado: 'DISCREPANCIA',
      confianza: 0,
      observacion: 'Sin coincidencia en los registros de Siigo.',
    });
  });

  const summary: ConciliationSummary = {
    exactos: exactos || 0,
    parciales: parciales || 0,
    discrepancias: discrepancias || 0,
    pendientesBanco: Math.max(0, banco.length - exactos - parciales),
    pendientesSiigo: Math.max(0, siigo.length - siigoUsados.size),
  };

  return { items, summary };
};
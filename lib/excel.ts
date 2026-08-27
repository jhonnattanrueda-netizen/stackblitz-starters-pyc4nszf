import * as XLSX from 'xlsx';
import { BankTransaction, SiigoTransaction } from '../types/conciliacion';

// 1. Parser para Extractos Bancarios o Preliminares
export const parseBankExcel = async (file: File): Promise<BankTransaction[]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  const transactions: BankTransaction[] = [];

  if (rawData.length === 0) return [];

  // Detectar si es una plantilla Preliminar sin encabezados
  const isPreliminar = rawData.some((row) => {
    return (
      row &&
      row.length >= 9 &&
      typeof row[3] === 'number' &&
      typeof row[4] === 'number' &&
      typeof row[5] === 'number' &&
      typeof row[6] === 'number'
    );
  });

  if (isPreliminar) {
    rawData.forEach((row, index) => {
      if (!row || row.length < 9) return;

      const dia = parseInt(row[3], 10);
      const mes = parseInt(row[4], 10);
      const ano = parseInt(row[5], 10);
      const valorRaw = row[6];
      const descripcion = String(row[8] || '').trim();
      const refExtra = String(row[9] || 'N/A').trim();

      if (!isNaN(dia) && !isNaN(mes) && !isNaN(ano) && descripcion && valorRaw !== undefined) {
        const fechaFormatted = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const montoNum = Math.abs(Number(valorRaw) || 0);
        const esNegativo = Number(valorRaw) < 0;

        if (montoNum > 0) {
          transactions.push({
            id: `bank-prelim-${index}-${Date.now()}`,
            fecha: fechaFormatted,
            referencia: refExtra !== 'undefined' ? refExtra : 'N/A',
            descripcion: descripcion,
            monto: montoNum,
            tipo: esNegativo ? 'CREDITO' : 'DEBITO',
          });
        }
      }
    });

    console.log(`[parseBankExcel] Preliminar detectado. ${transactions.length} movimientos parseados.`);
    return transactions;
  }

  // Parser Estándar Bancolombia
  let headerRowIndex = -1;
  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    if (row && row.some((cell) => String(cell).toUpperCase().includes('FECHA') || String(cell).toUpperCase().includes('DESCRIPCI'))) {
      headerRowIndex = i;
      break;
    }
  }

  const dataRows = headerRowIndex !== -1 ? rawData.slice(headerRowIndex + 1) : rawData;

  dataRows.forEach((row, index) => {
    if (!row || row.length < 2) return;

    const fechaRaw = String(row[0] || '').trim();
    const descripcion = String(row[1] || '').trim();
    let valorRaw = row[4] !== undefined ? row[4] : row[3];

    if (!descripcion || descripcion.toUpperCase().includes('DESCRIPCION') || fechaRaw.toUpperCase().includes('FECHA')) {
      return;
    }

    let montoNum = 0;
    let esNegativo = false;

    if (typeof valorRaw === 'number') {
      montoNum = Math.abs(valorRaw);
      esNegativo = valorRaw < 0;
    } else if (typeof valorRaw === 'string') {
      const cleanStr = valorRaw.replace(/\$/g, '').replace(/\s/g, '').trim();
      esNegativo = cleanStr.includes('-') || cleanStr.startsWith('-');
      const numStr = cleanStr.replace(/-/g, '').replace(/\./g, '').replace(',', '.');
      montoNum = parseFloat(numStr) || 0;
    }

    if (montoNum > 0) {
      transactions.push({
        id: `bank-${index}-${Date.now()}`,
        fecha: fechaRaw,
        referencia: String(row[3] || 'N/A').trim(),
        descripcion: descripcion,
        monto: montoNum,
        tipo: esNegativo ? 'CREDITO' : 'DEBITO',
      });
    }
  });

  console.log(`[parseBankExcel] Estándar Bancolombia. ${transactions.length} movimientos parseados de ${dataRows.length} filas revisadas.`);
  return transactions;
};

// 2. Parser Estricto y Tolerante a Filas Recortadas para Movimiento Auxiliar Siigo
export const parseSiigoAuxiliarExcel = async (file: File): Promise<SiigoTransaction[]> => {
  if (!file) {
    console.error('[parseSiigoAuxiliarExcel] No se recibió ningún archivo (file es null/undefined).');
    return [];
  }

  console.log(`[parseSiigoAuxiliarExcel] Leyendo archivo: ${file.name} (${file.size} bytes)`);

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];

  if (!worksheet) {
    console.error('[parseSiigoAuxiliarExcel] No se encontró ninguna hoja en el workbook.', workbook.SheetNames);
    return [];
  }

  const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: null });
  console.log(`[parseSiigoAuxiliarExcel] Filas crudas leídas: ${rawData.length}`);

  const items: SiigoTransaction[] = [];
  let filasFiltradas = 0;
  let filasSinMonto = 0;

  // Función auxiliar para convertir a número de forma robusta
  // Soporta: número directo, string con formato "1.234.567,89", string con formato "1234567.89", vacío/null
  const toNumber = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;

    let str = String(val).trim();
    if (str === '') return 0;

    // Quitar símbolos de moneda y espacios
    str = str.replace(/\$/g, '').replace(/\s/g, '');

    // Si tiene coma como separador decimal y punto como separador de miles (formato es-CO)
    if (/,\d{1,2}$/.test(str) && str.includes('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else if (/,\d{1,2}$/.test(str)) {
      // Solo coma decimal, sin puntos de miles
      str = str.replace(',', '.');
    } else {
      // Puede tener puntos de miles sin decimales, o ya estar en formato correcto
      str = str.replace(/,/g, '');
    }

    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  rawData.forEach((rowRaw, idx) => {
    if (!rowRaw) return;

    // Recortar celdas vacías/nulas al final de la fila (filas "recortadas")
    const row = [...rowRaw];
    while (row.length > 0 && (row[row.length - 1] === null || row[row.length - 1] === undefined || row[row.length - 1] === '')) {
      row.pop();
    }

    if (row.length < 5) return;

    // Columna A (Índice 0): Código contable
    const colA = String(row[0] ?? '').trim();
    const colALower = colA.toLowerCase();

    // Filtro de encabezados superiores y resúmenes de pie de página
    if (
      !colA ||
      colALower.includes('código contable') ||
      colALower.includes('codigo contable') ||
      colALower.includes('cuenta contable') ||
      colALower.includes('movimiento auxiliar') ||
      colALower.includes('autentic') ||
      colALower.includes('de agosto') ||
      colALower.includes('de julio') ||
      colALower.includes('total general') ||
      colALower.includes('procesado en')
    ) {
      filasFiltradas++;
      return;
    }

    // Mapeo según la estructura física A-P
    const comprobante = String(row[2] ?? '').trim();  // Columna C (Índice 2)
    const fecha = String(row[4] ?? '').trim();        // Columna E (Índice 4)
    const tercero = String(row[7] ?? '').trim();      // Columna H (Índice 7)
    const descripcion = String(row[8] ?? row[9] ?? '').trim(); // Columna I o J

    // Columna M (Índice 12): Débito | Columna N (Índice 13): Crédito
    const valDebito = toNumber(row[12]);
    const valCredito = toNumber(row[13]);

    if (valDebito > 0) {
      items.push({
        id: `siigo-aux-${idx}-d`,
        fecha,
        comprobante,
        tercero,
        observaciones: descripcion,
        monto: valDebito,
        tipo: 'DEBITO',
        cuentaCode: colA,
      });
    } else if (valCredito > 0) {
      items.push({
        id: `siigo-aux-${idx}-c`,
        fecha,
        comprobante,
        tercero,
        observaciones: descripcion,
        monto: valCredito,
        tipo: 'CREDITO',
        cuentaCode: colA,
      });
    } else {
      filasSinMonto++;
    }
  });

  console.log(
    `[parseSiigoAuxiliarExcel] Resultado: ${items.length} movimientos | ${filasFiltradas} filas filtradas (encabezados/resúmenes) | ${filasSinMonto} filas con débito y crédito en 0.`
  );

  return items;
};
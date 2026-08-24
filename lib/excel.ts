import * as XLSX from 'xlsx';
import { BankTransaction } from '../types/conciliacion';

export const parseBankExcel = (file: File): Promise<BankTransaction[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);

        const transactions: BankTransaction[] = rawRows.map((row, index) => {
          const montoRaw = Number(row['Monto'] || row['Valor'] || row['Importe'] || 0);
          
          return {
            id: `bank-${index}-${Date.now()}`,
            fecha: String(row['Fecha'] || ''),
            referencia: String(row['Referencia'] || row['Documento'] || row['Nro'] || ''),
            descripcion: String(row['Descripcion'] || row['Concepto'] || row['Detalle'] || ''),
            monto: Math.abs(montoRaw),
            tipo: montoRaw < 0 ? 'DEBITO' : 'CREDITO',
          };
        });

        resolve(transactions);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};
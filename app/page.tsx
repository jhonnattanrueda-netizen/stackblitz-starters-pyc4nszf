'use client';

import { useState, ChangeEvent, DragEvent } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { parseBankExcel } from '../lib/excel';
import { conciliarMovimientos } from '../lib/matcher';
import { 
  BankTransaction, 
  SiigoTransaction, 
  ConciliationItem, 
  ConciliationSummary 
} from '../types/conciliacion';
import ConciliationResults from '../components/ConciliationResults';

// Registros de respaldo en caso de no tener llaves API configuradas en Vercel
const FALLBACK_SIIGO: SiigoTransaction[] = [
  { id: 'siigo-1', fecha: '2026-08-01', comprobante: 'RC-1-1024', tercero: 'Comercializadora Alfa S.A.S.', observaciones: 'Pago factura N-5402', monto: 1500000, tipo: 'CREDITO' },
  { id: 'siigo-2', fecha: '2026-08-03', comprobante: 'CC-1-809', tercero: 'Empresas Públicas de Santander', observaciones: 'Pago energía', monto: 450000, tipo: 'DEBITO' },
  { id: 'siigo-3', fecha: '2026-08-05', comprobante: 'RC-1-1025', tercero: 'Inversiones Globales Ltda.', observaciones: 'Abono cartera', monto: 3200000, tipo: 'CREDITO' },
  { id: 'siigo-4', fecha: '2026-08-10', comprobante: 'CC-1-810', tercero: 'Distribuidora del Oriente', observaciones: 'Compra suministros', monto: 180000, tipo: 'DEBITO' },
  { id: 'siigo-5', fecha: '2026-08-12', comprobante: 'RC-1-1028', tercero: 'Servicios Integrales de Colombia', observaciones: 'Honorarios agosto', monto: 890000, tipo: 'CREDITO' },
];

export default function Home() {
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Estados de conciliación
  const [conciliationResults, setConciliationResults] = useState<ConciliationItem[] | null>(null);
  const [conciliationSummary, setConciliationSummary] = useState<ConciliationSummary | null>(null);

  const processFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/)) {
      setError('Formato no válido. Sube un archivo .xlsx, .xls o .csv');
      return;
    }

    setLoading(true);
    setError(null);
    setFileName(file.name);
    setConciliationResults(null);

    try {
      const parsedBankData = await parseBankExcel(file);
      setTransactions(parsedBankData);

      let siigoTransactions: SiigoTransaction[] = [];

      // Consulta a la API Route de Siigo
      try {
        const res = await fetch('/api/siigo/journal-entries');
        if (res.ok) {
          const data = await res.json();
          const results = data.results || [];

          if (results.length > 0) {
            siigoTransactions = results.map((entry: any, index: number) => ({
              id: entry.id || `siigo-${index}`,
              fecha: entry.date || '',
              comprobante: `${entry.name || 'RC'}-${entry.number || index}`,
              tercero: entry.customer?.name?.[0] || 'Tercero No Especificado',
              observaciones: entry.observations || 'Sin detalle',
              monto: Math.abs(Number(entry.items?.[0]?.value || 0)),
              tipo: entry.items?.[0]?.type === 'Credit' ? 'CREDITO' : 'DEBITO',
            }));
          } else {
            siigoTransactions = FALLBACK_SIIGO;
          }
        } else {
          siigoTransactions = FALLBACK_SIIGO;
        }
      } catch (apiErr) {
        siigoTransactions = FALLBACK_SIIGO;
      }

      // Procesar cruce de datos
      const { items, summary } = conciliarMovimientos(parsedBankData, siigoTransactions);
      setConciliationResults(items);
      setConciliationSummary(summary);
    } catch (err) {
      setError('Error al procesar el archivo Excel. Verifica el formato del documento.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleReset = () => {
    setTransactions([]);
    setFileName(null);
    setConciliationResults(null);
    setConciliationSummary(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-8">
      <header className="max-w-7xl mx-auto mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Layers className="w-8 h-8 text-indigo-600" />
            Portal de Conciliación Bancaria
          </h1>
          <p className="text-slate-500 mt-1">
            Cruce automático entre extracto bancario en Excel y registros contables de Siigo.
          </p>
        </div>

        {transactions.length > 0 && (
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Cargar otro extracto
          </button>
        )}
      </header>

      <main className="max-w-7xl mx-auto space-y-8">
        {/* Dropzone para archivos Excel */}
        {transactions.length === 0 && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all bg-white shadow-sm ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]'
                : 'border-slate-300 hover:border-slate-400'
            }`}
          >
            <input
              type="file"
              id="excel-upload"
              accept=".xlsx, .xls, .csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <label htmlFor="excel-upload" className="cursor-pointer flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 border border-indigo-100 shadow-inner">
                <Upload className="w-8 h-8" />
              </div>
              <span className="text-xl font-bold text-slate-800">
                Arrastra tu extracto bancario aquí
              </span>
              <span className="text-sm text-slate-500 mt-2 max-w-sm">
                Soporta archivos de Excel (.xlsx, .xls) o CSV exportados desde cualquier entidad bancaria.
              </span>
              <span className="mt-6 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl shadow-md transition-all">
                <FileSpreadsheet className="w-4 h-4" /> Seleccionar Archivo
              </span>
            </label>
          </div>
        )}

        {/* Notificación de procesando */}
        {loading && (
          <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center gap-3 text-slate-700">
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="font-semibold text-sm">Consultando información y realizando cruce de saldos...</span>
          </div>
        )}

        {/* Notificación de Error */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Componente de Resultados */}
        {conciliationResults && conciliationSummary && (
          <ConciliationResults results={conciliationResults} summary={conciliationSummary} />
        )}
      </main>
    </div>
  );
}
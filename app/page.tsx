'use client';

import { useState, ChangeEvent, DragEvent } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, RefreshCw, Layers, ArrowRightLeft } from 'lucide-react';
import { parseBankExcel } from '../lib/excel';
import { conciliarMovimientos } from '../lib/matcher';
import { 
  BankTransaction, 
  SiigoTransaction, 
  ConciliationItem, 
  ConciliationSummary 
} from '../types/conciliacion';
import ConciliationResults from '../components/ConciliationResults';
import ConsolidadorFinanciero from '../components/ConsolidadorFinanciero';

export default function Home() {
  // Estado para controlar la pestaña activa (Conciliación Bancaria vs Consolidador Financiero)
  const [tabActiva, setTabActiva] = useState<'conciliacion' | 'consolidador'>('conciliacion');

  // Estados para la Conciliación Bancaria
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const [conciliationResults, setConciliationResults] = useState<ConciliationItem[] | null>(null);
  const [conciliationSummary, setConciliationSummary] = useState<ConciliationSummary | null>(null);
  const [siigoDataRaw, setSiigoDataRaw] = useState<SiigoTransaction[]>([]);

  // Lógica de procesamiento e ingesta de información para Conciliación
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

      // Consulta a la API Route de Siigo Nube
      const res = await fetch('/api/siigo/journal-entries');
      if (!res.ok) throw new Error('No se pudo establecer la conexión con la API de Siigo.');

      const data = await res.json();
      const results = data.results || [];

      const extractedSiigoItems: SiigoTransaction[] = [];

      // Extracción y mapeo de naturaleza contable (Débito/Crédito)
      results.forEach((entry: any, entryIdx: number) => {
        const items = entry.items || [];

        items.forEach((item: any, itemIdx: number) => {
          const accountCode = String(item.account?.code || '').trim();
          
          if (accountCode.startsWith('11')) {
            const isCredit = item.movement === 'Credit';

            extractedSiigoItems.push({
              id: `${entry.id || entryIdx}-${itemIdx}-${item.account?.id || itemIdx}`,
              fecha: entry.date || '',
              comprobante: entry.name || entry.document?.name || `CC-${entry.number || entryIdx}`,
              tercero: item.customer?.identification || item.customer?.id || 'Tercero No Especificado',
              observaciones: item.description || entry.observations || 'Sin detalle',
              monto: Math.abs(Number(item.value || 0)),
              tipo: isCredit ? 'CREDITO' : 'DEBITO', // Preserva la naturaleza exacta devuelta por Siigo
              cuentaCode: accountCode,
            });
          }
        });
      });

      setSiigoDataRaw(extractedSiigoItems);

      const { items, summary } = conciliarMovimientos(parsedBankData, extractedSiigoItems);
      setConciliationResults(items);
      setConciliationSummary(summary);
    } catch (err: any) {
      setError(err?.message || 'Error al procesar la información de conciliación.');
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
    setSiigoDataRaw([]);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-8">
      {/* Encabezado Principal y Selector de Pestañas */}
      <header className="max-w-7xl mx-auto mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Layers className="w-8 h-8 text-indigo-600" />
            Portal Financiero y Contable
          </h1>
          <p className="text-slate-500 mt-1">
            Plataforma unificada para conciliación bancaria y consolidación de Estados Financieros.
          </p>
        </div>

        {/* Pestañas de Navegación */}
        <div className="flex bg-slate-200 p-1.5 rounded-2xl gap-1">
          <button
            onClick={() => setTabActiva('conciliacion')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              tabActiva === 'conciliacion'
                ? 'bg-white text-indigo-700 shadow-md scale-100'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" /> Conciliación Bancaria
          </button>

          <button
            onClick={() => setTabActiva('consolidador')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              tabActiva === 'consolidador'
                ? 'bg-white text-indigo-700 shadow-md scale-100'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" /> Consolidador Financiero
          </button>
        </div>
      </header>

      {/* Contenido Dinámico según la Pestaña Activa */}
      <main className="max-w-7xl mx-auto space-y-8">
        {tabActiva === 'conciliacion' ? (
          <>
            {/* Botón Reset de Extracto */}
            {transactions.length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  Cargar otro extracto
                </button>
              </div>
            )}

            {/* Carga de Archivo Extracto (Dropzone) */}
            {transactions.length === 0 && (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all bg-white shadow-sm ${
                  isDragging ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]' : 'border-slate-300 hover:border-slate-400'
                }`}
              >
                <input type="file" id="excel-upload" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileChange} />
                <label htmlFor="excel-upload" className="cursor-pointer flex flex-col items-center">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 border border-indigo-100 shadow-inner">
                    <Upload className="w-8 h-8" />
                  </div>
                  <span className="text-xl font-bold text-slate-800">Arrastra tu extracto bancario aquí</span>
                  <span className="text-sm text-slate-500 mt-2 max-w-sm">
                    Soporta archivos de Excel (.xlsx, .xls) o CSV exportados desde cualquier entidad bancaria.
                  </span>
                  <span className="mt-6 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl shadow-md transition-all">
                    <FileSpreadsheet className="w-4 h-4" /> Seleccionar Archivo
                  </span>
                </label>
              </div>
            )}

            {/* Spinner de Carga */}
            {loading && (
              <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center gap-3 text-slate-700">
                <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <span className="font-semibold text-sm">Consultando los comprobantes contables en Siigo Nube...</span>
              </div>
            )}

            {/* Mensaje de Error */}
            {error && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}

            {/* Tablas de Resultados de Conciliación */}
            {conciliationResults && conciliationSummary && (
              <ConciliationResults 
                results={conciliationResults} 
                summary={conciliationSummary} 
                siigoDataRaw={siigoDataRaw} 
                bankTransactions={transactions}
              />
            )}
          </>
        ) : (
          /* Render de la vista del Consolidador */
          <ConsolidadorFinanciero />
        )}
      </main>
    </div>
  );
}
'use client';

import { useState, ChangeEvent, DragEvent } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, RefreshCw, Layers, ArrowRightLeft, Search } from 'lucide-react';
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
  const [tabActiva, setTabActiva] = useState<'conciliacion' | 'consolidador'>('conciliacion');

  // Estados de fecha bajo demanda
  const [selectedMonth, setSelectedMonth] = useState<string>('07'); // Julio por defecto
  const [selectedYear, setSelectedYear] = useState<string>('2026');  // 2026 por defecto

  // Estados de datos
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const [conciliationResults, setConciliationResults] = useState<ConciliationItem[] | null>(null);
  const [conciliationSummary, setConciliationSummary] = useState<ConciliationSummary | null>(null);
  const [siigoDataRaw, setSiigoDataRaw] = useState<SiigoTransaction[]>([]);

  // 1. Carga inicial del Excel del Extracto Bancario
  const handleFileUpload = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/)) {
      setError('Formato no válido. Sube un archivo .xlsx, .xls o .csv');
      return;
    }

    try {
      setError(null);
      const parsedBankData = await parseBankExcel(file);
      setTransactions(parsedBankData);
    } catch (err: any) {
      setError('Error al procesar el archivo Excel.');
    }
  };

  // 2. Función que ejecuta la llamada a Siigo ÚNICAMENTE bajo la orden explícita del usuario
  const fetchSiigoDataOnDemand = async () => {
    if (transactions.length === 0) {
      setError('Por favor primero carga el archivo de extracto bancario.');
      return;
    }

    setLoading(true);
    setError(null);

    // Calcular el último día del mes seleccionado
    const lastDay = new Date(parseInt(selectedYear, 10), parseInt(selectedMonth, 10), 0).getDate();
    const startDate = `${selectedYear}-${selectedMonth}-01`;
    const endDate = `${selectedYear}-${selectedMonth}-${String(lastDay).padStart(2, '0')}`;

    try {
      const res = await fetch(
        `/api/siigo/journal-entries?startDate=${startDate}&endDate=${endDate}&t=${Date.now()}`,
        { cache: 'no-store' }
      );

      if (!res.ok) throw new Error('Error al conectar con el servidor de Siigo.');

      const data = await res.json();
      const results = data.results || [];

      const extractedSiigoItems: SiigoTransaction[] = [];

      results.forEach((entry: any, entryIdx: number) => {
        const items = entry.items || [];

        items.forEach((item: any, itemIdx: number) => {
          const accountCode = String(item.account?.code || '').trim();
          
          if (accountCode.startsWith('11')) {
            const movAttr = String(item.movement || item.type || '').trim();
            const esCredito = movAttr === 'Credit' || movAttr === 'credit' || movAttr === 'C';
            const montoVal = Math.abs(Number(item.value || item.debit || item.credit || 0));

            extractedSiigoItems.push({
              id: `${entry.id || entryIdx}-${itemIdx}-${item.account?.id || itemIdx}`,
              fecha: entry.date || '',
              comprobante: entry.name || entry.document?.name || `CC-${entry.number || entryIdx}`,
              tercero: item.customer?.identification || item.customer?.id || 'Tercero No Especificado',
              observaciones: item.description || entry.observations || 'Sin detalle',
              monto: montoVal,
              tipo: esCredito ? 'CREDITO' : 'DEBITO',
              cuentaCode: accountCode,
            });
          }
        });
      });

      setSiigoDataRaw(extractedSiigoItems);

      const { items, summary } = conciliarMovimientos(transactions, extractedSiigoItems);
      setConciliationResults(items);
      setConciliationSummary(summary);
    } catch (err: any) {
      setError(err?.message || 'Error al obtener registros de Siigo.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleReset = () => {
    setTransactions([]);
    setConciliationResults(null);
    setConciliationSummary(null);
    setSiigoDataRaw([]);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-8">
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

      <main className="max-w-7xl mx-auto space-y-8">
        {tabActiva === 'conciliacion' ? (
          <>
            {/* Panel de Selección de Periodo y Carga en Vivo */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Mes a Conciliar:</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="01">Enero</option>
                    <option value="02">Febrero</option>
                    <option value="03">Marzo</option>
                    <option value="04">Abril</option>
                    <option value="05">Mayo</option>
                    <option value="06">Junio</option>
                    <option value="07">Julio</option>
                    <option value="08">Agosto</option>
                    <option value="09">Septiembre</option>
                    <option value="10">Octubre</option>
                    <option value="11">Noviembre</option>
                    <option value="12">Diciembre</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Año:</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="2024">2024</option>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                  </select>
                </div>
              </div>

              {/* Botón Acción para disparar la consulta a Siigo */}
              <div className="flex items-center gap-3">
                {transactions.length > 0 && (
                  <button
                    onClick={handleReset}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Limpiar Todo
                  </button>
                )}

                <button
                  onClick={fetchSiigoDataOnDemand}
                  disabled={loading || transactions.length === 0}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-md transition-all ${
                    loading || transactions.length === 0
                      ? 'bg-slate-300 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'
                  }`}
                >
                  <Search className="w-4 h-4" />
                  {loading ? 'Consultando Siigo...' : '🔍 Traer Registros de Siigo'}
                </button>
              </div>
            </div>

            {/* Carga del Extracto Bancario */}
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
                  <span className="text-xl font-bold text-slate-800">1. Arrastra tu extracto bancario aquí</span>
                  <span className="text-sm text-slate-500 mt-2 max-w-sm">
                    Selecciona tu archivo Excel (.xlsx, .xls) de la entidad bancaria.
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
                <span className="font-semibold text-sm">Consultando los registros del periodo en Siigo Nube...</span>
              </div>
            )}

            {/* Mensajes de Error */}
            {error && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}

            {/* Muestra los Resultados ÚNICAMENTE cuando el usuario haya presionado el botón */}
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
          <ConsolidadorFinanciero />
        )}
      </main>
    </div>
  );
}
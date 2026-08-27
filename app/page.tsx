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

  const [selectedMonth, setSelectedMonth] = useState<string>('07');
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedAccount, setSelectedAccount] = useState<string>('11200501');

  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const [conciliationResults, setConciliationResults] = useState<ConciliationItem[] | null>(null);
  const [conciliationSummary, setConciliationSummary] = useState<ConciliationSummary | null>(null);
  const [siigoDataRaw, setSiigoDataRaw] = useState<SiigoTransaction[]>([]);

  const handleFileUpload = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/)) {
      setError('Formato no válido. Sube un archivo .xlsx, .xls o .csv');
      return;
    }

    try {
      setError(null);
      const parsedBankData = await parseBankExcel(file);
      setTransactions(parsedBankData);
    } catch (err) {
      setError('Error al procesar el archivo Excel.');
    }
  };

  // Traer exactamente la información auxiliar desde la API de Siigo Nube
  const fetchSiigoAuxiliarFromAPI = async () => {
    if (transactions.length === 0) {
      setError('Primero carga el archivo de extracto bancario.');
      return;
    }

    setLoading(true);
    setError(null);

    const lastDay = new Date(parseInt(selectedYear, 10), parseInt(selectedMonth, 10), 0).getDate();
    const startDate = `${selectedYear}-${selectedMonth}-01`;
    const endDate = `${selectedYear}-${selectedMonth}-${String(lastDay).padStart(2, '0')}`;

    try {
      const res = await fetch(
        `/api/siigo/journal-entries?accountCode=${selectedAccount}&startDate=${startDate}&endDate=${endDate}&t=${Date.now()}`,
        { cache: 'no-store' }
      );

      if (!res.ok) throw new Error('Error al conectar con Siigo.');

      const data = await res.json();
      const results = data.results || [];

      const extractedItems: SiigoTransaction[] = [];

      // Descomprimir cada movimiento individual por cuenta contable
      results.forEach((entry: any, entryIdx: number) => {
        const items = entry.items || [];

        items.forEach((item: any, itemIdx: number) => {
          const accountCode = String(item.account?.code || '').trim();
          
          // Filtrar por la cuenta contable objetivo (11200501)
          if (accountCode === selectedAccount || accountCode.startsWith('11')) {
            const valDebit = Number(item.debit || 0);
            const valCredit = Number(item.credit || 0);
            const movAttr = String(item.movement || item.type || '').trim();

            let esCredito = false;
            let montoAbsoluto = 0;

            // Mapeo idéntico al Auxiliar por Cuenta Contable
            if (valDebit > 0) {
              esCredito = false;
              montoAbsoluto = valDebit;
            } else if (valCredit > 0) {
              esCredito = true;
              montoAbsoluto = valCredit;
            } else if (movAttr === 'Credit' || movAttr === 'credit' || movAttr === 'C') {
              esCredito = true;
              montoAbsoluto = Math.abs(Number(item.value || 0));
            } else {
              esCredito = false;
              montoAbsoluto = Math.abs(Number(item.value || 0));
            }

            extractedItems.push({
              id: `siigo-api-${entry.id || entryIdx}-${itemIdx}`,
              fecha: entry.date || '',
              comprobante: entry.name || entry.document?.name || `CC-${entry.number || entryIdx}`,
              tercero: item.customer?.identification || item.customer?.id || 'Tercero No Especificado',
              observaciones: item.description || entry.observations || 'Sin detalle',
              monto: montoAbsoluto,
              tipo: esCredito ? 'CREDITO' : 'DEBITO',
              cuentaCode: accountCode,
            });
          }
        });
      });

      setSiigoDataRaw(extractedItems);

      const { items, summary } = conciliarMovimientos(transactions, extractedItems);
      setConciliationResults(items);
      setConciliationSummary(summary);
    } catch (err: any) {
      setError(err?.message || 'Error al obtener registros del auxiliar de Siigo.');
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
    setSiigoDataRaw([]);
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
            {/* Panel de Filtros por Fecha y Cuenta Auxiliar */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Mes:</label>
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

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Cuenta Contable Siigo:</label>
                  <input
                    type="text"
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                    className="bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    placeholder="11200501"
                  />
                </div>
              </div>

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
                  onClick={fetchSiigoAuxiliarFromAPI}
                  disabled={loading || transactions.length === 0}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-md transition-all ${
                    loading || transactions.length === 0
                      ? 'bg-slate-300 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'
                  }`}
                >
                  <Search className="w-4 h-4" />
                  {loading ? 'Consultando Auxiliar...' : '🔍 Traer Movimiento Auxiliar Siigo'}
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
                    Carga tu extracto de banco en Excel (.xlsx, .xls) o CSV.
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
                <span className="font-semibold text-sm">Consultando los movimientos auxiliares de la cuenta {selectedAccount} en Siigo...</span>
              </div>
            )}

            {/* Mensajes de Error */}
            {error && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}

            {/* Render de Resultados */}
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
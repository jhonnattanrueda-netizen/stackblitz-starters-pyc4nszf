'use client';

import { useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, RefreshCw, Layers, ArrowRightLeft, FileCheck, Zap } from 'lucide-react';
import { parseBankExcel, parseSiigoAuxiliarExcel } from '../lib/excel';
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

  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [siigoDataRaw, setSiigoDataRaw] = useState<SiigoTransaction[]>([]);
  const [bankFileName, setBankFileName] = useState<string | null>(null);
  const [siigoFileName, setSiigoFileName] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [conciliationResults, setConciliationResults] = useState<ConciliationItem[] | null>(null);
  const [conciliationSummary, setConciliationSummary] = useState<ConciliationSummary | null>(null);

  // Carga del Extracto o Preliminar Bancario (Local)
  const handleBankFileUpload = async (file: File) => {
    try {
      setError(null);
      setBankFileName(file.name);
      const parsedBankData = await parseBankExcel(file);
      setTransactions(parsedBankData);

      if (siigoDataRaw.length > 0) {
        const { items, summary } = conciliarMovimientos(parsedBankData, siigoDataRaw);
        setConciliationResults(items);
        setConciliationSummary(summary);
      }
    } catch (err) {
      setError('Error al procesar el archivo del extracto bancario.');
    }
  };

  // Carga del Auxiliar Contable en Excel (Local puro, sin peticiones a Siigo)
  const handleSiigoAuxiliarUpload = async (file: File) => {
    try {
      setError(null);
      setSiigoFileName(file.name);
      const parsedSiigoData = await parseSiigoAuxiliarExcel(file);
      setSiigoDataRaw(parsedSiigoData);

      if (transactions.length > 0) {
        const { items, summary } = conciliarMovimientos(transactions, parsedSiigoData);
        setConciliationResults(items);
        setConciliationSummary(summary);
      }
    } catch (err) {
      setError('Error al procesar el archivo de Movimiento Auxiliar en Excel.');
    }
  };

  // Autoconciliación manual
  const ejecutarAutoConciliacion = () => {
    if (transactions.length === 0 || siigoDataRaw.length === 0) {
      setError('Carga tanto el Extracto Bancario como el Auxiliar Contable en Excel para autoconciliar.');
      return;
    }

    setError(null);
    const { items, summary } = conciliarMovimientos(transactions, siigoDataRaw);
    setConciliationResults(items);
    setConciliationSummary(summary);
  };

  const handleReset = () => {
    setTransactions([]);
    setSiigoDataRaw([]);
    setBankFileName(null);
    setSiigoFileName(null);
    setConciliationResults(null);
    setConciliationSummary(null);
    setError(null);
  };

  // Fallback visual para mostrar las tablas desde que se carga cualquier archivo
  const displayResults: ConciliationItem[] = conciliationResults || [
    ...transactions.map((b) => ({
      id: b.id,
      bankTransaction: b,
      estado: 'PENDIENTE_BANCO' as const,
      diferencia: b.monto,
      motivo: 'Movimiento en banco pendiente por cruzar',
    })),
    ...siigoDataRaw.map((s) => ({
      id: s.id,
      siigoTransaction: s,
      estado: 'PENDIENTE_SIIGO' as const,
      diferencia: s.monto,
      motivo: 'Movimiento contable pendiente por cruzar',
    })),
  ];

  const displaySummary: ConciliationSummary = conciliationSummary || {
    totalBanco: transactions.reduce((acc, b) => acc + (b.tipo === 'DEBITO' ? b.monto : -b.monto), 0),
    totalSiigo: siigoDataRaw.reduce((acc, s) => acc + (s.tipo === 'DEBITO' ? s.monto : -s.monto), 0),
    diferenciaTotal: 0,
    totalConciliados: 0,
    totalPendientesBanco: transactions.length,
    totalPendientesSiigo: siigoDataRaw.length,
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
            {/* Carga de Archivos Locales */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl border-2 border-indigo-100 shadow-sm text-center flex flex-col items-center justify-between">
                <div>
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-indigo-100">
                    <Upload className="w-7 h-7" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm">1. Extracto o Preliminar Bancario (Excel)</h3>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                    {bankFileName ? `✓ ${bankFileName} (${transactions.length} registros)` : 'Sube el extracto descargado del banco.'}
                  </p>
                </div>
                <label className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer transition-all shadow-md inline-flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  {bankFileName ? 'Cambiar Extracto' : 'Cargar Extracto'}
                  <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleBankFileUpload(e.target.files[0])} />
                </label>
              </div>

              <div className="bg-white p-6 rounded-2xl border-2 border-emerald-100 shadow-sm text-center flex flex-col items-center justify-between">
                <div>
                  <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-emerald-100">
                    <FileCheck className="w-7 h-7" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm">2. Auxiliar por Cuenta (Excel)</h3>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                    {siigoFileName ? `✓ ${siigoFileName} (${siigoDataRaw.length} movimientos)` : 'Sube el archivo Excel de Movimiento Auxiliar.'}
                  </p>
                </div>
                <label className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer transition-all shadow-md inline-flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  {siigoFileName ? 'Cambiar Auxiliar' : 'Cargar Auxiliar Excel'}
                  <input type="file" accept=".xlsx, .xls" className="hidden" onChange={(e) => e.target.files?.[0] && handleSiigoAuxiliarUpload(e.target.files[0])} />
                </label>
              </div>
            </div>

            {/* Barra de Control y Acciones */}
            {(transactions.length > 0 || siigoDataRaw.length > 0) && (
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-4">
                <div className="text-xs font-medium text-slate-600">
                  Registros cargados: <span className="font-bold text-slate-800">{transactions.length}</span> del Banco y <span className="font-bold text-slate-800">{siigoDataRaw.length}</span> del Auxiliar Contable.
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleReset}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Limpiar Todo
                  </button>

                  <button
                    onClick={ejecutarAutoConciliacion}
                    disabled={transactions.length === 0 || siigoDataRaw.length === 0}
                    className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs text-white shadow-md transition-all ${
                      transactions.length === 0 || siigoDataRaw.length === 0
                        ? 'bg-slate-300 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'
                    }`}
                  >
                    <Zap className="w-4 h-4" /> ⚡ Autoconciliar y Cruza de Saldos
                  </button>
                </div>
              </div>
            )}

            {/* Mensaje de Error */}
            {error && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}

            {/* Tablas de Información y Cruce siempre activas */}
            {(transactions.length > 0 || siigoDataRaw.length > 0) && (
              <ConciliationResults 
                results={displayResults} 
                summary={displaySummary} 
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
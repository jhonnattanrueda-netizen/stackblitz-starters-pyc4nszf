'use client';

import { useState, useMemo, useEffect } from 'react';
import { ConciliationItem, ConciliationSummary, BankTransaction, SiigoTransaction } from '../types/conciliacion';
import { Search, Check, RefreshCw } from 'lucide-react';

interface Props {
  results: ConciliationItem[];
  summary: ConciliationSummary;
  siigoDataRaw: SiigoTransaction[];
  bankTransactions: BankTransaction[];
}

const parseDocumentDateToISO = (dateStr: string, defaultYear = 2026): string => {
  if (!dateStr) return '';
  const clean = dateStr.trim();

  if (clean.match(/^\d{4}-\d{2}-\d{2}/)) {
    return clean.substring(0, 10);
  }

  const parts = clean.split(/[/.-]/);
  if (parts.length >= 2) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10);
    let year = parts[2] ? parseInt(parts[2], 10) : defaultYear;

    if (parts[0].length === 4) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    }

    if (year < 100) year += 2000;

    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return '';
};

export default function ConciliationResults({ siigoDataRaw, bankTransactions }: Props) {
  const availableAccounts = useMemo(() => {
    const codes = new Set<string>();
    siigoDataRaw.forEach((item) => {
      if (item.cuentaCode) codes.add(item.cuentaCode);
    });
    return Array.from(codes).sort();
  }, [siigoDataRaw]);

  const [startDate, setStartDate] = useState<string>('2026-07-01');
  const [endDate, setEndDate] = useState<string>('2026-07-31');
  const [selectedAccountCode, setSelectedAccountCode] = useState<string>('11200501');

  const [pendingBank, setPendingBank] = useState<BankTransaction[]>([]);
  const [pendingSiigo, setPendingSiigo] = useState<SiigoTransaction[]>([]);
  const [conciliatedCount, setConciliatedCount] = useState<number>(0);

  useEffect(() => {
    const startISO = startDate ? parseDocumentDateToISO(startDate) : '';
    const endISO = endDate ? parseDocumentDateToISO(endDate) : '';
    const currentFilterYear = startDate ? parseInt(startDate.split('-')[0], 10) : 2026;

    const filteredBank = bankTransactions.filter((b) => {
      const bISO = parseDocumentDateToISO(b.fecha, currentFilterYear);
      if (!bISO) return true;
      if (startISO && bISO < startISO) return false;
      if (endISO && bISO > endISO) return false;
      return true;
    });

    const filteredSiigo = siigoDataRaw.filter((s) => {
      const matchAccount = selectedAccountCode === 'ALL' || s.cuentaCode === selectedAccountCode;
      if (!matchAccount) return false;

      const docDateISO = parseDocumentDateToISO(s.fecha);
      if (!docDateISO) return true;
      if (startISO && docDateISO < startISO) return false;
      if (endISO && docDateISO > endISO) return false;

      return true;
    });

    setPendingBank(filteredBank);
    setPendingSiigo(filteredSiigo);
    setConciliatedCount(0);
  }, [startDate, endDate, selectedAccountCode, bankTransactions, siigoDataRaw]);

  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [selectedSiigoId, setSelectedSiigoId] = useState<string | null>(null);

  const [bankSearch, setBankSearch] = useState('');
  const [siigoSearch, setSiigoSearch] = useState('');

  const filteredBankView = useMemo(() => {
    return pendingBank.filter((item) =>
      (item.descripcion || '').toLowerCase().includes(bankSearch.toLowerCase())
    );
  }, [pendingBank, bankSearch]);

  const filteredSiigoView = useMemo(() => {
    return pendingSiigo.filter((item) =>
      (item.comprobante || '').toLowerCase().includes(siigoSearch.toLowerCase()) ||
      (item.tercero || '').toLowerCase().includes(siigoSearch.toLowerCase()) ||
      (item.observaciones || '').toLowerCase().includes(siigoSearch.toLowerCase())
    );
  }, [pendingSiigo, siigoSearch]);

  const totalSaldoBank = useMemo(() => pendingBank.reduce((acc, curr) => acc + curr.monto, 0), [pendingBank]);
  const totalSaldoSiigo = useMemo(() => pendingSiigo.reduce((acc, curr) => acc + curr.monto, 0), [pendingSiigo]);
  const diferencia = Math.abs(totalSaldoBank - totalSaldoSiigo);

  const handleConciliate = () => {
    if (!selectedBankId || !selectedSiigoId) return;

    setPendingBank((prev) => prev.filter((item) => item.id !== selectedBankId));
    setPendingSiigo((prev) => prev.filter((item) => item.id !== selectedSiigoId));
    setConciliatedCount((prev) => prev + 1);

    setSelectedBankId(null);
    setSelectedSiigoId(null);
  };

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedAccountCode('ALL');
  };

  return (
    <div className="space-y-6">
      {/* Controles de Filtros */}
      <div className="flex flex-wrap justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <button
          onClick={handleClearFilters}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 border border-slate-200 px-3 py-2 rounded-xl transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Mostrar Todos los Registros
        </button>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600 uppercase">Desde:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-indigo-50 text-indigo-900 border border-indigo-200 font-semibold text-xs px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600 uppercase">Hasta:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-indigo-50 text-indigo-900 border border-indigo-200 font-semibold text-xs px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600 uppercase">Cuenta Siigo:</label>
            <select
              value={selectedAccountCode}
              onChange={(e) => setSelectedAccountCode(e.target.value)}
              className="bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="ALL">Todas las Cuentas (1105 - 1145)</option>
              {availableAccounts.map((code) => (
                <option key={code} value={code}>
                  Cuenta {code}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Buscadores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar en Extracto..."
            value={bankSearch}
            onChange={(e) => setBankSearch(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar Comprobante / Tercero en Siigo..."
            value={siigoSearch}
            onChange={(e) => setSiigoSearch(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
      </div>

      {/* Tablas Principales en 2 Columnas (Fecha - Concepto - Débito - Crédito) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tabla Extracto Bancario */}
        <div className="bg-white border-2 border-indigo-200 rounded-2xl shadow-sm flex flex-col h-[520px] overflow-hidden">
          <div className="bg-indigo-600 text-white px-5 py-3 font-bold text-sm tracking-wide">
            Información Extracto ({filteredBankView.length})
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="p-3 w-20">Fecha</th>
                  <th className="p-3">Concepto</th>
                  <th className="p-3 text-right text-emerald-700 w-24">Débito</th>
                  <th className="p-3 text-right text-rose-700 w-24">Crédito</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredBankView.map((item) => {
                  const isSelected = selectedBankId === item.id;
                  const isDebito = item.tipo === 'DEBITO';

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedBankId(isSelected ? null : item.id)}
                      className={`cursor-pointer transition-all ${
                        isSelected ? 'bg-indigo-50 border-indigo-500 font-semibold' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="p-3 font-mono text-slate-500">{item.fecha}</td>
                      <td className="p-3">
                        <p className="font-semibold text-slate-800 line-clamp-1">{item.descripcion}</p>
                        <span className="text-[10px] text-slate-400">Ref: {item.referencia}</span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600">
                        {isDebito ? `$${item.monto.toLocaleString('es-CO')}` : '-'}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-rose-600">
                        {!isDebito ? `$${item.monto.toLocaleString('es-CO')}` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabla Movimientos Siigo */}
        <div className="bg-white border-2 border-indigo-200 rounded-2xl shadow-sm flex flex-col h-[520px] overflow-hidden">
          <div className="bg-indigo-600 text-white px-5 py-3 font-bold text-sm tracking-wide flex justify-between items-center">
            <span>Información Movimientos Siigo ({filteredSiigoView.length})</span>
            <span className="text-xs bg-indigo-500 text-white px-2 py-0.5 rounded font-mono">
              {selectedAccountCode === 'ALL' ? 'Grupo 1105-1145' : `Cta: ${selectedAccountCode}`}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="p-3 w-20">Fecha</th>
                  <th className="p-3">Concepto</th>
                  <th className="p-3 text-right text-emerald-700 w-24">Débito</th>
                  <th className="p-3 text-right text-rose-700 w-24">Crédito</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredSiigoView.map((item) => {
                  const isSelected = selectedSiigoId === item.id;
                  const isDebito = item.tipo === 'DEBITO';

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedSiigoId(isSelected ? null : item.id)}
                      className={`cursor-pointer transition-all ${
                        isSelected ? 'bg-indigo-50 border-indigo-500 font-semibold' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="p-3 font-mono text-slate-500">{item.fecha}</td>
                      <td className="p-3">
                        <p className="font-semibold text-slate-800 line-clamp-1">{item.comprobante} - {item.tercero}</p>
                        <p className="text-[10px] text-slate-400 line-clamp-1">{item.observaciones}</p>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600">
                        {isDebito ? `$${item.monto.toLocaleString('es-CO')}` : '-'}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-rose-600">
                        {!isDebito ? `$${item.monto.toLocaleString('es-CO')}` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Footer Saldos y Diferencia */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center pt-2">
        <div className="bg-indigo-600 text-white p-4 rounded-xl shadow-sm text-center">
          <span className="text-xs font-semibold uppercase opacity-80 block">Saldo Final Extracto</span>
          <p className="text-xl font-bold mt-1">${totalSaldoBank.toLocaleString('es-CO')}</p>
        </div>

        <div className="bg-slate-800 text-white p-4 rounded-xl shadow-sm text-center">
          <span className="text-xs font-semibold uppercase text-slate-400 block">Diferencia Extracto vs Siigo</span>
          <p className={`text-xl font-bold mt-1 ${diferencia === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
            ${diferencia.toLocaleString('es-CO')}
          </p>
        </div>

        <div className="bg-indigo-600 text-white p-4 rounded-xl shadow-sm text-center">
          <span className="text-xs font-semibold uppercase opacity-80 block">Saldo Final Siigo</span>
          <p className="text-xl font-bold mt-1">${totalSaldoSiigo.toLocaleString('es-CO')}</p>
        </div>
      </div>

      {/* Botón Accionar Conciliación */}
      <div className="flex justify-center pt-2">
        <button
          onClick={handleConciliate}
          disabled={!selectedBankId || !selectedSiigoId}
          className={`px-8 py-3.5 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center gap-2 ${
            selectedBankId && selectedSiigoId
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white scale-105 cursor-pointer ring-4 ring-emerald-100'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          <Check className="w-5 h-5" />
          {selectedBankId && selectedSiigoId ? 'Conciliar Selección' : 'Selecciona 1 movimiento de cada lado'}
        </button>
      </div>
    </div>
  );
}
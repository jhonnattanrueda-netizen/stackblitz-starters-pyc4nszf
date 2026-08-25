'use client';

import { useState, useMemo, useEffect } from 'react';
import { ConciliationItem, ConciliationSummary, BankTransaction, SiigoTransaction } from '../types/conciliacion';
import { Search, Calendar, Check } from 'lucide-react';

interface Props {
  results: ConciliationItem[];
  summary: ConciliationSummary;
  siigoDataRaw: SiigoTransaction[];
  bankTransactions: BankTransaction[];
}

// Convierte cualquier formato (YYYY-MM-DD, DD/MM/YYYY) a formato ISO estándar YYYY-MM-DD
const normalizeDateToISO = (dateStr: string): string => {
  if (!dateStr) return '';
  const cleanStr = dateStr.trim();

  if (cleanStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    return cleanStr.substring(0, 10);
  }

  const parts = cleanStr.split(/[/.-]/);
  if (parts.length >= 3) {
    let day = parts[0];
    let month = parts[1];
    let year = parts[2];

    if (parts[0].length === 4) {
      year = parts[0];
      month = parts[1];
      day = parts[2];
    }

    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return cleanStr;
};

export default function ConciliationResults({ siigoDataRaw, bankTransactions }: Props) {
  // Cuentas disponibles
  const availableAccounts = useMemo(() => {
    const codes = new Set<string>();
    siigoDataRaw.forEach((item) => {
      if (item.cuentaCode) codes.add(item.cuentaCode);
    });
    return Array.from(codes).sort();
  }, [siigoDataRaw]);

  // Controles de Selección de Rango de Fechas (Defecto mes completo actual)
  const [startDate, setStartDate] = useState<string>('2026-07-01');
  const [endDate, setEndDate] = useState<string>('2026-07-31');
  const [selectedAccountCode, setSelectedAccountCode] = useState<string>('ALL');

  // Listas activas pendientes
  const [pendingBank, setPendingBank] = useState<BankTransaction[]>([]);
  const [pendingSiigo, setPendingSiigo] = useState<SiigoTransaction[]>([]);
  const [conciliatedCount, setConciliatedCount] = useState<number>(0);

  // Filtrado reactivo según Rango de Fechas y Cuenta Seleccionada
  useEffect(() => {
    const startISO = startDate ? normalizeDateToISO(startDate) : '';
    const endISO = endDate ? normalizeDateToISO(endDate) : '';

    // Filtrar Banco por rango de fechas
    const filteredBank = bankTransactions.filter((b) => {
      const bankDateISO = normalizeDateToISO(b.fecha);
      if (startISO && bankDateISO < startISO) return false;
      if (endISO && bankDateISO > endISO) return false;
      return true;
    });

    // Filtrar Siigo por cuenta y rango de fechas
    const filteredSiigo = siigoDataRaw.filter((s) => {
      const matchAccount = selectedAccountCode === 'ALL' || s.cuentaCode === selectedAccountCode;
      if (!matchAccount) return false;

      const siigoDateISO = normalizeDateToISO(s.fecha);
      if (startISO && siigoDateISO < startISO) return false;
      if (endISO && siigoDateISO > endISO) return false;

      return true;
    });

    setPendingBank(filteredBank);
    setPendingSiigo(filteredSiigo);
    setConciliatedCount(0);
  }, [startDate, endDate, selectedAccountCode, bankTransactions, siigoDataRaw]);

  // Selección manual de filas
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [selectedSiigoId, setSelectedSiigoId] = useState<string | null>(null);

  // Buscadores de texto
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

  // Saldos acumulados
  const totalSaldoBank = useMemo(() => pendingBank.reduce((acc, curr) => acc + curr.monto, 0), [pendingBank]);
  const totalSaldoSiigo = useMemo(() => pendingSiigo.reduce((acc, curr) => acc + curr.monto, 0), [pendingSiigo]);
  const diferencia = Math.abs(totalSaldoBank - totalSaldoSiigo);

  // Acción manual para conciliar
  const handleConciliate = () => {
    if (!selectedBankId || !selectedSiigoId) return;

    setPendingBank((prev) => prev.filter((item) => item.id !== selectedBankId));
    setPendingSiigo((prev) => prev.filter((item) => item.id !== selectedSiigoId));
    setConciliatedCount((prev) => prev + 1);

    setSelectedBankId(null);
    setSelectedSiigoId(null);
  };

  return (
    <div className="space-y-6">
      {/* Barra de Filtros: Rango de Fechas + Selector de Cuenta */}
      <div className="flex flex-wrap justify-end items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        {/* Fecha Desde */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-600 uppercase">Desde:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-indigo-50 text-indigo-900 border border-indigo-200 font-semibold text-xs px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {/* Fecha Hasta */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-600 uppercase">Hasta:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-indigo-50 text-indigo-900 border border-indigo-200 font-semibold text-xs px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {/* Selector de Cuenta Siigo */}
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

      {/* Tarjetas de Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">Conciliados Manuales</span>
          <p className="text-3xl font-extrabold text-emerald-600 mt-2">{conciliatedCount}</p>
          <span className="text-xs text-slate-500 mt-1 block">Movimientos cruzados</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">Revisión Parcial</span>
          <p className="text-3xl font-extrabold text-amber-500 mt-2">0</p>
          <span className="text-xs text-slate-500 mt-1 block">Sin autoconciliación</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">Pendientes en Banco</span>
          <p className="text-3xl font-extrabold text-rose-500 mt-2">{pendingBank.length}</p>
          <span className="text-xs text-slate-500 mt-1 block">En el rango seleccionado</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">Pendientes en Siigo</span>
          <p className="text-3xl font-extrabold text-indigo-600 mt-2">{pendingSiigo.length}</p>
          <span className="text-xs text-slate-500 mt-1 block">En la cuenta seleccionada</span>
        </div>
      </div>

      {/* Buscadores de Texto */}
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

      {/* Columnas Principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Banco */}
        <div className="bg-white border-2 border-indigo-200 rounded-2xl shadow-sm flex flex-col h-[500px]">
          <div className="bg-indigo-600 text-white px-5 py-3.5 rounded-t-xl font-bold text-sm tracking-wide">
            Información Extracto ({filteredBankView.length})
          </div>
          <div className="p-4 flex-1 overflow-y-auto space-y-2 divide-y divide-slate-100">
            {filteredBankView.map((item) => {
              const isSelected = selectedBankId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedBankId(isSelected ? null : item.id)}
                  className={`p-3.5 rounded-xl cursor-pointer transition-all border flex items-center justify-between ${
                    isSelected ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-200 shadow-sm' : 'border-slate-100 hover:bg-slate-50'
                  }`}
                >
                  <div className="space-y-1">
                    <p className="font-semibold text-xs text-slate-800">{item.descripcion}</p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span>{item.fecha}</span>
                      <span>•</span>
                      <span>Ref: {item.referencia}</span>
                    </div>
                  </div>
                  <span className="font-extrabold text-sm text-slate-900">${item.monto.toLocaleString('es-CO')}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Siigo */}
        <div className="bg-white border-2 border-indigo-200 rounded-2xl shadow-sm flex flex-col h-[500px]">
          <div className="bg-indigo-600 text-white px-5 py-3.5 rounded-t-xl font-bold text-sm tracking-wide flex justify-between items-center">
            <span>Información Movimientos Siigo ({filteredSiigoView.length})</span>
            <span className="text-xs bg-indigo-500 text-white px-2.5 py-1 rounded-md font-mono">
              {selectedAccountCode === 'ALL' ? 'Grupo 1105-1145' : `Cta: ${selectedAccountCode}`}
            </span>
          </div>
          <div className="p-4 flex-1 overflow-y-auto space-y-2 divide-y divide-slate-100">
            {filteredSiigoView.map((item) => {
              const isSelected = selectedSiigoId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedSiigoId(isSelected ? null : item.id)}
                  className={`p-3.5 rounded-xl cursor-pointer transition-all border flex items-center justify-between ${
                    isSelected ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-200 shadow-sm' : 'border-slate-100 hover:bg-slate-50'
                  }`}
                >
                  <div className="space-y-1">
                    <p className="font-semibold text-xs text-slate-800">{item.comprobante} - {item.tercero}</p>
                    <p className="text-[11px] text-slate-500 line-clamp-1">{item.observaciones}</p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span>{item.fecha}</span>
                      {item.cuentaCode && (
                        <>
                          <span>•</span>
                          <span className="text-indigo-600 font-semibold">Cta: {item.cuentaCode}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="font-extrabold text-sm text-slate-900">${item.monto.toLocaleString('es-CO')}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Saldos */}
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

      {/* Botón Accionar */}
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
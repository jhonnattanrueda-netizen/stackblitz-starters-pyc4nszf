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

const MESES = [
  { label: 'Todos los Meses', value: 'ALL' },
  { label: 'Enero', value: '01' },
  { label: 'Febrero', value: '02' },
  { label: 'Marzo', value: '03' },
  { label: 'Abril', value: '04' },
  { label: 'Mayo', value: '05' },
  { label: 'Junio', value: '06' },
  { label: 'Julio', value: '07' },
  { label: 'Agosto', value: '08' },
  { label: 'Septiembre', value: '09' },
  { label: 'Octubre', value: '10' },
  { label: 'Noviembre', value: '11' },
  { label: 'Diciembre', value: '12' },
];

// Función para extraer el número de mes (01 - 12) sin importar el formato de fecha
const extractMonthNumber = (dateStr: string): string => {
  if (!dateStr) return '';
  const cleanStr = dateStr.trim();

  // Formato YYYY-MM-DD
  if (cleanStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    return cleanStr.split('-')[1];
  }

  // Formato DD/MM/YYYY o D/M/YYYY
  const parts = cleanStr.split(/[/.-]/);
  if (parts.length >= 2) {
    // Si la segunda parte es un número entre 1 y 12
    const m = parseInt(parts[1], 10);
    if (!isNaN(m) && m >= 1 && m <= 12) {
      return String(m).padStart(2, '0');
    }
  }

  return '';
};

export default function ConciliationResults({ siigoDataRaw, bankTransactions }: Props) {
  // Cuentas contables disponibles
  const availableAccounts = useMemo(() => {
    const codes = new Set<string>();
    siigoDataRaw.forEach((item) => {
      if (item.cuentaCode) codes.add(item.cuentaCode);
    });
    return Array.from(codes).sort();
  }, [siigoDataRaw]);

  // Selectores
  const [selectedMonth, setSelectedMonth] = useState<string>('07'); // Defecto Julio
  const [selectedAccountCode, setSelectedAccountCode] = useState<string>('ALL');

  // Listas de pendientes activas
  const [pendingBank, setPendingBank] = useState<BankTransaction[]>([]);
  const [pendingSiigo, setPendingSiigo] = useState<SiigoTransaction[]>([]);
  const [conciliatedCount, setConciliatedCount] = useState<number>(0);

  // Filtrado reactivo al cambiar Mes o Cuenta
  useEffect(() => {
    // Filtrar Banco
    const filteredBank = bankTransactions.filter((b) => {
      if (selectedMonth === 'ALL') return true;
      const month = extractMonthNumber(b.fecha);
      return month === selectedMonth;
    });

    // Filtrar Siigo
    const filteredSiigo = siigoDataRaw.filter((s) => {
      const matchAccount = selectedAccountCode === 'ALL' || s.cuentaCode === selectedAccountCode;
      if (!matchAccount) return false;
      if (selectedMonth === 'ALL') return true;

      const month = extractMonthNumber(s.fecha);
      return month === selectedMonth;
    });

    setPendingBank(filteredBank);
    setPendingSiigo(filteredSiigo);
    setConciliatedCount(0);
  }, [selectedMonth, selectedAccountCode, bankTransactions, siigoDataRaw]);

  // Selección manual
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [selectedSiigoId, setSelectedSiigoId] = useState<string | null>(null);

  // Buscadores
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

  // Acción manual de Conciliación
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
      {/* Controles Principales */}
      <div className="flex flex-wrap justify-end items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-slate-600">Mes:</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-indigo-700 text-white font-semibold text-sm px-4 py-2 rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {MESES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-slate-600">Cuenta Bancaria Siigo:</label>
          <select
            value={selectedAccountCode}
            onChange={(e) => setSelectedAccountCode(e.target.value)}
            className="bg-indigo-700 text-white font-semibold text-sm px-4 py-2 rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="ALL">Todas las Cuentas (1110 - 1145)</option>
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
          <span className="text-xs text-slate-500 mt-1 block">Extracto del mes</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">Pendientes en Siigo</span>
          <p className="text-3xl font-extrabold text-indigo-600 mt-2">{pendingSiigo.length}</p>
          <span className="text-xs text-slate-500 mt-1 block">Registros de la cuenta</span>
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

      {/* Listas Principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Extracto Banco */}
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

        {/* Movimientos Siigo */}
        <div className="bg-white border-2 border-indigo-200 rounded-2xl shadow-sm flex flex-col h-[500px]">
          <div className="bg-indigo-600 text-white px-5 py-3.5 rounded-t-xl font-bold text-sm tracking-wide flex justify-between items-center">
            <span>Información Movimientos Siigo ({filteredSiigoView.length})</span>
            <span className="text-xs bg-indigo-500 text-white px-2.5 py-1 rounded-md font-mono">
              {selectedAccountCode === 'ALL' ? 'Grupo 1110-1145' : `Cta: ${selectedAccountCode}`}
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

      {/* Botón Acción */}
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
'use client';

import { useState } from 'react';
import { FileSpreadsheet, Download, RefreshCw, AlertCircle } from 'lucide-react';

// 📋 MAPAS DE ORDENAMIENTO
const MAPA_ORDEN_C_EXACTO: { [codigo: number]: number } = {
  4: 0, 41: 0.01, 4175: 0.02, 4180: 0.03, 42: 0.04, 4210: 0.05, 4295: 0.06,
  5: 0.07, 51: 0.08, 5105: 0.09, 5110: 0.1, 5115: 0.11, 5120: 0.12, 5125: 0.13,
  5130: 0.14, 5135: 0.15, 5140: 0.16, 5155: 0.17, 5195: 0.18, 52: 0.19,
  5205: 0.2, 5210: 0.21, 5220: 0.22, 5235: 0.23, 5255: 0.24, 5295: 0.25,
  53: 0.26, 5305: 0.27, 5315: 0.28, 5395: 0.29, 6: 0.3, 61: 0.31, 6135: 0.32,
  6155: 0.33, 6180: 0.34, 63: 0.35, 6305: 0.36, 6310: 0.37, 6320: 0.38, 3605: 0.39
};

const MAPA_ORDEN_EMPRESA_EXACTO: { [empresa: string]: number } = {
  "SOLUCIONES": 0.0, "LATAM": 0.1, "MAKEAD": 0.02, "BU": 0.03, "COLOR": 0.04, "SEGURDOC": 0.05
};

const MAPA_ORDEN_MES_EXACTO: { [mes: string]: number } = {
  "ENERO": 0.0, "FEBRERO": 0.02, "MARZO": 0.03, "ABRIL": 0.04, "MAYO": 0.05,
  "JUNIO": 0.06, "JULIO": 0.07, "AGOSTO": 0.08, "SEPTIEMBRE": 0.09, "OCTUBRE": 0.1,
  "NOVIEMBRE": 0.11, "DICIEMBRE": 0.12
};

export default function ConsolidadorFinanciero() {
  const [archivoERI, setArchivoERI] = useState<File | null>(null);
  const [archivoBalance, setArchivoBalance] = useState<File | null>(null);
  const [empresaConsolidado, setEmpresaConsolidado] = useState<string>('SOLUCIONES');
  const [mesConsolidado, setMesConsolidado] = useState<string>('JULIO');
  const [cargando, setCargando] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const procesarYGenerarConsolidado = async () => {
    if (!archivoERI || !archivoBalance) {
      setError("Por favor selecciona ambos archivos Excel (ERI y Balance por Tercero).");
      return;
    }

    // Import dinámico de XLSX si no está global
    let libXLSX = (window as any).XLSX;
    if (!libXLSX) {
      try {
        libXLSX = await import('xlsx');
      } catch (err) {
        setError("No se pudo cargar el motor de procesamiento Excel.");
        return;
      }
    }

    setCargando(true);
    setError(null);

    try {
      // 1. Leer ERI
      const bufERI = await archivoERI.arrayBuffer();
      const wbERI = libXLSX.read(bufERI);
      const dataERI: any[][] = libXLSX.utils.sheet_to_json(wbERI.Sheets[wbERI.SheetNames[0]], { header: 1 });

      const eriList: { cod: number; nombre: string; val: number }[] = [];
      let registroUtilidad: { cod: number; nombre: string; val: number } | null = null;

      for (let r = 0; r < dataERI.length; r++) {
        const f = dataERI[r];
        if (!f || f.length < 2) continue;
        const c0 = String(f[0] || '').trim();
        const c1 = String(f[1] || '').trim();
        const c2 = parseFloat(f[2]) || 0;

        if (/^\d+$/.test(c0) && c0.length <= 4) {
          eriList.push({ cod: parseInt(c0, 10), nombre: c1, val: c2 });
        } else if (c1.toLowerCase().includes('utilidad') || c1.toLowerCase().includes('pérdida') || c1.toLowerCase().includes('perdida')) {
          registroUtilidad = { cod: 3605, nombre: c1, val: c2 };
        }
      }

      // 2. Mapeo Dinámico de ORDEN C
      const mapaOrdenC = new Map<number, number>();
      let proximoOrdenC = 0.40;

      Object.entries(MAPA_ORDEN_C_EXACTO).forEach(([cod, orden]) => {
        mapaOrdenC.set(parseInt(cod, 10), orden);
      });

      eriList.forEach(item => {
        if (!mapaOrdenC.has(item.cod)) {
          mapaOrdenC.set(item.cod, parseFloat(proximoOrdenC.toFixed(2)));
          proximoOrdenC += 0.01;
        }
      });

      // 3. Mapeo ORDEN EMPRESA y MES
      const empUpper = empresaConsolidado.trim().toUpperCase();
      let valorOrdenEmpresa = MAPA_ORDEN_EMPRESA_EXACTO[empUpper];
      if (valorOrdenEmpresa === undefined) {
        valorOrdenEmpresa = parseFloat((Object.keys(MAPA_ORDEN_EMPRESA_EXACTO).length / 100).toFixed(2));
      }

      const mesUpper = mesConsolidado.trim().toUpperCase();
      const valorOrdenMes = MAPA_ORDEN_MES_EXACTO[mesUpper] ?? 0.0;

      // 4. Leer Balance
      const bufBal = await archivoBalance.arrayBuffer();
      const wbBal = libXLSX.read(bufBal);

      const balMap: { [cod4: string]: { [tercero: string]: number } } = {};
      const sheetAProcesar = wbBal.SheetNames.find((name: string) => name.includes('Hoja1') || name.includes('Hoja2')) || wbBal.SheetNames[0];
      const dataBal: any[][] = libXLSX.utils.sheet_to_json(wbBal.Sheets[sheetAProcesar], { header: 1 });

      let cuentaActual = "";
      for (let r = 0; r < dataBal.length; r++) {
        const f = dataBal[r];
        if (!f || f.length < 2) continue;

        let colEtiqueta = String(f[0] || '').trim();
        let colDebito = parseFloat(f[1]) || 0;
        let colCredito = parseFloat(f[2]) || 0;

        if (!colEtiqueta && f.length >= 3) {
          colEtiqueta = String(f[1] || '').trim();
          colDebito = parseFloat(f[2]) || 0;
          colCredito = parseFloat(f[3]) || 0;
        }

        const etiquetaLower = colEtiqueta.toLowerCase();
        if (!colEtiqueta || etiquetaLower.includes('etiquetas') || etiquetaLower.includes('(en blanco)') || etiquetaLower.includes('total general') || etiquetaLower.includes('total')) {
          continue;
        }

        if (/^\d{4}$/.test(colEtiqueta)) {
          cuentaActual = colEtiqueta;
        } else if (cuentaActual && colEtiqueta.length > 2) {
          const saldoNeto = colDebito - colCredito;
          if (saldoNeto !== 0) {
            if (!balMap[cuentaActual]) balMap[cuentaActual] = {};
            balMap[cuentaActual][colEtiqueta] = saldoNeto;
          }
        }
      }

      // 5. Generar filas finales
      const lineasFinales: any[] = [];

      for (const eri of eriList) {
        const codStr = String(eri.cod);
        const esCuentade1o2Digitos = codStr.length <= 2;
        const tieneTerceros = (codStr.length === 4) && (balMap[codStr] !== undefined) && (Object.keys(balMap[codStr]).length > 0);
        const valorOrdenC = mapaOrdenC.get(eri.cod) ?? 0.99;

        let totalIngresos = 0, totalGastos = 0, totalCostos = 0;
        if (codStr.startsWith('4')) totalIngresos = codStr.startsWith('4175') ? -eri.val : eri.val;
        else if (codStr.startsWith('5')) totalGastos = eri.val;
        else if (codStr.startsWith('6')) totalCostos = eri.val;

        const ocultarTotales = esCuentade1o2Digitos || tieneTerceros;

        lineasFinales.push({
          'CODIGO': eri.cod,
          'ORDEN C': valorOrdenC,
          'NOMBRE CUENTA': eri.nombre,
          'VALOR': eri.val,
          'EMPRESA': empUpper,
          'MES': mesUpper,
          'ORDEN EMPRESA': valorOrdenEmpresa,
          'ORDEN MES': valorOrdenMes,
          'TOTAL INGRESOS': ocultarTotales ? 0 : totalIngresos,
          'TOTAL GASTOS': ocultarTotales ? 0 : totalGastos,
          'TOTAL COSTOS': ocultarTotales ? 0 : totalCostos
        });

        if (tieneTerceros) {
          const tercerosObj = balMap[codStr];
          for (const [terceroNombre, terceroVal] of Object.entries(tercerosObj)) {
            let tIng = 0, tGas = 0, tCos = 0;
            if (codStr.startsWith('4')) tIng = terceroVal;
            else if (codStr.startsWith('5')) tGas = terceroVal;
            else if (codStr.startsWith('6')) tCos = terceroVal;

            lineasFinales.push({
              'CODIGO': eri.cod,
              'ORDEN C': valorOrdenC,
              'NOMBRE CUENTA': terceroNombre,
              'VALOR': terceroVal,
              'EMPRESA': empUpper,
              'MES': mesUpper,
              'ORDEN EMPRESA': valorOrdenEmpresa,
              'ORDEN MES': valorOrdenMes,
              'TOTAL INGRESOS': tIng,
              'TOTAL GASTOS': tGas,
              'TOTAL COSTOS': tCos
            });
          }
        }
      }

      if (registroUtilidad) {
        lineasFinales.push({
          'CODIGO': registroUtilidad.cod,
          'ORDEN C': 0.39,
          'NOMBRE CUENTA': registroUtilidad.nombre,
          'VALOR': registroUtilidad.val,
          'EMPRESA': empUpper,
          'MES': mesUpper,
          'ORDEN EMPRESA': valorOrdenEmpresa,
          'ORDEN MES': valorOrdenMes,
          'TOTAL INGRESOS': 0,
          'TOTAL GASTOS': 0,
          'TOTAL COSTOS': 0
        });
      }

      // 6. Descargar Excel
      const sheetFinal = libXLSX.utils.json_to_sheet(lineasFinales);
      const bookFinal = libXLSX.utils.book_new();
      libXLSX.utils.book_append_sheet(bookFinal, sheetFinal, mesUpper);

      libXLSX.writeFile(bookFinal, `ARCHIVO_FINAL_${empUpper}_${mesUpper}.xlsx`);
    } catch (err: any) {
      setError("Error al procesar los archivos Excel. Verifica su estructura.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-indigo-600" />
          Consolidador Financiero (ERI vs. Balance)
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          Carga el Estado de Resultado Integral y el Balance por Tercero para generar el archivo consolidado unificado.
        </p>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Empresa</label>
              <select 
                value={empresaConsolidado} 
                onChange={e => setEmpresaConsolidado(e.target.value)}
                className="w-full border border-slate-300 p-2.5 rounded-xl text-sm bg-white font-semibold text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="SOLUCIONES">SOLUCIONES</option>
                <option value="LATAM">LATAM</option>
                <option value="MAKEAD">MAKEAD</option>
                <option value="BU">BU</option>
                <option value="COLOR">COLOR</option>
                <option value="SEGURDOC">SEGURDOC</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Mes del Reporte</label>
              <select 
                value={mesConsolidado} 
                onChange={e => setMesConsolidado(e.target.value)}
                className="w-full border border-slate-300 p-2.5 rounded-xl text-sm bg-white font-semibold text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO","JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Subida ERI */}
          <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-6 text-center bg-slate-50/50 transition-all flex flex-col justify-center items-center">
            <span className="text-3xl mb-2">📄</span>
            <p className="text-xs font-bold text-slate-700 uppercase mb-1">1. Estado de Resultado Integral (ERI)</p>
            <p className="text-[11px] text-slate-400 mb-4">{archivoERI ? archivoERI.name : 'Selecciona archivo (.xlsx)'}</p>
            <label className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer transition-all shadow-md">
              Seleccionar Excel
              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={e => e.target.files && setArchivoERI(e.target.files[0])} />
            </label>
          </div>

          {/* Subida Balance */}
          <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-6 text-center bg-slate-50/50 transition-all flex flex-col justify-center items-center">
            <span className="text-3xl mb-2">📑</span>
            <p className="text-xs font-bold text-slate-700 uppercase mb-1">2. Balance por Tercero</p>
            <p className="text-[11px] text-slate-400 mb-4">{archivoBalance ? archivoBalance.name : 'Selecciona archivo (.xlsx)'}</p>
            <label className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer transition-all shadow-md">
              Seleccionar Excel
              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={e => e.target.files && setArchivoBalance(e.target.files[0])} />
            </label>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-center">
          <button 
            onClick={procesarYGenerarConsolidado}
            disabled={cargando || !archivoERI || !archivoBalance}
            className={`w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
              cargando || !archivoERI || !archivoBalance 
                ? 'bg-slate-300 cursor-not-allowed' 
                : 'bg-emerald-600 hover:bg-emerald-700 scale-105 active:scale-95'
            }`}
          >
            {cargando ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Procesando Archivos...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" /> Generar y Descargar Archivo Final (.xlsx)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
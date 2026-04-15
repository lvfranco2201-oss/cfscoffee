'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Save, RefreshCw, TrendingUp, TrendingDown, Target,
  DollarSign, AlertCircle, CheckCircle2, Edit3, Info,
  Settings2, X, ChevronLeft, ChevronRight, Copy
} from 'lucide-react';
import { useFilter, filterToParams } from '@/context/FilterContext';
import TopFilters from '@/components/TopFilters';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface MonthBudget { year: number; month: number; salesTarget: number; laborCostPct: number; }
interface BudgetRow {
  storeId: number;
  storeName: string;
  locationCode: string;
  actualNetSales: number;
  actualLaborCost: number;
  actualLaborPct: number | null;
  proratedSalesBudget: number | null;
  proratedLaborBudget: number | null;
  budgetLaborPct: number | null;
  salesAchievementPct: number | null;
  salesVariance: number | null;
  monthBudgets: MonthBudget[];
}
interface Totals {
  totalActual: number; totalBudget: number; totalLaborCost: number;
  overallAchieve: number | null; overallLaborPct: number | null;
}
interface ApiData {
  from: string; to: string; range: string;
  rows: BudgetRow[];
  totals: Totals;
  monthsInRange: { year: number; month: number }[];
  hasBudgetData: boolean;
}

interface ConfigRow {
  storeId: number; storeName: string; locationCode: string;
  salesTarget: number | null; laborCostPct: number | null;
  notes: string; hasBudget: boolean;
}
interface ConfigData {
  year: number; month: number; daysInMonth: number; rows: ConfigRow[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const MONTHS_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function fmt$(n: number | null) {
  if (n === null || n === 0) return n === 0 ? '$0' : '—';
  return new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(n);
}
function fmtPct(n: number | null, d = 1) {
  if (n === null) return '—';
  return `${n.toFixed(d)}%`;
}
function AchieveBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span style={{ color:'var(--text-muted)', fontSize:'0.75rem' }}>Sin meta</span>;
  const good = pct >= 100, warn = pct >= 80;
  const color = good ? 'var(--success)' : warn ? 'var(--warning)' : 'var(--danger)';
  const bg    = good ? 'rgba(46,202,127,0.1)' : warn ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)';
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 9px', borderRadius:8, background:bg, color, fontSize:'0.8rem', fontWeight:700 }}>
      {good ? <TrendingUp size={11}/> : <TrendingDown size={11}/>} {fmtPct(pct)}
    </span>
  );
}

// ── Formatted Money Input ─────────────────────────────────────────────────────
// Shows "$30,000" when not focused; plain digits when editing.

function FormattedNumberInput({
  value, onChange, placeholder = '0', width = 155, hasValue,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  width?: number;
  hasValue?: boolean;
}) {
  const [focused, setFocused] = useState(false);

  // Display: formatted when blurred, raw when focused
  const displayValue = !focused && value !== ''
    ? new Intl.NumberFormat('en-US').format(parseFloat(value))
    : value;

  return (
    <div style={{ position:'relative', display:'inline-flex', alignItems:'center' }}>
      <span style={{ position:'absolute', left:11, color:'var(--text-muted)', fontSize:'0.82rem', pointerEvents:'none', zIndex:1 }}>$</span>
      <input
        type="text"
        inputMode="numeric"
        value={displayValue}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={e => {
          // Strip commas so the raw value stays numeric
          const clean = e.target.value.replace(/,/g, '');
          if (clean === '' || /^\d*\.?\d*$/.test(clean)) onChange(clean);
        }}
        style={{
          width, paddingLeft:24, paddingRight:10, paddingTop:9, paddingBottom:9,
          borderRadius:9,
          border:`1px solid ${hasValue ? 'rgba(221,167,86,0.4)' : 'var(--border-color)'}`,
          background: hasValue ? 'rgba(221,167,86,0.05)' : 'rgba(255,255,255,0.04)',
          color:'var(--text-main)', fontSize:'0.86rem', outline:'none', textAlign:'right',
          fontFamily:'Inter', transition:'all 0.2s', letterSpacing: '0.01em',
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Budget Edit Modal — pre-loads ALL active stores for a month
// ─────────────────────────────────────────────────────────────────────────────

function BudgetEditModal({
  initialYear, initialMonth, onSaved, onClose,
}: {
  initialYear: number; initialMonth: number;
  onSaved: () => void; onClose: () => void;
}) {
  const [selYear,  setSelYear]  = useState(initialYear);
  const [selMonth, setSelMonth] = useState(initialMonth);
  const [config,   setConfig]   = useState<ConfigData | null>(null);
  const [edits,    setEdits]    = useState<Record<number, { salesTarget:string; laborCostPct:string; notes:string }>>({});
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [dirty,    setDirty]    = useState(false);
  const [toast,    setToast]    = useState<string|null>(null);
  // When auto-filled from a prev month, stores that month label for the banner
  const [suggestedFrom, setSuggestedFrom] = useState<string|null>(null);

  // Load stores + existing budgets for selected month.
  // If no budget exists yet, auto-fill from the most recent saved month (up to 12 months back).
  const loadConfig = useCallback(async (y: number, m: number) => {
    setLoading(true);
    setSuggestedFrom(null);
    try {
      const res = await fetch(`/api/presupuesto/config?year=${y}&month=${m}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ConfigData = await res.json();
      setConfig(data);

      const hasSavedBudget = data.rows.some(r => r.hasBudget);

      if (hasSavedBudget) {
        // Month already configured — load as-is
        const init: typeof edits = {};
        data.rows.forEach(r => {
          init[r.storeId] = {
            salesTarget:  r.salesTarget  != null ? String(r.salesTarget)  : '',
            laborCostPct: r.laborCostPct != null ? String(r.laborCostPct) : '',
            notes:        r.notes ?? '',
          };
        });
        setEdits(init);
        setDirty(false);
      } else {
        // No budget yet — search the last month that has data (up to 12 months back)
        const init: typeof edits = {};
        data.rows.forEach(r => { init[r.storeId] = { salesTarget:'', laborCostPct:'', notes:'' }; });

        let foundLabel: string | null = null;
        for (let i = 1; i <= 12; i++) {
          const pm = m - i <= 0 ? m - i + 12 : m - i;
          const py = m - i <= 0 ? y - 1 : y;
          const prevRes = await fetch(`/api/presupuesto/config?year=${py}&month=${pm}`);
          if (!prevRes.ok) break;
          const prev: ConfigData = await prevRes.json();
          const hasData = prev.rows.some(r => r.hasBudget);
          if (hasData) {
            prev.rows.forEach(r => {
              if (r.salesTarget != null || r.laborCostPct != null) {
                init[r.storeId] = {
                  salesTarget:  r.salesTarget  != null ? String(r.salesTarget)  : '',
                  laborCostPct: r.laborCostPct != null ? String(r.laborCostPct) : '30',
                  notes: '',
                };
              }
            });
            foundLabel = `${MONTHS_FULL[pm-1]} ${py}`;
            break;
          }
        }
        setEdits(init);
        setDirty(false); // pre-filled but NOT dirty — user must confirm
        if (foundLabel) setSuggestedFrom(foundLabel);
      }
    } catch (e: any) {
      setToast('Error al cargar: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


  useEffect(() => { loadConfig(selYear, selMonth); }, [selYear, selMonth, loadConfig]);

  function prevMonth() { if (selMonth === 1) { setSelYear(y=>y-1); setSelMonth(12); } else setSelMonth(m=>m-1); }
  function nextMonth() { if (selMonth === 12) { setSelYear(y=>y+1); setSelMonth(1); } else setSelMonth(m=>m+1); }

  function change(storeId: number, field: 'salesTarget'|'laborCostPct'|'notes', val: string) {
    setEdits(p => ({ ...p, [storeId]: { ...p[storeId], [field]: val } }));
    setDirty(true);
  }

  // Copy values from previous month
  async function copyFromPrevMonth() {
    const pm = selMonth === 1 ? 12 : selMonth - 1;
    const py = selMonth === 1 ? selYear - 1 : selYear;
    try {
      const res = await fetch(`/api/presupuesto/config?year=${py}&month=${pm}`);
      const prev: ConfigData = await res.json();
      const next: typeof edits = { ...edits };
      prev.rows.forEach(r => {
        if (r.salesTarget != null || r.laborCostPct != null) {
          next[r.storeId] = {
            salesTarget:  r.salesTarget  != null ? String(r.salesTarget)  : next[r.storeId]?.salesTarget ?? '',
            laborCostPct: r.laborCostPct != null ? String(r.laborCostPct) : next[r.storeId]?.laborCostPct ?? '',
            notes:        next[r.storeId]?.notes ?? '',
          };
        }
      });
      setEdits(next);
      setDirty(true);
      setToast(`Valores copiados desde ${MONTHS_FULL[pm-1]} ${py}`);
      setTimeout(() => setToast(null), 2500);
    } catch {
      setToast('No se pudo copiar el mes anterior');
      setTimeout(() => setToast(null), 2000);
    }
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    try {
      const rows = config.rows.map(r => {
        const e = edits[r.storeId] ?? {};
        return {
          storeId:      r.storeId,
          storeName:    r.storeName,
          year:         selYear,
          month:        selMonth,
          salesTarget:  e.salesTarget  !== '' ? parseFloat(e.salesTarget)  : 0,
          laborCostPct: e.laborCostPct !== '' ? parseFloat(e.laborCostPct) : 30,
          notes:        e.notes ?? '',
        };
      });

      const res = await fetch('/api/presupuesto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDirty(false);
      setToast(`✅ ${rows.length} tiendas guardadas — ${MONTHS_FULL[selMonth-1]} ${selYear}`);
      setTimeout(() => { setToast(null); onSaved(); }, 1800);
    } catch (e: any) {
      setToast('Error al guardar: ' + e.message);
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  const daysInMonth = config?.daysInMonth ?? new Date(selYear, selMonth, 0).getDate();
  const configuredCount = config?.rows.filter(r => edits[r.storeId]?.salesTarget !== '').length ?? 0;
  const totalCount      = config?.rows.length ?? 0;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.78)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(6px)', padding: '1rem' }}>
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:20, width:'min(960px, 100%)', maxHeight:'92vh', display:'flex', flexDirection:'column', boxShadow:'0 32px 80px rgba(0,0,0,0.7)' }}>

        {/* ── Modal Header ─────────────────────────────────────────────────── */}
        <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--border-color)', display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexShrink:0, gap:12 }}>
          <div>
            <div style={{ fontFamily:'Outfit', fontWeight:700, fontSize:'1.1rem', display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <Settings2 size={18} style={{ color:'var(--cfs-gold)' }} />
              Configurar Presupuesto Mensual
            </div>
            <div style={{ fontSize:'0.79rem', color:'var(--text-muted)' }}>
              Define la meta de ventas y el % de costo laboral para cada tienda. Se prora automáticamente por día en el dashboard.
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid var(--border-color)', borderRadius:9, color:'var(--text-muted)', padding:'7px 9px', cursor:'pointer', flexShrink:0 }}>
            <X size={16}/>
          </button>
        </div>

        {/* ── Month Picker & Actions ────────────────────────────────────────── */}
        <div style={{ padding:'12px 24px', borderBottom:'1px solid var(--border-color)', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', flexShrink:0 }}>
          {/* Month nav */}
          <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.04)', border:'1px solid var(--border-color)', borderRadius:10, padding:'4px' }}>
            <button onClick={prevMonth} style={{ background:'rgba(255,255,255,0.07)', border:'none', borderRadius:7, color:'var(--text-muted)', padding:'5px 9px', cursor:'pointer' }}><ChevronLeft size={15}/></button>
            <span style={{ minWidth:150, textAlign:'center', fontFamily:'Outfit', fontWeight:700, fontSize:'0.98rem' }}>
              {MONTHS_FULL[selMonth-1]} {selYear}
            </span>
            <button onClick={nextMonth} style={{ background:'rgba(255,255,255,0.07)', border:'none', borderRadius:7, color:'var(--text-muted)', padding:'5px 9px', cursor:'pointer' }}><ChevronRight size={15}/></button>
          </div>

          {/* Stats pill */}
          <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', padding:'5px 12px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid var(--border-color)', whiteSpace:'nowrap' }}>
            {daysInMonth} días &nbsp;·&nbsp; <span style={{ color: configuredCount === totalCount ? 'var(--success)' : 'var(--warning)', fontWeight:700 }}>{configuredCount}/{totalCount}</span> tiendas configuradas
          </div>

          {/* Copy from prev month */}
          <button onClick={copyFromPrevMonth} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:9, border:'1px solid var(--border-color)', background:'rgba(255,255,255,0.04)', color:'var(--text-muted)', fontSize:'0.8rem', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
            <Copy size={13}/>
            Copiar {MONTHS_FULL[selMonth === 1 ? 11 : selMonth-2]}
          </button>

          {/* Toast inside row */}
          {toast && (
            <span style={{ fontSize:'0.78rem', color: toast.startsWith('✅') ? 'var(--success)' : toast.startsWith('Error') ? 'var(--danger)' : 'var(--cfs-gold)', fontWeight:600 }}>
              {toast}
            </span>
          )}

          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
            <button onClick={onClose} style={{ padding:'8px 18px', borderRadius:9, border:'1px solid var(--border-color)', background:'transparent', color:'var(--text-muted)', fontWeight:600, fontSize:'0.83rem', cursor:'pointer' }}>
              Cancelar
            </button>
            <button
              onClick={() => { setDirty(true); handleSave(); }}
              disabled={saving || (!dirty && !suggestedFrom)}
              style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 22px', borderRadius:9, background: (dirty || suggestedFrom) ? 'var(--cfs-gold)' : 'rgba(221,167,86,0.2)', border:'none', color: (dirty || suggestedFrom) ? '#000' : 'rgba(221,167,86,0.4)', fontWeight:700, fontSize:'0.88rem', cursor: (dirty || suggestedFrom) && !saving ? 'pointer':'not-allowed', transition:'all 0.2s' }}
            >
              <Save size={14}/>
              {saving ? 'Guardando…' : suggestedFrom && !dirty ? 'Confirmar y Guardar' : 'Guardar'}
            </button>
          </div>
        </div>

        {/* ── Suggestion banner ───────────────────────────────────────────────── */}
        {suggestedFrom && !loading && (
          <div style={{ padding:'10px 24px', borderBottom:'1px solid rgba(221,167,86,0.2)', background:'rgba(221,167,86,0.06)', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
            <Copy size={14} style={{ color:'var(--cfs-gold)', flexShrink:0 }}/>
            <span style={{ fontSize:'0.8rem', color:'var(--cfs-gold)', fontWeight:600 }}>
              Valores pre-cargados desde <strong>{suggestedFrom}</strong> como referencia.
            </span>
            <span style={{ fontSize:'0.79rem', color:'var(--text-muted)', marginLeft:4 }}>
              Ajusta los que necesites y haz clic en “Confirmar y Guardar”.
            </span>
            <button
              onClick={() => setSuggestedFrom(null)}
              style={{ marginLeft:'auto', background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:'2px 4px', flexShrink:0 }}
              title="Descartar sugerencia"
            >
              <X size={14}/>
            </button>
          </div>
        )}

        {/* ── Table ─────────────────────────────────────────────────────────── */}
        <div style={{ overflowY:'auto', flex:1 }}>
          {loading ? (
            <div style={{ padding:'3rem', textAlign:'center', color:'var(--text-muted)' }}>
              <RefreshCw size={20} style={{ animation:'spin 1s linear infinite', margin:'0 auto 8px', display:'block' }}/>
              <div style={{ fontSize:'0.84rem' }}>Cargando tiendas…</div>
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.85rem' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid var(--border-color)', background:'rgba(255,255,255,0.025)' }}>
                  <th style={{ padding:'11px 20px', textAlign:'left',   fontFamily:'Outfit', fontSize:'0.73rem', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-muted)', fontWeight:700, whiteSpace:'nowrap' }}>
                    Tienda
                  </th>
                  <th style={{ padding:'11px 16px', textAlign:'center', fontFamily:'Outfit', fontSize:'0.73rem', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-muted)', fontWeight:700, whiteSpace:'nowrap' }}>
                    Meta Mensual de Ventas
                  </th>
                  <th style={{ padding:'11px 16px', textAlign:'center', fontFamily:'Outfit', fontSize:'0.73rem', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--cfs-gold)', fontWeight:700, whiteSpace:'nowrap' }}>
                    Presupuesto Diario
                  </th>
                  <th style={{ padding:'11px 16px', textAlign:'center', fontFamily:'Outfit', fontSize:'0.73rem', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-muted)', fontWeight:700, whiteSpace:'nowrap' }}>
                    % Meta Costo Laboral
                  </th>
                  <th style={{ padding:'11px 16px', textAlign:'left',   fontFamily:'Outfit', fontSize:'0.73rem', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-muted)', fontWeight:700, whiteSpace:'nowrap' }}>
                    Notas
                  </th>
                </tr>
              </thead>
              <tbody>
                {config?.rows.map((row, idx) => {
                  const e = edits[row.storeId] ?? { salesTarget:'', laborCostPct:'', notes:'' };
                  const monthly   = e.salesTarget !== '' ? parseFloat(e.salesTarget)  : 0;
                  const dailyBdg  = monthly > 0 ? monthly / daysInMonth : null;
                  const hasValues = e.salesTarget !== '' || e.laborCostPct !== '';

                  return (
                    <tr key={row.storeId} style={{
                      borderBottom:'1px solid var(--border-color)',
                      background: idx%2===0 ? 'transparent' : 'rgba(255,255,255,0.012)',
                    }}>
                      {/* Store */}
                      <td style={{ padding:'11px 20px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          {/* Status dot */}
                          <span style={{ width:7, height:7, borderRadius:'50%', flexShrink:0, background: hasValues ? 'var(--success)' : 'var(--border-color)', boxShadow: hasValues ? '0 0 6px var(--success)' : 'none', transition:'all 0.3s' }}/>
                          <div>
                            <div style={{ fontWeight:600, fontSize:'0.88rem' }}>{row.storeName ?? `Store ${row.storeId}`}</div>
                            {row.locationCode && <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:1 }}>{row.locationCode}</div>}
                          </div>
                        </div>
                      </td>

                      {/* Sales target */}
                      <td style={{ padding:'8px 16px', textAlign:'center' }}>
                        <FormattedNumberInput
                          value={e.salesTarget}
                          onChange={v => change(row.storeId, 'salesTarget', v)}
                          placeholder="Ej: 50,000"
                          width={160}
                          hasValue={!!e.salesTarget}
                        />
                      </td>

                      {/* Daily budget — computed, read-only */}
                      <td style={{ padding:'11px 16px', textAlign:'center' }}>
                        <span style={{
                          fontWeight:700, fontSize:'0.9rem',
                          color: dailyBdg ? 'var(--cfs-gold)' : 'var(--border-color)',
                          transition:'color 0.2s',
                        }}>
                          {dailyBdg ? fmt$(dailyBdg) : '—'}
                        </span>
                      </td>

                      {/* Labor % */}
                      <td style={{ padding:'8px 16px', textAlign:'center' }}>
                        <div style={{ position:'relative', display:'inline-flex', alignItems:'center' }}>
                          <input
                            type="number" min={0} max={100} step={0.5}
                            value={e.laborCostPct}
                            placeholder="30"
                            onChange={v => change(row.storeId, 'laborCostPct', v.target.value)}
                            style={{
                              width:95, paddingLeft:10, paddingRight:24, paddingTop:9, paddingBottom:9,
                              borderRadius:9, border:`1px solid ${e.laborCostPct ? 'rgba(59,130,246,0.35)' : 'var(--border-color)'}`,
                              background: e.laborCostPct ? 'rgba(59,130,246,0.05)' : 'rgba(255,255,255,0.04)',
                              color:'var(--text-main)', fontSize:'0.86rem', outline:'none', textAlign:'center',
                              fontFamily:'Inter', transition:'all 0.2s',
                            }}
                          />
                          <span style={{ position:'absolute', right:10, color:'var(--text-muted)', fontSize:'0.8rem', pointerEvents:'none' }}>%</span>
                        </div>
                      </td>

                      {/* Notes */}
                      <td style={{ padding:'8px 16px' }}>
                        <input
                          type="text" value={e.notes} placeholder="Observaciones…" maxLength={120}
                          onChange={v => change(row.storeId, 'notes', v.target.value)}
                          style={{ width:'100%', minWidth:140, padding:'9px 10px', borderRadius:9, border:'1px solid var(--border-color)', background:'rgba(255,255,255,0.04)', color:'var(--text-main)', fontSize:'0.82rem', outline:'none', fontFamily:'Inter' }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Footer tip ─────────────────────────────────────────────────────── */}
        <div style={{ padding:'12px 24px', borderTop:'1px solid var(--border-color)', flexShrink:0, display:'flex', alignItems:'center', gap:8, fontSize:'0.77rem', color:'var(--text-muted)', background:'rgba(255,255,255,0.01)' }}>
          <Info size={13} style={{ flexShrink:0, color:'var(--info)' }}/>
          Los presupuestos se guardan por tienda y mes. Si ya existe uno para ese mes, se <strong style={{ color:'var(--text-main)' }}>sobreescribe</strong> (UPSERT). Navega a otros meses sin perder lo ya guardado.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page UI
// ─────────────────────────────────────────────────────────────────────────────

export default function PresupuestoUI() {
  const { filter } = useFilter();
  const [data,     setData]     = useState<ApiData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [toast,    setToast]    = useState<{ type:'success'|'error'; msg:string } | null>(null);
  const abortRef = useRef<AbortController|null>(null);

  // ── Sort state ───────────────────────────────────────────────────────────────
  type SortCol = 'storeName'|'proratedSalesBudget'|'actualNetSales'|'salesVariance'|'salesAchievementPct'|'budgetLaborPct'|'actualLaborPct'|'actualLaborCost';
  const [sortCol, setSortCol] = useState<SortCol>('storeName');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc');

  function toggleSort(col: SortCol) {
    setSortCol(col);
    setSortDir(p => (sortCol === col && p === 'asc') ? 'desc' : 'asc');
  }

  const showToast = (type: 'success'|'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchData = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const res = await fetch(`/api/presupuesto?${filterToParams(filter).toString()}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      showToast('error', e.message ?? 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    const t = setTimeout(() => fetchData(), 300);
    return () => clearTimeout(t);
  }, [fetchData]);
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // Determine modal's initial month (last period month, or current)
  const now = new Date();
  const initYear  = data?.monthsInRange?.at(-1)?.year  ?? now.getFullYear();
  const initMonth = data?.monthsInRange?.at(-1)?.month ?? (now.getMonth() + 1);

  const { totals } = data ?? {
    totals: { totalActual:0, totalBudget:0, totalLaborCost:0, overallAchieve:null, overallLaborPct:null }
  };
  const periodLabel = data
    ? (data.from === data.to ? data.from : `${data.from} → ${data.to}`)
    : '…';

  // ── Sorted rows ──────────────────────────────────────────────────────────────
  const sortedRows = [...(data?.rows ?? [])].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1;
    const va = a[sortCol] ?? (typeof a[sortCol] === 'number' ? -Infinity : '');
    const vb = b[sortCol] ?? (typeof b[sortCol] === 'number' ? -Infinity : '');
    if (typeof va === 'string') return mul * va.localeCompare(vb as string);
    return mul * ((va as number) - (vb as number));
  });

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', top:24, right:24, zIndex:9999, display:'flex', alignItems:'center', gap:10, padding:'12px 20px', borderRadius:12, background: toast.type==='success' ? 'rgba(46,202,127,0.15)' : 'rgba(239,68,68,0.15)', border:`1px solid ${toast.type==='success' ? 'rgba(46,202,127,0.3)' : 'rgba(239,68,68,0.3)'}`, color: toast.type==='success' ? 'var(--success)' : 'var(--danger)', backdropFilter:'blur(12px)', fontWeight:600, fontSize:'0.88rem', animation:'fade-in-up 0.3s ease', boxShadow:'0 8px 32px rgba(0,0,0,0.4)' }}>
          {toast.type==='success' ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}
          {toast.msg}
        </div>
      )}

      {/* Edit Modal */}
      {showEdit && (
        <BudgetEditModal
          initialYear={initYear}
          initialMonth={initMonth}
          onSaved={() => { setShowEdit(false); fetchData(); showToast('success', 'Presupuesto guardado'); }}
          onClose={() => setShowEdit(false)}
        />
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="top-header" style={{ marginBottom:0, flexWrap:'wrap', gap:'1rem' }}>
        <div>
          <h1 style={{ fontFamily:'Outfit', fontWeight:700, fontSize:'1.6rem', marginBottom:4 }}>
            <span className="text-gradient">Presupuesto</span> & Metas
          </h1>
          <p style={{ color:'var(--text-muted)', fontSize:'0.82rem' }}>
            Período activo: <strong style={{ color:'var(--text-main)' }}>{periodLabel}</strong>
            &nbsp;·&nbsp; Presupuesto prorateado día a día
          </p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <TopFilters 
            availableStores={data?.availableStores ?? []} 
            onApply={() => fetchData()} 
            loading={loading} 
            onRefresh={fetchData} 
          />
          <button
            onClick={() => setShowEdit(true)}
            style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 18px', borderRadius:10, background:'var(--cfs-gold)', border:'none', color:'#000', fontWeight:700, fontSize:'0.85rem', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}
          >
            <Settings2 size={14}/>
            Editar Metas
          </button>
        </div>
      </div>

      {/* ── No budget warning ────────────────────────────────────────────────── */}
      {!loading && data && !data.hasBudgetData && (
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 18px', borderRadius:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)', color:'var(--warning)', fontSize:'0.83rem' }}>
          <AlertCircle size={16} style={{ flexShrink:0 }}/>
          <div>
            No hay presupuesto configurado para este período.&nbsp;
            <button onClick={() => setShowEdit(true)} style={{ background:'none', border:'none', color:'var(--cfs-gold)', fontWeight:700, cursor:'pointer', fontSize:'0.83rem', padding:0, textDecoration:'underline' }}>
              Haz clic aquí para configurarlo →
            </button>
          </div>
        </div>
      )}

      {/* ── Info tip ─────────────────────────────────────────────────────────── */}
      {!loading && data && data.hasBudgetData && (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 15px', borderRadius:10, background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.14)', color:'var(--info)', fontSize:'0.8rem' }}>
          <Info size={13} style={{ flexShrink:0 }}/>
          Presupuesto prorateado = Meta mensual ÷ días del mes × días del período.
          {data.monthsInRange.length > 1 && <>&nbsp;Período multi-mes: se acumulan los presupuestos de cada mes proporcionalmente.</>}
        </div>
      )}

      {/* ── KPI Cards ────────────────────────────────────────────────────────── */}
      <div className="grid-cols-4" style={{ opacity: loading ? 0.65 : 1, transition:'opacity 0.3s' }}>
        {[
          { label:'Presupuesto Período',  value: fmt$(totals.totalBudget),       icon:<Target size={18}/>,      color:'var(--cfs-gold)', bg:'rgba(221,167,86,0.08)' },
          { label:'Ventas Reales',         value: fmt$(totals.totalActual),        icon:<DollarSign size={18}/>,  color:'var(--success)',  bg:'rgba(46,202,127,0.08)' },
          {
            label:'Cumplimiento',
            value: fmtPct(totals.overallAchieve),
            icon: totals.overallAchieve != null && totals.overallAchieve >= 100 ? <TrendingUp size={18}/> : <TrendingDown size={18}/>,
            color: totals.overallAchieve == null ? 'var(--text-muted)' : totals.overallAchieve >= 100 ? 'var(--success)' : totals.overallAchieve >= 80 ? 'var(--warning)' : 'var(--danger)',
            bg: totals.overallAchieve != null && totals.overallAchieve >= 100 ? 'rgba(46,202,127,0.08)' : 'rgba(239,68,68,0.08)',
          },
          { label:'% Costo Laboral Real',  value: fmtPct(totals.overallLaborPct), icon:<AlertCircle size={18}/>, color:'var(--info)',     bg:'rgba(59,130,246,0.08)' },
        ].map((k,i) => (
          <div key={i} className="glass-card" style={{ gap:'0.5rem' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:'0.72rem', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{k.label}</span>
              <span style={{ padding:8, borderRadius:10, background:k.bg, color:k.color }}>{k.icon}</span>
            </div>
            <div style={{ fontFamily:'Outfit', fontWeight:700, fontSize:'1.5rem' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── Comparison Table ──────────────────────────────────────────────────── */}
      <div className="glass-card" style={{ padding:0, overflow:'hidden', opacity: loading ? 0.65 : 1, transition:'opacity 0.25s' }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border-color)', display:'flex', alignItems:'center', gap:8 }}>
          <Edit3 size={15} style={{ color:'var(--cfs-gold)' }}/>
          <span style={{ fontFamily:'Outfit', fontWeight:700, fontSize:'0.95rem' }}>Comparativo por Tienda</span>
          {loading && <RefreshCw size={13} style={{ animation:'spin 1s linear infinite', color:'var(--text-muted)', marginLeft:4 }}/>}
        </div>

        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.84rem' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border-color)', background:'rgba(255,255,255,0.02)' }}>
                {([
                  { l:'Tienda',           k:'storeName',            a:'left'   as const },
                  { l:'Presup. Período',  k:'proratedSalesBudget',  a:'center' as const },
                  { l:'Ventas Reales',    k:'actualNetSales',       a:'center' as const },
                  { l:'Variación $',      k:'salesVariance',        a:'center' as const },
                  { l:'Cumplimiento',     k:'salesAchievementPct',  a:'center' as const },
                  { l:'% Lab. Meta',      k:'budgetLaborPct',       a:'center' as const },
                  { l:'% Lab. Real',      k:'actualLaborPct',       a:'center' as const },
                  { l:'Costo Lab. Real $',k:'actualLaborCost',      a:'center' as const },
                ] as { l:string; k:SortCol; a:'left'|'center' }[]).map(col => {
                  const active = sortCol === col.k;
                  return (
                    <th
                      key={col.k}
                      onClick={() => toggleSort(col.k)}
                      style={{
                        padding:'11px 16px', textAlign:col.a,
                        fontFamily:'Outfit', fontWeight:700, fontSize:'0.72rem',
                        textTransform:'uppercase', letterSpacing:'0.06em',
                        color: active ? 'var(--cfs-gold)' : 'var(--text-muted)',
                        whiteSpace:'nowrap', cursor:'pointer', userSelect:'none',
                        transition:'color 0.2s',
                      }}
                    >
                      <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                        {col.l}
                        <span style={{ display:'inline-flex', flexDirection:'column', gap:1, opacity: active ? 1 : 0.3, transition:'opacity 0.2s' }}>
                          <span style={{ width:0, height:0, borderLeft:'3.5px solid transparent', borderRight:'3.5px solid transparent', borderBottom:`4px solid ${active && sortDir==='asc' ? 'var(--cfs-gold)' : 'currentColor'}`, display:'block', opacity: active && sortDir==='desc' ? 0.3 : 1 }}/>
                          <span style={{ width:0, height:0, borderLeft:'3.5px solid transparent', borderRight:'3.5px solid transparent', borderTop:`4px solid ${active && sortDir==='desc' ? 'var(--cfs-gold)' : 'currentColor'}`, display:'block', opacity: active && sortDir==='asc' ? 0.3 : 1 }}/>
                        </span>
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, idx) => {
                const varPos    = (row.salesVariance ?? 0) >= 0;
                const laborOver = row.actualLaborPct != null && row.budgetLaborPct != null && row.actualLaborPct > row.budgetLaborPct;
                return (
                  <tr key={row.storeId} style={{ borderBottom:'1px solid var(--border-color)', background: idx%2===0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                    <td style={{ padding:'12px 16px' }}>
                      <div style={{ fontWeight:600 }}>{row.storeName ?? `Store ${row.storeId}`}</div>
                      {row.locationCode && <div style={{ fontSize:'0.71rem', color:'var(--text-muted)', marginTop:1 }}>{row.locationCode}</div>}
                    </td>
                    <td style={{ padding:'12px 16px', textAlign:'center', fontWeight:600, color: row.proratedSalesBudget ? 'var(--text-main)' : 'var(--text-muted)' }}>
                      {fmt$(row.proratedSalesBudget ?? 0)}
                    </td>
                    <td style={{ padding:'12px 16px', textAlign:'center', fontWeight:700 }}>{fmt$(row.actualNetSales)}</td>
                    <td style={{ padding:'12px 16px', textAlign:'center' }}>
                      {row.salesVariance != null
                        ? <span style={{ fontWeight:700, color: varPos ? 'var(--success)' : 'var(--danger)' }}>{varPos?'+':''}{fmt$(row.salesVariance)}</span>
                        : <span style={{ color:'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding:'12px 16px', textAlign:'center' }}>
                      <AchieveBadge pct={row.salesAchievementPct}/>
                    </td>
                    <td style={{ padding:'12px 16px', textAlign:'center', color:'var(--text-muted)' }}>{fmtPct(row.budgetLaborPct)}</td>
                    <td style={{ padding:'12px 16px', textAlign:'center' }}>
                      {row.actualLaborPct != null
                        ? <span style={{ fontWeight:700, color: laborOver ? 'var(--danger)' : 'var(--success)' }}>{fmtPct(row.actualLaborPct)}</span>
                        : <span style={{ color:'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding:'12px 16px', textAlign:'center', color:'var(--text-muted)', fontWeight:600 }}>{fmt$(row.actualLaborCost)}</td>
                  </tr>
                );
              })}

              {/* Totals row */}
              {data && data.rows.length > 1 && (
                <tr style={{ borderTop:'2px solid var(--border-color)', background:'rgba(221,167,86,0.04)' }}>
                  <td style={{ padding:'12px 16px', fontFamily:'Outfit', fontWeight:700, fontSize:'0.88rem', color:'var(--cfs-gold)' }}>TOTAL</td>
                  <td style={{ padding:'12px 16px', textAlign:'center', fontWeight:700 }}>{fmt$(totals.totalBudget)}</td>
                  <td style={{ padding:'12px 16px', textAlign:'center', fontWeight:700 }}>{fmt$(totals.totalActual)}</td>
                  <td style={{ padding:'12px 16px', textAlign:'center', fontWeight:700, color:(totals.totalActual-totals.totalBudget)>=0?'var(--success)':'var(--danger)' }}>
                    {totals.totalBudget > 0 ? `${(totals.totalActual-totals.totalBudget)>=0?'+':''}${fmt$(totals.totalActual-totals.totalBudget)}` : '—'}
                  </td>
                  <td style={{ padding:'12px 16px', textAlign:'center' }}><AchieveBadge pct={totals.overallAchieve}/></td>
                  <td style={{ padding:'12px 16px', textAlign:'center', color:'var(--text-muted)' }}>—</td>
                  <td style={{ padding:'12px 16px', textAlign:'center', fontWeight:700 }}>{fmtPct(totals.overallLaborPct)}</td>
                  <td style={{ padding:'12px 16px', textAlign:'center', fontWeight:700 }}>{fmt$(totals.totalLaborCost)}</td>
                </tr>
              )}
            </tbody>
          </table>

          {!loading && data?.rows.length === 0 && (
            <div style={{ padding:'3rem', textAlign:'center', color:'var(--text-muted)', fontSize:'0.87rem' }}>
              No se encontraron tiendas activas.
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:16, alignItems:'center', padding:'10px 14px', borderRadius:10, background:'rgba(255,255,255,0.02)', border:'1px solid var(--border-color)', fontSize:'0.77rem', color:'var(--text-muted)' }}>
        <span style={{ color:'var(--success)', fontWeight:600 }}>● ≥ 100%</span> Meta cumplida
        <span style={{ color:'var(--warning)', fontWeight:600 }}>● 80–99%</span> En riesgo
        <span style={{ color:'var(--danger)',  fontWeight:600 }}>● &lt; 80%</span> Bajo meta
        <span style={{ marginLeft:'auto' }}>Actuals: Aurora/Toast POS · Presupuestos: Supabase (UPSERT por tienda/mes)</span>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>
    </div>
  );
}

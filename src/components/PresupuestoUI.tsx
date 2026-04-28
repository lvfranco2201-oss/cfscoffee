'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Save, RefreshCw, TrendingUp, TrendingDown, Target,
  DollarSign, AlertCircle, CheckCircle2, Edit3, Info,
  Settings2, X, ChevronLeft, ChevronRight, Copy, BarChart2, Activity
} from 'lucide-react';
import { useFilter, filterToParams } from '@/context/FilterContext';
import { useTranslation } from '@/lib/i18n/LanguageContext';


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
function AchieveBadge({ pct, noGoalLabel = 'Sin meta' }: { pct: number | null; noGoalLabel?: string }) {
  if (pct === null) return <span style={{ color:'var(--text-muted)', fontSize:'0.75rem' }}>{noGoalLabel}</span>;
  const good = pct >= 100, warn = pct >= 80;
  const color = good ? 'var(--success)' : warn ? 'var(--warning)' : 'var(--danger)';
  const bg    = good ? 'rgba(46,202,127,0.1)' : warn ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)';
  const barW  = Math.min(pct, 100);
  return (
    <div style={{ display:'inline-flex', flexDirection:'column', alignItems:'center', gap:3, minWidth:72 }}>
      <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:7, background:bg, color, fontSize:'0.78rem', fontWeight:700 }}>
        {good ? <TrendingUp size={10}/> : <TrendingDown size={10}/>} {fmtPct(pct)}
      </span>
      <div style={{ width:72, height:3, borderRadius:3, background:'rgba(255,255,255,0.08)', overflow:'hidden' }}>
        <div style={{ width:`${barW}%`, height:'100%', borderRadius:3, background:color, transition:'width 0.6s ease' }}/>
      </div>
    </div>
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
// Charts
// ─────────────────────────────────────────────────────────────────────────────

// ── Achievement bar chart (gradient bars, goal line, pct label) ───────────────
function AchievementBarChart({ rows, t }: { rows: BudgetRow[]; t: (k:string)=>string }) {
  const chartRows = [...rows]
    .filter(r => r.salesAchievementPct !== null)
    .sort((a, b) => (b.salesAchievementPct ?? 0) - (a.salesAchievementPct ?? 0))
    .slice(0, 12);

  if (chartRows.length === 0) return null;

  const barH = 30, gap = 7, labelW = 130, chartW = 360;
  const totalH = chartRows.length * (barH + gap);
  const goalX  = labelW + chartW * (100 / 150);

  return (
    <div style={{ flex: '1 1 420px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        <BarChart2 size={14} style={{ color: 'var(--cfs-gold)' }} />
        <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '0.88rem' }}>
          {t('presupuesto.chart_achievement_title')}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 20, height: 1, background: 'rgba(255,255,255,0.3)', borderTop: '1.5px dashed rgba(255,255,255,0.3)' }} />
          100% goal
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${labelW + chartW + 60} ${totalH + 4}`} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="barGood" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#2eca7f" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#2eca7f" stopOpacity={1} />
          </linearGradient>
          <linearGradient id="barWarn" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={1} />
          </linearGradient>
          <linearGradient id="barBad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={1} />
          </linearGradient>
        </defs>

        {chartRows.map((row, i) => {
          const pct   = Math.min(row.salesAchievementPct ?? 0, 150);
          const good  = pct >= 100, warn = pct >= 80;
          const color = good ? '#2eca7f' : warn ? '#f59e0b' : '#ef4444';
          const gradId = good ? 'barGood' : warn ? 'barWarn' : 'barBad';
          const bgW   = (pct / 150) * chartW;
          const y     = i * (barH + gap);
          const name  = (row.storeName ?? `Store ${row.storeId}`)
            .replace(/^CFS Coffee\s*[-–]\s*/i, '').replace(/^CFS\s+/i, '');
          const label = name.length > 18 ? name.slice(0, 17) + '…' : name;
          return (
            <g key={row.storeId}>
              <text x={labelW - 8} y={y + barH / 2 + 4} textAnchor="end"
                style={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'Inter' }}>{label}</text>
              {/* Background track */}
              <rect x={labelW} y={y} width={chartW} height={barH} rx={6} fill="rgba(255,255,255,0.04)" />
              {/* Filled bar */}
              <rect x={labelW} y={y} width={Math.max(bgW, 4)} height={barH} rx={6} fill={`url(#${gradId})`} />
              {/* Shine strip */}
              <rect x={labelW} y={y + 2} width={Math.max(bgW, 4)} height={barH / 3} rx={4} fill="rgba(255,255,255,0.08)" />
              {/* Goal line */}
              <line x1={goalX} y1={y - 3} x2={goalX} y2={y + barH + 3}
                stroke="rgba(255,255,255,0.28)" strokeWidth={1.5} strokeDasharray="4 3" />
              {/* Pct label */}
              <text x={labelW + Math.min(bgW, chartW) + 7} y={y + barH / 2 + 4}
                style={{ fill: color, fontSize: 10.5, fontFamily: 'Inter', fontWeight: 700 }}>
                {fmtPct(row.salesAchievementPct)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Status donut ──────────────────────────────────────────────────────────────
function StatusDonut({ rows, t }: { rows: BudgetRow[]; t: (k:string)=>string }) {
  const withBudget = rows.filter(r => r.salesAchievementPct !== null);
  const good  = withBudget.filter(r => (r.salesAchievementPct ?? 0) >= 100).length;
  const warn  = withBudget.filter(r => { const p = r.salesAchievementPct ?? 0; return p >= 80 && p < 100; }).length;
  const bad   = withBudget.filter(r => (r.salesAchievementPct ?? 0) < 80).length;
  const noBdg = rows.filter(r => r.salesAchievementPct === null).length;
  const total = rows.length;
  if (total === 0) return null;

  const R = 54, cx = 72, cy = 72, strokeW = 20;
  const circ = 2 * Math.PI * R;
  const segments = [
    { count: good,  color: '#2eca7f', label: t('presupuesto.status_met') },
    { count: warn,  color: '#f59e0b', label: t('presupuesto.status_risk') },
    { count: bad,   color: '#ef4444', label: t('presupuesto.status_below') },
    { count: noBdg, color: 'rgba(255,255,255,0.1)', label: t('presupuesto.status_no_budget') },
  ].filter(s => s.count > 0);

  let offset = -Math.PI / 2;
  const arcs = segments.map(s => {
    const angle   = (s.count / total) * 2 * Math.PI;
    const dashArr = (angle / (2 * Math.PI)) * circ;
    const rot     = (offset * 180) / Math.PI;
    offset += angle;
    return { ...s, dashArr, rot };
  });

  const goodPct = total > 0 ? Math.round((good / total) * 100) : 0;

  return (
    <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        <Target size={14} style={{ color: 'var(--cfs-gold)' }} />
        <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '0.88rem' }}>
          {t('presupuesto.chart_status_title')}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <svg width={144} height={144}>
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeW} />
          {arcs.map((a, i) => (
            <circle key={i} cx={cx} cy={cy} r={R} fill="none"
              stroke={a.color} strokeWidth={strokeW}
              strokeDasharray={`${a.dashArr} ${circ - a.dashArr}`}
              style={{ transform: `rotate(${a.rot}deg)`, transformOrigin: `${cx}px ${cy}px`, filter: a.color !== 'rgba(255,255,255,0.1)' ? 'drop-shadow(0 0 4px currentColor)' : 'none' }}
            />
          ))}
          <text x={cx} y={cy - 10} textAnchor="middle"
            style={{ fill: 'var(--text-main)', fontSize: 24, fontWeight: 700, fontFamily: 'Outfit' }}>{total}</text>
          <text x={cx} y={cy + 9} textAnchor="middle"
            style={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'Inter' }}>{t('presupuesto.stores_label')}</text>
          <text x={cx} y={cy + 24} textAnchor="middle"
            style={{ fill: '#2eca7f', fontSize: 11, fontFamily: 'Outfit', fontWeight: 700 }}>{goodPct}% on track</text>
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {segments.map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.79rem' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0, boxShadow: s.color !== 'rgba(255,255,255,0.1)' ? `0 0 6px ${s.color}` : 'none' }} />
              <span style={{ color: 'var(--text-muted)', minWidth: 80 }}>{s.label}</span>
              <span style={{ fontWeight: 700, color: s.color }}>{s.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Variance waterfall ────────────────────────────────────────────────────────
function VarianceWaterfall({ rows }: { rows: BudgetRow[] }) {
  const valid = [...rows]
    .filter(r => r.salesVariance !== null && r.proratedSalesBudget !== null && r.proratedSalesBudget > 0)
    .sort((a, b) => (b.salesVariance ?? 0) - (a.salesVariance ?? 0))
    .slice(0, 10);
  if (valid.length === 0) return null;

  const maxAbs = Math.max(...valid.map(r => Math.abs(r.salesVariance ?? 0)), 1);
  const barH = 26, gap = 6, labelW = 120, halfW = 160;
  const totalH = valid.length * (barH + gap);
  const midX = labelW + halfW;

  return (
    <div style={{ flex: '1 1 340px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        <DollarSign size={14} style={{ color: 'var(--cfs-gold)' }} />
        <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '0.88rem' }}>Sales Variance</span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 4 }}>vs Budget</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${labelW + halfW * 2 + 70} ${totalH}`} style={{ overflow: 'visible' }}>
        {/* Center axis */}
        <line x1={midX} y1={0} x2={midX} y2={totalH} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
        {valid.map((row, i) => {
          const v    = row.salesVariance ?? 0;
          const pos  = v >= 0;
          const bw   = (Math.abs(v) / maxAbs) * halfW;
          const x    = pos ? midX : midX - bw;
          const y    = i * (barH + gap);
          const color = pos ? '#2eca7f' : '#ef4444';
          const name  = (row.storeName ?? '').replace(/^CFS Coffee\s*[-–]\s*/i, '').replace(/^CFS\s+/i, '');
          const lbl   = name.length > 15 ? name.slice(0, 14) + '…' : name;
          return (
            <g key={row.storeId}>
              <text x={labelW - 6} y={y + barH / 2 + 4} textAnchor="end"
                style={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'Inter' }}>{lbl}</text>
              <rect x={x} y={y} width={Math.max(bw, 3)} height={barH} rx={4} fill={color} opacity={0.8} />
              <text
                x={pos ? midX + bw + 5 : midX - bw - 5}
                y={y + barH / 2 + 4}
                textAnchor={pos ? 'start' : 'end'}
                style={{ fill: color, fontSize: 10, fontFamily: 'Inter', fontWeight: 700 }}>
                {pos ? '+' : ''}{fmt$(v)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Labor scatter (bubble) ────────────────────────────────────────────────────
function LaborBubble({ rows }: { rows: BudgetRow[] }) {
  const valid = rows.filter(r => r.actualLaborPct !== null && r.budgetLaborPct !== null && r.actualNetSales > 0);
  if (valid.length < 2) return null;

  const W = 300, H = 160, PL = 30, PB = 24;
  const xs = valid.map(r => r.actualNetSales);
  const ys = valid.map(r => r.actualLaborPct ?? 0);
  const maxX = Math.max(...xs); const minX = Math.min(...xs);
  const maxY = Math.max(...ys, 50); const minY = Math.min(...ys, 0);

  const px = (v: number) => PL + ((v - minX) / (maxX - minX || 1)) * (W - PL);
  const py = (v: number) => H - PB - ((v - minY) / (maxY - minY || 1)) * (H - PB);

  return (
    <div style={{ flex: '0 0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Activity size={13} style={{ color: 'var(--cfs-gold)' }} />
        <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '0.85rem' }}>Labor % vs Sales</span>
      </div>
      <svg width={W + 20} height={H + 10}>
        {/* Goal line at budget avg */}
        <line x1={PL} y1={py(30)} x2={W} y2={py(30)}
          stroke="rgba(221,167,86,0.35)" strokeWidth={1} strokeDasharray="4 3" />
        <text x={W + 3} y={py(30) + 4} style={{ fill: 'rgba(221,167,86,0.7)', fontSize: 8, fontFamily: 'Inter' }}>30%</text>
        {/* Grid */}
        {[0, 25, 50, 75, 100].map(pct => (
          <line key={pct} x1={PL} y1={py(pct * (maxY / 100))} x2={W} y2={py(pct * (maxY / 100))}
            stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
        ))}
        {/* Points */}
        {valid.map(row => {
          const x = px(row.actualNetSales);
          const y = py(row.actualLaborPct ?? 0);
          const over = (row.actualLaborPct ?? 0) > (row.budgetLaborPct ?? 30);
          const color = over ? '#ef4444' : '#2eca7f';
          return (
            <g key={row.storeId}>
              <circle cx={x} cy={y} r={6} fill={color} opacity={0.8} />
              <circle cx={x} cy={y} r={10} fill={color} opacity={0.1} />
            </g>
          );
        })}
        {/* Axes */}
        <line x1={PL} y1={0} x2={PL} y2={H - PB} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
        <line x1={PL} y1={H - PB} x2={W} y2={H - PB} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
        <text x={PL} y={H + 6} style={{ fill: 'var(--text-muted)', fontSize: 8, fontFamily: 'Inter' }}>Low Sales</text>
        <text x={W} y={H + 6} textAnchor="end" style={{ fill: 'var(--text-muted)', fontSize: 8, fontFamily: 'Inter' }}>High Sales</text>
      </svg>
      <div style={{ display: 'flex', gap: 12, fontSize: '0.7rem', marginTop: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--success)' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />Under budget</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--danger)' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', display: 'inline-block' }} />Over budget</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page UI
// ─────────────────────────────────────────────────────────────────────────────

export default function PresupuestoUI() {
  const { filter } = useFilter();
  const { t } = useTranslation();
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
      showToast('error', e.message ?? t('presupuesto.toast_error_load'));
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
          onSaved={() => { setShowEdit(false); fetchData(); showToast('success', t('presupuesto.toast_saved')); }}
          onClose={() => setShowEdit(false)}
        />
      )}

      {/* ── Header ── */}
      <div className="top-header" style={{ marginBottom:0, flexWrap:'wrap', gap:'1rem' }}>
        <div>
          <h1 style={{ fontFamily:'Outfit', fontWeight:700, fontSize:'1.6rem', marginBottom:4 }}>
            <span className="text-gradient">{t('presupuesto.title')}</span> {t('presupuesto.subtitle')}
          </h1>
          <p style={{ color:'var(--text-muted)', fontSize:'0.82rem' }}>
            {t('presupuesto.period_label')}: <strong style={{ color:'var(--text-main)' }}>{periodLabel}</strong>
            &nbsp;·&nbsp; {t('presupuesto.prorated_note')}
          </p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <button
            onClick={() => setShowEdit(true)}
            style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 18px', borderRadius:10, background:'var(--cfs-gold)', border:'none', color:'#000', fontWeight:700, fontSize:'0.85rem', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}
          >
            <Settings2 size={14}/>
            {t('presupuesto.edit_goals')}
          </button>
        </div>
      </div>

      {/* ── No budget warning ── */}
      {!loading && data && !data.hasBudgetData && (
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 18px', borderRadius:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)', color:'var(--warning)', fontSize:'0.83rem' }}>
          <AlertCircle size={16} style={{ flexShrink:0 }}/>
          <div>
            {t('presupuesto.no_budget_warning')}&nbsp;
            <button onClick={() => setShowEdit(true)} style={{ background:'none', border:'none', color:'var(--cfs-gold)', fontWeight:700, cursor:'pointer', fontSize:'0.83rem', padding:0, textDecoration:'underline' }}>
              {t('presupuesto.configure_link')}
            </button>
          </div>
        </div>
      )}

      {/* ── Info tip ── */}
      {!loading && data && data.hasBudgetData && (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 15px', borderRadius:10, background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.14)', color:'var(--info)', fontSize:'0.8rem' }}>
          <Info size={13} style={{ flexShrink:0 }}/>
          {t('presupuesto.prorated_tip')}
          {data.monthsInRange.length > 1 && <>&nbsp;{t('presupuesto.multimonth_note')}</>}
        </div>
      )}

      {/* ── KPI Cards ────────────────────────────────────────────────────────── */}
      <div className="grid-cols-4">
        {loading ? (
          [0,1,2,3].map(i => (
            <div key={i} className="glass-card" style={{ gap: 10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ width:'55%', height:9, borderRadius:5, background:'rgba(255,255,255,0.05)', animation:'shimmer 1.5s infinite', backgroundSize:'200% 100%', backgroundImage:'linear-gradient(90deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.09) 50%,rgba(255,255,255,0.04) 100%)' }} />
                <div style={{ width:34, height:34, borderRadius:10, background:'rgba(255,255,255,0.05)', animation:'shimmer 1.5s infinite', backgroundSize:'200% 100%', backgroundImage:'linear-gradient(90deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.09) 50%,rgba(255,255,255,0.04) 100%)' }} />
              </div>
              <div style={{ width:'70%', height:28, borderRadius:8, background:'rgba(255,255,255,0.05)', animation:'shimmer 1.5s infinite', backgroundSize:'200% 100%', backgroundImage:'linear-gradient(90deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.09) 50%,rgba(255,255,255,0.04) 100%)' }} />
            </div>
          ))
        ) : (
          [
            { label: t('presupuesto.kpi_budget'),      value: fmt$(totals.totalBudget),       icon:<Target size={18}/>,      color:'var(--cfs-gold)', bg:'rgba(221,167,86,0.08)' },
            { label: t('presupuesto.kpi_sales'),        value: fmt$(totals.totalActual),        icon:<DollarSign size={18}/>,  color:'var(--success)',  bg:'rgba(46,202,127,0.08)' },
            {
              label: t('presupuesto.kpi_achievement'),
              value: fmtPct(totals.overallAchieve),
              icon: totals.overallAchieve != null && totals.overallAchieve >= 100 ? <TrendingUp size={18}/> : <TrendingDown size={18}/>,
              color: totals.overallAchieve == null ? 'var(--text-muted)' : totals.overallAchieve >= 100 ? 'var(--success)' : totals.overallAchieve >= 80 ? 'var(--warning)' : 'var(--danger)',
              bg: totals.overallAchieve != null && totals.overallAchieve >= 100 ? 'rgba(46,202,127,0.08)' : 'rgba(239,68,68,0.08)',
            },
            { label: t('presupuesto.kpi_labor_pct'),    value: fmtPct(totals.overallLaborPct), icon:<AlertCircle size={18}/>, color:'var(--info)',     bg:'rgba(59,130,246,0.08)' },
          ].map((k,i) => (
            <div key={i} className="glass-card" style={{ gap:'0.5rem', animation:`fade-in-up 0.4s ease both`, animationDelay:`${i*0.08}s` }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontSize:'0.72rem', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{k.label}</span>
                <span style={{ padding:8, borderRadius:10, background:k.bg, color:k.color }}>{k.icon}</span>
              </div>
              <div style={{ fontFamily:'Outfit', fontWeight:700, fontSize:'1.5rem', color: k.color }}>{k.value}</div>
              {/* Mini progress bar on achievement card */}
              {i === 2 && totals.overallAchieve != null && (
                <div style={{ width:'100%', height:3, borderRadius:3, background:'rgba(255,255,255,0.06)', overflow:'hidden', marginTop:2 }}>
                  <div style={{ width:`${Math.min(totals.overallAchieve, 100)}%`, height:'100%', background:k.color, borderRadius:3, transition:'width 0.8s ease' }} />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ── Charts row 1: Donut + Achievement bars ── */}
      {!loading && data && data.rows.length > 0 && (
        <div className="glass-card" style={{ display:'flex', flexWrap:'wrap', gap:'2.5rem', alignItems:'flex-start' }}>
          <StatusDonut rows={data.rows} t={t} />
          <AchievementBarChart rows={data.rows} t={t} />
        </div>
      )}

      {/* ── Charts row 2: Variance waterfall + Labor scatter ── */}
      {!loading && data && data.rows.length > 1 && (
        <div className="glass-card" style={{ display:'flex', flexWrap:'wrap', gap:'2.5rem', alignItems:'flex-start' }}>
          <VarianceWaterfall rows={data.rows} />
          <LaborBubble rows={data.rows} />
        </div>
      )}

      {/* ── Comparison Table ──────────────────────────────────────────────────── */}
      <div className="glass-card" style={{ padding:0, overflow:'hidden', opacity: loading ? 0.65 : 1, transition:'opacity 0.25s' }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border-color)', display:'flex', alignItems:'center', gap:8 }}>
          <Edit3 size={15} style={{ color:'var(--cfs-gold)' }}/>
          <span style={{ fontFamily:'Outfit', fontWeight:700, fontSize:'0.95rem' }}>{t('presupuesto.table_title')}</span>
          {loading && <RefreshCw size={13} style={{ animation:'spin 1s linear infinite', color:'var(--text-muted)', marginLeft:4 }}/>}
        </div>

        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.8rem' }}>
            <thead style={{ position:'sticky', top:0, zIndex:2, background:'var(--bg-card)' }}>
              <tr style={{ borderBottom:'1px solid var(--border-color)', background:'rgba(255,255,255,0.02)' }}>
                {([
                  { l: t('presupuesto.col_store'),          k:'storeName',            a:'left'   as const },
                  { l: t('presupuesto.col_budget'),          k:'proratedSalesBudget',  a:'center' as const },
                  { l: t('presupuesto.col_sales'),           k:'actualNetSales',       a:'center' as const },
                  { l: t('presupuesto.col_variance'),        k:'salesVariance',        a:'center' as const },
                  { l: t('presupuesto.col_achievement'),     k:'salesAchievementPct',  a:'center' as const },
                  { l: t('presupuesto.col_labor_target'),    k:'budgetLaborPct',       a:'center' as const },
                  { l: t('presupuesto.col_labor_actual'),    k:'actualLaborPct',       a:'center' as const },
                  { l: t('presupuesto.col_labor_cost'),      k:'actualLaborCost',      a:'center' as const },
                ] as { l:string; k:SortCol; a:'left'|'center' }[]).map(col => {
                  const active = sortCol === col.k;
                  return (
                    <th
                      key={col.k}
                      onClick={() => toggleSort(col.k)}
                      style={{
                        padding:'8px 10px', textAlign:col.a,
                        fontFamily:'Outfit', fontWeight:700, fontSize:'0.68rem',
                        textTransform:'uppercase', letterSpacing:'0.05em',
                        color: active ? 'var(--cfs-gold)' : 'var(--text-muted)',
                        whiteSpace:'nowrap', cursor:'pointer', userSelect:'none',
                        transition:'color 0.2s',
                      }}
                    >
                      <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}>
                        {col.l}
                        <span style={{ display:'inline-flex', flexDirection:'column', gap:1, opacity: active ? 1 : 0.3, transition:'opacity 0.2s' }}>
                          <span style={{ width:0, height:0, borderLeft:'3px solid transparent', borderRight:'3px solid transparent', borderBottom:`3.5px solid ${active && sortDir==='asc' ? 'var(--cfs-gold)' : 'currentColor'}`, display:'block', opacity: active && sortDir==='desc' ? 0.3 : 1 }}/>
                          <span style={{ width:0, height:0, borderLeft:'3px solid transparent', borderRight:'3px solid transparent', borderTop:`3.5px solid ${active && sortDir==='desc' ? 'var(--cfs-gold)' : 'currentColor'}`, display:'block', opacity: active && sortDir==='asc' ? 0.3 : 1 }}/>
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
                const fullName  = row.storeName ?? `Store ${row.storeId}`;
                const shortName = fullName
                  .replace(/^CFS Coffee\s*[-–]\s*/i, '')
                  .replace(/^CFS\s+/i, '');
                const display   = shortName.length > 22 ? shortName.slice(0, 21) + '…' : shortName;
                return (
                  <tr key={row.storeId} style={{ borderBottom:'1px solid var(--border-color)', background: idx%2===0 ? 'transparent' : 'rgba(255,255,255,0.015)', animation:`rowIn 0.25s ease both`, animationDelay:`${idx*0.03}s` }}>
                    <td style={{ padding:'7px 10px', maxWidth: 160 }}>
                      <div style={{ fontWeight:600, fontSize:'0.82rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={fullName}>{display}</div>
                      {row.locationCode && <div style={{ fontSize:'0.68rem', color:'var(--text-muted)', marginTop:1 }}>{row.locationCode}</div>}
                    </td>
                    <td style={{ padding:'7px 10px', textAlign:'center', fontWeight:600, fontSize:'0.8rem', color: row.proratedSalesBudget ? 'var(--text-main)' : 'var(--text-muted)' }}>
                      {fmt$(row.proratedSalesBudget ?? 0)}
                    </td>
                    <td style={{ padding:'7px 10px', textAlign:'center', fontWeight:700, fontSize:'0.8rem' }}>{fmt$(row.actualNetSales)}</td>
                    <td style={{ padding:'7px 10px', textAlign:'center', fontSize:'0.8rem' }}>
                      {row.salesVariance != null
                        ? <span style={{ fontWeight:700, color: varPos ? 'var(--success)' : 'var(--danger)' }}>{varPos?'+':''}{fmt$(row.salesVariance)}</span>
                        : <span style={{ color:'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding:'7px 10px', textAlign:'center' }}>
                      <AchieveBadge pct={row.salesAchievementPct} noGoalLabel={t('presupuesto.no_goal')}/>
                    </td>
                    <td style={{ padding:'7px 10px', textAlign:'center', color:'var(--text-muted)', fontSize:'0.8rem' }}>{fmtPct(row.budgetLaborPct)}</td>
                    <td style={{ padding:'7px 10px', textAlign:'center', fontSize:'0.8rem' }}>
                      {row.actualLaborPct != null
                        ? <span style={{ fontWeight:700, color: laborOver ? 'var(--danger)' : 'var(--success)' }}>{fmtPct(row.actualLaborPct)}</span>
                        : <span style={{ color:'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding:'7px 10px', textAlign:'center', color:'var(--text-muted)', fontWeight:600, fontSize:'0.8rem' }}>{fmt$(row.actualLaborCost)}</td>
                  </tr>
                );
              })}

              {/* Totals row */}
              {data && data.rows.length > 1 && (
                <tr style={{ borderTop:'2px solid var(--border-color)', background:'rgba(221,167,86,0.04)' }}>
                  <td style={{ padding:'8px 10px', fontFamily:'Outfit', fontWeight:700, fontSize:'0.82rem', color:'var(--cfs-gold)', letterSpacing:'0.05em' }}>{t('presupuesto.total_row')}</td>
                  <td style={{ padding:'8px 10px', textAlign:'center', fontWeight:700, fontSize:'0.8rem' }}>{fmt$(totals.totalBudget)}</td>
                  <td style={{ padding:'8px 10px', textAlign:'center', fontWeight:700, fontSize:'0.8rem' }}>{fmt$(totals.totalActual)}</td>
                  <td style={{ padding:'8px 10px', textAlign:'center', fontWeight:700, fontSize:'0.8rem', color:(totals.totalActual-totals.totalBudget)>=0?'var(--success)':'var(--danger)' }}>
                    {totals.totalBudget > 0 ? `${(totals.totalActual-totals.totalBudget)>=0?'+':''}${fmt$(totals.totalActual-totals.totalBudget)}` : '—'}
                  </td>
                  <td style={{ padding:'8px 10px', textAlign:'center' }}><AchieveBadge pct={totals.overallAchieve} noGoalLabel={t('presupuesto.no_goal')}/></td>
                  <td style={{ padding:'8px 10px', textAlign:'center', color:'var(--text-muted)', fontSize:'0.8rem' }}>—</td>
                  <td style={{ padding:'8px 10px', textAlign:'center', fontWeight:700, fontSize:'0.8rem' }}>{fmtPct(totals.overallLaborPct)}</td>
                  <td style={{ padding:'8px 10px', textAlign:'center', fontWeight:700, fontSize:'0.8rem' }}>{fmt$(totals.totalLaborCost)}</td>
                </tr>
              )}
            </tbody>
          </table>

          {!loading && data?.rows.length === 0 && (
            <div style={{ padding:'3rem', textAlign:'center', color:'var(--text-muted)', fontSize:'0.87rem' }}>
              {t('presupuesto.no_stores')}
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:16, alignItems:'center', padding:'10px 14px', borderRadius:10, background:'rgba(255,255,255,0.02)', border:'1px solid var(--border-color)', fontSize:'0.77rem', color:'var(--text-muted)' }}>
        <span style={{ color:'var(--success)', fontWeight:600 }}>● ≥ 100%</span> {t('presupuesto.legend_met')}
        <span style={{ color:'var(--warning)', fontWeight:600 }}>● 80–99%</span> {t('presupuesto.legend_risk')}
        <span style={{ color:'var(--danger)',  fontWeight:600 }}>● &lt; 80%</span> {t('presupuesto.legend_below')}
        <span style={{ marginLeft:'auto' }}>{t('presupuesto.legend_source')}</span>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes rowIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fade-in-up { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>
    </div>
  );
}

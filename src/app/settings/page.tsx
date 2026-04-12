'use client';
import { useState, useEffect } from 'react';
import { Users, Shield, Plus, Trash2, CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: 'ADMIN' | 'MANAGER';
  store_id: number | null;
  created_at: string;
};

type Toast = { id: number; type: 'success' | 'error'; message: string };

function Toaster({ toasts, remove }: { toasts: Toast[]; remove: (id: number) => void }) {
  return (
    <div style={{ position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px', pointerEvents: 'none' }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: t.type === 'success' ? 'rgba(46,202,127,0.15)' : 'rgba(239,68,68,0.15)',
          border: `1px solid ${t.type === 'success' ? 'rgba(46,202,127,0.4)' : 'rgba(239,68,68,0.4)'}`,
          color: t.type === 'success' ? 'var(--success)' : 'var(--danger)',
          backdropFilter: 'blur(12px)', borderRadius: '12px',
          padding: '12px 16px', fontSize: '0.88rem', fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          animation: 'fade-in-up 0.3s ease',
          pointerEvents: 'all',
        }}>
          {t.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {t.message}
          <button onClick={() => remove(t.id)} style={{ background: 'none', color: 'inherit', marginLeft: '4px', opacity: 0.7 }}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <AlertCircle size={40} style={{ color: 'var(--danger)', margin: '0 auto 1rem' }} />
        <h3 style={{ marginBottom: '0.75rem', fontFamily: 'Outfit' }}>¿Confirmar acción?</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{message}</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-main)', fontFamily: 'inherit' }}>
            Cancelar
          </button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '10px', background: 'var(--danger)', border: 'none', borderRadius: '8px', color: '#fff', fontFamily: 'inherit', fontWeight: 700 }}>
            Eliminar Acceso
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // New user state
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'ADMIN' | 'MANAGER'>('MANAGER');

  const addToast = (type: Toast['type'], message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/users');
      if (res.status === 403) {
        addToast('error', 'Solo los administradores pueden ver esta sección.');
        return;
      }
      const data = await res.json();
      if (data.users) setUsers(data.users);
    } catch {
      addToast('error', 'Error al cargar la lista de usuarios.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, password: newPassword, full_name: newName, role: newRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowAddModal(false);
        setNewEmail(''); setNewPassword(''); setNewName(''); setNewRole('MANAGER');
        addToast('success', `Usuario ${newName} creado con éxito.`);
        fetchUsers();
      } else {
        addToast('error', data.error ?? 'Error al crear usuario.');
      }
    } catch {
      addToast('error', 'Error de conexión al crear usuario.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    setConfirmDelete(null);
    try {
      const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        addToast('success', 'Acceso eliminado correctamente.');
        fetchUsers();
      } else {
        addToast('error', data.error ?? 'Error al eliminar el acceso.');
      }
    } catch {
      addToast('error', 'Error de conexión al eliminar.');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: '8px',
    background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)',
    color: 'var(--text-main)', fontSize: '0.88rem', fontFamily: 'inherit',
    outline: 'none', transition: 'border-color 0.2s',
  };

  return (
    <div className="animate-in">
      <Toaster toasts={toasts} remove={removeToast} />

      {confirmDelete && (
        <ConfirmModal
          message="Esta acción eliminará el acceso del usuario permanentemente. ¿Continuar?"
          onConfirm={() => handleDeleteUser(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <div className="top-header">
        <div>
          <h2>Configuración y Acceso</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Gestiona los permisos y usuarios de la plataforma CFS BI
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            background: 'linear-gradient(135deg, var(--cfs-gold) 0%, #b8860b 100%)',
            color: '#fff', padding: '10px 20px', borderRadius: '12px',
            display: 'flex', alignItems: 'center', gap: '8px',
            fontWeight: 600, boxShadow: '0 4px 14px rgba(221, 167, 86, 0.3)',
            fontFamily: 'inherit',
          }}
        >
          <Plus size={18} /> Nuevo Acceso
        </button>
      </div>

      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Shield size={20} color="var(--cfs-gold)" />
          <h3 style={{ fontSize: '1.1rem' }}>Personal Autorizado</h3>
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            {users.length} {users.length === 1 ? 'usuario' : 'usuarios'}
          </span>
        </div>

        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando directorio...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                  {['USUARIO', 'ROL', 'FECHA REGISTRO', 'ACCIONES'].map(h => (
                    <th key={h} style={{ padding: '1rem 1.5rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No hay perfiles configurados.
                  </td></tr>
                )}
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(221,167,86,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '38px', height: '38px', background: 'rgba(221,167,86,0.1)', color: 'var(--cfs-gold)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontFamily: 'Outfit', flexShrink: 0 }}>
                          {(u.full_name || u.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{u.full_name || 'Sin Nombre'}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <span className={`badge ${u.role === 'ADMIN' ? 'info' : 'success'}`}>
                        {u.role === 'ADMIN' ? 'Administrador' : 'Store Manager'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      {new Date(u.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <button
                        onClick={() => setConfirmDelete(u.id)}
                        style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '6px 10px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', fontFamily: 'inherit', cursor: 'pointer' }}
                        title="Eliminar acceso"
                      >
                        <Trash2 size={14} /> Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal Crear Usuario ─────────────────────────────────────────── */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9997, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '460px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontFamily: 'Outfit' }}>Crear Nuevo Acceso</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', color: 'var(--text-muted)', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                { label: 'Nombre Completo', value: newName, onChange: setNewName, type: 'text', placeholder: 'Ej: Carlos Manager' },
                { label: 'Correo Electrónico', value: newEmail, onChange: setNewEmail, type: 'email', placeholder: 'carlos@cfscoffee.com' },
                { label: 'Contraseña', value: newPassword, onChange: setNewPassword, type: 'password', placeholder: 'Mínimo 6 caracteres' },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', display: 'block', fontWeight: 600 }}>{f.label}</label>
                  <input required value={f.value} onChange={e => f.onChange(e.target.value)} type={f.type} style={inputStyle} placeholder={f.placeholder} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', display: 'block', fontWeight: 600 }}>Nivel de Acceso</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value as 'ADMIN' | 'MANAGER')} style={inputStyle}>
                  <option value="MANAGER">Store Manager — Lectura de métricas</option>
                  <option value="ADMIN">Administrador — Control total</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-main)', fontFamily: 'inherit' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={isSaving} style={{ flex: 1, padding: '12px', background: isSaving ? 'rgba(221,167,86,0.5)' : 'var(--cfs-gold)', border: 'none', borderRadius: '10px', color: '#000', fontFamily: 'Outfit', fontWeight: 700, cursor: isSaving ? 'not-allowed' : 'pointer' }}>
                  {isSaving ? 'Creando…' : 'Crear Acceso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

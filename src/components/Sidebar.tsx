'use client';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  BarChart3,
  Coffee,
  Store,
  Users,
  Package,
  Settings,
  TrendingUp,
  LogOut,
  Sun,
  Moon,
  RefreshCw,
  Check,
} from 'lucide-react';
import styles from './Sidebar.module.css';
import { createClient } from '@/utils/supabase/client';
import { useTheme } from '@/context/ThemeContext';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const [userName, setUserName] = useState<string>('Admin');
  const [userRole, setUserRole] = useState<string>('Gerente General');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(false);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await fetch('/api/revalidate', { method: 'POST' });
      setRefreshed(true);
      setTimeout(() => setRefreshed(false), 3000);
    } catch {
      // silent fail
    } finally {
      setRefreshing(false);
    }
  };

  // Load the real user from Supabase session
  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Prefer display name from metadata, fall back to email username
      const meta = user.user_metadata ?? {};
      const name =
        meta.full_name ??
        meta.name ??
        user.email?.split('@')[0] ??
        'Admin';

      // Role from metadata if set, otherwise default
      const role = meta.role ?? meta.user_role ?? 'Gerente General';

      setUserName(String(name));
      setUserRole(String(role));
    }
    loadUser();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const navItems = [
    { name: 'Dashboard',    path: '/',          icon: <BarChart3 size={20} /> },
    { name: 'Ventas',       path: '/ventas',     icon: <TrendingUp size={20} /> },
    { name: 'Sucursales',   path: '/sucursales', icon: <Store size={20} /> },
    { name: 'Labor',        path: '/inventario', icon: <Package size={20} /> },
    { name: 'Clientes',     path: '/clientes',   icon: <Users size={20} /> },
    { name: 'Canales',      path: '/productos',  icon: <Coffee size={20} /> },
  ];

  return (
    <aside className="sidebar">
      {/* LOGO EMBLEMA */}
      <div className={styles.logoContainer} style={{ display: 'flex', justifyContent: 'center', padding: '0.5rem 0 1.5rem 0' }}>
        <Image
          src="/logo-cuadrado.png"
          alt="CFS Emblem"
          width={180}
          height={180}
          className={styles.heroLogo}
          priority
        />
      </div>

      <nav className={styles.nav}>
        <div className={styles.navSection}>MENÚ PRINCIPAL</div>
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.name}
              href={item.path}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
            >
              {item.icon}
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* CUADRANTE INFERIOR */}
      <div className={styles.bottomNav}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <Image
            src="/logo-largo.png"
            alt="CFS Coffee for the soul"
            width={180}
            height={55}
            style={{ objectFit: 'contain', filter: 'brightness(0) invert(1) drop-shadow(0px 2px 8px rgba(255,255,255,0.15))' }}
            priority
          />
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            padding: '8px 12px',
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
            color: 'var(--cfs-slate)',
            fontSize: '0.82rem',
            fontWeight: 500,
            marginBottom: '0.4rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
        </button>

        {/* Refresh data cache */}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          title="Forzar actualización de datos (busts el caché ISR)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            padding: '8px 12px',
            borderRadius: '10px',
            background: refreshed
              ? 'rgba(46,202,127,0.1)'
              : 'rgba(255,255,255,0.04)',
            border: `1px solid ${refreshed ? 'rgba(46,202,127,0.3)' : 'rgba(255,255,255,0.07)'}`,
            color: refreshed ? 'var(--success)' : 'var(--cfs-slate)',
            fontSize: '0.82rem',
            fontWeight: 500,
            marginBottom: '0.5rem',
            cursor: refreshing ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s',
            opacity: refreshing ? 0.7 : 1,
          }}
        >
          {refreshed
            ? <><Check size={15} /> Datos actualizados</>
            : <><RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} /> Actualizar datos</>
          }
        </button>

        <Link href="/settings" className={styles.navItem}>
          <Settings size={20} />
          <span>Configuración</span>
        </Link>

        <div className={styles.userProfile} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className={styles.avatar}>
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{userName}</span>
              <span className={styles.userRole}>{userRole}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{ background: 'transparent', color: 'var(--danger)', padding: '6px', cursor: 'pointer', opacity: 0.8 }}
            title="Cerrar Sesión"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}

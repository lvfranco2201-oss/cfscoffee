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
  Globe,
  RefreshCw,
  Check
} from 'lucide-react';
import styles from './Sidebar.module.css';
import { createClient } from '@/utils/supabase/client';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/lib/i18n/LanguageContext';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { t, locale, toggleLanguage } = useTranslation();

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
      const rawName =
        meta.full_name ??
        meta.name ??
        user.email?.split('@')[0] ??
        'Admin';
      
      const firstName = String(rawName).trim().split(' ')[0];

      // Role from metadata if set, otherwise default
      let role = meta.role ?? meta.user_role ?? 'Gerente General';
      if (role === 'ADMIN') role = 'Administrador';
      if (role === 'MANAGER') role = 'Store Manager';

      setUserName(firstName);
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
    { name: t('sidebar.dashboard'),        path: '/',           icon: <BarChart3 size={20} />, enabled: true  },
    { name: t('sidebar.ventas'),           path: '/ventas',     icon: <TrendingUp size={20} />, enabled: false },
    { name: t('sidebar.sucursales'),       path: '/sucursales', icon: <Store size={20} />,     enabled: false },
    { name: t('sidebar.costos_laborales'), path: '/inventario', icon: <Package size={20} />,   enabled: false },
    { name: t('sidebar.clientes'),         path: '/clientes',   icon: <Users size={20} />,     enabled: false },
    { name: t('sidebar.productos'),        path: '/productos',  icon: <Coffee size={20} />,    enabled: false },
  ];

  return (
    <aside className="sidebar">
      {/* LOGO EMBLEMA */}
      <div className={styles.logoContainer} style={{ display: 'flex', justifyContent: 'center', padding: '0 0 1rem 0' }}>
        <Image
          src="/logo-cuadrado.png"
          alt="CFS Emblem"
          width={130}
          height={130}
          className={styles.heroLogo}
          priority
        />
      </div>

      {/* MENÚ PRINCIPAL */}
      <nav className={styles.nav}>
        <div className={styles.navSection}>{t('sidebar.menu_principal')}</div>
        {navItems.map((item) => {
          const isActive = pathname === item.path;

          if (!item.enabled) {
            // Disabled / coming-soon item — no link, just visual
            return (
              <div
                key={item.path}
                className={styles.navItem}
                style={{ opacity: 0.4, cursor: 'not-allowed', position: 'relative' }}
                title={locale === 'en' ? 'Coming Soon' : 'Próximamente'}
              >
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>
                  <div style={{ position: 'relative', zIndex: 1 }}>{item.icon}</div>
                </div>
                <span className={styles.navItemText}>{item.name}</span>
                {/* Pill visible on wider sidebar */}
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '0.6rem', fontWeight: 700,
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                  background: 'rgba(221,167,86,0.12)',
                  color: 'rgba(221,167,86,0.6)',
                  border: '1px solid rgba(221,167,86,0.15)',
                  borderRadius: '6px', padding: '2px 6px',
                  whiteSpace: 'nowrap',
                  display: 'var(--sidebar-pill-display, none)',
                }}>
                  {locale === 'en' ? 'Soon' : 'Pronto'}
                </span>
              </div>
            );
          }

          return (
            <Link
              key={item.path}
              href={item.path}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
            >
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isActive ? '#DDA756' : '#94A3B8' }}>
                {isActive && (
                  <span style={{ position: 'absolute', inset: -4, background: 'rgba(221, 167, 86, 0.4)', filter: 'blur(8px)', borderRadius: '50%', zIndex: 0 }} />
                )}
                <div style={{ position: 'relative', zIndex: 1 }}>{item.icon}</div>
              </div>
              <span className={styles.navItemText}>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div style={{ flexGrow: 1 }} />

      {/* CUADRANTE INFERIOR */}
      <div className={styles.bottomNav}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.8rem' }}>
          <Image
            src="/logo-largo.png"
            alt="CFS Coffee for the soul"
            width={150}
            height={40}
            style={{ objectFit: 'contain', filter: 'brightness(0) invert(1) drop-shadow(0px 2px 8px rgba(255,255,255,0.15))' }}
            priority
          />
        </div>

        {/* Language toggle */}
        <button
          onClick={toggleLanguage}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
            padding: '8px 12px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
            color: 'var(--cfs-slate)', fontSize: '0.82rem', fontWeight: 500,
            marginBottom: '0.4rem', cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          <Globe size={15} />
          {locale === 'en' ? 'Español' : 'English'}
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
            padding: '8px 12px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
            color: 'var(--cfs-slate)', fontSize: '0.82rem', fontWeight: 500,
            marginBottom: '0.4rem', cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          {theme === 'dark' ? t('sidebar.modo_claro') : t('sidebar.modo_oscuro')}
        </button>

        {/* <Link href="/settings" className={styles.navItem}>
          <Settings size={20} />
          <span>Configuración</span>
        </Link> */}
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

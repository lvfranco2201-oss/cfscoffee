'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErrorMsg('Credenciales incorrectas. Verifica tu correo y contraseña.');
      setLoading(false);
    } else {
      router.push('/');
      router.refresh();
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 16px',
    paddingRight: '44px',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#fff',
    outline: 'none',
    fontFamily: 'Outfit, sans-serif',
    fontSize: '0.95rem',
    transition: 'border-color 0.2s, background 0.2s',
    boxSizing: 'border-box',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: `url('/IMG_8255.avif')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
      }}
    >
      {/* Crystalline overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(135deg, rgba(7,11,20,0.97) 0%, rgba(7,11,20,0.75) 60%, rgba(221,167,86,0.08) 100%)',
        zIndex: 0,
      }} />

      {/* Ambient glow */}
      <div style={{
        position: 'absolute',
        bottom: '15%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '500px',
        height: '200px',
        background: 'radial-gradient(ellipse, rgba(221,167,86,0.12) 0%, transparent 70%)',
        zIndex: 0,
        pointerEvents: 'none',
      }} />

      {/* Login card */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: '420px',
          margin: '20px',
          padding: '3rem 2.5rem 2.5rem',
          borderRadius: '24px',
          background: 'rgba(12,20,36,0.65)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          animation: 'fade-in-up 0.5s ease',
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: '1.75rem', animation: 'float 6s ease-in-out infinite' }}>
          <Image
            src="/logo-cuadrado.png"
            alt="CFS Coffee"
            width={120}
            height={120}
            style={{ objectFit: 'contain', filter: 'brightness(0) invert(1) drop-shadow(0px 6px 20px rgba(221,167,86,0.5))' }}
            priority
          />
        </div>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontFamily: 'Outfit', fontSize: '1.65rem', fontWeight: 800, color: '#fff', marginBottom: '0.3rem', letterSpacing: '-0.02em' }}>
            CFS Coffee BI
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.88rem', letterSpacing: '0.04em' }}>
            Plataforma Analítica Corporativa
          </p>
        </div>

        {/* Divider */}
        <div style={{ width: '100%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(221,167,86,0.3), transparent)', marginBottom: '1.75rem' }} />

        {/* Form */}
        <form onSubmit={handleLogin} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Email */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Correo Corporativo
            </label>
            <input
              type="email"
              required
              placeholder="correo@cfscoffee.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = 'rgba(221,167,86,0.6)'; e.target.style.background = 'rgba(255,255,255,0.08)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; e.target.style.background = 'rgba(255,255,255,0.06)'; }}
            />
          </div>

          {/* Password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Contraseña
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...inputStyle, letterSpacing: showPassword ? 'normal' : (password ? '3px' : 'normal') }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(221,167,86,0.6)'; e.target.style.background = 'rgba(255,255,255,0.08)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; e.target.style.background = 'rgba(255,255,255,0.06)'; }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', color: 'rgba(255,255,255,0.35)', padding: '4px',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {errorMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#f87171',
              fontSize: '0.83rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              animation: 'fade-in-up 0.3s ease',
            }}>
              ⚠ {errorMsg}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !email || !password}
            style={{
              marginTop: '0.75rem',
              width: '100%',
              padding: '15px',
              borderRadius: '12px',
              background: loading || !email || !password
                ? 'rgba(221,167,86,0.3)'
                : 'linear-gradient(135deg, #DDA756 0%, #b8860b 100%)',
              color: loading || !email || !password ? 'rgba(255,255,255,0.4)' : '#070b14',
              border: 'none',
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 800,
              fontSize: '0.95rem',
              letterSpacing: '0.06em',
              cursor: loading || !email || !password ? 'not-allowed' : 'pointer',
              transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px',
              boxShadow: loading || !email || !password ? 'none' : '0 4px 20px rgba(221,167,86,0.35)',
            }}
            onMouseOver={(e) => { if (!loading && email && password) e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseOut={(e) => { if (!loading && email && password) e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            {loading ? (
              <span style={{ width: '20px', height: '20px', border: '2.5px solid rgba(0,0,0,0.2)', borderTopColor: '#070b14', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
            ) : (
              <><LogIn size={16} /> INGRESAR AL SISTEMA</>
            )}
          </button>
        </form>

        {/* Footer */}
        <p style={{ marginTop: '2rem', fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', textAlign: 'center', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Powered by Toast API Analytics · CFSCoffee BI v3
        </p>
      </div>
    </div>
  );
}

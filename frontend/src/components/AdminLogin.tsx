import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  ChevronRight, LogIn, ClipboardList, CreditCard, Wrench, AlertCircle,
} from 'lucide-react';
import loginWorkshop from '../assets/login-workshop.png';

export type AuthUser = { email: string; name: string };

const API_BASE = 'http://localhost:3000';

export default function AdminLogin({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Email dan kata sandi wajib diisi.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Email atau kata sandi salah.');
        return;
      }

      localStorage.setItem('bengkel_token', data.token);
      localStorage.setItem('bengkel_user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch {
      setError('Tidak dapat terhubung ke server. Pastikan backend berjalan di port 3000.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="admin-login-page">
      <section className="admin-login-left">
        <div className="admin-login-left-inner">
          <span className="admin-login-badge"><i /> SISTEM MANAJEMEN BENGKEL SATU PINTU</span>
          <div className="admin-login-copy">
            <h1>KELOLA BENGKEL,<br />SATU PINTU.</h1>
            <p>Antrean, kasir, dan komisi mekanik dalam satu layar.</p>
          </div>
          <div className="admin-login-preview">
            <div className="admin-login-illustration">
              <img src={loginWorkshop} alt="Ilustrasi bengkel" className="illustration-image" />
            </div>
            <div className="admin-login-features">
              <span><ClipboardList size={14} /> Kanban Antrean</span>
              <span><CreditCard size={14} /> Kasir &amp; Struk</span>
              <span><Wrench size={14} /> Komisi Otomatis</span>
            </div>
          </div>
          <div className="admin-login-footer">
            <span>Bengkel MVP v1.0 · Command Center</span>
            <span>Akses Khusus Admin &amp; Kasir</span>
          </div>
        </div>
      </section>

      <section className="admin-login-right">
        <div className="admin-login-card">
          <div className="admin-login-brand">
            <span className="admin-login-icon"><Wrench size={20} /></span>
            <span>
              <strong>Bengkel</strong>
              <small>SATU PINTU DASHBOARD</small>
            </span>
          </div>
          <h2>Masuk ke Dasbor</h2>
          <p className="admin-login-description">Masukkan kredensial admin Anda untuk mengelola operasional.</p>

          {error && (
            <div className="admin-login-error" role="alert">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          <form className="admin-login-form" onSubmit={submitLogin}>
            <label className="admin-login-field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@bengkelmvp.com"
                autoComplete="email"
                disabled={loading}
                required
              />
            </label>
            <label className="admin-login-field">
              <span>Kata sandi</span>
              <div className="admin-password-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Masukkan kata sandi"
                  autoComplete="current-password"
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  <LogIn size={16} />
                </button>
              </div>
            </label>
            <div className="admin-login-options">
              <label><input type="checkbox" /> <span>Ingat saya</span></label>
              <span>Sesi 24 jam</span>
            </div>
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? (
                <><span className="admin-login-spinner" /> Memverifikasi…</>
              ) : (
                <>Masuk ke Dasbor <ChevronRight size={17} /></>
              )}
            </button>
          </form>

          <p className="admin-login-help">
            Lupa kata sandi? <strong>Hubungi pemilik bengkel</strong> untuk reset akun admin.
          </p>
        </div>
      </section>
    </main>
  );
}
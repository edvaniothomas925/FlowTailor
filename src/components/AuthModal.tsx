import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, RefreshCw, AlertTriangle, Scissors, Sparkles } from 'lucide-react';
import { toast } from '../lib/toast';
import { customAuth } from '../lib/neonStore';

interface AuthModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onLoginSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen = true,
  onClose,
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Por favor, introduza um e-mail válido.');
      return;
    }

    if (!password) {
      setErrorMessage('Por favor, introduza a palavra-passe.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Enviar requisição POST para /api/auth/login
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: cleanEmail,
          password: password,
        }),
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch (parseErr) {
        console.warn('Erro ao processar JSON de login:', parseErr);
      }

      // 2. Não permitir o redirecionamento se a API responder com status de erro (ex: 401 ou 400)
      if (!response.ok || !data || data.success === false) {
        const errorMsg = 'E-mail ou palavra-passe inválidos.';
        setErrorMessage(errorMsg);
        toast.error(errorMsg);
        return;
      }

      // 3. Apenas se a autenticação for válida, conclui a sessão local e redireciona
      await customAuth.login(cleanEmail, password);
      toast.success('Sessão iniciada com sucesso!');

      if (onLoginSuccess) {
        onLoginSuccess();
      } else if (onClose) {
        onClose();
      }
    } catch (err: any) {
      const errorMsg = 'E-mail ou palavra-passe inválidos.';
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      id="auth-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
    >
      <div
        id="auth-modal-container"
        className="w-full max-w-md bg-white rounded-3xl border border-atelier-200/80 shadow-2xl shadow-slate-900/20 overflow-hidden"
      >
        <div className="p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-atelier-600 text-white rounded-2xl mb-1 shadow-md shadow-atelier-600/20">
              <Scissors className="w-6 h-6 rotate-45" />
            </div>
            <h2 className="text-2xl font-extrabold font-display text-slate-900 flex items-center justify-center gap-1.5">
              FlowTailor <Sparkles className="w-4 h-4 text-atelier-500 fill-atelier-300" />
            </h2>
            <p className="text-xs text-slate-500">
              Inicie sessão com o seu e-mail e palavra-passe
            </p>
          </div>

          {errorMessage && (
            <div
              id="auth-error-alert"
              className="p-3 bg-red-50 border border-red-200 text-xs font-semibold text-red-700 rounded-xl leading-normal flex items-start gap-2"
            >
              <AlertTriangle className="w-4.5 h-4.5 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form id="auth-login-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-500" /> Endereço de E-mail
              </label>
              <input
                id="login-email-input"
                type="email"
                required
                placeholder="seu.email@exemplo.com"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-atelier-500/20 focus:border-atelier-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-slate-500" /> Palavra-passe
                </span>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </label>
              <input
                id="login-password-input"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Introduza a sua palavra-passe"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-atelier-500/20 focus:border-atelier-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="pt-2 space-y-2">
              <button
                id="login-submit-button"
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-atelier-700 hover:bg-atelier-850 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-atelier-750/15 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>A validar credenciais...</span>
                  </>
                ) : (
                  'Entrar no Painel'
                )}
              </button>

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-all text-center cursor-pointer"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';

// Importações do Firebase Config
import {
  auth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from '../firebaseConfig';

// Importação dos assets
import bgImage from '../assets/Back.gif';
import logoImg from '../assets/icon.png';

// Ícones SVG Inline de Alta Fidelidade (100% compatíveis e nítidos em qualquer resolução)
const Icons = {
  User: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Mail: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  ),
  Lock: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  Shield: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  ),
  Eye: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  EyeOff: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
      <line x1="2" x2="22" y1="2" y2="22"/>
    </svg>
  ),
  ArrowBack: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 19-7-7 7-7"/>
      <path d="M19 12H5"/>
    </svg>
  ),
  ArrowForward: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14"/>
      <path d="m12 5 7 7-7 7"/>
    </svg>
  ),
  Login: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
      <polyline points="10 17 15 12 10 7"/>
      <line x1="15" x2="3" y1="12" y2="12"/>
    </svg>
  ),
  UserPlus: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <line x1="19" x2="19" y1="8" y2="14"/>
      <line x1="22" x2="16" y1="11" y2="11"/>
    </svg>
  ),
  Send: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4Z"/>
      <path d="M22 2 11 13"/>
    </svg>
  ),
  CheckCircle: () => (
    <svg className="w-5 h-5 text-lime-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  ),
  AlertCircle: () => (
    <svg className="w-5 h-5 text-red-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" x2="12" y1="8" y2="12"/>
      <line x1="12" x2="12.01" y1="16" y2="16"/>
    </svg>
  ),
  Close: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18"/>
      <path d="m6 6 12 12"/>
    </svg>
  ),
  SSL: () => (
    <svg className="w-3.5 h-3.5 text-lime-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  Cloud: () => (
    <svg className="w-3.5 h-3.5 text-lime-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
    </svg>
  ),
};

export default function LoginScreen() {
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register' | 'forgot'

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Mensagens de alerta inline para feedback visual nítido
  const [feedback, setFeedback] = useState(null); // { type: 'error' | 'success', message: string }

  const showFeedbackMessage = (type, message) => {
    setFeedback({ type, message });
  };

  const clearFeedback = () => setFeedback(null);

  // ==========================================
  // 1. FUNÇÃO DE CADASTRO
  // ==========================================
  const handleRegister = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    clearFeedback();

    if (!name.trim() || !email.trim() || !password) {
      showFeedbackMessage('error', 'Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    if (password.length < 6) {
      showFeedbackMessage('error', 'A senha deve conter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      showFeedbackMessage('error', 'As senhas digitadas não coincidem. Verifique e tente novamente.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(userCredential.user, { displayName: name.trim() });
      showFeedbackMessage('success', `Conta criada com sucesso! Bem-vindo(a), ${name.trim()}!`);
      
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      let friendlyMessage = 'Ocorreu um erro ao criar sua conta. Tente novamente.';
      if (error.code === 'auth/email-already-in-use') {
        friendlyMessage = 'Este endereço de e-mail já está cadastrado em outra conta.';
      } else if (error.code === 'auth/invalid-email') {
        friendlyMessage = 'O formato do e-mail inserido é inválido.';
      } else if (error.code === 'auth/weak-password') {
        friendlyMessage = 'Senha fraca. Utilize pelo menos 6 caracteres combinando letras e números.';
      }
      showFeedbackMessage('error', friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // 2. FUNÇÃO DE LOGIN
  // ==========================================
  const handleLogin = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    clearFeedback();

    if (!email.trim() || !password) {
      showFeedbackMessage('error', 'Preencha seu e-mail e senha para acessar a plataforma.');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      let friendlyMessage = 'E-mail ou senha incorretos. Verifique seus dados.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        friendlyMessage = 'Credenciais inválidas. Verifique o e-mail e a senha digitados.';
      } else if (error.code === 'auth/invalid-email') {
        friendlyMessage = 'O formato do e-mail digitado é inválido.';
      } else if (error.code === 'auth/too-many-requests') {
        friendlyMessage = 'Muitas tentativas sem sucesso. Aguarde alguns instantes e tente novamente.';
      }
      showFeedbackMessage('error', friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // 3. FUNÇÃO DE RECUPERAR SENHA
  // ==========================================
  const handleResetPassword = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    clearFeedback();

    if (!email.trim()) {
      showFeedbackMessage('error', 'Informe o seu endereço de e-mail para receber o link de redefinição.');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      showFeedbackMessage('success', 'Link de recuperação enviado com sucesso! Verifique sua caixa de entrada e spam.');
      setTimeout(() => {
        setActiveTab('login');
      }, 3500);
    } catch (error) {
      let friendlyMessage = 'Não foi possível enviar o e-mail de recuperação. Verifique o e-mail informado.';
      if (error.code === 'auth/user-not-found') {
        friendlyMessage = 'Nenhuma conta encontrada com este e-mail.';
      } else if (error.code === 'auth/invalid-email') {
        friendlyMessage = 'O formato do e-mail inserido é inválido.';
      }
      showFeedbackMessage('error', friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const bgUrl = typeof bgImage === 'object' ? bgImage.uri || bgImage.default : bgImage;
  const logoUrl = typeof logoImg === 'object' ? logoImg.uri || logoImg.default : logoImg;

  return (
    <div 
      className="relative min-h-[100dvh] w-full flex items-center justify-center bg-cover bg-center bg-no-repeat overflow-y-auto py-5 px-3 sm:p-6 md:p-8"
      style={{ backgroundImage: `url(${bgUrl})` }}
    >
      {/* Dynamic Dark Vignette & Frosted Ambient Backdrop */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/65 to-black/85 backdrop-blur-md" />

      {/* Decorative Radial Glows (Verde Limão) */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-lime-400/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-lime-500/15 rounded-full blur-3xl pointer-events-none hidden sm:block" />

      {/* Main Authentication Container */}
      <div className="relative z-10 w-full max-w-md sm:max-w-lg my-auto animate-fadeIn">
        
        {/* White Glass Card */}
        <div className="bg-white/95 sm:bg-white/98 backdrop-blur-2xl rounded-3xl p-5 sm:p-8 md:p-9 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5),0_0_35px_rgba(163,230,53,0.25)] border border-white/80 transition-all duration-300">
          
          {/* Header & Logo */}
          <div className="flex flex-col items-center text-center mb-4 sm:mb-6">
            
            {/* Logo Badge with Lime Glow */}
            <div className="relative group mb-2.5 sm:mb-3">
              <div className="absolute -inset-1 bg-gradient-to-r from-lime-400 to-lime-500 rounded-3xl blur-sm opacity-80 group-hover:opacity-100 transition duration-300" />
              <div className="relative w-14 h-14 sm:w-20 sm:h-20 rounded-2xl bg-black flex items-center justify-center p-2.5 sm:p-3 border-2 border-lime-400/70 shadow-xl shadow-lime-950/20">
                <img 
                  src={logoUrl} 
                  alt="W3Labs Agro Logo" 
                  className="w-full h-full object-contain filter brightness-100" 
                />
              </div>
            </div>

            {/* Smart Platform Tag */}
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 sm:py-1 rounded-full bg-lime-100 border border-lime-300 text-lime-950 text-[10px] sm:text-xs font-black tracking-wide uppercase mb-1.5 sm:mb-2 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-lime-500 animate-pulse" />
              Plataforma Agrícola Inteligente
            </div>

            {/* Brand Title in Pure Black */}
            <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight font-sans">
              AgroFrank
            </h1>
            <p className="text-[11px] sm:text-sm text-zinc-600 font-bold tracking-wider uppercase mt-0.5">
              W3Labs Agro • Gestão e Alta Produtividade
            </p>
          </div>

          {/* Tab Switcher (Segmented Control) - Only visible when not in 'forgot' mode */}
          {activeTab !== 'forgot' && (
            <div className="mb-4 sm:mb-6 p-1 bg-zinc-100 border border-zinc-200 rounded-2xl flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  clearFeedback();
                  setPassword('');
                  setConfirmPassword('');
                }}
                className={`flex-1 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-black transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
                  activeTab === 'login'
                    ? 'bg-gradient-to-r from-lime-400 via-lime-500 to-lime-600 text-black shadow-md shadow-lime-500/30'
                    : 'text-zinc-700 hover:text-black hover:bg-zinc-200/60'
                }`}
              >
                <Icons.Login />
                <span>Acessar Conta</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('register');
                  clearFeedback();
                  setPassword('');
                  setConfirmPassword('');
                }}
                className={`flex-1 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-black transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
                  activeTab === 'register'
                    ? 'bg-gradient-to-r from-lime-400 via-lime-500 to-lime-600 text-black shadow-md shadow-lime-500/30'
                    : 'text-zinc-700 hover:text-black hover:bg-zinc-200/60'
                }`}
              >
                <Icons.UserPlus />
                <span>Criar Conta</span>
              </button>
            </div>
          )}

          {/* Forgot Password Header (Back Button) */}
          {activeTab === 'forgot' && (
            <div className="mb-4 sm:mb-5 pb-3 sm:pb-4 border-b border-zinc-200">
              <button 
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  clearFeedback();
                }} 
                className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-zinc-700 hover:text-black transition-colors group cursor-pointer"
              >
                <span className="transition-transform group-hover:-translate-x-1 text-black">
                  <Icons.ArrowBack />
                </span>
                <span>Voltar ao login</span>
              </button>
              <h2 className="text-xl sm:text-2xl font-black text-black mt-2.5 sm:mt-3">
                Recuperar Senha
              </h2>
              <p className="text-xs sm:text-sm text-zinc-600 font-medium mt-1">
                Insira o seu e-mail cadastrado para receber o link de redefinição de acesso.
              </p>
            </div>
          )}

          {/* Feedback Notification Banner */}
          {feedback && (
            <div 
              className={`mb-4 sm:mb-5 p-3 sm:p-4 rounded-2xl flex items-start gap-3 border text-xs sm:text-sm animate-fadeIn ${
                feedback.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : 'bg-lime-50 border-lime-300 text-lime-950'
              }`}
            >
              {feedback.type === 'error' ? <Icons.AlertCircle /> : <Icons.CheckCircle />}
              <div className="flex-1 font-bold leading-relaxed">
                {feedback.message}
              </div>
              <button 
                type="button" 
                onClick={clearFeedback}
                className="text-zinc-500 hover:text-black p-1 cursor-pointer"
              >
                <Icons.Close />
              </button>
            </div>
          )}

          {/* Form */}
          <form 
            onSubmit={
              activeTab === 'register' ? handleRegister :
              activeTab === 'login' ? handleLogin : handleResetPassword
            } 
            className="space-y-3.5 sm:space-y-4"
          >
            {/* Campo: Nome Completo (Apenas no Cadastro) */}
            {activeTab === 'register' && (
              <div className="space-y-1">
                <label className="block text-[10px] sm:text-xs font-black text-black uppercase tracking-wider">
                  Nome Completo
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-zinc-500 pointer-events-none flex items-center">
                    <Icons.User />
                  </div>
                  <input
                    type="text"
                    className="w-full bg-zinc-50 border-2 border-zinc-200 rounded-2xl pl-11 pr-4 py-3 sm:py-3.5 text-black text-sm sm:text-base placeholder-zinc-400 font-medium focus:bg-white focus:border-lime-500 focus:ring-4 focus:ring-lime-400/20 transition-all outline-none"
                    placeholder="Ex: João da Silva"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoCapitalize="words"
                    autoComplete="name"
                    required
                  />
                </div>
              </div>
            )}

            {/* Campo: E-mail */}
            <div className="space-y-1">
              <label className="block text-[10px] sm:text-xs font-black text-black uppercase tracking-wider">
                Endereço de E-mail
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-zinc-500 pointer-events-none flex items-center">
                  <Icons.Mail />
                </div>
                <input
                  type="email"
                  className="w-full bg-zinc-50 border-2 border-zinc-200 rounded-2xl pl-11 pr-4 py-3 sm:py-3.5 text-black text-sm sm:text-base placeholder-zinc-400 font-medium focus:bg-white focus:border-lime-500 focus:ring-4 focus:ring-lime-400/20 transition-all outline-none"
                  placeholder="seu.email@fazenda.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoCapitalize="none"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Campo: Senha (Login e Cadastro) */}
            {activeTab !== 'forgot' && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] sm:text-xs font-black text-black uppercase tracking-wider">
                    Senha de Acesso
                  </label>
                  {activeTab === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('forgot');
                        clearFeedback();
                      }}
                      className="text-[11px] sm:text-xs font-bold text-lime-700 hover:text-lime-900 transition-colors cursor-pointer"
                    >
                      Esqueceu a senha?
                    </button>
                  )}
                </div>

                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-zinc-500 pointer-events-none flex items-center">
                    <Icons.Lock />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="w-full bg-zinc-50 border-2 border-zinc-200 rounded-2xl pl-11 pr-12 py-3 sm:py-3.5 text-black text-sm sm:text-base placeholder-zinc-400 font-medium focus:bg-white focus:border-lime-500 focus:ring-4 focus:ring-lime-400/20 transition-all outline-none"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoCapitalize="none"
                    autoComplete={activeTab === 'login' ? 'current-password' : 'new-password'}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 p-1 text-zinc-500 hover:text-black transition-colors cursor-pointer flex items-center justify-center"
                    title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? <Icons.Eye /> : <Icons.EyeOff />}
                  </button>
                </div>
              </div>
            )}

            {/* Campo: Confirmar Senha (Apenas no Cadastro) */}
            {activeTab === 'register' && (
              <div className="space-y-1">
                <label className="block text-[10px] sm:text-xs font-black text-black uppercase tracking-wider">
                  Confirmar Senha
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-zinc-500 pointer-events-none flex items-center">
                    <Icons.Shield />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="w-full bg-zinc-50 border-2 border-zinc-200 rounded-2xl pl-11 pr-12 py-3 sm:py-3.5 text-black text-sm sm:text-base placeholder-zinc-400 font-medium focus:bg-white focus:border-lime-500 focus:ring-4 focus:ring-lime-400/20 transition-all outline-none"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoCapitalize="none"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 p-1 text-zinc-500 hover:text-black transition-colors cursor-pointer flex items-center justify-center"
                    title={showConfirmPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showConfirmPassword ? <Icons.Eye /> : <Icons.EyeOff />}
                  </button>
                </div>
              </div>
            )}

            {/* Botão de Ação Principal (Verde Limão com Texto Preto) */}
            <div className="pt-2 sm:pt-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-lime-400 via-lime-500 to-lime-600 hover:from-lime-300 hover:to-lime-500 active:from-lime-600 active:to-lime-700 text-black text-sm sm:text-base font-black py-3.5 sm:py-4 px-6 rounded-2xl shadow-lg shadow-lime-500/35 hover:shadow-lime-500/50 flex items-center justify-center gap-2.5 transition-all transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer border border-lime-300/80"
              >
                {loading ? (
                  <div className="w-5 h-5 sm:w-6 sm:h-6 border-3 border-black/30 border-t-black rounded-full animate-spin" />
                ) : (
                  <>
                    {activeTab === 'register' ? (
                      <Icons.ArrowForward />
                    ) : activeTab === 'login' ? (
                      <Icons.ArrowForward />
                    ) : (
                      <Icons.Send />
                    )}
                    <span>
                      {activeTab === 'register' && 'Cadastrar e Iniciar'}
                      {activeTab === 'login' && 'Entrar na Plataforma'}
                      {activeTab === 'forgot' && 'Enviar Link de Recuperação'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Security & System Badges Footer */}
          <div className="mt-5 sm:mt-7 pt-4 sm:pt-5 border-t border-zinc-200/80 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 text-zinc-500 text-[10px] sm:text-xs">
            <div className="flex items-center gap-3 font-bold text-zinc-700">
              <span className="inline-flex items-center gap-1">
                <Icons.SSL />
                SSL 256-Bit
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <Icons.Cloud />
                Nuvem Conectada
              </span>
            </div>
            <div className="font-semibold text-zinc-500">
              © 2026 AgroFrank • W3Labs
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

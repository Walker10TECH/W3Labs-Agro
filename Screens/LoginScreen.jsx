import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

// Importações do seu arquivo de configuração do Firebase
import {
  auth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from '../firebaseConfig';

// Importando as imagens diretamente
import bgImage from '../assets/Back.gif';
import logoImg from '../assets/icon.png';

export default function LoginScreen() {
  const [activeTab, setActiveTab] = useState('login');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ==========================================
  // 1. FUNÇÃO DE CADASTRO
  // ==========================================
  const handleRegister = async () => {
    if (!name || !email || !password) {
      window.alert('Atenção: Por favor, preencha todos os campos.');
      return;
    }
    if (password !== confirmPassword) {
      window.alert('Atenção: As senhas não coincidem!');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });
      window.alert(`Sucesso! Conta criada com sucesso para ${name}!`);

      setPassword('');
      setConfirmPassword('');
      // Opcional: setActiveTab('login');
    } catch (error) {
      let friendlyMessage = 'Ocorreu um erro ao criar a conta. Tente novamente.';
      if (error.code === 'auth/email-already-in-use') {
        friendlyMessage = 'Este endereço de email já está em uso por outra conta.';
      } else if (error.code === 'auth/invalid-email') {
        friendlyMessage = 'O endereço de email fornecido é inválido.';
      } else if (error.code === 'auth/weak-password') {
        friendlyMessage = 'Sua senha é muito fraca. Use pelo menos 6 caracteres.';
      }
      window.alert(`Erro no Cadastro: ${friendlyMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // 2. FUNÇÃO DE LOGIN
  // ==========================================
  const handleLogin = async () => {
    if (!email || !password) {
      window.alert('Atenção: Preencha o email e a senha para entrar.');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      let friendlyMessage = 'Ocorreu um erro ao tentar acessar a conta.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        friendlyMessage = 'Email ou senha incorretos.';
      } else if (error.code === 'auth/invalid-email') {
        friendlyMessage = 'O endereço de email fornecido é inválido.';
      }
      window.alert(`Erro no Login: ${friendlyMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // 3. FUNÇÃO DE RECUPERAR SENHA
  // ==========================================
  const handleResetPassword = async () => {
    if (!email) {
      window.alert('Atenção: Por favor, informe seu email no campo para que possamos enviar o link de recuperação.');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      window.alert('Verifique seu Email: O link para redefinição de senha foi enviado para sua caixa de entrada.');
      setActiveTab('login');
      setPassword('');
    } catch (error) {
      window.alert('Erro: Não foi possível enviar o email de redefinição. Verifique se o email digitado está correto.');
    } finally {
      setLoading(false);
    }
  };

  const renderPasswordInput = (placeholder, value, onChangeText, isVisible, toggleVisibility) => (
    <div className="password-container">
      <input
        type={isVisible ? "text" : "password"}
        className="password-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChangeText(e.target.value)}
        autoCapitalize="none"
      />
      <button type="button" onClick={toggleVisibility} className="eye-icon">
        <Ionicons
          name={isVisible ? 'eye-outline' : 'eye-off-outline'}
          size={22}
          color="#888"
        />
      </button>
    </div>
  );

  return (
    <div className="background" style={{ backgroundImage: `url(${typeof bgImage === 'object' ? bgImage.uri || bgImage.default : bgImage})` }}>
      <style>{`
        /* RESET BÁSICO */
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        .background {
          display: flex;
          width: 100vw;
          height: 100vh;
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
        }

        .overlay {
          flex: 1;
          background-color: rgba(0,0,0,0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
        }

        .main-wrapper {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          width: 100%;
          height: 100%;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }

        .top-section {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 0 30px;
          flex: 1;
        }

        .logo-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 40px;
        }

        .logo {
          width: 60px;
          height: 60px;
          object-fit: contain;
          filter: brightness(0) invert(1); /* Aplica efeito tintColor branco */
        }

        .logo-text {
          font-size: 24px;
          color: #fff;
          font-weight: bold;
          margin-top: 8px;
          letter-spacing: 0.5px;
        }

        .form-container {
          width: 100%;
          display: flex;
          flex-direction: column;
        }

        .back-button {
          margin-bottom: 16px;
          align-self: flex-start;
          background: none;
          border: none;
          cursor: pointer;
          color: #fff;
          display: flex;
          align-items: center;
        }

        .header-text {
          font-size: 26px;
          color: #fff;
          font-weight: bold;
          margin-bottom: 24px;
          text-align: center;
        }

        .sub-header-text {
          font-size: 18px;
          color: #fff;
          margin-bottom: 20px;
          text-align: center;
        }

        .input {
          background-color: #E8E8E8;
          border-radius: 8px;
          height: 60px;
          margin-bottom: 12px;
          width: 100%;
          padding: 16px;
          font-size: 18px;
          color: #333;
          border: none;
          outline: none;
        }

        .input::placeholder {
          color: #888;
        }

        .password-container {
          display: flex;
          align-items: center;
          background-color: #E8E8E8;
          border-radius: 8px;
          margin-bottom: 12px;
          height: 60px;
        }

        .password-input {
          flex: 1;
          padding: 16px;
          font-size: 18px;
          color: #333;
          border: none;
          outline: none;
          background: transparent;
          height: 100%;
          border-radius: 8px 0 0 8px;
        }

        .password-input::placeholder {
          color: #888;
        }

        .eye-icon {
          padding: 0 16px;
          cursor: pointer;
          background: none;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          outline: none;
        }

        .forgot-password-button {
          color: #fff;
          font-size: 18px;
          text-align: right;
          margin-bottom: 20px;
          background: none;
          border: none;
          cursor: pointer;
          align-self: flex-end;
          outline: none;
        }

        .primary-button {
          background-color: #5CB82E;
          padding: 0 32px;
          height: 60px;
          display: flex;
          justify-content: center;
          align-items: center;
          border-radius: 8px;
          margin-top: 16px;
          align-self: center;
          min-width: 180px;
          border: none;
          cursor: pointer;
          color: #fff;
          font-size: 20px;
          font-weight: bold;
          outline: none;
          transition: background-color 0.2s;
        }
        
        .primary-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .tab-bar-container {
          display: flex;
          flex-direction: row;
          background-color: rgba(232, 232, 232, 0.9);
          border-radius: 12px;
          margin: 0 30px 30px 30px;
          overflow: hidden;
          align-items: center;
        }

        .tab-button {
          flex: 1;
          padding: 16px 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 18px;
          color: #888;
          font-weight: 600;
          outline: none;
        }

        .tab-button.active {
          color: #111;
          font-weight: bold;
          background: transparent;
        }

        .tab-separator {
          width: 1px;
          height: 25px;
          background-color: #C4C4C4;
        }

        .spinner {
          border: 3px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          border-top: 3px solid #fff;
          width: 24px;
          height: 24px;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* RESPONSIVIDADE PARA DESKTOP/NAVEGADOR */
        @media (min-width: 768px) {
          .main-wrapper {
            max-width: 450px;
            max-height: 700px;
            background-color: rgba(0, 0, 0, 0.45);
            border-radius: 20px;
            padding: 20px 0;
            box-shadow: 0 10px 20px rgba(0,0,0,0.3);
            height: auto;
          }
          
          .top-section {
            padding: 0 40px;
          }
          
          .tab-bar-container {
            margin: 0 40px 40px 40px;
          }
        }
      `}</style>

      <div className="overlay">
        <div className="main-wrapper">
          
          {/* SESSÃO SUPERIOR: LOGO E FORMULÁRIO */}
          <div className="top-section">
            <div className="logo-container">
              <img src={typeof logoImg === 'object' ? logoImg.uri || logoImg.default : logoImg} alt="Logo" className="logo" />
              <span className="logo-text">AgroFrank</span>
            </div>

            <div className="form-container">
              {activeTab === 'forgot' && (
                <button className="back-button" onClick={() => setActiveTab('login')}>
                  <Ionicons name="arrow-back-outline" size={24} color="#fff" />
                </button>
              )}

              <h1 className="header-text">
                {activeTab === 'register' && 'Crie sua Conta'}
                {activeTab === 'login' && 'Acesse sua Conta'}
                {activeTab === 'forgot' && 'Esqueci minha Senha'}
              </h1>

              {activeTab === 'forgot' && (
                <p className="sub-header-text">
                  Insira seu email abaixo para receber o link de recuperação.
                </p>
              )}

              {activeTab === 'register' && (
                <input
                  type="text"
                  className="input"
                  placeholder="Nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoCapitalize="words"
                />
              )}

              <input
                type="email"
                className="input"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoCapitalize="none"
              />

              {activeTab !== 'forgot' &&
                renderPasswordInput('Senha', password, setPassword, showPassword, () =>
                  setShowPassword(!showPassword)
                )}

              {activeTab === 'register' &&
                renderPasswordInput(
                  'Confirmar a Senha',
                  confirmPassword,
                  setConfirmPassword,
                  showConfirmPassword,
                  () => setShowConfirmPassword(!showConfirmPassword)
                )}

              {activeTab === 'login' && (
                <button className="forgot-password-button" onClick={() => setActiveTab('forgot')}>
                  Esqueceu sua Senha?
                </button>
              )}

              <button
                className="primary-button"
                onClick={
                  activeTab === 'register' ? handleRegister :
                  activeTab === 'login' ? handleLogin : handleResetPassword
                }
                disabled={loading}
              >
                {loading ? (
                  <div className="spinner"></div>
                ) : (
                  <span>
                    {activeTab === 'register' && 'Criar Conta'}
                    {activeTab === 'login' && 'Entrar'}
                    {activeTab === 'forgot' && 'Redefinir Senha'}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* SESSÃO INFERIOR: TAB BAR */}
          {activeTab !== 'forgot' && (
            <div className="tab-bar-container">
              <button
                className={`tab-button ${activeTab === 'register' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('register');
                  setPassword('');
                  setConfirmPassword('');
                }}
              >
                Criar Conta
              </button>

              <div className="tab-separator" />

              <button
                className={`tab-button ${activeTab === 'login' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('login');
                  setPassword('');
                  setConfirmPassword('');
                }}
              >
                Entrar
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ImageBackground,
  ActivityIndicator,
  Image,
  useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Importações do seu arquivo de configuração do Firebase
import {
  auth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from '../firebaseConfig';

export default function LoginScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768; // Breakpoint para layout de navegador/desktop

  // Controle de telas: 'register' (Cadastro), 'login' (Entrar) ou 'forgot' (Recuperar Senha)
  const [activeTab, setActiveTab] = useState('login');

  // Estados dos formulários
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Controle de visibilidade das senhas
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Substitua pelo caminho correto da sua imagem de fundo
  const bgImage = require('../assets/Back.gif');

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

  // ==========================================
  // COMPONENTES REUTILIZÁVEIS
  // ==========================================
  const renderPasswordInput = (placeholder, value, onChangeText, isVisible, toggleVisibility) => (
    <View style={styles.passwordContainer}>
      <TextInput
        style={styles.passwordInput}
        placeholder={placeholder}
        placeholderTextColor="#888"
        secureTextEntry={!isVisible}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
      />
      <TouchableOpacity onPress={toggleVisibility} style={styles.eyeIcon}>
        <Ionicons
          name={isVisible ? 'eye-outline' : 'eye-off-outline'}
          size={22}
          color="#888"
        />
      </TouchableOpacity>
    </View>
  );

  return (
    <ImageBackground source={bgImage} style={styles.background}>
      <View style={styles.overlay}>
        
        {/* CONTAINER PRINCIPAL RESPONSIVO */}
        <View style={[styles.mainWrapper, isDesktop && styles.desktopCard]}>
          
          {/* SESSÃO SUPERIOR: LOGO E FORMULÁRIO */}
          <View style={[styles.topSection, isDesktop && { paddingHorizontal: 40 }]}>
            <View style={styles.logoContainer}>
              <Image source={require('../assets/icon.png')} style={styles.logo} />
              <Text style={styles.logoText}>AgroFrank</Text>
            </View>

            <View style={styles.formContainer}>
              {activeTab === 'forgot' && (
                <TouchableOpacity style={styles.backButton} onPress={() => setActiveTab('login')}>
                  <Ionicons name="arrow-back-outline" size={24} color="#fff" />
                </TouchableOpacity>
              )}

              <Text style={styles.headerText}>
                {activeTab === 'register' && 'Crie sua Conta'}
                {activeTab === 'login' && 'Acesse sua Conta'}
                {activeTab === 'forgot' && 'Esqueci minha Senha'}
              </Text>

              {activeTab === 'forgot' && (
                <Text style={styles.subHeaderText}>
                  Insira seu email abaixo para receber o link de recuperação.
                </Text>
              )}

              {activeTab === 'register' && (
                <TextInput
                  style={styles.input}
                  placeholder="Nome"
                  placeholderTextColor="#888"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              )}

              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#888"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
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
                <TouchableOpacity onPress={() => setActiveTab('forgot')}>
                  <Text style={styles.forgotPasswordText}>Esqueceu sua Senha?</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={
                  activeTab === 'register' ? handleRegister :
                  activeTab === 'login' ? handleLogin : handleResetPassword
                }
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {activeTab === 'register' && 'Criar Conta'}
                    {activeTab === 'login' && 'Entrar'}
                    {activeTab === 'forgot' && 'Redefinir Senha'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* SESSÃO INFERIOR: TAB BAR */}
          {activeTab !== 'forgot' && (
            <View style={[styles.tabBarContainer, isDesktop && { marginHorizontal: 40, marginBottom: 40 }]}>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'register' && styles.tabButtonActive]}
                onPress={() => {
                  setActiveTab('register');
                  setPassword('');
                  setConfirmPassword('');
                }}
              >
                <Text style={[styles.tabButtonText, activeTab === 'register' && styles.tabButtonTextActive]}>
                  Criar Conta
                </Text>
              </TouchableOpacity>

              <View style={styles.tabSeparator} />

              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'login' && styles.tabButtonActive]}
                onPress={() => {
                  setActiveTab('login');
                  setPassword('');
                  setConfirmPassword('');
                }}
              >
                <Text style={[styles.tabButtonText, activeTab === 'login' && styles.tabButtonTextActive]}>
                  Entrar
                </Text>
              </TouchableOpacity>
            </View>
          )}

        </View>

      </View>
    </ImageBackground>
  );
}

// ==========================================
// ESTILOS ADAPTADOS (EXCLUSIVO WEB)
// ==========================================
const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100vh', // Garante altura total na web
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', // Centraliza conteúdo no Desktop
  },
  mainWrapper: {
    flex: 1,
    justifyContent: 'space-between',
    width: '100%',
  },
  // Classe específica para o visual do navegador/desktop
  desktopCard: {
    maxWidth: 450,
    maxHeight: 700,
    backgroundColor: 'rgba(0, 0, 0, 0.45)', // Fundo translúcido para o Card
    alignSelf: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    paddingVertical: 20,
    marginVertical: 'auto',
    boxShadow: '0 10px 20px rgba(0,0,0,0.3)', // Usa boxShadow nativo da web
    flex: undefined, 
  },
  topSection: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 60,
    height: 60,
    resizeMode: 'contain',
    tintColor: '#fff',
  },
  logoText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
    marginTop: 8,
    letterSpacing: 0.5,
  },
  formContainer: {
    width: '100%',
  },
  backButton: {
    marginBottom: 16,
    alignSelf: 'flex-start',
    outlineStyle: 'none',
    cursor: 'pointer',
  },
  headerText: {
    fontSize: 26,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  subHeaderText: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#E8E8E8',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    height: 60,
    fontSize: 18,
    color: '#333',
    marginBottom: 12,
    outlineStyle: 'none', // Remove borda de foco na Web
  },
  passwordContainer: {
    flexDirection: 'row',
    backgroundColor: '#E8E8E8',
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    height: 60,
    fontSize: 18,
    color: '#333',
    outlineStyle: 'none',
  },
  eyeIcon: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    outlineStyle: 'none',
    cursor: 'pointer',
  },
  forgotPasswordText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'right',
    marginBottom: 20,
    outlineStyle: 'none',
    cursor: 'pointer',
  },
  primaryButton: {
    backgroundColor: '#5CB82E',
    paddingHorizontal: 32,
    height: 60,
    justifyContent: 'center',
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
    alignSelf: 'center',
    minWidth: 180,
    outlineStyle: 'none',
    cursor: 'pointer',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(232, 232, 232, 0.9)',
    borderRadius: 12,
    marginHorizontal: 30,
    marginBottom: 30,
    overflow: 'hidden',
    alignItems: 'center',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    outlineStyle: 'none',
    cursor: 'pointer',
  },
  tabButtonActive: {
    backgroundColor: 'transparent',
  },
  tabButtonText: {
    fontSize: 18,
    color: '#888',
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: '#111',
    fontWeight: 'bold',
  },
  tabSeparator: {
    width: 1,
    height: '50%',
    backgroundColor: '#C4C4C4',
  },
});
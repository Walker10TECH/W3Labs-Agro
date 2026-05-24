import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ImageBackground,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  ActivityIndicator,
  LayoutAnimation,
  UIManager
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

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function LoginScreen() {
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

  const triggerAnimation = () => {
    if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  // ==========================================
  // 1. FUNÇÃO DE CADASTRO
  // ==========================================
  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Atenção', 'Por favor, preencha todos os campos.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Atenção', 'As senhas não coincidem!');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // Atualiza o perfil do usuário com o nome digitado
      await updateProfile(userCredential.user, { displayName: name });
      Alert.alert('Sucesso!', `Conta criada com sucesso para ${name}!`);

      // Limpa os campos após criar a conta
      setPassword('');
      setConfirmPassword('');
      // Opcional: já mudar para a tela de login ou manter logado dependendo da sua navegação

    } catch (error) {
      let friendlyMessage = 'Ocorreu um erro ao criar a conta. Tente novamente.';
      if (error.code === 'auth/email-already-in-use') {
        friendlyMessage = 'Este endereço de email já está em uso por outra conta.';
      } else if (error.code === 'auth/invalid-email') {
        friendlyMessage = 'O endereço de email fornecido é inválido.';
      } else if (error.code === 'auth/weak-password') {
        friendlyMessage = 'Sua senha é muito fraca. Use pelo menos 6 caracteres.';
      }
      Alert.alert('Erro no Cadastro', friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // 2. FUNÇÃO DE LOGIN
  // ==========================================
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Atenção', 'Preencha o email e a senha para entrar.');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Se tiver sucesso, o listener global (onAuthStateChanged) do App.js assumirá a navegação
    } catch (error) {
      let friendlyMessage = 'Ocorreu um erro ao tentar acessar a conta.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        friendlyMessage = 'Email ou senha incorretos.';
      } else if (error.code === 'auth/invalid-email') {
        friendlyMessage = 'O endereço de email fornecido é inválido.';
      }
      Alert.alert('Erro no Login', friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // 3. FUNÇÃO DE RECUPERAR SENHA
  // ==========================================
  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Atenção', 'Por favor, informe seu email no campo para que possamos enviar o link de recuperação.');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert('Verifique seu Email', 'O link para redefinição de senha foi enviado para sua caixa de entrada.');
      triggerAnimation();
      setActiveTab('login'); // Volta para a tela de login
      setPassword(''); // Limpa a senha atual
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível enviar o email de redefinição. Verifique se o email digitado está correto.');
    } finally {
      setLoading(false);
    }
  };

  // Componente reutilizável para os inputs de senha (com o ícone de visualizar senha)
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
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
          >
            {/* SESSÃO SUPERIOR: LOGO E FORMULÁRIO */}
            <View style={styles.topSection}>

              <View style={styles.logoContainer}>
                {/* Substitua a logo abaixo pela logo original branca do AgroFrank se tiver */}
                <Image source={require('../assets/icon.png')} style={styles.logo} />
                <Text style={styles.logoText}>AgroFrank</Text>
              </View>

              <View style={styles.formContainer}>

                {/* Botão Voltar (aparece apenas ao recuperar senha) */}
                {activeTab === 'forgot' && (
                  <TouchableOpacity style={styles.backButton} onPress={() => { triggerAnimation(); setActiveTab('login'); }}>
                    <Ionicons name="arrow-back-outline" size={24} color="#fff" />
                  </TouchableOpacity>
                )}

                {/* Títulos dinâmicos dependendo da aba */}
                <Text style={styles.headerText}>
                  {activeTab === 'register' && 'Crie sua Conta'}
                  {activeTab === 'login' && 'Acesse sua Conta'}
                  {activeTab === 'forgot' && 'Esqueci minha Senha'}
                </Text>

                {/* Subtítulo da recuperação de senha */}
                {activeTab === 'forgot' && (
                  <Text style={styles.subHeaderText}>
                    Insira seu email abaixo para receber o link de recuperação.
                  </Text>
                )}

                {/* CAMPO: NOME (Exclusivo da aba Criar Conta) */}
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

                {/* CAMPO: EMAIL (Aparece em todas as abas) */}
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#888"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />

                {/* CAMPO: SENHA (Login e Cadastro) */}
                {activeTab !== 'forgot' &&
                  renderPasswordInput('Senha', password, setPassword, showPassword, () =>
                    setShowPassword(!showPassword)
                  )}

                {/* CAMPO: CONFIRMAR SENHA (Exclusivo do Cadastro) */}
                {activeTab === 'register' &&
                  renderPasswordInput(
                    'Confirmar a Senha',
                    confirmPassword,
                    setConfirmPassword,
                    showConfirmPassword,
                    () => setShowConfirmPassword(!showConfirmPassword)
                  )}

                {/* LINK: ESQUECEU A SENHA (Exclusivo do Login) */}
                {activeTab === 'login' && (
                  <TouchableOpacity onPress={() => { triggerAnimation(); setActiveTab('forgot'); }}>
                    <Text style={styles.forgotPasswordText}>Esqueceu sua Senha?</Text>
                  </TouchableOpacity>
                )}

                {/* BOTÃO PRINCIPAL DE AÇÃO */}
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={
                    activeTab === 'register'
                      ? handleRegister
                      : activeTab === 'login'
                        ? handleLogin
                        : handleResetPassword
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

            {/* SESSÃO INFERIOR: TAB BAR (Oculta na aba de recuperar senha) */}
            {activeTab !== 'forgot' && (
              <View style={styles.tabBarContainer}>

                <TouchableOpacity
                  style={[styles.tabButton, activeTab === 'register' && styles.tabButtonActive]}
                  onPress={() => {
                    triggerAnimation();
                    setActiveTab('register');
                    // Opcional: limpar senhas ao trocar de aba
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
                    triggerAnimation();
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

          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}

// ==========================================
// ESTILOS (Otimizado para Mobile como a Imagem)
// ==========================================
const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)', // Tom escuro para realçar o formulário (igual a imagem)
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topSection: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30, // Margens laterais
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 60,
    height: 60,
    resizeMode: 'contain',
    tintColor: '#fff', // Se a sua logo for preta, isso forçará a ficar branca (se aplicável ao PNG)
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
    backgroundColor: '#E8E8E8', // Fundo cinza dos inputs
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    height: 60,
    fontSize: 18,
    color: '#333',
    marginBottom: 12,
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
  },
  eyeIcon: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  forgotPasswordText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'right',
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#5CB82E', // Verde da imagem
    paddingHorizontal: 32,
    height: 60,
    justifyContent: 'center',
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
    alignSelf: 'center',
    minWidth: 180, // Faz o botão ter tamanho parecido com o da imagem (não ocupar a tela toda)
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(232, 232, 232, 0.9)', // Fundo translúcido branco/cinza
    borderRadius: 12,
    marginHorizontal: 30,
    marginBottom: 30, // Afastado do rodapé do celular
    overflow: 'hidden',
    alignItems: 'center',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: 'transparent',
  },
  tabButtonText: {
    fontSize: 18,
    color: '#888', // Cinza para o texto inativo
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: '#111', // Preto para o texto ativo
    fontWeight: 'bold',
  },
  tabSeparator: {
    width: 1,
    height: '50%',
    backgroundColor: '#C4C4C4', // Risco divisório no meio do menu inferior
  },
});
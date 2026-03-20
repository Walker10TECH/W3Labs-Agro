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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  auth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from '../firebaseConfig';

export default function Login() {
  // Controle de abas: 'register', 'login' ou 'forgot'
  const [activeTab, setActiveTab] = useState('register');

  // Estados dos inputs
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Controle de visibilidade das senhas
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Imagem de fundo
  const bgImage = require('../assets/Back.gif');

  // Funções de Ação (Substitua pelos métodos reais do Firebase)
  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Erro', 'As senhas não coincidem!');
      return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });
      Alert.alert('Sucesso', `Conta criada para ${name}!`);
    } catch (error) {
      let friendlyMessage = 'Ocorreu um erro ao criar a conta. Tente novamente.';
      if (error.code === 'auth/email-already-in-use') {
        friendlyMessage = 'Este endereço de email já está em uso.';
      } else if (error.code === 'auth/invalid-email') {
        friendlyMessage = 'O endereço de email fornecido é inválido.';
      } else if (error.code === 'auth/weak-password') {
        friendlyMessage = 'A senha é muito fraca. Use pelo menos 6 caracteres.';
      }
      Alert.alert('Erro no Cadastro', friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erro', 'Preencha o email e a senha.');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // A navegação para a tela principal deve ser tratada por um listener
      // de estado de autenticação (onAuthStateChanged) no componente raiz do app.
    } catch (error) {
      let friendlyMessage = 'Ocorreu um erro ao tentar fazer login.';
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

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Erro', 'Por favor, informe seu email para recuperar a senha.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert('Verifique seu Email', 'Um link para redefinição de senha foi enviado para o seu email!');
      setActiveTab('login');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível enviar o email de redefinição. Verifique o email digitado e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Renderiza o Input de Senha com o ícone de olho
  const renderPasswordInput = (placeholder, value, onChangeText, isVisible, toggleVisibility) => (
    <View style={styles.passwordContainer}>
      <TextInput
        style={styles.passwordInput}
        placeholder={placeholder}
        placeholderTextColor="#7a7a7a"
        secureTextEntry={!isVisible}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
      />
      <TouchableOpacity onPress={toggleVisibility} style={styles.eyeIcon}>
        <Ionicons
          name={isVisible ? 'eye-outline' : 'eye-off-outline'}
          size={24}
          color="#7a7a7a"
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
            
            {/* LOGO E TÍTULO PRINCIPAL */}
            <View style={styles.logoContainer}>
              <Image source={require('../assets/icon.png')} style={styles.logo} />
              <Text style={styles.logoText}>W3LabsAGRO</Text>
            </View>

            {/* CONTEÚDO PRINCIPAL (Muda com base na aba ativa) */}
            <View style={styles.formContainer}>
              {activeTab === 'forgot' && (
                <TouchableOpacity style={styles.backButton} onPress={() => setActiveTab('login')}>
                  <Ionicons name="arrow-back-outline" size={28} color="#fff" />
                </TouchableOpacity>
              )}

              <Text style={styles.headerText}>
                {activeTab === 'register' && 'Crie sua Conta'}
                {activeTab === 'login' && 'Acesse sua Conta'}
                {activeTab === 'forgot' && 'Esqueci minha Senha'}
              </Text>

              {activeTab === 'forgot' && (
                <Text style={styles.subHeaderText}>
                  Coloque seu email para recuperação da senha
                </Text>
              )}

              {/* NOME (Apenas Cadastro) */}
              {activeTab === 'register' && (
                <TextInput
                  style={styles.input}
                  placeholder="Nome"
                  placeholderTextColor="#7a7a7a"
                  value={name}
                  onChangeText={setName}
                />
              )}

              {/* EMAIL (Todas as abas) */}
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#7a7a7a"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />

              {/* SENHA (Login e Cadastro) */}
              {activeTab !== 'forgot' &&
                renderPasswordInput('Senha', password, setPassword, showPassword, () =>
                  setShowPassword(!showPassword)
                )}

              {/* CONFIRMAR SENHA (Apenas Cadastro) */}
              {activeTab === 'register' &&
                renderPasswordInput(
                  'Confirmar a Senha',
                  confirmPassword,
                  setConfirmPassword,
                  showConfirmPassword,
                  () => setShowConfirmPassword(!showConfirmPassword)
                )}

              {/* ESQUECEU A SENHA (Apenas Login) */}
              {activeTab === 'login' && (
                <TouchableOpacity onPress={() => setActiveTab('forgot')}>
                  <Text style={styles.forgotPasswordText}>Esqueceu sua Senha?</Text>
                </TouchableOpacity>
              )}

              {/* BOTÃO DE AÇÃO */}
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

            {/* TAB BAR INFERIOR (Oculto na tela de recuperar senha) */}
            {activeTab !== 'forgot' && (
              <View style={styles.tabBarContainer}>
                <TouchableOpacity
                  style={[styles.tabButton, activeTab === 'register' && styles.tabButtonActive]}
                  onPress={() => setActiveTab('register')}
                >
                  <Text
                    style={[styles.tabButtonText, activeTab === 'register' && styles.tabButtonTextActive]}
                  >
                    Criar Conta
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tabButton, activeTab === 'login' && styles.tabButtonActive]}
                  onPress={() => setActiveTab('login')}
                >
                  <Text
                    style={[styles.tabButtonText, activeTab === 'login' && styles.tabButtonTextActive]}
                  >
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

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)', // Escurece o fundo de folhas para destacar o formulário
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  logo: {
    width: 50,
    height: 50,
    resizeMode: 'contain',
  },
  logoText: {
    fontSize: 28,
    color: '#fff',
    fontWeight: 'bold',
    marginTop: 8,
  },
  formContainer: {
    flex: 1,
    justifyContent: 'center',
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  backButton: {
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  headerText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  subHeaderText: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
  },
  passwordContainer: {
    flexDirection: 'row',
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#333',
  },
  eyeIcon: {
    padding: 16,
  },
  forgotPasswordText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'right',
    marginBottom: 20,
    textDecorationLine: 'underline',
  },
  primaryButton: {
    backgroundColor: '#5CB82E', // Verde da imagem
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    maxWidth: 250,
    width: '100%',
    alignSelf: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#D1D1D1',
    borderRadius: 30,
    marginBottom: 20,
    overflow: 'hidden',
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#EAEAEA',
    borderRadius: 30,
  },
  tabButtonText: {
    fontSize: 14,
    color: '#7a7a7a',
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: '#333',
  },
});
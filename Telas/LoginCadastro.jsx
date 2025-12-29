import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import * as common from './Common';
import { 
    auth, 
    db, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    updateProfile, 
    sendPasswordResetEmail,
    doc,        
    setDoc,     
    serverTimestamp 
} from '../firebaseConfig';

// --- CONSTANTES E CONFIGURAÇÕES ---
const AUTH_CONFIG = { 
    minPasswordLength: 6, 
    maxPasswordLength: 128, 
    maxNameLength: 50, 
    emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, 
    passwordRegex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 
    debounceDelay: 300, 
    maxRetryAttempts: 3, 
    lockoutDuration: 300000 
};

const ERROR_MESSAGES = { 
    INVALID_EMAIL: 'Email deve ter um formato válido',
    WEAK_PASSWORD: 'Senha deve ter pelo menos 6 caracteres, incluindo maiúscula, minúscula e número',
    PASSWORD_MISMATCH: 'As senhas não coincidem',
    EMPTY_FIELDS: 'Todos os campos são obrigatórios',
    INVALID_CREDENTIALS: 'Email ou senha incorretos',
    EMAIL_EXISTS: 'Este email já está em uso',
    NETWORK_ERROR: 'Erro de conexão. Verifique sua internet',
    TOO_MANY_ATTEMPTS: 'Muitas tentativas. Tente novamente em alguns minutos',
    USER_NOT_FOUND: 'Usuário não encontrado',
    GENERIC_ERROR: 'Erro inesperado. Tente novamente'
};

const FIREBASE_ERROR_CODES = { 
    'auth/invalid-email': ERROR_MESSAGES.INVALID_EMAIL,
    'auth/user-disabled': 'Conta desabilitada. Entre em contato com o suporte',
    'auth/user-not-found': ERROR_MESSAGES.USER_NOT_FOUND,
    'auth/wrong-password': ERROR_MESSAGES.INVALID_CREDENTIALS,
    'auth/email-already-in-use': ERROR_MESSAGES.EMAIL_EXISTS,
    'auth/weak-password': ERROR_MESSAGES.WEAK_PASSWORD,
    'auth/network-request-failed': ERROR_MESSAGES.NETWORK_ERROR,
    'auth/too-many-requests': ERROR_MESSAGES.TOO_MANY_ATTEMPTS,
    'auth/operation-not-allowed': 'Operação não permitida',
    'auth/invalid-credential': ERROR_MESSAGES.INVALID_CREDENTIALS
};

// --- FUNÇÕES UTILITÁRIAS ---

/**
 * Valida formato de email
 * @param {string} email - Email para validar
 * @returns {boolean} - True se válido
 */
const validateEmail = (email) => { 
    if (!email || typeof email !== 'string') return false;
    return AUTH_CONFIG.emailRegex.test(email.trim());
};

/**
 * Valida força da senha
 * @param {string} password - Senha para validar
 * @returns {object} - { isValid: boolean, strength: string, errors: array }
 */
const validatePassword = (password) => { 
    if (!password || typeof password !== 'string') {
        return { isValid: false, strength: 'weak', errors: ['Senha é obrigatória'] };
    }

    const errors = []; 
    let strength = 'weak'; 

    if (password.length < AUTH_CONFIG.minPasswordLength) {
        errors.push(`Senha deve ter pelo menos ${AUTH_CONFIG.minPasswordLength} caracteres`);
    }

    if (password.length > AUTH_CONFIG.maxPasswordLength) {
        errors.push(`Senha deve ter no máximo ${AUTH_CONFIG.maxPasswordLength} caracteres`);
    }

    if (!/[a-z]/.test(password)) {
        errors.push('Senha deve conter pelo menos uma letra minúscula');
    }

    if (!/[A-Z]/.test(password)) {
        errors.push('Senha deve conter pelo menos uma letra maiúscula');
    }

    if (!/\d/.test(password)) {
        errors.push('Senha deve conter pelo menos um número');
    }

    if (errors.length === 0) {
        if (password.length >= 12 && /[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            strength = 'strong';
        } else if (password.length >= 8) {
            strength = 'medium';
        }
    }

    return {
        isValid: errors.length === 0,
        strength,
        errors
    };
};

/**
 * Valida nome do usuário
 * @param {string} name - Nome para validar
 * @returns {object} - { isValid: boolean, error: string }
 */
const validateName = (name) => { 
    if (!name || typeof name !== 'string') {
        return { isValid: false, error: 'Nome é obrigatório' };
    }

    const trimmedName = name.trim(); 

    if (trimmedName.length < 2) {
        return { isValid: false, error: 'Nome deve ter pelo menos 2 caracteres.' };
    }

    if (trimmedName.length > AUTH_CONFIG.maxNameLength) {
        return { isValid: false, error: `Nome deve ter no máximo ${AUTH_CONFIG.maxNameLength} caracteres` };
    }

    if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(trimmedName)) {
        return { isValid: false, error: 'Nome deve conter apenas letras e espaços' };
    }

    return { isValid: true, error: null };
};

/**
 * Traduz códigos de erro do Firebase
 * @param {string} errorCode - Código de erro do Firebase
 * @returns {string} - Mensagem de erro traduzida
 */
const getFirebaseErrorMessage = (errorCode) => { 
    return FIREBASE_ERROR_CODES[errorCode] || ERROR_MESSAGES.GENERIC_ERROR;
};

/**
 * Sanitiza entrada de texto
 * @param {string} input - Texto para sanitizar
 * @returns {string} - Texto sanitizado
 */
const sanitizeInput = (input) => { 
    if (!input || typeof input !== 'string') return '';
    return input.trim().replace(/[<>]/g, ''); // Remove caracteres potencialmente perigosos
};

/**
 * Debounce para validação em tempo real
 * @param {Function} func - Função para fazer debounce
 * @param {number} delay - Delay em milliseconds
 * @returns {Function} - Função com debounce
 */
const useDebounce = (func, delay) => {
    const timeoutRef = useRef(null);

    return useCallback((...args) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => func(...args), delay);
    }, [func, delay]);
};

// --- COMPONENTE PRINCIPAL DE AUTENTICAÇÃO ---
export const AuthPage = ({ navigation }) => {
    // --- ESTADOS ---
    const [isLogin, setIsLogin] = useState(true); 
    const [formData, setFormData] = useState({ 
        nome: '', 
        email: '', 
        password: '', 
        confirmPassword: '' 
    });
    const [showPassword, setShowPassword] = useState(false); 
    const [showConfirmPassword, setShowConfirmPassword] = useState(false); 
    const [loading, setLoading] = useState(false); 
    const [errors, setErrors] = useState({}); 
    const [passwordStrength, setPasswordStrength] = useState('weak'); 
    const [attemptCount, setAttemptCount] = useState(0); 
    const [isLocked, setIsLocked] = useState(false); 
    const [lockoutTimer, setLockoutTimer] = useState(null); 

    // --- REFS ---
    const emailInputRef = useRef(null);
    const passwordInputRef = useRef(null);
    const confirmPasswordInputRef = useRef(null);
    const lockoutTimeoutRef = useRef(null);

    // --- VALIDAÇÃO EM TEMPO REAL ---
    const debouncedValidateEmail = useDebounce((email) => {
        if (email && !validateEmail(email)) {
            setErrors(prev => ({ ...prev, email: ERROR_MESSAGES.INVALID_EMAIL }));
        } else {
            setErrors(prev => ({ ...prev, email: null }));
        }
    }, AUTH_CONFIG.debounceDelay);

    const debouncedValidatePassword = useDebounce((password) => {
        const validation = validatePassword(password);
        setPasswordStrength(validation.strength);
        
        if (password && !validation.isValid) {
            setErrors(prev => ({ ...prev, password: validation.errors[0] }));
        } else {
            setErrors(prev => ({ ...prev, password: null }));
        }
    }, AUTH_CONFIG.debounceDelay);

    const debouncedValidateConfirmPassword = useDebounce((confirmPassword) => {
        if (confirmPassword && confirmPassword !== formData.password) {
            setErrors(prev => ({ ...prev, confirmPassword: ERROR_MESSAGES.PASSWORD_MISMATCH }));
        } else {
            setErrors(prev => ({ ...prev, confirmPassword: null }));
        }
    }, AUTH_CONFIG.debounceDelay);

    // --- HANDLERS ---
    const setField = useCallback((field, value) => {
        // Para 'nome', não fazemos trim durante o input para permitir espaços entre nomes.
        // O valor final é sanitizado no envio.
        const sanitizedValue = field === 'nome'
            ? value.replace(/[<>]/g, '') 
            : sanitizeInput(value);      

        setFormData(prev => ({ ...prev, [field]: sanitizedValue }));

        // Validação em tempo real
        switch (field) {
            case 'email':
                debouncedValidateEmail(sanitizedValue);
                break;
            case 'password':
                debouncedValidatePassword(sanitizedValue);
                break;
            case 'confirmPassword':
                debouncedValidateConfirmPassword(sanitizedValue);
                break;
        }
    }, [formData.password, debouncedValidateEmail, debouncedValidatePassword, debouncedValidateConfirmPassword]);

    const validateForm = useCallback(() => {
        const newErrors = {}; 
        let isValid = true; 

        // Validação de email
        if (!formData.email) {
            newErrors.email = 'Email é obrigatório';
            isValid = false;
        } else if (!validateEmail(formData.email)) {
            newErrors.email = ERROR_MESSAGES.INVALID_EMAIL;
            isValid = false;
        }

        // Validação de senha
        if (!formData.password) {
            newErrors.password = 'Senha é obrigatória';
            isValid = false;
        } else {
            const passwordValidation = validatePassword(formData.password);
            if (!passwordValidation.isValid) {
                newErrors.password = passwordValidation.errors[0];
                isValid = false;
            }
        }

        // Validações específicas para registro
        if (!isLogin) {
            // Validação de nome
            if (!formData.nome) {
                newErrors.nome = 'Nome é obrigatório';
                isValid = false;
            } else {
                const nameValidation = validateName(formData.nome);
                if (!nameValidation.isValid) {
                    newErrors.nome = nameValidation.error;
                    isValid = false;
                }
            }

            // Validação de confirmação de senha
            if (!formData.confirmPassword) {
                newErrors.confirmPassword = 'Confirmação de senha é obrigatória';
                isValid = false;
            } else if (formData.password !== formData.confirmPassword) {
                newErrors.confirmPassword = ERROR_MESSAGES.PASSWORD_MISMATCH;
                isValid = false;
            }
        }

        setErrors(newErrors);
        return isValid;
    }, [formData, isLogin]);

    const handleLockout = useCallback(() => {
        setIsLocked(true);
        setLockoutTimer(Date.now() + AUTH_CONFIG.lockoutDuration); 

        lockoutTimeoutRef.current = setTimeout(() => {
            setIsLocked(false);
            setAttemptCount(0);
            setLockoutTimer(null);
        }, AUTH_CONFIG.lockoutDuration);
    }, []);

    const handleAuthAction = useCallback(async () => {
        if (isLocked) {
            const remainingTime = Math.ceil((lockoutTimer - Date.now()) / 1000); 
            common.Alert.alert(
                'Conta Temporariamente Bloqueada',
                `Tente novamente em ${remainingTime} segundos.`
            );
            return;
        }

        if (!validateForm()) {
            common.Alert.alert('Erro de Validação', 'Por favor, corrija os campos destacados.');
            return;
        }

        setLoading(true);
        
        try {
            if (isLogin) {
                // --- LOGIN ---
                await signInWithEmailAndPassword(auth, formData.email, formData.password);
                setAttemptCount(0); // Reset contagem de tentativas no sucesso
            } else {
                // --- REGISTRO ---
                const userCredential = await createUserWithEmailAndPassword(
                    auth, 
                    formData.email, 
                    formData.password
                );
                
                // Atualiza perfil com nome
                await updateProfile(userCredential.user, { 
                    displayName: formData.nome.trim() 
                });

                // >>> INTEGRAÇÃO COM FIRESTORE <<<
                // Cria documento na coleção 'users' com dados essenciais e timestamp
                const userDocRef = doc(db, "users", userCredential.user.uid);
                await setDoc(userDocRef, {
                    uid: userCredential.user.uid,
                    displayName: formData.nome.trim(),
                    email: formData.email.toLowerCase(),
                    createdAt: serverTimestamp(),
                    role: 'user' 
                });
            }
        } catch (error) {
            console.error('Auth error:', error);
            
            const errorMessage = getFirebaseErrorMessage(error.code); 
            
            // Incrementa contador de tentativas para login
            if (isLogin) {
                const newAttemptCount = attemptCount + 1; 
                setAttemptCount(newAttemptCount);
                
                if (newAttemptCount >= AUTH_CONFIG.maxRetryAttempts) {
                    handleLockout();
                    return;
                }
            }
            
            common.Alert.alert('Erro de Autenticação', errorMessage);
        } finally {
            setLoading(false);
        }
    }, [isLocked, lockoutTimer, validateForm, isLogin, formData, attemptCount, handleLockout]);

    const toggleAuthMode = useCallback(() => {
        setIsLogin(prev => !prev);
        setFormData({ nome: '', email: '', password: '', confirmPassword: '' });
        setErrors({});
        setPasswordStrength('weak');
        setAttemptCount(0);
        
        if (lockoutTimeoutRef.current) {
            clearTimeout(lockoutTimeoutRef.current);
            setIsLocked(false);
            setLockoutTimer(null);
        }
    }, []);

    // --- CLEANUP ---
    useEffect(() => {
        return () => {
            if (lockoutTimeoutRef.current) {
                clearTimeout(lockoutTimeoutRef.current);
            }
        };
    }, []);

    // --- COMPUTED VALUES ---
    const passwordStrengthColor = useMemo(() => { 
        switch (passwordStrength) {
            case 'strong': return '#4CAF50';
            case 'medium': return '#FF9800';
            default: return '#F44336';
        }
    }, [passwordStrength]);

    const isFormValid = useMemo(() => { 
        return Object.keys(errors).every(key => !errors[key]) && 
               formData.email && 
               formData.password && 
               (isLogin || (formData.nome && formData.confirmPassword));
    }, [errors, formData, isLogin]);

    return (
        <common.ImageBackground 
            source={require('../assets/Back.gif')} 
            style={common.styles.backgroundImage}
        >
            <common.SafeAreaView style={{ flex: 1, width: '100%', justifyContent: 'center' }}>
                <common.ScrollView 
                    contentContainerStyle={{
                        flexGrow: 1, 
                        justifyContent: 'center', 
                        alignItems: 'center',
                        padding: 20
                    }}
                    showsVerticalScrollIndicator={true}
                    keyboardShouldPersistTaps="handled"
                >
                    <common.View style={[common.styles.authContent, { backgroundColor: 'transparent', padding: 20, borderRadius: 20 }]}>
                        <common.Image 
                            source={require('../assets/icon.png')} 
                            style={common.styles.logo} 
                            resizeMode="contain" 
                        />
                        
                        <common.Text style={[common.styles.appName, { fontFamily: common.theme.fonts.light }]}>
                            <common.Text style={{ fontFamily: common.theme.fonts.bold }}>
                                Agro
                            </common.Text>
                        </common.Text>
                        
                        <common.Text style={common.styles.authTitle}>
                            {isLogin ? "Bem-vindo de volta" : "Crie sua Conta"}
                        </common.Text>
                        
                        {/* Campo Nome (Registro) */}
                        {!isLogin && (
                            <common.View style={[
                                common.styles.authInputContainer,
                                errors.nome && { borderColor: common.theme.colors.error }
                            ]}>
                                <common.TextInput 
                                    style={common.styles.authInput} 
                                    value={formData.nome} 
                                    onChangeText={(value) => setField('nome', value)}
                                    placeholder="Nome completo" 
                                    placeholderTextColor={common.theme.colors.secondaryText}
                                    maxLength={AUTH_CONFIG.maxNameLength}
                                    autoCapitalize="words"
                                    returnKeyType="next"
                                    onSubmitEditing={() => emailInputRef.current?.focus()}
                                />
                            </common.View>
                        )}
                        {errors.nome && (
                            <common.Text style={common.styles.errorText}>{errors.nome}</common.Text>
                        )}
                        
                        {/* Campo Email */}
                        <common.View style={[
                            common.styles.authInputContainer,
                            errors.email && { borderColor: common.theme.colors.error }
                        ]}>
                            <common.TextInput 
                                ref={emailInputRef}
                                style={common.styles.authInput} 
                                value={formData.email} 
                                onChangeText={(value) => setField('email', value)}
                                placeholder="Email" 
                                keyboardType="email-address" 
                                autoCapitalize="none" 
                                autoComplete="email"
                                placeholderTextColor={common.theme.colors.secondaryText}
                                returnKeyType="next"
                                onSubmitEditing={() => passwordInputRef.current?.focus()}
                            />
                        </common.View>
                        {errors.email && (
                            <common.Text style={common.styles.errorText}>{errors.email}</common.Text>
                        )}
                        
                        {/* Campo Senha */}
                        <common.View style={[
                            common.styles.authInputContainer,
                            errors.password && { borderColor: common.theme.colors.error }
                        ]}>
                            <common.TextInput 
                                ref={passwordInputRef}
                                style={common.styles.authInput} 
                                value={formData.password} 
                                onChangeText={(value) => setField('password', value)}
                                placeholder="Senha" 
                                secureTextEntry={!showPassword} 
                                placeholderTextColor={common.theme.colors.secondaryText}
                                maxLength={AUTH_CONFIG.maxPasswordLength}
                                returnKeyType={isLogin ? "done" : "next"}
                                onSubmitEditing={() => {
                                    if (isLogin) {
                                        handleAuthAction();
                                    } else {
                                        confirmPasswordInputRef.current?.focus();
                                    }
                                }}
                            />
                            <common.TouchableOpacity 
                                onPress={() => setShowPassword(!showPassword)}
                                style={{ padding: 5 }}
                            >
                                <common.MaterialCommunityIcons 
                                    name={showPassword ? "eye-off" : "eye"} 
                                    size={22} 
                                    color={common.theme.colors.secondaryText} 
                                />
                            </common.TouchableOpacity>
                        </common.View>
                        {errors.password && (
                            <common.Text style={common.styles.errorText}>{errors.password}</common.Text>
                        )}
                        
                        {/* Indicador de Força da Senha */}
                        {!isLogin && formData.password && (
                            <common.View style={{
                                width: '100%',
                                height: 4,
                                backgroundColor: '#E0E0E0',
                                borderRadius: 2,
                                marginBottom: 10
                            }}>
                                <common.View style={{
                                    height: '100%',
                                    backgroundColor: passwordStrengthColor,
                                    borderRadius: 2,
                                    width: passwordStrength === 'weak' ? '33%' : 
                                           passwordStrength === 'medium' ? '66%' : '100%'
                                }} />
                            </common.View>
                        )}
                        
                        {/* Campo Confirmar Senha */}
                        {!isLogin && (
                            <common.View style={[
                                common.styles.authInputContainer,
                                errors.confirmPassword && { borderColor: common.theme.colors.error }
                            ]}>
                                <common.TextInput 
                                    ref={confirmPasswordInputRef}
                                    style={common.styles.authInput} 
                                    value={formData.confirmPassword} 
                                    onChangeText={(value) => setField('confirmPassword', value)}
                                    placeholder="Confirmar senha" 
                                    secureTextEntry={!showConfirmPassword} 
                                    placeholderTextColor={common.theme.colors.secondaryText}
                                    maxLength={AUTH_CONFIG.maxPasswordLength}
                                    returnKeyType="done"
                                    onSubmitEditing={handleAuthAction}
                                />
                                <common.TouchableOpacity 
                                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                    style={{ padding: 5 }}
                                >
                                    <common.MaterialCommunityIcons 
                                        name={showConfirmPassword ? "eye-off" : "eye"} 
                                        size={22} 
                                        color={common.theme.colors.secondaryText} 
                                    />
                                </common.TouchableOpacity>
                            </common.View>
                        )}
                        {errors.confirmPassword && (
                            <common.Text style={common.styles.errorText}>{errors.confirmPassword}</common.Text>
                        )}
                        
                        {/* Aviso de Tentativas */}
                        {isLogin && attemptCount > 0 && !isLocked && (
                            <common.View style={{
                                backgroundColor: '#FFF3CD',
                                padding: 10,
                                borderRadius: 8,
                                marginBottom: 15,
                                borderLeftWidth: 4,
                                borderLeftColor: '#FFC107'
                            }}>
                                <common.Text style={{ color: '#856404', fontSize: 12, textAlign: 'center' }}>
                                    Tentativa {attemptCount} de {AUTH_CONFIG.maxRetryAttempts}
                                </common.Text>
                            </common.View>
                        )}
                        
                        {/* Aviso de Bloqueio */}
                        {isLocked && (
                            <common.View style={{
                                backgroundColor: '#F8D7DA',
                                padding: 10,
                                borderRadius: 8,
                                marginBottom: 15,
                                borderLeftWidth: 4,
                                borderLeftColor: '#DC3545'
                            }}>
                                <common.Text style={{ color: '#721C24', fontSize: 12, textAlign: 'center' }}>
                                    Conta temporariamente bloqueada
                                </common.Text>
                            </common.View>
                        )}
                        
                        {/* Botão de Ação (Entrar / Criar) */}
                        <common.TouchableOpacity 
                            style={[
                                common.styles.authButton, 
                                (loading || !isFormValid || isLocked) && { opacity: 0.5 }
                            ]} 
                            onPress={handleAuthAction} 
                            disabled={loading || !isFormValid || isLocked}
                        >
                            {loading ? (
                                <common.ActivityIndicator color={common.theme.colors.textWhite} />
                            ) : (
                                <common.Text style={common.styles.buttonText}>
                                    {isLogin ? "Entrar" : "Criar Conta"}
                                </common.Text>
                            )}
                        </common.TouchableOpacity>
                        
                        {/* Link Esqueci Minha Senha */}
                        {isLogin && (
                            <common.TouchableOpacity 
                                onPress={() => navigation.navigate('EsqueciSenha')} 
                                style={{ marginVertical: 15, alignSelf: 'center' }}
                            >
                                <common.Text style={{ 
                                    color: common.theme.colors.textWhite, 
                                    fontSize: 14,
                                    textDecorationLine: 'underline'
                                }}>
                                    Esqueceu sua senha?
                                </common.Text>
                            </common.TouchableOpacity>
                        )}
                        
                        {/* Footer Alternar Modo */}
                        <common.View style={common.styles.authFooter}>
                            <common.TouchableOpacity 
                                style={[
                                    common.styles.authFooterButton, 
                                    !isLogin && common.styles.authFooterButtonActive
                                ]} 
                                onPress={() => toggleAuthMode()}
                                disabled={loading}
                            >
                                <common.Text style={[
                                    common.styles.authFooterText, 
                                    !isLogin && common.styles.authFooterTextActive
                                ]}>
                                    Criar Conta
                                </common.Text>
                            </common.TouchableOpacity>
                            
                            <common.TouchableOpacity 
                                style={[
                                    common.styles.authFooterButton, 
                                    isLogin && common.styles.authFooterButtonActive
                                ]} 
                                onPress={() => toggleAuthMode()}
                                disabled={loading}
                            >
                                <common.Text style={[
                                    common.styles.authFooterText, 
                                    isLogin && common.styles.authFooterTextActive
                                ]}>
                                    Entrar
                                </common.Text>
                            </common.TouchableOpacity>
                        </common.View>
                    </common.View>
                </common.ScrollView>
            </common.SafeAreaView>
        </common.ImageBackground>
    );
};

// --- COMPONENTE DE RECUPERAÇÃO DE SENHA ---
export const EsqueciSenhaPage = ({ navigation }) => {
    const [email, setEmail] = useState(''); 
    const [loading, setLoading] = useState(false); 
    const [emailSent, setEmailSent] = useState(false); 
    const [error, setError] = useState(''); 
    const [countdown, setCountdown] = useState(0); 

    const countdownRef = useRef(null);

    const validateEmailInput = useCallback((emailInput) => {
        const sanitizedEmail = sanitizeInput(emailInput); 
        
        if (!sanitizedEmail) {
            setError('Email é obrigatório');
            return false;
        }
        
        if (!validateEmail(sanitizedEmail)) {
            setError(ERROR_MESSAGES.INVALID_EMAIL);
            return false;
        }
        
        setError('');
        return true;
    }, []);

    const startCountdown = useCallback(() => {
        setCountdown(60); 
        
        countdownRef.current = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(countdownRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, []);

    const handleReset = useCallback(async () => {
        if (!validateEmailInput(email)) {
            return;
        }
        
        setLoading(true);
        setError('');
        
        try {
            await sendPasswordResetEmail(auth, email.trim());
            setEmailSent(true);
            startCountdown();
            
            common.Alert.alert(
                "Email Enviado", 
                "Verifique sua caixa de entrada e spam. Um link para redefinir sua senha foi enviado.", 
                [{ text: 'OK' }]
            );
        } catch (error) {
            console.error("Password reset error:", error);
            
            const errorMessage = getFirebaseErrorMessage(error.code); 
            setError(errorMessage);
            
            common.Alert.alert("Erro", errorMessage);
        } finally {
            setLoading(false);
        }
    }, [email, validateEmailInput, startCountdown]);

    const handleResend = useCallback(() => {
        if (countdown === 0) {
            handleReset();
        }
    }, [countdown, handleReset]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (countdownRef.current) {
                clearInterval(countdownRef.current);
            }
        };
    }, []);

    return (
        <common.ImageBackground 
            source={require('../assets/Back.gif')} 
            style={common.styles.backgroundImage}
        >
            <common.CustomHeader title="Recuperar Senha" navigation={navigation} />
            
            <common.View style={[
                common.styles.authContent, 
                { justifyContent: 'center', flex: 1, padding: 20 }
            ]}>
                <common.Image 
                    source={require('../assets/icon.png')} 
                    style={common.styles.logo} 
                    resizeMode="contain" 
                />
                
                <common.Text style={[
                    common.styles.appName,
                    { fontFamily: common.theme.fonts.light, marginBottom: 20 }
                ]}>
                    <common.Text style={{ fontFamily: common.theme.fonts.bold }}>
                        Agro
                    </common.Text>
                </common.Text>
                
                <common.Text style={{
                    color: common.theme.colors.textWhite, 
                    textAlign: 'center', 
                    marginBottom: 30, 
                    fontSize: 16,
                    lineHeight: 24
                }}>
                    {emailSent 
                        ? "Email enviado! Verifique sua caixa de entrada e spam."
                        : "Insira seu email para receber um link de redefinição de senha."
                    }
                </common.Text>
                
                <common.View style={[
                    common.styles.authInputContainer,
                    error && { borderColor: common.theme.colors.error }
                ]}>
                    <common.TextInput 
                        style={common.styles.authInput} 
                        value={email} 
                        onChangeText={(value) => {
                            setEmail(sanitizeInput(value));
                            if (error) setError('');
                        }}
                        placeholder="Email" 
                        keyboardType="email-address" 
                        autoCapitalize="none" 
                        autoComplete="email"
                        placeholderTextColor={common.theme.colors.secondaryText}
                        editable={!loading}
                        returnKeyType="done"
                        onSubmitEditing={handleReset}
                    />
                </common.View>
                
                {error && (
                    <common.Text style={[common.styles.errorText, { marginBottom: 15 }]}>
                        {error}
                    </common.Text>
                )}
                
                <common.TouchableOpacity 
                    style={[
                        common.styles.authButton, 
                        (loading || (emailSent && countdown > 0)) && { opacity: 0.5 }
                    ]} 
                    onPress={emailSent ? handleResend : handleReset} 
                    disabled={loading || (emailSent && countdown > 0)}
                >
                    {loading ? (
                        <common.ActivityIndicator color={common.theme.colors.textWhite} />
                    ) : (
                        <common.Text style={common.styles.buttonText}>
                            {emailSent 
                                ? (countdown > 0 ? `Reenviar em ${countdown}s` : "Reenviar Email")
                                : "Enviar Link"
                            }
                        </common.Text>
                    )}
                </common.TouchableOpacity>
                
                {emailSent && (
                    <common.View style={{
                        backgroundColor: '#D4EDDA',
                        padding: 15,
                        borderRadius: 8,
                        marginTop: 20,
                        borderLeftWidth: 4,
                        borderLeftColor: '#28A745'
                    }}>
                        <common.Text style={{ 
                            color: '#155724', 
                            fontSize: 14, 
                            textAlign: 'center',
                            lineHeight: 20
                        }}>
                            ✓ Email enviado com sucesso!{"\n"}
                            Não recebeu? Verifique a pasta de spam ou tente reenviar.
                        </common.Text>
                    </common.View>
                )}
                
                <common.TouchableOpacity 
                    onPress={() => navigation.goBack()}
                    style={{ 
                        marginTop: 20, 
                        alignSelf: 'center',
                        padding: 10
                    }}
                >
                    <common.Text style={{ 
                        color: common.theme.colors.textWhite, 
                        fontSize: 14,
                        textDecorationLine: 'underline'
                    }}>
                        ← Voltar ao login
                    </common.Text>
                </common.TouchableOpacity>
            </common.View>
        </common.ImageBackground>
    );
};
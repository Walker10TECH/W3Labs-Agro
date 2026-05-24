import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions
} from 'react-native';

// Módulos Expo e Vector Icons
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Location from 'expo-location';

// Firebase
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { auth, db, signOut } from '../firebaseConfig'; // Certifique-se de que o caminho está correto

// Bibliotecas de IA
import MarkdownDisplay from 'react-native-markdown-display';

// =====================================================================
// 1️⃣ CONFIGURAÇÕES GERAIS E TEMA
// =====================================================================

const CONFIG = {
    GROQ_API_KEY: process.env.EXPO_PUBLIC_GROQ_API_KEY || '',
    WEATHER_API_KEY: process.env.EXPO_PUBLIC_WEATHER_API_KEY || '',
    MAX_TOOL_LOOPS: 5,
};

const THEME = {
    primary: '#4CAF50',
    primaryDark: '#388E3C',
    secondary: '#FFFFFF',     // Branco
    background: '#F9FBF9',    // Fundo cinza claro
    textBlack: '#2C3329',     // Texto escuro
    textWhite: '#FFFFFF',     // Texto branco
    secondaryText: '#4A4A4A', // Cinza para subtítulos
    grayButton: '#F0F2F0',    // Fundo dos botões do chatbot
};

const MODES = {
    WELCOME: 'welcome',
    OPTIONS: 'options',
    AI: 'ai',
};

// Modelos do Groq atualizados
const APPROVED_MODELS = [
    {
        id: 'openai/gpt-oss-120b',
        name: 'W3Labs Web Search (Compound)',
        desc: 'Acesso à internet em tempo real via Groq. Respostas mais completas.',
        provider: 'groq'
    },
];

// =====================================================================
// 2️⃣ CAMADA DE SERVIÇO DE IA (GROQ CLOUD E TOOLS)
// =====================================================================


class GroqService {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseURL = 'https://api.groq.com/openai/v1/chat/completions';
    }

    async chat(payload) {
        if (!this.apiKey) {
            throw new Error("Chave da API do Groq (GROQ_API_KEY) não está configurada.");
        }

        try {
            const response = await fetch(this.baseURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `Erro ${response.status}: Falha ao contatar GroqCloud`);
            }

            return await response.json();
        } catch (error) {
            console.error('Groq Service Error:', error);
            throw error;
        }
    }
}

const groqService = new GroqService(CONFIG.GROQ_API_KEY);

const TOOLS_DEFINITION = [
    {
        type: 'function',
        function: {
            name: 'get_farm_data',
            description: 'Busca registros técnicos internos da fazenda no banco de dados (Firebase).',
            parameters: {
                type: 'object',
                required: ['topic'],
                properties: {
                    topic: {
                        type: 'string',
                        description: 'Setor para consulta.',
                        enum: ['colheitas', 'diesel', 'plantios', 'pulverizacoes', 'pluviometro', 'estoqueGeral', 'inventario', 'revisoes']
                    },
                },
            },
        },
    },
];

const TOOLS_IMPLEMENTATION = {
    get_farm_data: async ({ topic }) => {
        const userUid = auth?.currentUser?.uid;
        if (!userUid) return JSON.stringify({ error: "Usuário não autenticado." });

        const schemaMap = {
            colheitas: { orderBy: 'dataColheita' },
            diesel: { orderBy: 'data' },
            plantios: { orderBy: 'dataPlantio' },
            pulverizacoes: { orderBy: 'dataAplicacao' },
            pluviometro: { orderBy: 'dataMedicao' },
            estoqueGeral: { orderBy: null },
            inventario: { orderBy: 'dataAquisicao' },
            revisoes: { orderBy: 'dataRevisao' },
        };

        if (!schemaMap[topic]) return JSON.stringify({ error: `Tópico '${topic}' inválido.` });

        try {
            const config = schemaMap[topic];
            const colRef = collection(db, 'users', userUid, topic);

            let q = config.orderBy
                ? query(colRef, orderBy(config.orderBy, 'desc'), limit(5))
                : query(colRef, limit(5));

            const snapshot = await getDocs(q);
            if (snapshot.empty) return JSON.stringify({ info: `Sem dados para: ${topic}` });

            const data = snapshot.docs.map(doc => {
                const raw = doc.data();
                const normalized = {};
                Object.keys(raw).forEach(key => {
                    if (raw[key]?.toDate) {
                        normalized[key] = raw[key].toDate().toISOString().split('T')[0];
                    } else {
                        normalized[key] = raw[key];
                    }
                });
                return normalized;
            });

            return JSON.stringify(data);
        } catch (e) {
            return JSON.stringify({ error: `Erro DB: ${e.message}` });
        }
    },
};

async function processAttachment(uri) {
    try {
        // Para envio de imagens ao LLM (se o modelo do Groq suportar visão, ex: Llama 3.2 Vision)
        return await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
        });
    } catch (error) {
        throw new Error("Falha na leitura do arquivo.");
    }
}

// =====================================================================
// 3️⃣ COMPONENTES DO CHATBOT (AGRONOMIA)
// =====================================================================

const SettingsModal = ({ visible, onClose, currentModel, onSelectModel, location, onRequestLocation, locationLoading }) => (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Configurações</Text>
                    <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                        <Ionicons name="close" size={24} color={THEME.secondaryText} />
                    </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={{ padding: 20 }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: THEME.textBlack, marginBottom: 15 }}>
                        Motor de Inferência (Groq)
                    </Text>
                    {APPROVED_MODELS.map((model) => (
                        <TouchableOpacity
                            key={model.id}
                            style={[
                                styles.modelOptionCard,
                                currentModel === model.id && styles.modelOptionCardActive
                            ]}
                            onPress={() => onSelectModel(model.id)}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={[
                                    styles.modelName,
                                    currentModel === model.id && { color: THEME.primary }
                                ]}>
                                    {model.name}
                                </Text>
                                <Text style={styles.modelDesc}>{model.desc}</Text>
                            </View>
                            <View style={[
                                styles.radioButtonOuter,
                                currentModel === model.id && { borderColor: THEME.primary }
                            ]}>
                                {currentModel === model.id && <View style={styles.radioButtonInner} />}
                            </View>
                        </TouchableOpacity>
                    ))}

                    <View style={{ height: 30 }} />

                    <Text style={styles.sectionTitle}>Dados da Sessão</Text>
                    <TouchableOpacity
                        onPress={onRequestLocation}
                        disabled={locationLoading}
                        style={{ backgroundColor: 'rgba(0,0,0,0.05)', padding: 15, borderRadius: 10, flexDirection: 'row', alignItems: 'center' }}
                    >
                        <Ionicons name="location-outline" size={24} color={THEME.secondaryText} />
                        <View style={{ marginLeft: 15, flex: 1 }}>
                            <Text style={{ fontWeight: 'bold', color: THEME.textBlack, fontSize: 14 }}>Localização</Text>
                            <Text style={{ color: THEME.secondaryText, fontSize: 13 }}>
                                {locationLoading
                                    ? 'Buscando...'
                                    : location
                                        ? `${location.city || 'N/A'}, ${location.region || 'N/A'} - ${location.country || 'N/A'}`
                                        : 'Toque para buscar... (habilite a permissão)'}
                            </Text>
                        </View>
                        {locationLoading && <ActivityIndicator size="small" color={THEME.primary} />}
                    </TouchableOpacity>
                    <View style={{ height: 40 }} />
                </ScrollView>
            </View>
        </View>
    </Modal>
);

const WelcomeView = React.memo(({ onModeChange }) => (
    <View style={styles.chatbotWelcomeContainer}>
        <View style={{ alignItems: 'center', width: '100%' }}>
            <MaterialCommunityIcons name="robot-happy-outline" size={64} color={THEME.primary} />
            <Text style={styles.chatbotWelcomeTitle}>Olá! Sou a AgronomIA</Text>
            <Text style={styles.chatbotWelcomeSubtitle}>Sua assistente W3Labs (Powered by Groq).</Text>
        </View>
        <View style={{ width: '100%', marginTop: 32 }}>
            <TouchableOpacity style={styles.chatbotPromptCard} onPress={() => onModeChange(MODES.AI)}>
                <Text style={styles.chatbotPromptCardText}>Fazer uma pergunta por texto</Text>
                <Ionicons name="chatbubbles-outline" size={24} color={THEME.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.chatbotPromptCard} onPress={() => onModeChange(MODES.OPTIONS)}>
                <Text style={styles.chatbotPromptCardText}>Ver ações rápidas e mercado</Text>
                <Ionicons name="flash-outline" size={24} color={THEME.primary} />
            </TouchableOpacity>
        </View>
    </View>
));

const OptionsView = React.memo(({ onOptionSelect }) => {
    const analysisOptions = [
        { label: 'Cotação Soja', query: 'Qual a cotação da soja hoje?', icon: 'trending-up-outline' },
        { label: 'Histórico Chuva', query: 'Relatório do meu histórico de chuva', icon: 'rainy-outline' },
        { label: 'Estoque', query: 'Análise do meu estoque geral', icon: 'archive-outline' },
        { label: 'Consumo Diesel', query: 'Análise do consumo de diesel', icon: 'speedometer-outline' },
    ];

    return (
        <ScrollView contentContainerStyle={{ padding: 10 }}>
            <Text style={styles.formSectionTitle}>Análises Rápidas</Text>
            <View style={styles.quickOptionsGrid}>
                {analysisOptions.map(item => (
                    <TouchableOpacity key={item.label} style={styles.chatbotQuickOption} onPress={() => onOptionSelect(item.query)}>
                        <Ionicons name={item.icon} size={28} color={THEME.primary} />
                        <Text style={styles.chatbotQuickOptionText}>{item.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </ScrollView>
    );
});

const AgronomiaChatbot = ({ onClose }) => {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeModel, setActiveModel] = useState(APPROVED_MODELS[0].id);
    const [attachedFile, setAttachedFile] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [location, setLocation] = useState(null);
    const [locationLoading, setLocationLoading] = useState(false);
    const [chatMode, setChatMode] = useState(MODES.WELCOME);
    const flatListRef = useRef(null);

    const requestLocation = useCallback(async () => {
        setLocationLoading(true);
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert("Permissão negada", "A permissão de localização é necessária.");
                return;
            }

            let currentLocation = await Location.getCurrentPositionAsync({});
            let geocode = await Location.reverseGeocodeAsync(currentLocation.coords);
            if (geocode && geocode.length > 0) {
                setLocation(geocode[0]);
            }
        } catch (error) {
            console.error("GPS Error: ", error);
        } finally {
            setLocationLoading(false);
        }
    }, []);

    useEffect(() => {
        requestLocation();
    }, [requestLocation]);

    const systemPrompt = useMemo(() => `
        Você é a AgronomIA, Especialista Sênior da W3Labs.
        Localização do Usuário: ${location ? `${location.city}, ${location.country}` : 'Não disponível'}.
        
        Diretrizes:
        1. Seja breve, técnico e direto.
        2. Use as FERRAMENTAS disponíveis para consultar dados da conta do usuário.
        3. Formate suas respostas usando Markdown limpo.
    `, [location]);

    const handleSend = useCallback(async (manualQuery = null) => {
        const text = (manualQuery || inputText).trim();
        if (loading || (!text && !attachedFile)) return;

        if (manualQuery) setChatMode(MODES.AI);

        const userMsg = {
            id: Date.now().toString(),
            role: 'user',
            sender: 'user',
            text: text,
            fileData: attachedFile
        };

        const newHistory = [...messages, userMsg];
        setMessages(newHistory);
        setInputText('');
        setAttachedFile(null);
        setLoading(true);

        try {
            const botId = Date.now() + '_bot';
            setMessages(prev => [...prev, {
                id: botId, role: 'assistant', sender: 'bot', text: ''
            }]);

            // Formata o histórico para o padrão OpenAI/Groq
            let apiMessages = [
                { role: 'system', content: systemPrompt },
                ...newHistory.map(m => ({
                    role: m.role,
                    content: m.text,
                    ...(m.tool_calls && { tool_calls: m.tool_calls }),
                    ...(m.tool_call_id && { tool_call_id: m.tool_call_id, name: m.name })
                }))
            ];

            let keepGenerating = true;
            let loopCount = 0;
            let currentText = '';

            // Loop de execução de ferramentas via Groq
            while (keepGenerating && loopCount < CONFIG.MAX_TOOL_LOOPS) {
                loopCount++;

                const response = await groqService.chat({
                    model: activeModel,
                    messages: apiMessages,
                    tools: TOOLS_DEFINITION,
                    tool_choice: 'auto',
                    temperature: 0.3
                });

                const choice = response.choices[0];
                const msg = choice.message;

                if (msg.executed_tools && msg.executed_tools.length > 0) {
                    setMessages(prev => [...prev, {
                        id: Date.now() + '_sys_web_' + Math.random(),
                        role: 'system',
                        sender: 'system',
                        text: `🌐 Fontes consultadas na web com sucesso.`
                    }]);
                }

                if (msg.content) {
                    currentText += msg.content;
                    setMessages(prev => prev.map(m =>
                        m.id === botId ? {
                            ...m,
                            text: currentText,
                            usage: {
                                duration: response.usage.total_time?.toFixed(2) || 0,
                                tokens: response.usage.total_tokens
                            }
                        } : m
                    ));
                }

                if (msg.tool_calls && msg.tool_calls.length > 0) {
                    // Adiciona a mensagem do assistente com a chamada de função no histórico da API
                    apiMessages.push(msg);

                    for (const call of msg.tool_calls) {
                        const fnName = call.function.name;
                        const fnArgs = JSON.parse(call.function.arguments);

                        setMessages(prev => [...prev, {
                            id: Date.now() + '_sys_' + Math.random(),
                            role: 'system',
                            sender: 'system',
                            text: `⚙️ Consultando: ${fnName}...`
                        }]);

                        let result = JSON.stringify({ error: "Ferramenta falhou ou não implementada" });

                        if (TOOLS_IMPLEMENTATION[fnName]) {
                            result = await TOOLS_IMPLEMENTATION[fnName](fnArgs);
                        }

                        // Retorna o resultado da ferramenta para o Groq
                        apiMessages.push({
                            role: 'tool',
                            tool_call_id: call.id,
                            name: fnName,
                            content: result
                        });
                    }
                } else {
                    keepGenerating = false; // Finaliza o loop se não houver mais chamadas de ferramentas
                }
            }
        } catch (error) {
            console.error("Erro AgronomIA:", error);
            setMessages(prev => [...prev, {
                id: Date.now() + '_err',
                role: 'assistant',
                sender: 'bot',
                text: `⚠️ **Erro de Comunicação**\nNão foi possível processar via GroqCloud.\n${error.message}`,
                isError: true
            }]);
        } finally {
            setLoading(false);
        }
    }, [inputText, attachedFile, loading, messages, activeModel, systemPrompt]);

    const pickDocument = async () => {
        try {
            const res = await DocumentPicker.getDocumentAsync({
                type: ['image/*', 'application/pdf', 'text/csv'],
                copyToCacheDirectory: true
            });
            if (!res.canceled && res.assets[0]) {
                setAttachedFile(res.assets[0]);
            }
        } catch (err) {
            Alert.alert("Erro", "Seleção cancelada.");
        }
    };

    const handleClearChat = () => {
        setMessages([]);
        setChatMode(MODES.WELCOME);
    };

    return (
        <View style={styles.chatbotPopupContainer}>
            {/* HEADER DO CHATBOT */}
            <View style={styles.chatbotHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {chatMode !== MODES.WELCOME && (
                        <TouchableOpacity onPress={() => setChatMode(MODES.WELCOME)} style={[styles.headerButton, { marginRight: 10, backgroundColor: 'transparent' }]}>
                            <Ionicons name="arrow-back" size={24} color={THEME.secondaryText} />
                        </TouchableOpacity>
                    )}
                    <View>
                        <Text style={styles.chatbotTitle}>AgronomIA</Text>
                        <Text style={{ fontSize: 11, color: THEME.textBlack, opacity: 0.7, marginTop: 4 }}>
                            {location ? `📍 ${location.city}` : 'W3Labs / Groq Engine'}
                        </Text>
                    </View>
                </View>
                <View style={{ flexDirection: 'row' }}>
                    <TouchableOpacity onPress={() => setShowSettings(true)} style={[styles.headerButton, { backgroundColor: 'transparent' }]}>
                        <Ionicons name="settings-outline" size={24} color={THEME.secondaryText} />
                    </TouchableOpacity>
                    {messages.length > 0 && chatMode === MODES.AI && (
                        <TouchableOpacity onPress={handleClearChat} style={[styles.headerButton, { backgroundColor: 'transparent' }]}>
                            <Ionicons name="trash-outline" size={22} color={THEME.secondaryText} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={onClose} style={[styles.headerButton, { backgroundColor: 'transparent' }]}>
                        <Ionicons name="close" size={24} color={THEME.secondaryText} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* TELA DE BOAS VINDAS */}
            {chatMode === MODES.WELCOME && <WelcomeView onModeChange={setChatMode} />}
            {chatMode === MODES.OPTIONS && <OptionsView onOptionSelect={(q) => handleSend(q)} />}

            {/* TELA DE CHAT */}
            {chatMode === MODES.AI && (
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{ padding: 15, paddingBottom: 20 }}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                        renderItem={({ item }) => (
                            <View style={[
                                styles.messageBubble,
                                item.sender === 'user' ? styles.userMessage :
                                    item.sender === 'system' ? styles.systemMessage : styles.botMessage
                            ]}>
                                {item.fileData && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, opacity: 0.8 }}>
                                        <Ionicons name="document-attach" size={16} color={item.sender === 'user' ? THEME.textWhite : THEME.textBlack} />
                                        <Text style={{ fontSize: 11, marginLeft: 5, color: item.sender === 'user' ? THEME.textWhite : THEME.textBlack }}>
                                            {item.fileData.name}
                                        </Text>
                                    </View>
                                )}
                                <MarkdownDisplay
                                    style={
                                        item.sender === 'user'
                                            ? { body: { color: THEME.textWhite } }
                                            : item.sender === 'system'
                                                ? { body: styles.systemMessageText }
                                                : {}
                                    }
                                >
                                    {item.text || " "}
                                </MarkdownDisplay>
                                {item.usage && (
                                    <Text style={{
                                        fontSize: 9, color: item.sender === 'user' ? THEME.textWhite : THEME.secondaryText,
                                        opacity: 0.7, marginTop: 5, textAlign: 'right'
                                    }}>
                                        ⚡ {item.usage.duration}s | Tks: {item.usage.tokens}
                                    </Text>
                                )}
                            </View>
                        )}
                    />
                    <View style={styles.chatInputContainer}>
                        <TouchableOpacity onPress={pickDocument} style={{ padding: 10 }}>
                            <Ionicons name="attach" size={24} color={attachedFile ? THEME.primary : THEME.secondaryText} />
                        </TouchableOpacity>
                        <TextInput
                            style={styles.chatInput}
                            value={inputText}
                            onChangeText={setInputText}
                            placeholder={attachedFile ? "Arquivo pronto. O que fazer?" : "Pergunte à AgronomIA..."}
                            placeholderTextColor={THEME.secondaryText}
                            multiline
                            editable={!loading}
                        />
                        {(inputText.trim().length > 0 || attachedFile) && (
                            <TouchableOpacity
                                onPress={() => handleSend()}
                                disabled={loading}
                                style={[styles.chatbotSendButton, loading && { opacity: 0.6 }]}
                            >
                                {loading ? <ActivityIndicator size="small" color={THEME.textWhite} /> : <Ionicons name="send" size={20} color={THEME.textWhite} />}
                            </TouchableOpacity>
                        )}
                    </View>
                </KeyboardAvoidingView>
            )}

            <SettingsModal
                visible={showSettings}
                onClose={() => setShowSettings(false)}
                currentModel={activeModel}
                location={location}
                locationLoading={locationLoading}
                onRequestLocation={requestLocation}
                onSelectModel={(m) => { setActiveModel(m); setShowSettings(false); }}
            />
        </View>
    );
};

const ChatbotFAB = ({ onPress }) => (
    <TouchableOpacity style={styles.chatbotFab} onPress={onPress} activeOpacity={0.8}>
        <MaterialCommunityIcons name="robot-outline" size={28} color={THEME.textWhite} />
    </TouchableOpacity>
);

// =====================================================================
// 4️⃣ TELA PRINCIPAL (DASHBOARD)
// =====================================================================

export default function Dashboard({ navigation }) {
    const { width } = useWindowDimensions();
    // Calcula a largura exata para caberem 3 itens na tela, subtraindo paddings e margins (50px no total)
    const buttonWidth = Platform.OS === 'web' ? 160 : Math.floor((width - 50) / 3);
    const [weather, setWeather] = useState({
        temp: '--', desc: 'Buscando clima...', humidity: '--', wind: '--', rain: '--'
    });
    const [location, setLocation] = useState(null);
    const [isChatbotOpen, setIsChatbotOpen] = useState(false);
    const userName = auth.currentUser?.displayName || "Usuário";

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Erro ao fazer logout:", error);
            Alert.alert("Atenção", "Não foi possível sair. Tente novamente.");
        }
    };

    // Busca Localização e Clima
    useEffect(() => {
        (async () => {
            try {
                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    setWeather({ ...weather, desc: 'Permissão negada' });
                    return;
                }

                let loc = await Location.getCurrentPositionAsync({});
                let geocode = await Location.reverseGeocodeAsync(loc.coords);
                if (geocode.length > 0) setLocation(geocode[0]);

                if (CONFIG.WEATHER_API_KEY) {
                    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${loc.coords.latitude}&lon=${loc.coords.longitude}&appid=${CONFIG.WEATHER_API_KEY}&units=metric&lang=pt_br`);
                    const data = await res.json();

                    if (data.main) {
                        setWeather({
                            temp: Math.round(data.main.temp),
                            desc: data.weather[0].description,
                            humidity: data.main.humidity,
                            wind: Math.round(data.wind.speed * 3.6),
                            rain: data.rain ? data.rain['1h'] || 0 : 0
                        });
                    }
                }
            } catch (error) {
                console.error(error);
                setWeather({ ...weather, desc: 'Erro ao carregar clima' });
            }
        })();
    }, []);

    // Menu na Ordem Exata
    const gridItems = [
        { id: 1, title: 'PULVERIZAÇÃO', icon: 'spray-can', lib: FontAwesome5, screen: 'Pulverizacao' },
        { id: 2, title: 'PLANTIO', icon: 'seedling', lib: FontAwesome5, screen: 'Plantios' },
        { id: 3, title: 'COLHEITA', icon: 'tractor', lib: FontAwesome5, screen: 'Colheitas' },
        { id: 4, title: 'REVISÕES', icon: 'wrench', lib: FontAwesome5, screen: 'Revisoes' },
        { id: 5, title: 'DIESEL', icon: 'gas-pump', lib: FontAwesome5, screen: 'Diesel' },
        { id: 6, title: 'ESTOQUE', icon: 'warehouse', lib: FontAwesome5, screen: 'Manager', params: { initialView: 'estoque' } },
        { id: 7, title: 'PLUVIÔMETRO', icon: 'cloud-rain', lib: FontAwesome5, screen: 'Pluviometro' },
        { id: 8, title: '% ANDAMENTO', icon: 'percentage', lib: FontAwesome5, screen: 'Andamento' },
        { id: 9, title: 'GERENCIADOR', icon: 'cogs', lib: FontAwesome5, screen: 'Manager' },
        { id: 10, title: 'MANUAIS', icon: 'book-open', lib: FontAwesome5, screen: 'Manuais' },
    ];

    const gridRows = [];
    for (let i = 0; i < gridItems.length; i += 3) {
        gridRows.push(gridItems.slice(i, i + 3));
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.webContainer}>
            {/* HEADER VERDE */}
            <View style={styles.topHeader}>
                <View style={styles.headerTopRow}>
                    <Text style={styles.greetingText}>Olá, {userName}</Text>
                    <View style={styles.headerIconsWrapper}>
                        <TouchableOpacity style={styles.iconBtnHeader}>
                            <Ionicons name="download-outline" size={24} color={THEME.textWhite} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconBtnHeader} onPress={handleLogout}>
                            <Ionicons name="log-out-outline" size={24} color={THEME.textWhite} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Bloco de Clima */}
                <View style={styles.weatherInfoWrapper}>
                    <Text style={styles.weatherTempText}>{weather.temp}°C</Text>
                    <Text style={styles.weatherDescText}>{weather.desc.replace(/\b\w/g, l => l.toUpperCase())}</Text>

                    <View style={styles.weatherPill}>
                        <View style={styles.pillItem}>
                            <Ionicons name="water" size={14} color={THEME.textWhite} />
                            <Text style={styles.pillText}>{weather.humidity}%</Text>
                        </View>
                        <View style={styles.pillItem}>
                            <FontAwesome5 name="wind" size={12} color={THEME.textWhite} />
                            <Text style={styles.pillText}>{weather.wind} km/h</Text>
                        </View>
                        <View style={styles.pillItem}>
                            <FontAwesome5 name="cloud-rain" size={12} color={THEME.textWhite} />
                            <Text style={styles.pillText}>{weather.rain}mm</Text>
                        </View>
                    </View>
                </View>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 100, paddingTop: 30 }}>
                {/* GRID 3x3x3x1 RESPONSIVO */}
                <View style={styles.gridContainer}>
                    {gridRows.map((row, rowIndex) => (
                        <View key={rowIndex} style={styles.gridRow}>
                            {row.map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    style={[styles.gridButton, { width: buttonWidth, height: Platform.OS === 'web' ? 150 : buttonWidth }]}
                                    onPress={() => item.screen ? navigation.navigate(item.screen, item.params) : Alert.alert('Aviso', 'Tela em construção.')}
                                >
                                    <item.lib
                                        name={item.icon}
                                        size={Platform.OS === 'web' ? 32 : 28}
                                        color={THEME.textWhite}
                                        style={{ marginBottom: 12 }}
                                    />
                                    <Text style={styles.gridButtonText} numberOfLines={1}>{item.title}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ))}
                </View>
            </ScrollView>

            {/* FAB DO CHATBOT */}
            {!isChatbotOpen && (
                <ChatbotFAB onPress={() => setIsChatbotOpen(true)} />
            )}

            {/* MODAL DO CHATBOT */}
            <Modal visible={isChatbotOpen} animationType="slide" transparent>
                <View style={styles.modalOverlayChatbot}>
                    <AgronomiaChatbot onClose={() => setIsChatbotOpen(false)} />
                </View>
            </Modal>
            </View>
        </SafeAreaView>
    );
}

// =====================================================================
// 5️⃣ ESTILOS GERAIS (OTIMIZADOS PARA MOBILE)
// =====================================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: THEME.background,
    },
    webContainer: {
        flex: 1,
        width: '100%',
        maxWidth: Platform.OS === 'web' ? 1200 : '100%',
        alignSelf: 'center',
    },
    // --- Header do Dashboard ---
    topHeader: {
        backgroundColor: THEME.primary,
        width: '100%',
        paddingBottom: 30,
        borderBottomLeftRadius: Platform.OS === 'web' ? 30 : 20,
        borderBottomRightRadius: Platform.OS === 'web' ? 30 : 20,
        paddingHorizontal: Platform.OS === 'web' ? 40 : 20,
        ...Platform.select({ web: { boxShadow: '0px 4px 8px rgba(0,0,0,0.1)' }, default: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 } }),
        elevation: 5,
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: Platform.OS === 'ios' ? 10 : 35, // Afasta um pouco mais no Android para evitar notch
    },
    greetingText: {
        color: THEME.textWhite,
        fontSize: 22,
        fontWeight: 'bold',
    },
    headerIconsWrapper: {
        flexDirection: 'row',
    },
    iconBtnHeader: {
        marginLeft: 15,
    },
    weatherInfoWrapper: {
        alignItems: 'center',
        marginTop: 15,
    },
    weatherTempText: {
        fontSize: 56,
        fontWeight: 'bold',
        color: THEME.textWhite,
    },
    weatherDescText: {
        fontSize: 18,
        color: THEME.textWhite,
        marginBottom: 15,
        opacity: 0.9,
    },
    weatherPill: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        borderRadius: 30,
        paddingVertical: 8,
        paddingHorizontal: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pillItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 12,
    },
    pillText: {
        color: THEME.textWhite,
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 6,
    },

    // --- Grid do Dashboard Mobile ---
    gridContainer: {
        width: '100%',
        paddingHorizontal: Platform.OS === 'web' ? 20 : 10,
        alignItems: 'center',
    },
    gridRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        width: '100%',
        marginBottom: Platform.OS === 'web' ? 20 : 15,
    },
    gridButton: {
        backgroundColor: THEME.primaryDark,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        ...Platform.select({ web: { boxShadow: '0px 4px 5px rgba(0,0,0,0.2)' }, default: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5 } }),
        elevation: 6,
        marginHorizontal: Platform.OS === 'web' ? 10 : 5,
    },
    gridButtonText: {
        color: THEME.textWhite,
        fontSize: Platform.OS === 'web' ? 16 : 13,
        fontWeight: 'bold',
        textAlign: 'center',
        paddingHorizontal: 5,
    },

    // --- FAB ---
    chatbotFab: {
        position: 'absolute',
        right: 25,
        bottom: 30,
        backgroundColor: THEME.primary,
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        ...Platform.select({ web: { boxShadow: '0px 4px 4px rgba(0,0,0,0.3)' }, default: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4 } }),
        elevation: 6,
        borderWidth: 2,
        borderColor: '#fff',
    },

    // --- Estilos do Chatbot Mobile ---
    modalOverlayChatbot: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
        alignItems: Platform.OS === 'web' ? 'flex-end' : 'center',
        paddingHorizontal: Platform.OS === 'web' ? 30 : 10,
        paddingBottom: Platform.OS === 'web' ? 30 : 20,
    },
    chatbotPopupContainer: {
        backgroundColor: THEME.secondary,
        height: Platform.OS === 'web' ? 600 : '85%',
        width: Platform.OS === 'web' ? 400 : '100%',
        borderRadius: 20,
        overflow: 'hidden',
        ...Platform.select({ web: { boxShadow: '0px 0px 10px rgba(0,0,0,0.2)' }, default: { shadowColor: '#000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 10 } }),
        elevation: 10,
    },
    chatbotHeader: {
        backgroundColor: THEME.secondary,
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 18,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderColor: '#EAEAEA',
    },
    headerButton: {
        padding: 5,
    },
    chatbotTitle: {
        color: THEME.primary,
        fontWeight: 'bold',
        fontSize: 18,
    },
    chatbotWelcomeContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
    },
    chatbotWelcomeTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: THEME.textBlack,
        marginTop: 15,
    },
    chatbotWelcomeSubtitle: {
        fontSize: 14,
        color: THEME.secondaryText,
        textAlign: 'center',
        marginTop: 5,
    },
    chatbotPromptCard: {
        flexDirection: 'row',
        backgroundColor: THEME.grayButton,
        padding: 18,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    chatbotPromptCardText: {
        fontSize: 14,
        color: THEME.textBlack,
        flex: 1,
    },

    formSectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: THEME.textBlack,
        marginBottom: 15,
        marginTop: 10,
    },
    quickOptionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    chatbotQuickOption: {
        width: '48%',
        backgroundColor: THEME.grayButton,
        padding: 15,
        borderRadius: 15,
        alignItems: 'center',
        marginBottom: 15,
    },
    chatbotQuickOptionText: {
        fontSize: 12,
        color: THEME.textBlack,
        textAlign: 'center',
        marginTop: 8,
        fontWeight: '600',
    },

    messageBubble: {
        padding: 15,
        borderRadius: 15,
        marginBottom: 10,
        maxWidth: '85%',
    },
    userMessage: {
        backgroundColor: THEME.primary,
        alignSelf: 'flex-end',
        borderBottomRightRadius: 5,
    },
    botMessage: {
        backgroundColor: THEME.grayButton,
        alignSelf: 'flex-start',
        borderBottomLeftRadius: 5,
    },
    systemMessage: {
        backgroundColor: 'transparent',
        alignSelf: 'center',
        padding: 5,
    },
    systemMessageText: {
        color: THEME.secondaryText,
        fontSize: 12,
        fontStyle: 'italic',
        textAlign: 'center'
    },
    chatInputContainer: {
        flexDirection: 'row',
        padding: 10,
        paddingBottom: Platform.OS === 'ios' ? 25 : 15, // Notch padding
        backgroundColor: THEME.secondary,
        borderTopWidth: 1,
        borderColor: '#EAEAEA',
        alignItems: 'center',
    },
    chatInput: {
        flex: 1,
        backgroundColor: THEME.grayButton,
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderRadius: 20,
        maxHeight: 100,
        minHeight: 45,
        color: THEME.textBlack,
    },
    chatbotSendButton: {
        backgroundColor: THEME.primary,
        width: 46,
        height: 46,
        borderRadius: 23,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },

    // --- Modal Configs ---
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContainer: {
        backgroundColor: THEME.secondary,
        borderRadius: 15,
        overflow: 'hidden',
        width: '100%',
        alignSelf: 'center',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 18,
        borderBottomWidth: 1,
        borderColor: '#eee',
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    modelOptionCard: {
        padding: 15,
        backgroundColor: '#fff',
        borderRadius: 10,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#eee'
    },
    modelOptionCardActive: {
        borderColor: THEME.primary,
        backgroundColor: '#f0fdf4'
    },
    modelName: {
        fontWeight: 'bold',
        fontSize: 14,
        color: THEME.textBlack
    },
    modelDesc: {
        fontSize: 12,
        color: THEME.secondaryText,
        marginTop: 4
    },
    radioButtonOuter: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: '#ccc',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10
    },
    radioButtonInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: THEME.primary
    }
});
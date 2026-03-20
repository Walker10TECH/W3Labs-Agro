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
    View
} from 'react-native';

// Módulos Expo e Vector Icons
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Location from 'expo-location';

// Firebase
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { auth, db, signOut } from '../firebaseConfig'; // Certifique-se de que este caminho está correto

// Bibliotecas de IA
import { Ollama } from "ollama";
import MarkdownDisplay from 'react-native-markdown-display';

// =====================================================================
// 1️⃣ CONFIGURAÇÕES GERAIS E TEMA
// =====================================================================

const CONFIG = {
    OLLAMA_HOST: 'http://127.0.0.1:11434',
    OLLAMA_API_KEY: process.env.EXPO_PUBLIC_OLLAMA_API_KEY || '',
    WEATHER_API_KEY: process.env.EXPO_PUBLIC_WEATHER_API_KEY || '',
    // Configurações Gerais
    MAX_TOOL_LOOPS: 5,
};

const THEME = {
    primary: '#6DB33F',       // Verde vibrante principal
    primaryDark: '#5A9634',   // Verde dos botões (ligeiramente mais fechado)
    secondary: '#FFFFFF',     // Branco
    background: '#F4F6F4',    // Fundo cinza claro
    textBlack: '#2C3329',     // Texto escuro
    textWhite: '#FFFFFF',     // Texto branco
    secondaryText: '#7A8078', // Cinza para subtítulos
    grayButton: '#F0F2F0',    // Fundo dos botões do chatbot
};

const MODES = {
    WELCOME: 'welcome',
    OPTIONS: 'options',
    AI: 'ai',
};

const APPROVED_MODELS = [
    {
        id: 'gpt-oss:20b-cloud',
        name: 'W3Labs 20B (Local)',
        desc: 'Execução local via Ollama. Gratuito e Privado.',
        provider: 'ollama'
    }
];

const { width } = Dimensions.get('window');

// =====================================================================
// 2️⃣ CAMADA DE SERVIÇO DE IA (OLLAMA E TOOLS)
// =====================================================================

/**
 * Busca resultados na web usando a API da Ollama.
 * @param {string} query - A string de busca.
 * @returns {Promise<string>} - JSON stringificado com os resultados ou erro.
 */
async function fetchWebSearchResults(query) {
    if (!CONFIG.OLLAMA_API_KEY) {
        return JSON.stringify({ error: "A chave da API (OLLAMA_API_KEY) não está configurada." });
    }

    try {
        const response = await fetch('https://ollama.com/api/web_search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.OLLAMA_API_KEY}`,
            },
            body: JSON.stringify({ query: query, max_results: 5 }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API de busca retornou ${response.status}: ${errorBody}`);
        }

        const data = await response.json();
        return JSON.stringify(data.results || []);
    } catch (error) {
        console.error("Erro na busca web:", error);
        return JSON.stringify({ error: `Falha na busca web: ${error.message}` });
    }
}

async function fetchWebPage(url) {
    if (!CONFIG.OLLAMA_API_KEY) {
        return JSON.stringify({ error: "A chave da API (OLLAMA_API_KEY) não está configurada." });
    }

    try {
        const response = await fetch('https://ollama.com/api/web_fetch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CONFIG.OLLAMA_API_KEY}` },
            body: JSON.stringify({ url: url }),
        });

        if (!response.ok) throw new Error(`API de fetch retornou ${response.status}`);
        const data = await response.json();
        return `Título: ${data.title}\n\nConteúdo: ${data.content}`.substring(0, 8000);
    } catch (error) {
        console.error("Erro no fetch da web:", error);
        return JSON.stringify({ error: `Falha ao buscar URL: ${error.message}` });
    }
}

class OllamaService {
    constructor(host, apiKey) {
        const config = { host };
        if (apiKey) {
            config.headers = { Authorization: `Bearer ${apiKey}` };
        }
        this.client = new Ollama(config);
    }

    async chatStream(payload, onChunk) {
        try { 
            const response = await this.client.chat({
                ...payload,
                stream: true,
            });

            let finalMetrics = null;
            for await (const part of response) {
                onChunk({
                    message: part.message,
                    done: part.done,
                    total_duration: part.total_duration,
                    eval_count: part.eval_count,
                    prompt_eval_count: part.prompt_eval_count
                });

                if (part.done) {
                    finalMetrics = {
                        total_duration: part.total_duration,
                        eval_count: part.eval_count,
                        prompt_eval_count: part.prompt_eval_count
                    };
                }
            }
            return finalMetrics;
        } catch (error) {
            console.error('Ollama Service Error:', error);
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error(
                    "Falha de Conexão (CORS/Network).\n" +
                    "1. Verifique se o Ollama está rodando.\n" +
                    "2. Se estiver na Web, inicie o Ollama com: OLLAMA_ORIGINS=\"*\" ollama serve"
                );
            }
            if (error.message && error.message.includes('401')) {
                throw new Error("Erro 401: Não autorizado. Verifique sua API KEY.");
            }
            if (error.status === 404) {
                 throw new Error(`Modelo '${payload.model}' não encontrado. Execute 'ollama pull ${payload.model}' no terminal.`);
            }
            throw error;
        }
    }
}

const ollamaService = new OllamaService(CONFIG.OLLAMA_HOST, CONFIG.OLLAMA_API_KEY);

const TOOLS_DEFINITION = [
    {
        type: 'function',
        function: {
            name: 'get_farm_data',
            description: 'Busca registros técnicos internos da fazenda (banco de dados).',
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
    {
        type: 'function',
        function: {
            name: 'web_search',
            description: 'Busca informações na web. Use para cotações, notícias, e informações gerais.',
            parameters: {
                type: 'object',
                required: ['query'],
                properties: {
                    query: {
                        type: 'string',
                        description: 'O que pesquisar (ex: "preço soja paraná", "clima para amanhã").',
                    },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'web_fetch',
            description: 'Obtém o conteúdo completo de uma página da web a partir de uma URL específica. Use após uma busca para aprofundar em um resultado.',
            parameters: {
                type: 'object',
                required: ['url'],
                properties: {
                    url: {
                        type: 'string',
                        description: 'A URL completa da página a ser buscada.',
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
    web_search: async ({ query }) => {
        return await fetchWebSearchResults(query);
    },
    web_fetch: async ({ url }) => {
        return await fetchWebPage(url);
    },
};

async function processAttachment(uri) {
    try {
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
                        Motor de Inferência
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
            <Text style={styles.chatbotWelcomeSubtitle}>Sua assistente W3Labs. Como posso ajudar hoje?</Text>
        </View>
        <View style={{width: '100%', marginTop: 32}}>
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
        { label: 'Cotação Soja',  query: 'Qual a cotação da soja hoje?', icon: 'trending-up-outline' },
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
          Alert.alert("Erro de Localização", "Não foi possível obter a localização atual.");
        } finally {
          setLocationLoading(false);
        }
    }, []);

    useEffect(() => {
        requestLocation();
    }, [requestLocation]);

    const systemPrompt = useMemo(() => `
        Você é a AgronomIA, Especialista Sênior da W3Labs.
        Modelo Atual: ${activeModel}.
        Localização do Usuário: ${location ? `${location.city}, ${location.country}` : 'Não disponível'}.
        
        Diretrizes:
        1. Seja breve, técnico e direto (Backend - Eficácia).
        2. Use as FERRAMENTAS disponíveis para consultar dados.
        3. Para buscar informações na web (cotações, notícias, clima), use a ferramenta 'web_search'.
        4. Para aprofundar em um resultado de busca, use 'web_fetch' com a URL.
        5. Para dados internos da fazenda (estoque, colheitas, etc.), use 'get_farm_data'.
    `, [activeModel, location]);

    const handleSend = useCallback(async (manualQuery = null) => {
        const text = (manualQuery || inputText).trim();
        if (loading || (!text && !attachedFile)) return;

        if (manualQuery) setChatMode(MODES.AI); // Se vier das opções rápidas

        const userMsg = {
            id: Date.now().toString(),
            role: 'user',
            sender: 'user',
            text: text,
            images: [],
            fileData: attachedFile
        };

        if (attachedFile?.mimeType?.startsWith('image/')) {
            try {
                const b64 = await processAttachment(attachedFile.uri);
                userMsg.images = [b64];
            } catch (e) {
                Alert.alert("Erro", "Falha ao processar imagem.");
                return;
            }
        }

        const newHistory = [...messages, userMsg];
        setMessages(newHistory);
        setInputText('');
        setAttachedFile(null);
        setLoading(true);

        try {
            const botId = Date.now() + '_bot';
            setMessages(prev => [...prev, {
                id: botId, role: 'assistant', sender: 'bot', text: '', thinking: ''
            }]);

            let apiMessages = [
                { role: 'system', content: systemPrompt },
                ...newHistory.map(m => ({
                    role: m.role,
                    content: m.text,
                    images: m.images?.length ? m.images : undefined,
                    tool_calls: m.tool_calls // Mantém histórico de chamadas de função
                }))
            ];

            let keepGenerating = true;
            let loopCount = 0;

            while (keepGenerating && loopCount < CONFIG.MAX_TOOL_LOOPS) {
                loopCount++;
                let currentText = '';
                let currentThinking = '';
                let currentToolCalls = [];

                const finalMetrics = await ollamaService.chatStream({
                    model: activeModel,
                    messages: apiMessages,
                    stream: true,
                    tools: TOOLS_DEFINITION,
                }, (chunk) => {
                    const msg = chunk.message;
                    if (msg.content) currentText += msg.content;
                    if (msg.thinking) currentThinking += msg.thinking;
                    if (msg.tool_calls) currentToolCalls.push(...msg.tool_calls);

                    setMessages(prev => prev.map(m =>
                        m.id === botId
                        ? { ...m, text: currentText, thinking: currentThinking }
                        : m
                    ));
                });

                if (finalMetrics) {
                    const usageMetrics = {
                        duration: (finalMetrics.total_duration / 1e9).toFixed(2),
                        tokens: `${finalMetrics.prompt_eval_count}/${finalMetrics.eval_count}`
                    };
                    setMessages(prev => prev.map(m => m.id === botId ? { ...m, usage: usageMetrics } : m));
                }

                if (currentToolCalls.length > 0) {
                    apiMessages.push({
                        role: 'assistant',
                        content: currentText,
                        tool_calls: currentToolCalls
                    });

                    for (const call of currentToolCalls) {
                        const fnName = call.function.name;
                        const fnArgs = call.function.arguments;

                        setMessages(prev => [...prev, {
                            id: Date.now() + '_sys',
                            role: 'system',
                            sender: 'system',
                            text: `⚙️ Executando: ${fnName}...`
                        }]);

                        let result = JSON.stringify({ error: "Ferramenta falhou" });

                        if (TOOLS_IMPLEMENTATION[fnName]) {
                            result = await TOOLS_IMPLEMENTATION[fnName](fnArgs);
                        }

                        apiMessages.push({
                            role: 'tool',
                            content: result,
                            tool_name: fnName
                        });
                    }
                } else {
                    keepGenerating = false;
                }
            }
        } catch (error) {
            console.error("Erro AgronomIA:", error);
            let errorMsg = `⚠️ **Sistema Indisponível**\n${error.message}`;
            setMessages(prev => [...prev, {
                id: Date.now() + '_err',
                role: 'assistant',
                sender: 'bot',
                text: errorMsg,
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
                        <Text style={styles.chatbotTitle}>
                            AgronomIA
                        </Text>
                        <Text style={{ fontSize: 11, color: THEME.textBlack, opacity: 0.7, marginTop: 4 }}>
                            {location ? `📍 ${location.city}` : 'W3Labs Intelligence'}
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
                                {item.thinking ? (
                                    <View style={{ backgroundColor: 'rgba(0,0,0,0.03)', padding: 8, borderRadius: 6, marginBottom: 6, borderLeftWidth: 2, borderLeftColor: '#aaa' }}>
                                        <Text style={{ fontSize: 10, color: THEME.secondaryText, fontStyle: 'italic' }}>🧠 {item.thinking}</Text>
                                    </View>
                                ) : null}
                                <MarkdownDisplay
                                    style={
                                        item.sender === 'user'
                                        ? { body: { color: THEME.textWhite } }
                                        : item.sender === 'system'
                                        ? { body: styles.systemMessageText }
                                        : {}
                                    }
                                >
                                    {item.text}
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
                            placeholder={attachedFile ? "Arquivo pronto. Descreva o que fazer." : "Pergunte à AgronomIA..."}
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
// 4️⃣ TELA PRINCIPAL (DASHBOARD.JSX)
// =====================================================================

export default function Dashboard({ navigation }) {
    const [weather, setWeather] = useState({
        temp: '--', desc: 'Buscando clima...', humidity: '--', wind: '--', rain: '--'
    });
    const [location, setLocation] = useState(null);
    const [isChatbotOpen, setIsChatbotOpen] = useState(false);
    const userName = auth.currentUser?.displayName || "Usuário"; // Simula o nome vindo do Firebase

    // Função para realizar o logout do usuário
    const handleLogout = async () => {
        try {
            await signOut(auth);
            // O listener `onAuthStateChanged` em `W3LabsAgro.jsx` irá
            // detectar a mudança de estado e redirecionar para a tela de Login.
        } catch (error) {
            console.error("Erro ao fazer logout:", error);
            alert("Não foi possível sair. Tente novamente.");
        }
    };

    // Busca Localização e Clima (OpenWeatherMap)
    useEffect(() => {
        (async () => {
            try {
                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    setWeather({ ...weather, desc: 'Permissão de localização negada' });
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

    // Array dos Botões do Menu na Ordem Exata
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

    // Lógica para estruturar exatamente o layout 3x3x3x1
    const gridRows = [
        gridItems.slice(0, 3), // [0, 1, 2]
        gridItems.slice(3, 6), // [3, 4, 5]
        gridItems.slice(6, 9), // [6, 7, 8]
        gridItems.slice(9, 10) // [9]
    ];

    return (
        <SafeAreaView style={styles.container}>
            {/* HEADER VERDE DO DASHBOARD */}
            <View style={styles.topHeader}>
                {/* Linha Superior: Nome e Ícones */}
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

                {/* Bloco de Clima Central */}
                <View style={styles.weatherInfoWrapper}>
                    <Text style={styles.weatherTempText}>{weather.temp}°C</Text>
                    <Text style={styles.weatherDescText}>{weather.desc.replace(/\b\w/g, l => l.toUpperCase())}</Text>
                    
                    {/* Pílula Translucida com Info Extra */}
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

            <ScrollView contentContainerStyle={{ paddingBottom: 100, paddingTop: 40 }}>
                {/* ESTRUTURA FIXA DE LINHAS PARA GARANTIR O FORMATO 3x3x3x1 */}
                <View style={styles.gridContainer}>
                    {gridRows.map((row, rowIndex) => (
                        <View key={rowIndex} style={styles.gridRow}>
                            {row.map((item) => (
                                <TouchableOpacity 
                                    key={item.id} 
                                    style={styles.gridButton}
                                    onPress={() => item.screen ? navigation.navigate(item.screen, item.params) : alert('Tela não implementada.')}
                                >
                                    <item.lib 
                                        name={item.icon} 
                                        size={28} 
                                        color={THEME.textWhite} 
                                        style={{ marginBottom: 10 }}
                                    />
                                    <Text style={styles.gridButtonText}>{item.title}</Text>
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
        </SafeAreaView>
    );
}

// =====================================================================
// 5️⃣ ESTILOS GERAIS
// =====================================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: THEME.background,
    },
    // --- Header do Dashboard ---
    topHeader: {
        backgroundColor: THEME.primary,
        width: '100%',
        paddingBottom: 25,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        paddingHorizontal: 20,
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: Platform.OS === 'ios' ? 10 : 30,
    },
    greetingText: {
        color: THEME.textWhite,
        fontSize: 16,
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
        marginTop: 10,
    },
    weatherTempText: {
        fontSize: 48,
        fontWeight: 'bold',
        color: THEME.textWhite,
    },
    weatherDescText: {
        fontSize: 14,
        color: THEME.textWhite,
        marginBottom: 15,
        opacity: 0.9,
    },
    weatherPill: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 30,
        paddingVertical: 8,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pillItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 15,
    },
    pillText: {
        color: THEME.textWhite,
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 6,
    },
    
    // --- Grid do Dashboard (Layout 3x3x3x1) ---
    gridContainer: {
        width: '100%',
        alignItems: 'center',
        paddingHorizontal: 10,
    },
    gridRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        width: '100%',
    },
    gridButton: {
        backgroundColor: THEME.primaryDark,
        width: Platform.OS === 'web' ? 150 : (width - 80) / 3,
        height: Platform.OS === 'web' ? 120 : 100,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 6,
        margin: 10,
        overflow: 'hidden',
    },
    gridButtonText: {
        color: THEME.textWhite,
        fontSize: Platform.OS === 'web' ? 14 : 10,
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 6,
        borderWidth: 2,
        borderColor: '#fff',
    },

    // --- Estilos do Chatbot ---
    modalOverlayChatbot: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
        padding: Platform.OS === 'web' ? 20 : 10,
    },
    chatbotPopupContainer: {
        backgroundColor: THEME.secondary,
        height: '85%',
        maxHeight: 650,
        width: '100%',
        maxWidth: 400,  
        borderRadius: 15,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 10,
    },
    chatbotHeader: {
        backgroundColor: THEME.secondary,
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 15,
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
        paddingBottom: Platform.OS === 'ios' ? 25 : 10,
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
        minHeight: 40,
        color: THEME.textBlack,
    },
    chatbotSendButton: {
        backgroundColor: THEME.primary,
        width: 44,
        height: 44,
        borderRadius: 22,
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
        maxWidth: 500,
        width: '100%',
        alignSelf: 'center',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 15,
        borderBottomWidth: 1,
        borderColor: '#eee',
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
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#ccc',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10
    },
    radioButtonInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: THEME.primary
    }
});
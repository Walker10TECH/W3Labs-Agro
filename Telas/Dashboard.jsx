import {
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import {
    ActivityIndicator,
    Dimensions,
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
import * as Location from 'expo-location';

// Firebase
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { auth, db, signOut } from '../firebaseConfig'; // Certifique-se de que este caminho está correto

// Bibliotecas de IA
import { Ollama } from "ollama";

// =====================================================================
// 1️⃣ CONFIGURAÇÕES GERAIS E TEMA
// =====================================================================

const CONFIG = {
    OLLAMA_HOST: 'http://127.0.0.1:11434',
    OLLAMA_API_KEY: process.env.EXPO_PUBLIC_OLLAMA_API_KEY || '',
    WEATHER_API_KEY: process.env.EXPO_PUBLIC_WEATHER_API_KEY || '',
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
    { id: 'gpt-oss:20b-cloud', name: 'W3Labs 20B (Local)', desc: 'Execução local via Ollama. Gratuito e Privado.' }
];

const { width } = Dimensions.get('window');

// =====================================================================
// 2️⃣ CAMADA DE SERVIÇO DE IA (OLLAMA E TOOLS)
// =====================================================================

class OllamaService {
    constructor(host, apiKey) {
        const config = { host };
        if (apiKey) {
            config.headers = { Authorization: `Bearer ${apiKey}` };
        }
        this.client = new Ollama(config);
    }

    async chatStream(payload, onChunk) {
        // NOTE: The 'ollama' package might face CORS issues on web. A proxy server, like the one in server.js, is recommended.
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
            description: 'Busca registros técnicos internos da fazenda no Firebase.',
            parameters: {
                type: 'object',
                required: ['topic'],
                properties: {
                    topic: {
                        type: 'string',
                        description: 'Setor para consulta.',
                        enum: ['colheitas', 'diesel', 'plantios', 'pulverizacoes', 'pluviometro', 'estoqueGeral', 'inventario', 'revisoes', 'andamento']
                    },
                },
            },
        },
    }
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
            andamento: { orderBy: 'dataAtt' },
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
    }
};

// =====================================================================
// 3️⃣ COMPONENTES DO CHATBOT (AGRONOMIA)
// =====================================================================

const SettingsModal = ({ visible, onClose, location, onRequestLocation, locationLoading }) => (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Configurações</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="close" size={24} color={THEME.secondaryText} />
                    </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={{ padding: 20 }}>
                    <Text style={styles.sectionTitle}>Dados da Sessão</Text>
                    <TouchableOpacity onPress={onRequestLocation} disabled={locationLoading} style={styles.locationBtn}>
                        <Ionicons name="location-outline" size={24} color={THEME.secondaryText} />
                        <View style={{ marginLeft: 15, flex: 1 }}>
                            <Text style={{ fontWeight: 'bold', color: THEME.textBlack }}>Localização</Text>
                            <Text style={{ color: THEME.secondaryText, fontSize: 13 }}>
                                {locationLoading ? 'Buscando...' : location ? `${location.city || 'N/A'}, ${location.region || 'N/A'}` : 'Toque para buscar...'}
                            </Text>
                        </View>
                        {locationLoading && <ActivityIndicator size="small" color={THEME.primary} />}
                    </TouchableOpacity>
                </ScrollView>
            </View>
        </View>
    </Modal>
);

const AgronomiaChatbot = ({ onClose, location }) => {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [chatMode, setChatMode] = useState(MODES.WELCOME);
    const flatListRef = useRef(null);

    const systemPrompt = useMemo(() => `
        Você é a AgronomIA, Especialista Sênior da W3Labs.
        Localização do Usuário: ${location ? `${location.city}, ${location.region}` : 'Não disponível'}.
        Use as ferramentas disponíveis para consultar dados do Firebase quando necessário.
    `, [location]);

    const handleSend = async (manualQuery = null) => {
        const text = (manualQuery || inputText).trim();
        if (loading || !text) return;

        if (manualQuery) setChatMode(MODES.AI);
        
        const userMsg = { id: Date.now().toString(), role: 'user', sender: 'user', text: text };
        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setLoading(true);

        try {
            const botId = Date.now() + '_bot';
            setMessages(prev => [...prev, { id: botId, role: 'assistant', sender: 'bot', text: '' }]);

            let apiMessages = [
                { role: 'system', content: systemPrompt },
                ...messages.map(m => ({ role: m.role, content: m.text })),
                { role: 'user', content: text }
            ];

            await ollamaService.chatStream({
                model: APPROVED_MODELS[0].id,
                messages: apiMessages,
                tools: TOOLS_DEFINITION,
            }, (chunk) => {
                const msg = chunk.message;
                if (msg && msg.content) {
                    setMessages(prev => prev.map(m => m.id === botId ? { ...m, text: m.text + msg.content } : m));
                }
            });

        } catch (error) {
            setMessages(prev => [...prev, { id: Date.now() + '_err', role: 'assistant', sender: 'bot', text: `⚠️ Erro de conexão com a IA.\nVerifique se o Ollama está rodando e a URL está correta.` }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.chatbotPopupContainer}>
            {/* HEADER DO CHATBOT */}
            <View style={styles.chatbotHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {chatMode !== MODES.WELCOME && (
                        <TouchableOpacity onPress={() => setChatMode(MODES.WELCOME)} style={{ marginRight: 10 }}>
                            <Ionicons name="arrow-back" size={24} color={THEME.secondaryText} />
                        </TouchableOpacity>
                    )}
                    <Text style={styles.chatbotTitle}>AgronomIA</Text>
                </View>
                <View style={{ flexDirection: 'row' }}>
                    <TouchableOpacity onPress={() => setShowSettings(true)} style={{ marginRight: 15 }}>
                        <Ionicons name="settings-outline" size={24} color={THEME.secondaryText} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="close" size={24} color={THEME.secondaryText} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* TELA DE BOAS VINDAS */}
            {chatMode === MODES.WELCOME && (
                <View style={styles.welcomeContainer}>
                    <MaterialCommunityIcons name="robot-outline" size={80} color={THEME.primary} style={{ marginBottom: 10 }} />
                    <Text style={styles.welcomeTitle}>Olá! Sou a AgronomIA</Text>
                    <Text style={styles.welcomeSubtitle}>Sua assistente para o agronegócio. Como posso ajudar hoje?</Text>
                    
                    <View style={{ width: '100%', marginTop: 20 }}>
                        <TouchableOpacity style={styles.promptCard} onPress={() => setChatMode(MODES.AI)}>
                            <Text style={styles.promptText}>Fazer uma pergunta por texto ou voz</Text>
                            <Ionicons name="chatbubbles-outline" size={24} color={THEME.primary} />
                        </TouchableOpacity>
                        
                        <TouchableOpacity style={styles.promptCard} onPress={() => {}}>
                            <Text style={styles.promptText}>Ver ações rápidas</Text>
                            <Ionicons name="flash-outline" size={24} color={THEME.primary} />
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* TELA DE CHAT */}
            {chatMode === MODES.AI && (
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={{ padding: 15 }} ref={flatListRef} onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}>
                        {messages.map(item => (
                            <View key={item.id} style={[styles.messageBubble, item.sender === 'user' ? styles.userMessage : styles.botMessage]}>
                                <Text style={{ color: item.sender === 'user' ? THEME.textWhite : THEME.textBlack }}>{item.text}</Text>
                            </View>
                        ))}
                    </ScrollView>
                    <View style={styles.chatInputContainer}>
                        <TextInput
                            style={styles.chatInput}
                            value={inputText}
                            onChangeText={setInputText}
                            placeholder="Pergunte à AgronomIA..."
                            placeholderTextColor={THEME.secondaryText}
                            multiline
                        />
                        <TouchableOpacity onPress={() => handleSend()} disabled={loading} style={styles.sendBtn}>
                            {loading ? <ActivityIndicator size="small" color={THEME.textWhite} /> : <Ionicons name="send" size={18} color={THEME.textWhite} />}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            )}

            <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} location={location} />
        </View>
    );
};

// =====================================================================
// 4️⃣ TELA PRINCIPAL (DASHBOARD.JSX)
// =====================================================================

export default function Dashboard() {
    const [weather, setWeather] = useState({
        temp: '--', desc: 'Buscando clima...', humidity: '--', wind: '--', rain: '--'
    });
    const [location, setLocation] = useState(null);
    const [isChatbotOpen, setIsChatbotOpen] = useState(false);
    const userName = auth.currentUser?.displayName || "Willyan"; // Simula o nome vindo do Firebase

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
        { id: 1, title: 'PULVERIZAÇÃO', icon: 'spray-can', lib: FontAwesome5 },
        { id: 2, title: 'PLANTIO', icon: 'seedling', lib: FontAwesome5 },
        { id: 3, title: 'COLHEITA', icon: 'tractor', lib: FontAwesome5 },
        { id: 4, title: 'REVISÕES', icon: 'wrench', lib: FontAwesome5 },
        { id: 5, title: 'DIESEL', icon: 'gas-pump', lib: FontAwesome5 },
        { id: 6, title: 'ESTOQUE', icon: 'warehouse', lib: FontAwesome5 },
        { id: 7, title: 'PLUVIÔMETRO', icon: 'cloud-rain', lib: FontAwesome5 },
        { id: 8, title: '% ANDAMENTO', icon: 'percentage', lib: FontAwesome5 },
        { id: 9, title: 'GERENCIADOR', icon: 'cogs', lib: FontAwesome5 },
        { id: 10, title: 'MANUAIS', icon: 'book-open', lib: FontAwesome5 },
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
                                <TouchableOpacity key={item.id} style={styles.gridButton}>
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
                <TouchableOpacity style={styles.fab} onPress={() => setIsChatbotOpen(true)}>
                    <MaterialCommunityIcons name="robot" size={32} color={THEME.textWhite} />
                </TouchableOpacity>
            )}

            {/* MODAL DO CHATBOT */}
            <Modal visible={isChatbotOpen} animationType="slide" transparent>
                <View style={styles.modalOverlayChatbot}>
                    <AgronomiaChatbot onClose={() => setIsChatbotOpen(false)} location={location} />
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
    //gridButton responsivo
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
    gridButtonTitle: {
        color: THEME.textWhite,
        fontSize: 12,
        fontWeight: 'bold',
        textAlign: 'center',
        paddingHorizontal: 5,
    },
    gridButtonText: {
        color: THEME.textWhite,
        fontSize: Platform.OS === 'web' ? 14 : 10,
        fontWeight: 'bold',
        textAlign: 'center',
        paddingHorizontal: 5,
    },
    
    // --- FAB ---
    fab: {
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
        maxWidth: 400,  // Define uma largura máxima
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
    chatbotTitle: {
        color: THEME.primary,
        fontWeight: 'bold',
        fontSize: 18,
    },
    welcomeContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
    },
    welcomeTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: THEME.textBlack,
        marginTop: 10,
    },
    welcomeSubtitle: {
        fontSize: 14,
        color: THEME.secondaryText,
        textAlign: 'center',
        marginTop: 5,
        marginBottom: 30,
    },
    promptCard: {
        flexDirection: 'row',
        backgroundColor: THEME.grayButton,
        padding: 18,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 12,
    },
    promptText: {
        fontSize: 14,
        color: THEME.textBlack,
        flex: 1,
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
    sendBtn: {
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
    locationBtn: {
        backgroundColor: THEME.grayButton,
        padding: 15,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
    },
});
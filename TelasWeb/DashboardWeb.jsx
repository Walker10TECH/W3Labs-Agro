// -----------------------------------------------------------------------------
// Dashboard.jsx
// Módulo de Dashboard e Chatbot AgronomIA.
// Adaptado EXCLUSIVAMENTE PARA WEB.
// -----------------------------------------------------------------------------
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { auth, db, signOut } from '../firebaseConfig'; // Ajuste o caminho se necessário

// =====================================================================
// 1️⃣ CONFIGURAÇÕES GERAIS E TEMA
// =====================================================================

const CONFIG = {
    GROQ_API_KEY: process.env.REACT_APP_GROQ_API_KEY || process.env.EXPO_PUBLIC_GROQ_API_KEY || '',
    WEATHER_API_KEY: process.env.REACT_APP_WEATHER_API_KEY || process.env.EXPO_PUBLIC_WEATHER_API_KEY || '',
    MAX_TOOL_LOOPS: 5,
};

const THEME = {
    primary: '#4CAF50',
    primaryDark: '#388E3C',
    secondary: '#FFFFFF',
    background: '#F9FBF9',
    textBlack: '#2C3329',
    textWhite: '#FFFFFF',
    secondaryText: '#4A4A4A',
    grayButton: '#F0F2F0',
};

const MODES = {
    WELCOME: 'welcome',
    OPTIONS: 'options',
    AI: 'ai',
};

const APPROVED_MODELS = [
    {
        id: 'openai/gpt-oss-120b', // Atualizado para um modelo válido no Groq (ajuste conforme necessário)
        name: 'W3Labs-AgronomIA com pesquisa na WEB(Compound)',
        desc: 'Acesso inteligente e respostas mais completas.',
        provider: 'groq'
    },
];

// =====================================================================
// 2️⃣ CAMADA DE SERVIÇO DE IA E TOOLS
// =====================================================================

class GroqService {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseURL = 'https://api.groq.com/openai/v1/chat/completions';
    }

    async chat(payload) {
        if (!this.apiKey) {
            throw new Error("Chave da API do Groq não está configurada.");
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

// Processador de Arquivos nativo para Web
const processAttachment = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

// =====================================================================
// 3️⃣ UTILITÁRIOS E ÍCONES SVG INLINE
// =====================================================================

const useWindowDimensions = () => {
    const [width, setWidth] = useState(window.innerWidth);
    useEffect(() => {
        const handleResize = () => setWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    return { width };
};

// Micro-parser de Markdown Seguro
const renderMarkdown = (text) => {
    if (!text) return { __html: '' };
    let html = text
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') // Negrito
        .replace(/\*(.*?)\*/g, '<i>$1</i>')     // Itálico
        .replace(/\n/g, '<br/>');               // Quebras de linha
    return { __html: html };
};

const Icons = {
    Robot: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><line x1="8" y1="16" x2="8" y2="16" /><line x1="16" y1="16" x2="16" y2="16" /></svg>),
    Close: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>),
    Chat: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>),
    Flash: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>),
    Trending: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>),
    Rain: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" /><path d="M16 20l-2 2" /><path d="M8 20l-2 2" /><path d="M12 20l-2 2" /></svg>),
    Archive: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" /></svg>),
    Speed: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4" /><path d="M12 18v4" /><path d="M4.93 4.93l2.83 2.83" /><path d="M16.24 16.24l2.83 2.83" /><path d="M2 12h4" /><path d="M18 12h4" /><path d="M4.93 19.07l2.83-2.83" /><path d="M16.24 7.76l2.83-2.83" /></svg>),
    ArrowBack: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>),
    Settings: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>),
    Trash: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>),
    Location: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>),
    Attach: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>),
    Send: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>),
    Download: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>),
    Logout: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>),
    Water: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" /></svg>),
    Wind: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" /></svg>),
    Tractor: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 14h2l2-3V7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4l3 3h3v2h-2.5" /><circle cx="7" cy="17" r="3" /><circle cx="17" cy="17" r="3" /></svg>),
    Plant: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22v-9m0 0C7 13 4 8.5 4 4c4 0 8.5 3 8.5 9zm0 0c5 0 8-4.5 8-9-4 0-8.5 3-8.5 9z" /></svg>),
    GasPump: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 22v-8c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v8" /><path d="M5 12V6c0-1.1.9-2 2-2h.01" /><path d="M9 4h.01" /><path d="M3 22h8" /><path d="M11 15h4v-3a2 2 0 0 1 2-2h2.5" /><path d="M19.5 10A2.5 2.5 0 0 1 22 12.5V17a2 2 0 0 1-2 2h-1" /></svg>),
    Document: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>)
};

// =====================================================================
// 4️⃣ COMPONENTES DO CHATBOT
// =====================================================================

const SettingsModal = ({ visible, onClose, currentModel, onSelectModel, location, onRequestLocation, locationLoading }) => {
    if (!visible) return null;
    return (
        <div style={styles.modalOverlay} onClick={onClose}>
            <div style={styles.modalContainer} onClick={e => e.stopPropagation()}>
                <div style={styles.modalHeader}>
                    <span style={styles.modalTitle}>Configurações</span>
                    <button onClick={onClose} style={styles.iconButton}>
                        <Icons.Close size={24} color={THEME.secondaryText} />
                    </button>
                </div>
                <div style={styles.modalBody}>
                    <span style={styles.sectionTitle}>Motor de Inferência (Groq)</span>
                    {APPROVED_MODELS.map((model) => (
                        <div
                            key={model.id}
                            style={{ ...styles.modelOptionCard, ...(currentModel === model.id ? styles.modelOptionCardActive : {}) }}
                            onClick={() => onSelectModel(model.id)}
                        >
                            <div style={{ flex: 1 }}>
                                <div style={{ ...styles.modelName, color: currentModel === model.id ? THEME.primary : THEME.textBlack }}>
                                    {model.name}
                                </div>
                                <div style={styles.modelDesc}>{model.desc}</div>
                            </div>
                            <div style={{ ...styles.radioButtonOuter, borderColor: currentModel === model.id ? THEME.primary : '#ccc' }}>
                                {currentModel === model.id && <div style={styles.radioButtonInner} />}
                            </div>
                        </div>
                    ))}

                    <div style={{ height: 30 }} />

                    <span style={styles.sectionTitle}>Dados da Sessão</span>
                    <button
                        onClick={onRequestLocation}
                        disabled={locationLoading}
                        style={styles.locationButton}
                    >
                        <Icons.Location size={24} color={THEME.secondaryText} />
                        <div style={{ marginLeft: 15, flex: 1, textAlign: 'left' }}>
                            <div style={{ fontWeight: 'bold', color: THEME.textBlack, fontSize: 14 }}>Localização</div>
                            <div style={{ color: THEME.secondaryText, fontSize: 13 }}>
                                {locationLoading
                                    ? 'Buscando...'
                                    : location
                                        ? `${location.city || 'N/A'}, ${location.region || 'BR'}`
                                        : 'Toque para buscar... (habilite a permissão)'}
                            </div>
                        </div>
                        {locationLoading && <span style={{ color: THEME.primary, fontSize: 12 }}>Carregando...</span>}
                    </button>
                </div>
            </div>
        </div>
    );
};

const WelcomeView = React.memo(({ onModeChange }) => (
    <div style={styles.chatbotWelcomeContainer}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <Icons.Robot size={64} color={THEME.primary} />
            <div style={styles.chatbotWelcomeTitle}>Olá! Sou a AgronomIA</div>
            <div style={styles.chatbotWelcomeSubtitle}>Sua assistente W3Labs.</div>
        </div>
        <div style={{ width: '100%', marginTop: 32 }}>
            <button style={styles.chatbotPromptCard} onClick={() => onModeChange(MODES.AI)}>
                <span style={styles.chatbotPromptCardText}>Fazer uma pergunta por texto</span>
                <Icons.Chat size={24} color={THEME.primary} />
            </button>
            <button style={styles.chatbotPromptCard} onClick={() => onModeChange(MODES.OPTIONS)}>
                <span style={styles.chatbotPromptCardText}>Ver ações rápidas e mercado</span>
                <Icons.Flash size={24} color={THEME.primary} />
            </button>
        </div>
    </div>
));

const OptionsView = React.memo(({ onOptionSelect }) => {
    const analysisOptions = [
        { label: 'Cotação Soja', query: 'Qual a cotação da soja hoje?', Icon: Icons.Trending },
        { label: 'Histórico Chuva', query: 'Relatório do meu histórico de chuva', Icon: Icons.Rain },
        { label: 'Estoque', query: 'Análise do meu estoque geral', Icon: Icons.Archive },
        { label: 'Consumo Diesel', query: 'Análise do consumo de diesel', Icon: Icons.Speed },
    ];

    return (
        <div style={{ padding: '15px', overflowY: 'auto' }}>
            <div style={styles.formSectionTitle}>Análises Rápidas</div>
            <div style={styles.quickOptionsGrid}>
                {analysisOptions.map(item => (
                    <button key={item.label} style={styles.chatbotQuickOption} onClick={() => onOptionSelect(item.query)}>
                        <item.Icon size={28} color={THEME.primary} />
                        <span style={styles.chatbotQuickOptionText}>{item.label}</span>
                    </button>
                ))}
            </div>
        </div>
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
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const requestLocation = useCallback(async () => {
        setLocationLoading(true);
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    // Mockando a cidade pelo OpenWeather para evitar lib de reverse geocode complexa
                    try {
                        if (CONFIG.WEATHER_API_KEY) {
                            const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${CONFIG.WEATHER_API_KEY}&units=metric&lang=pt_br`);
                            const data = await res.json();
                            if (data.name) setLocation({ city: data.name, region: data.sys?.country || 'BR' });
                        } else {
                            setLocation({ city: 'Lat/Lng', region: 'Desconhecida' });
                        }
                    } catch (error) {
                        console.error("Erro ao buscar cidade", error);
                    }
                    setLocationLoading(false);
                },
                (error) => {
                    console.error("GPS Error: ", error);
                    setLocationLoading(false);
                }
            );
        } else {
            setLocationLoading(false);
        }
    }, []);

    useEffect(() => {
        requestLocation();
    }, [requestLocation]);

    const systemPrompt = useMemo(() => `
        Você é a AgronomIA, Especialista Sênior da W3Labs.
        Localização do Usuário: ${location ? `${location.city}, ${location.region}` : 'Não disponível'}.
        
        Diretrizes:
        1. Seja breve, técnico e direto.
        2. Use as FERRAMENTAS disponíveis para consultar dados da conta do usuário.
        3. Formate suas respostas usando Markdown limpo.
    `, [location]);

    const handleSend = useCallback(async (manualQuery = null) => {
        const text = (manualQuery || inputText).trim();
        if (loading || (!text && !attachedFile)) return;

        if (manualQuery) setChatMode(MODES.AI);

        const userMsg = { id: Date.now().toString(), role: 'user', sender: 'user', text: text, fileData: attachedFile };
        const newHistory = [...messages, userMsg];

        setMessages(newHistory);
        setInputText('');
        setAttachedFile(null);
        setLoading(true);

        try {
            const botId = Date.now() + '_bot';
            setMessages(prev => [...prev, { id: botId, role: 'assistant', sender: 'bot', text: '' }]);

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
                    setMessages(prev => [...prev, { id: Date.now() + '_sys_web_' + Math.random(), role: 'system', sender: 'system', text: `🌐 Fontes consultadas na web.` }]);
                }

                if (msg.content) {
                    currentText += msg.content;
                    setMessages(prev => prev.map(m => m.id === botId ? { ...m, text: currentText } : m));
                }

                if (msg.tool_calls && msg.tool_calls.length > 0) {
                    apiMessages.push(msg);

                    for (const call of msg.tool_calls) {
                        const fnName = call.function.name;
                        const fnArgs = JSON.parse(call.function.arguments);

                        setMessages(prev => [...prev, { id: Date.now() + '_sys_' + Math.random(), role: 'system', sender: 'system', text: `⚙️ Consultando: ${fnName}...` }]);

                        let result = JSON.stringify({ error: "Ferramenta falhou" });
                        if (TOOLS_IMPLEMENTATION[fnName]) {
                            result = await TOOLS_IMPLEMENTATION[fnName](fnArgs);
                        }

                        apiMessages.push({ role: 'tool', tool_call_id: call.id, name: fnName, content: result });
                    }
                } else {
                    keepGenerating = false;
                }
            }
        } catch (error) {
            setMessages(prev => [...prev, { id: Date.now() + '_err', role: 'assistant', sender: 'bot', text: `⚠️ **Erro**\n${error.message}`, isError: true }]);
        } finally {
            setLoading(false);
        }
    }, [inputText, attachedFile, loading, messages, activeModel, systemPrompt]);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setAttachedFile(e.target.files[0]);
        }
    };

    return (
        <div style={styles.chatbotPopupContainer}>
            <div style={styles.chatbotHeader}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    {chatMode !== MODES.WELCOME && (
                        <button onClick={() => setChatMode(MODES.WELCOME)} style={{ ...styles.iconButton, marginRight: '10px' }}>
                            <Icons.ArrowBack size={24} color={THEME.secondaryText} />
                        </button>
                    )}
                    <div>
                        <div style={styles.chatbotTitle}>AgronomIA</div>
                        <div style={{ fontSize: '11px', color: THEME.textBlack, opacity: 0.7, marginTop: '4px' }}>
                            {location ? `📍 ${location.city}` : 'W3Labs Engine'}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex' }}>
                    <button onClick={() => setShowSettings(true)} style={styles.iconButton}>
                        <Icons.Settings size={24} color={THEME.secondaryText} />
                    </button>
                    {messages.length > 0 && chatMode === MODES.AI && (
                        <button onClick={() => { setMessages([]); setChatMode(MODES.WELCOME); }} style={styles.iconButton}>
                            <Icons.Trash size={22} color={THEME.secondaryText} />
                        </button>
                    )}
                    <button onClick={onClose} style={styles.iconButton}>
                        <Icons.Close size={24} color={THEME.secondaryText} />
                    </button>
                </div>
            </div>

            {chatMode === MODES.WELCOME && <WelcomeView onModeChange={setChatMode} />}
            {chatMode === MODES.OPTIONS && <OptionsView onOptionSelect={(q) => handleSend(q)} />}

            {chatMode === MODES.AI && (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
                        {messages.map((item) => (
                            <div key={item.id} style={{
                                ...styles.messageBubble,
                                ...(item.sender === 'user' ? styles.userMessage : item.sender === 'system' ? styles.systemMessage : styles.botMessage)
                            }}>
                                {item.fileData && (
                                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', opacity: 0.8 }}>
                                        <Icons.Attach size={16} color={item.sender === 'user' ? THEME.textWhite : THEME.textBlack} />
                                        <span style={{ fontSize: '11px', marginLeft: '5px', color: item.sender === 'user' ? THEME.textWhite : THEME.textBlack }}>
                                            {item.fileData.name}
                                        </span>
                                    </div>
                                )}
                                <div
                                    style={item.sender === 'system' ? styles.systemMessageText : { color: item.sender === 'user' ? THEME.textWhite : THEME.textBlack }}
                                    dangerouslySetInnerHTML={renderMarkdown(item.text || " ")}
                                />
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    <div style={styles.chatInputContainer}>
                        <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
                        <button onClick={() => fileInputRef.current.click()} style={{ padding: '10px', background: 'none', border: 'none', cursor: 'pointer' }}>
                            <Icons.Attach size={24} color={attachedFile ? THEME.primary : THEME.secondaryText} />
                        </button>
                        <textarea
                            style={styles.chatInput}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder={attachedFile ? "Arquivo pronto." : "Pergunte à AgronomIA..."}
                            disabled={loading}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                        />
                        {(inputText.trim().length > 0 || attachedFile) && (
                            <button onClick={() => handleSend()} disabled={loading} style={{ ...styles.chatbotSendButton, opacity: loading ? 0.6 : 1 }}>
                                {loading ? <span style={{ color: THEME.textWhite, fontSize: '12px' }}>...</span> : <Icons.Send size={20} color={THEME.textWhite} />}
                            </button>
                        )}
                    </div>
                </div>
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
        </div>
    );
};

// =====================================================================
// 5️⃣ TELA PRINCIPAL (DASHBOARD)
// =====================================================================

export default function Dashboard({ navigation }) {
    const { width } = useWindowDimensions();
    const isDesktop = width > 800;

    const [weather, setWeather] = useState({ temp: '--', desc: 'Buscando...', humidity: '--', wind: '--', rain: '--' });
    const [isChatbotOpen, setIsChatbotOpen] = useState(false);
    const userName = auth?.currentUser?.displayName || "Usuário";

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            window.alert("Atenção: Não foi possível sair.");
        }
    };

    useEffect(() => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(async (loc) => {
                try {
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
                    setWeather(prev => ({ ...prev, desc: 'Erro de conexão' }));
                }
            });
        } else {
            setWeather(prev => ({ ...prev, desc: 'Geolocalização não suportada' }));
        }
    }, []);

    const gridItems = [
        { id: 1, title: 'PULVERIZAÇÃO', Icon: Icons.Robot, screen: 'Pulverizacao' }, // Usando ícones genéricos disponíveis acima
        { id: 2, title: 'PLANTIO', Icon: Icons.Plant, screen: 'Plantios' },
        { id: 3, title: 'COLHEITA', Icon: Icons.Tractor, screen: 'Colheitas' },
        { id: 4, title: 'REVISÕES', Icon: Icons.Settings, screen: 'Revisoes' },
        { id: 5, title: 'DIESEL', Icon: Icons.GasPump, screen: 'Diesel' },
        { id: 6, title: 'ESTOQUE', Icon: Icons.Archive, screen: 'Manager', params: { initialView: 'estoque' } },
        { id: 7, title: 'PLUVIÔMETRO', Icon: Icons.Rain, screen: 'Pluviometro' },
        { id: 8, title: '% ANDAMENTO', Icon: Icons.Trending, screen: 'Andamento' },
        { id: 9, title: 'GERENCIADOR', Icon: Icons.Document, screen: 'Manager' },
        { id: 10, title: 'MANUAIS', Icon: Icons.Document, screen: 'Manuais' },
    ];

    const gridRows = [];
    for (let i = 0; i < gridItems.length; i += 3) {
        gridRows.push(gridItems.slice(i, i + 3));
    }

    return (
        <div style={styles.container}>
            {/* HEADER VERDE OCUPANDO TODA A LARGURA DA TELA */}
            <div style={{ ...styles.topHeader, ...(isDesktop ? { paddingBottom: '80px', paddingTop: '50px', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 } : { paddingBottom: '50px' }) }}>
                {/* Wrapper para manter o conteúdo (olá, clima) alinhado com o grid abaixo */}
                <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
                    <div style={styles.headerTopRow}>
                        <div style={styles.greetingText}>Olá, {userName}</div>
                        <div style={styles.headerIconsWrapper}>
                            <button style={styles.iconBtnHeader}><Icons.Download size={24} color={THEME.textWhite} /></button>
                            <button style={styles.iconBtnHeader} onClick={handleLogout}><Icons.Logout size={24} color={THEME.textWhite} /></button>
                        </div>
                    </div>

                    <div style={{ ...styles.weatherInfoWrapper, ...(isDesktop ? { marginTop: 15, alignItems: 'center' } : {}) }}>
                        <div style={styles.weatherTempText}>{weather.temp}°C</div>
                        <div style={styles.weatherDescText}>{weather.desc.replace(/\b\w/g, l => l.toUpperCase())}</div>

                        <div style={styles.weatherPill}>
                            <div style={styles.pillItem}><Icons.Water size={14} color={THEME.textWhite} /><span style={styles.pillText}>{weather.humidity}%</span></div>
                            <div style={styles.pillItem}><Icons.Wind size={12} color={THEME.textWhite} /><span style={styles.pillText}>{weather.wind} km/h</span></div>
                            <div style={styles.pillItem}><Icons.Rain size={12} color={THEME.textWhite} /><span style={styles.pillText}>{weather.rain}mm</span></div>
                        </div>
                    </div>
                </div>
            </div>

            <div style={styles.webContainer}>

                {/* GRID RESPONSIVO */}
                <div style={{ paddingBottom: '120px', paddingTop: '30px', overflowY: 'auto', flex: 1 }}>
                    <div style={styles.gridContainer}>
                        {gridRows.map((row, rowIndex) => (
                            <div key={rowIndex} style={styles.gridRow}>
                                {row.map((item) => (
                                    <button
                                        key={item.id}
                                        style={{ ...styles.gridButton, ...(isDesktop ? { height: '130px' } : {}) }}
                                        onClick={() => item.screen ? navigation.navigate(item.screen, item.params) : window.alert('Aviso: Tela em construção.')}
                                    >
                                        <item.Icon size={isDesktop ? 32 : 28} color={THEME.textWhite} />
                                        <div style={{ ...styles.gridButtonText, marginTop: '12px' }}>{item.title}</div>
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* FAB / MODAL DO CHATBOT */}
                {!isChatbotOpen && (
                    <button style={styles.chatbotFab} onClick={() => setIsChatbotOpen(true)}>
                        <Icons.Robot size={28} color={THEME.textWhite} />
                    </button>
                )}

                {isChatbotOpen && (
                    <div style={styles.modalOverlayChatbot}>
                        <AgronomiaChatbot onClose={() => setIsChatbotOpen(false)} />
                    </div>
                )}
            </div>
        </div>
    );
}

// =====================================================================
// 6️⃣ ESTILOS CSS EM JS OTIMIZADOS PARA WEB
// =====================================================================

const styles = {
    container: { display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: THEME.background, fontFamily: 'system-ui, -apple-system, sans-serif' },
    webContainer: { display: 'flex', flexDirection: 'column', flex: 1, width: '100%', maxWidth: '1200px', margin: '0 auto', position: 'relative' },

    topHeader: { backgroundColor: THEME.primary, width: '100%', paddingTop: '30px', paddingRight: '40px', paddingBottom: '20px', paddingLeft: '40px', boxSizing: 'border-box', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' },
    headerTopRow: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    greetingText: { color: THEME.textWhite, fontSize: '22px', fontWeight: 'bold' },
    headerIconsWrapper: { display: 'flex', flexDirection: 'row' },
    iconBtnHeader: { marginLeft: '15px', background: 'none', border: 'none', cursor: 'pointer' },

    weatherInfoWrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '15px' },
    weatherTempText: { fontSize: '48px', fontWeight: 'bold', color: THEME.textWhite },
    weatherDescText: { fontSize: '16px', color: THEME.textWhite, marginBottom: '15px', opacity: 0.9 },
    weatherPill: { display: 'flex', flexDirection: 'row', backgroundColor: 'rgba(255, 255, 255, 0.25)', borderRadius: '30px', padding: '8px 15px', alignItems: 'center', justifyContent: 'center' },
    pillItem: { display: 'flex', flexDirection: 'row', alignItems: 'center', margin: '0 10px' },
    pillText: { color: THEME.textWhite, fontSize: '14px', fontWeight: '600', marginLeft: '6px' },

    gridContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', padding: '0 15px' },
    gridRow: { display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: '15px', width: '100%' },
    gridButton: { backgroundColor: THEME.primaryDark, flex: 1, maxWidth: '140px', minWidth: '90px', height: '110px', borderRadius: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.2)', border: 'none', cursor: 'pointer', transition: 'transform 0.2s' },
    gridButtonText: { color: THEME.textWhite, fontSize: '14px', fontWeight: 'bold', textAlign: 'center', padding: '0 5px' },

    chatbotFab: { position: 'absolute', right: '25px', bottom: '30px', backgroundColor: THEME.primary, width: '60px', height: '60px', borderRadius: '30px', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.3)', border: '2px solid #fff', zIndex: 10, cursor: 'pointer' },

    modalOverlayChatbot: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', padding: '30px', zIndex: 1000 },
    chatbotPopupContainer: { backgroundColor: THEME.secondary, height: '650px', width: '420px', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 0 15px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' },
    chatbotHeader: { backgroundColor: THEME.secondary, display: 'flex', flexDirection: 'row', justifyContent: 'space-between', padding: '18px', alignItems: 'center', borderBottom: '1px solid #EAEAEA' },
    iconButton: { padding: '5px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    chatbotTitle: { color: THEME.primary, fontWeight: 'bold', fontSize: '18px' },

    chatbotWelcomeContainer: { display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', alignItems: 'center', padding: '30px' },
    chatbotWelcomeTitle: { fontSize: '22px', fontWeight: 'bold', color: THEME.textBlack, marginTop: '15px' },
    chatbotWelcomeSubtitle: { fontSize: '14px', color: THEME.secondaryText, textAlign: 'center', marginTop: '5px' },
    chatbotPromptCard: { display: 'flex', flexDirection: 'row', backgroundColor: THEME.grayButton, padding: '18px', borderRadius: '15px', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', border: 'none', width: '100%', cursor: 'pointer' },
    chatbotPromptCardText: { fontSize: '14px', color: THEME.textBlack, flex: 1, textAlign: 'left' },

    formSectionTitle: { fontSize: '16px', fontWeight: 'bold', color: THEME.textBlack, marginBottom: '15px', marginTop: '10px' },
    quickOptionsGrid: { display: 'flex', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    chatbotQuickOption: { width: '48%', backgroundColor: THEME.grayButton, padding: '15px', borderRadius: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '15px', border: 'none', cursor: 'pointer' },
    chatbotQuickOptionText: { fontSize: '12px', color: THEME.textBlack, textAlign: 'center', marginTop: '8px', fontWeight: '600' },

    messageBubble: { padding: '15px', borderRadius: '15px', marginBottom: '10px', maxWidth: '85%', wordWrap: 'break-word' },
    userMessage: { backgroundColor: THEME.primary, alignSelf: 'flex-end', borderBottomRightRadius: '5px', marginLeft: 'auto' },
    botMessage: { backgroundColor: THEME.grayButton, alignSelf: 'flex-start', borderBottomLeftRadius: '5px' },
    systemMessage: { backgroundColor: 'transparent', alignSelf: 'center', padding: '5px', margin: '0 auto' },
    systemMessageText: { color: THEME.secondaryText, fontSize: '12px', fontStyle: 'italic', textAlign: 'center' },

    chatInputContainer: { display: 'flex', flexDirection: 'row', paddingTop: '10px', paddingRight: '10px', paddingBottom: '15px', paddingLeft: '10px', backgroundColor: THEME.secondary, borderTop: '1px solid #EAEAEA', alignItems: 'center' },
    chatInput: { flex: 1, backgroundColor: THEME.grayButton, padding: '12px 15px', borderRadius: '20px', maxHeight: '100px', minHeight: '45px', color: THEME.textBlack, outline: 'none', border: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
    chatbotSendButton: { backgroundColor: THEME.primary, width: '46px', height: '46px', borderRadius: '23px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginLeft: '10px', border: 'none', cursor: 'pointer' },

    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', zIndex: 1100 },
    modalContainer: { backgroundColor: THEME.secondary, borderRadius: '15px', overflow: 'hidden', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', maxHeight: '90vh' },
    modalHeader: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', padding: '18px', borderBottom: '1px solid #eee', alignItems: 'center' },
    modalTitle: { fontSize: '18px', fontWeight: 'bold' },
    modalBody: { padding: '20px', overflowY: 'auto' },
    sectionTitle: { fontSize: '16px', fontWeight: 'bold', marginBottom: '15px', display: 'block' },
    modelOptionCard: { padding: '15px', backgroundColor: '#fff', borderRadius: '10px', marginBottom: '10px', display: 'flex', flexDirection: 'row', alignItems: 'center', border: '1px solid #eee', cursor: 'pointer' },
    modelOptionCardActive: { borderColor: THEME.primary, backgroundColor: '#f0fdf4' },
    modelName: { fontWeight: 'bold', fontSize: '14px' },
    modelDesc: { fontSize: '12px', color: THEME.secondaryText, marginTop: '4px' },
    radioButtonOuter: { width: '22px', height: '22px', borderRadius: '11px', border: '2px solid #ccc', display: 'flex', justifyContent: 'center', alignItems: 'center', marginLeft: '10px' },
    radioButtonInner: { width: '12px', height: '12px', borderRadius: '6px', backgroundColor: THEME.primary },
    locationButton: { backgroundColor: 'rgba(0,0,0,0.05)', padding: '15px', borderRadius: '10px', display: 'flex', flexDirection: 'row', alignItems: 'center', border: 'none', cursor: 'pointer', width: '100%' }
};
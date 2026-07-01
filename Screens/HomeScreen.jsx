import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { auth, db, signOut } from '../firebaseConfig';

const CONFIG = {
    GROQ_API_KEY: process.env.EXPO_PUBLIC_GROQ_API_KEY || '',
    WEATHER_API_KEY: process.env.EXPO_PUBLIC_WEATHER_API_KEY || '',
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
    error: '#E53935'
};

const MODES = {
    WELCOME: 'welcome',
    OPTIONS: 'options',
    AI: 'ai',
};

const APPROVED_MODELS = [
    {
        id: 'openai/gpt-oss-120b',
        name: 'W3Labs Web Search (Compound)',
        desc: 'Acesso à internet em tempo real via Groq. Respostas mais completas.',
        provider: 'groq'
    },
];

class GroqService {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseURL = 'https://api.groq.com/openai/v1/chat/completions';
    }

    async chat(payload) {
        if (!this.apiKey) throw new Error("Chave da API do Groq (GROQ_API_KEY) não está configurada.");
        try {
            const response = await fetch(this.baseURL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
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
            let q = config.orderBy ? query(colRef, orderBy(config.orderBy, 'desc'), limit(5)) : query(colRef, limit(5));
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

const convertFileToBase64 = async (file) => {
    return new Promise((resolve, reject) => {
        if (!file) return reject(new Error('File object not found'));
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};

const SimpleMarkdown = ({ text, isSystem }) => {
    const formatText = (content) => {
        if (!content) return "";
        let html = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        html = html.replace(/\n/g, '<br/>');
        return html;
    };
    return (
        <span 
            className="markdown-text" 
            style={isSystem ? { fontSize: 12, fontStyle: 'italic', color: THEME.secondaryText } : {}}
            dangerouslySetInnerHTML={{ __html: formatText(text) }} 
        />
    );
};

const SettingsModal = ({ visible, onClose, currentModel, onSelectModel, location, onRequestLocation, locationLoading }) => {
    if (!visible) return null;
    return (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal-responsive" style={{ maxWidth: 500 }}>
                <div className="modal-header">
                    <span className="modal-title">Configurações</span>
                    <button className="icon-btn" onClick={onClose}><Ionicons name="close" size={24} color={THEME.secondaryText} /></button>
                </div>
                <div style={{ padding: 20, overflowY: 'auto' }}>
                    <div style={{ fontSize: 16, fontWeight: 'bold', color: THEME.textBlack, marginBottom: 15 }}>Motor de Inferência (Groq)</div>
                    {APPROVED_MODELS.map((model) => (
                        <button key={model.id} className={`model-option-card ${currentModel === model.id ? 'active' : ''}`} onClick={() => onSelectModel(model.id)}>
                            <div style={{ flex: 1, textAlign: 'left' }}>
                                <div style={{ fontWeight: 'bold', fontSize: 14, color: currentModel === model.id ? THEME.primary : THEME.textBlack }}>{model.name}</div>
                                <div style={{ fontSize: 12, color: THEME.secondaryText, marginTop: 4 }}>{model.desc}</div>
                            </div>
                            <div className={`radio-outer ${currentModel === model.id ? 'active' : ''}`}>
                                {currentModel === model.id && <div className="radio-inner" />}
                            </div>
                        </button>
                    ))}
                    <div style={{ height: 30 }} />
                    <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 15 }}>Dados da Sessão</div>
                    <button className="location-btn" onClick={onRequestLocation} disabled={locationLoading}>
                        <Ionicons name="location-outline" size={24} color={THEME.secondaryText} />
                        <div style={{ marginLeft: 15, flex: 1, textAlign: 'left' }}>
                            <div style={{ fontWeight: 'bold', color: THEME.textBlack, fontSize: 14 }}>Localização</div>
                            <div style={{ color: THEME.secondaryText, fontSize: 13 }}>
                                {locationLoading ? 'Buscando...' : location ? `${location.city || 'N/A'}, ${location.region || 'N/A'} - ${location.country || 'N/A'}` : 'Toque para buscar... (habilite a permissão)'}
                            </div>
                        </div>
                        {locationLoading && <div className="spinner" style={{ width: 16, height: 16 }} />}
                    </button>
                </div>
            </div>
        </div>
    );
};

const WelcomeView = React.memo(({ onModeChange }) => (
    <div className="chatbot-welcome-container">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <MaterialCommunityIcons name="robot-happy-outline" size={64} color={THEME.primary} />
            <div className="chatbot-welcome-title">Olá! Sou a AgronomIA</div>
            <div className="chatbot-welcome-subtitle">Sua assistente W3Labs (Powered by Groq).</div>
        </div>
        <div style={{ width: '100%', marginTop: 32 }}>
            <button className="chatbot-prompt-card" onClick={() => onModeChange(MODES.AI)}>
                <span className="chatbot-prompt-text">Fazer uma pergunta por texto</span>
                <Ionicons name="chatbubbles-outline" size={24} color={THEME.primary} />
            </button>
            <button className="chatbot-prompt-card" onClick={() => onModeChange(MODES.OPTIONS)}>
                <span className="chatbot-prompt-text">Ver ações rápidas e mercado</span>
                <Ionicons name="flash-outline" size={24} color={THEME.primary} />
            </button>
        </div>
    </div>
));

const OptionsView = React.memo(({ onOptionSelect }) => {
    const analysisOptions = [
        { label: 'Cotação Soja', query: 'Qual a cotação da soja hoje?', icon: 'trending-up-outline' },
        { label: 'Histórico Chuva', query: 'Relatório do meu histórico de chuva', icon: 'rainy-outline' },
        { label: 'Estoque', query: 'Análise do meu estoque geral', icon: 'archive-outline' },
        { label: 'Consumo Diesel', query: 'Análise do consumo de diesel', icon: 'speedometer-outline' },
    ];
    return (
        <div style={{ padding: 15, overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: THEME.textBlack, marginBottom: 15, marginTop: 10 }}>Análises Rápidas</div>
            <div className="quick-options-grid">
                {analysisOptions.map(item => (
                    <button key={item.label} className="chatbot-quick-option" onClick={() => onOptionSelect(item.query)}>
                        <Ionicons name={item.icon} size={28} color={THEME.primary} />
                        <span className="chatbot-quick-option-text">{item.label}</span>
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
    const chatEndRef = useRef(null);
    const fileInputRef = useRef(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (chatMode === MODES.AI) {
            scrollToBottom();
        }
    }, [messages, chatMode]);

    const requestLocation = useCallback(async () => {
        setLocationLoading(true);
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                window.alert("A permissão de localização é necessária.");
                return;
            }
            let currentLocation = await Location.getCurrentPositionAsync({});
            let geocode = await Location.reverseGeocodeAsync(currentLocation.coords);
            if (geocode && geocode.length > 0) setLocation(geocode[0]);
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
                    model: activeModel, messages: apiMessages, tools: TOOLS_DEFINITION, tool_choice: 'auto', temperature: 0.3
                });
                const choice = response.choices[0];
                const msg = choice.message;

                if (msg.executed_tools && msg.executed_tools.length > 0) {
                    setMessages(prev => [...prev, { id: Date.now() + '_sys_web_' + Math.random(), role: 'system', sender: 'system', text: `🌐 Fontes consultadas na web com sucesso.` }]);
                }

                if (msg.content) {
                    currentText += msg.content;
                    setMessages(prev => prev.map(m => m.id === botId ? {
                        ...m, text: currentText, usage: { duration: response.usage.total_time?.toFixed(2) || 0, tokens: response.usage.total_tokens }
                    } : m));
                }

                if (msg.tool_calls && msg.tool_calls.length > 0) {
                    apiMessages.push(msg);
                    for (const call of msg.tool_calls) {
                        const fnName = call.function.name;
                        const fnArgs = JSON.parse(call.function.arguments);

                        setMessages(prev => [...prev, { id: Date.now() + '_sys_' + Math.random(), role: 'system', sender: 'system', text: `⚙️ Consultando: ${fnName}...` }]);

                        let result = JSON.stringify({ error: "Ferramenta falhou ou não implementada" });
                        if (TOOLS_IMPLEMENTATION[fnName]) result = await TOOLS_IMPLEMENTATION[fnName](fnArgs);

                        apiMessages.push({ role: 'tool', tool_call_id: call.id, name: fnName, content: result });
                    }
                } else {
                    keepGenerating = false;
                }
            }
        } catch (error) {
            console.error("Erro AgronomIA:", error);
            setMessages(prev => [...prev, { id: Date.now() + '_err', role: 'assistant', sender: 'bot', text: `⚠️ **Erro de Comunicação**\nNão foi possível processar via GroqCloud.\n${error.message}`, isError: true }]);
        } finally {
            setLoading(false);
        }
    }, [inputText, attachedFile, loading, messages, activeModel, systemPrompt]);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) setAttachedFile(file);
    };

    const handleClearChat = () => {
        setMessages([]);
        setChatMode(MODES.WELCOME);
    };

    return (
        <div className="chatbot-popup-container">
            <div className="chatbot-header">
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    {chatMode !== MODES.WELCOME && (
                        <button onClick={() => setChatMode(MODES.WELCOME)} className="icon-btn" style={{ marginRight: 10 }}>
                            <Ionicons name="arrow-back" size={24} color={THEME.secondaryText} />
                        </button>
                    )}
                    <div>
                        <div className="chatbot-title">AgronomIA</div>
                        <div style={{ fontSize: 11, color: THEME.textBlack, opacity: 0.7, marginTop: 4 }}>
                            {location ? `📍 ${location.city}` : 'W3Labs / Groq Engine'}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'row' }}>
                    <button onClick={() => setShowSettings(true)} className="icon-btn">
                        <Ionicons name="settings-outline" size={24} color={THEME.secondaryText} />
                    </button>
                    {messages.length > 0 && chatMode === MODES.AI && (
                        <button onClick={handleClearChat} className="icon-btn">
                            <Ionicons name="trash-outline" size={22} color={THEME.secondaryText} />
                        </button>
                    )}
                    <button onClick={onClose} className="icon-btn">
                        <Ionicons name="close" size={24} color={THEME.secondaryText} />
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {chatMode === MODES.WELCOME && <WelcomeView onModeChange={setChatMode} />}
                {chatMode === MODES.OPTIONS && <OptionsView onOptionSelect={(q) => handleSend(q)} />}

                {chatMode === MODES.AI && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div className="chat-messages-container" style={{ flex: 1, overflowY: 'auto', padding: 15 }}>
                            {messages.map((item) => (
                                <div key={item.id} className={`message-bubble ${item.sender === 'user' ? 'user-message' : item.sender === 'system' ? 'system-message' : 'bot-message'}`}>
                                    {item.fileData && (
                                        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 8, opacity: 0.8 }}>
                                            <Ionicons name="document-attach" size={16} color={item.sender === 'user' ? THEME.textWhite : THEME.textBlack} />
                                            <span style={{ fontSize: 11, marginLeft: 5, color: item.sender === 'user' ? THEME.textWhite : THEME.textBlack }}>
                                                {item.fileData.name}
                                            </span>
                                        </div>
                                    )}
                                    <SimpleMarkdown text={item.text || " "} isSystem={item.sender === 'system'} />
                                    {item.usage && (
                                        <div style={{ fontSize: 9, color: item.sender === 'user' ? THEME.textWhite : THEME.secondaryText, opacity: 0.7, marginTop: 5, textAlign: 'right' }}>
                                            ⚡ {item.usage.duration}s | Tks: {item.usage.tokens}
                                        </div>
                                    )}
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="chat-input-container">
                            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
                            <button onClick={() => fileInputRef.current?.click()} style={{ padding: 10, background: 'none', border: 'none', cursor: 'pointer' }}>
                                <Ionicons name="attach" size={24} color={attachedFile ? THEME.primary : THEME.secondaryText} />
                            </button>
                            <textarea
                                className="chat-input"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder={attachedFile ? "Arquivo pronto. O que fazer?" : "Pergunte à AgronomIA..."}
                                disabled={loading}
                                onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            />
                            {(inputText.trim().length > 0 || attachedFile) && (
                                <button onClick={() => handleSend()} disabled={loading} className="chatbot-send-button" style={loading ? { opacity: 0.6 } : {}}>
                                    {loading ? <div className="spinner" style={{ width: 20, height: 20, borderColor: `${THEME.textWhite}40`, borderTopColor: THEME.textWhite }} /> : <Ionicons name="send" size={20} color={THEME.textWhite} />}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

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

export default function Dashboard({ navigation }) {
    const [weather, setWeather] = useState({ temp: '--', desc: 'Buscando clima...', humidity: '--', wind: '--', rain: '--' });
    const [location, setLocation] = useState(null);
    const [isChatbotOpen, setIsChatbotOpen] = useState(false);
    const userName = auth.currentUser?.displayName || "Usuário";

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Erro ao fazer logout:", error);
            window.alert("Não foi possível sair. Tente novamente.");
        }
    };

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

    useEffect(() => {
        if (typeof document !== 'undefined' && !document.getElementById('w3-agro-home-styles')) {
            const style = document.createElement('style');
            style.id = 'w3-agro-home-styles';
            style.innerHTML = `
                * { box-sizing: border-box; }
                body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background-color: ${THEME.background}; }
                button { cursor: pointer; }
                .spinner { border: 4px solid ${THEME.primary}40; border-top-color: ${THEME.primary}; border-radius: 50%; animation: spin 1s linear infinite; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                
                .home-container { display: flex; flex-direction: column; min-height: 100vh; }
                .home-web-container { flex: 1; width: 100%; max-width: 1200px; align-self: center; margin: 0 auto; display: flex; flex-direction: column; position: relative; }
                
                .top-header { background-color: ${THEME.primary}; padding: 30px 20px; border-bottom-left-radius: 20px; border-bottom-right-radius: 20px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
                .header-top-row { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
                .greeting-text { color: ${THEME.textWhite}; font-size: 22px; font-weight: bold; }
                .header-icons { display: flex; flex-direction: row; }
                .icon-btn-header { margin-left: 15px; background: none; border: none; padding: 0; }
                
                .weather-wrapper { display: flex; flex-direction: column; align-items: center; margin-top: 15px; }
                .weather-temp { font-size: 56px; font-weight: bold; color: ${THEME.textWhite}; }
                .weather-desc { font-size: 18px; color: ${THEME.textWhite}; margin-bottom: 15px; opacity: 0.9; text-transform: capitalize; }
                .weather-pill { display: flex; flex-direction: row; background-color: rgba(255,255,255,0.25); border-radius: 30px; padding: 8px 15px; align-items: center; justify-content: center; }
                .pill-item { display: flex; flex-direction: row; align-items: center; margin: 0 12px; }
                .pill-text { color: ${THEME.textWhite}; font-size: 16px; font-weight: 600; margin-left: 6px; }

                .dashboard-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; padding: 30px 10px 100px 10px; width: 100%; }
                .grid-button { background-color: ${THEME.primaryDark}; border-radius: 20px; display: flex; flex-direction: column; justify-content: center; align-items: center; box-shadow: 0 4px 5px rgba(0,0,0,0.2); border: none; aspect-ratio: 1; padding: 10px; transition: transform 0.2s; }
                .grid-button:hover { transform: translateY(-2px); }
                .grid-button-text { color: ${THEME.textWhite}; font-size: 13px; font-weight: bold; text-align: center; margin-top: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; }

                .chatbot-fab { position: fixed; right: 25px; bottom: 30px; background-color: ${THEME.primary}; width: 60px; height: 60px; border-radius: 30px; display: flex; justify-content: center; align-items: center; box-shadow: 0 4px 4px rgba(0,0,0,0.3); border: 2px solid #fff; z-index: 100; }

                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 20px; }
                .modal-responsive { background-color: ${THEME.secondary}; border-radius: 15px; overflow: hidden; width: 100%; display: flex; flex-direction: column; max-height: 90vh; }
                .modal-header { display: flex; flex-direction: row; justify-content: space-between; align-items: center; padding: 18px; border-bottom: 1px solid #eee; }
                .modal-title { font-size: 18px; font-weight: bold; }
                .icon-btn { background: none; border: none; padding: 5px; cursor: pointer; }

                .chatbot-popup-container { background-color: ${THEME.secondary}; width: 100%; height: 100%; display: flex; flex-direction: column; border-radius: 20px; overflow: hidden; box-shadow: 0 0 10px rgba(0,0,0,0.2); }
                .chatbot-header { background-color: ${THEME.secondary}; display: flex; flex-direction: row; justify-content: space-between; padding: 18px; align-items: center; border-bottom: 1px solid #EAEAEA; }
                .chatbot-title { color: ${THEME.primary}; font-weight: bold; font-size: 18px; }

                .chatbot-welcome-container { flex: 1; display: flex; flex-direction: column; justify-content: center; alignItems: center; padding: 30px; text-align: center; }
                .chatbot-welcome-title { font-size: 22px; font-weight: bold; color: ${THEME.textBlack}; margin-top: 15px; }
                .chatbot-welcome-subtitle { font-size: 14px; color: ${THEME.secondaryText}; margin-top: 5px; }
                .chatbot-prompt-card { display: flex; flex-direction: row; background-color: ${THEME.grayButton}; padding: 18px; border-radius: 15px; align-items: center; justify-content: space-between; margin-bottom: 12px; border: none; width: 100%; text-align: left; transition: background 0.2s; }
                .chatbot-prompt-card:hover { background-color: #e0e4e0; }
                .chatbot-prompt-text { font-size: 14px; color: ${THEME.textBlack}; flex: 1; }

                .quick-options-grid { display: flex; flex-wrap: wrap; justify-content: space-between; }
                .chatbot-quick-option { width: 48%; background-color: ${THEME.grayButton}; padding: 15px; border-radius: 15px; display: flex; flex-direction: column; align-items: center; margin-bottom: 15px; border: none; transition: transform 0.2s; }
                .chatbot-quick-option:hover { transform: scale(1.02); }
                .chatbot-quick-option-text { font-size: 12px; color: ${THEME.textBlack}; text-align: center; margin-top: 8px; font-weight: 600; }

                .message-bubble { padding: 15px; border-radius: 15px; margin-bottom: 10px; max-width: 85%; word-break: break-word; }
                .user-message { background-color: ${THEME.primary}; align-self: flex-end; border-bottom-right-radius: 5px; color: ${THEME.textWhite}; }
                .bot-message { background-color: ${THEME.grayButton}; align-self: flex-start; border-bottom-left-radius: 5px; color: ${THEME.textBlack}; }
                .system-message { background-color: transparent; align-self: center; padding: 5px; text-align: center; }
                .markdown-text { line-height: 1.5; }
                .markdown-text p { margin: 0 0 10px 0; }
                .markdown-text p:last-child { margin: 0; }

                .chat-input-container { display: flex; flex-direction: row; padding: 10px 10px 20px 10px; background-color: ${THEME.secondary}; border-top: 1px solid #EAEAEA; align-items: center; }
                .chat-input { flex: 1; background-color: ${THEME.grayButton}; padding: 12px 15px; border-radius: 20px; max-height: 100px; min-height: 45px; border: none; resize: none; font-family: inherit; font-size: 14px; outline: none; }
                .chatbot-send-button { background-color: ${THEME.primary}; width: 46px; height: 46px; border-radius: 23px; display: flex; justify-content: center; align-items: center; margin-left: 10px; border: none; flex-shrink: 0; }

                .model-option-card { padding: 15px; background-color: #fff; border-radius: 10px; margin-bottom: 10px; display: flex; flex-direction: row; align-items: center; border: 1px solid #eee; width: 100%; cursor: pointer; }
                .model-option-card.active { border-color: ${THEME.primary}; background-color: #f0fdf4; }
                .radio-outer { width: 22px; height: 22px; border-radius: 11px; border: 2px solid #ccc; display: flex; justify-content: center; align-items: center; margin-left: 10px; }
                .radio-outer.active { border-color: ${THEME.primary}; }
                .radio-inner { width: 12px; height: 12px; border-radius: 6px; background-color: ${THEME.primary}; }
                .location-btn { background-color: rgba(0,0,0,0.05); padding: 15px; border-radius: 10px; display: flex; flex-direction: row; align-items: center; border: none; width: 100%; }

                @media (min-width: 768px) {
                    .top-header { padding: 30px 40px; border-bottom-left-radius: 30px; border-bottom-right-radius: 30px; }
                    .dashboard-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); padding: 30px 20px 100px 20px; }
                    .grid-button { padding: 20px; }
                    .grid-button-text { font-size: 16px; margin-top: 15px; }
                    .chatbot-popup-container { max-width: 400px; height: 600px; margin: auto; }
                    .modal-overlay { align-items: flex-end; justify-content: flex-end; padding: 30px; }
                }
            `;
            document.head.appendChild(style);
        }
    }, []);

    return (
        <div className="home-container">
            <div className="home-web-container">
                <div className="top-header">
                    <div className="header-top-row">
                        <span className="greeting-text">Olá, {userName}</span>
                        <div className="header-icons">
                            <button className="icon-btn-header">
                                <Ionicons name="download-outline" size={24} color={THEME.textWhite} />
                            </button>
                            <button className="icon-btn-header" onClick={handleLogout}>
                                <Ionicons name="log-out-outline" size={24} color={THEME.textWhite} />
                            </button>
                        </div>
                    </div>
                    <div className="weather-wrapper">
                        <span className="weather-temp">{weather.temp}°C</span>
                        <span className="weather-desc">{weather.desc}</span>
                        <div className="weather-pill">
                            <div className="pill-item">
                                <Ionicons name="water" size={14} color={THEME.textWhite} />
                                <span className="pill-text">{weather.humidity}%</span>
                            </div>
                            <div className="pill-item">
                                <FontAwesome5 name="wind" size={12} color={THEME.textWhite} />
                                <span className="pill-text">{weather.wind} km/h</span>
                            </div>
                            <div className="pill-item">
                                <FontAwesome5 name="cloud-rain" size={12} color={THEME.textWhite} />
                                <span className="pill-text">{weather.rain}mm</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="dashboard-grid">
                    {gridItems.map((item) => (
                        <button key={item.id} className="grid-button" onClick={() => item.screen ? navigation?.navigate?.(item.screen, item.params) : window.alert('Tela em construção.')}>
                            <item.lib name={item.icon} size={32} color={THEME.textWhite} />
                            <span className="grid-button-text" title={item.title}>{item.title}</span>
                        </button>
                    ))}
                </div>

                {!isChatbotOpen && (
                    <button className="chatbot-fab" onClick={() => setIsChatbotOpen(true)}>
                        <MaterialCommunityIcons name="robot-outline" size={28} color={THEME.textWhite} />
                    </button>
                )}

                {isChatbotOpen && (
                    <div className="modal-overlay">
                        <AgronomiaChatbot onClose={() => setIsChatbotOpen(false)} />
                    </div>
                )}
            </div>
        </div>
    );
}

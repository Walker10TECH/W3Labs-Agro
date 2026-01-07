import React, {
    useCallback,
    useMemo,
    useEffect,
    useRef,
    useState
} from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Animated,
    TextInput
} from 'react-native';

// Módulos Expo e Firebase
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Location from 'expo-location';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';

// Bibliotecas de IA
import { Ollama } from "ollama";

// Configurações do Projeto (Imports Relativos)
import { auth, db } from '../firebaseConfig';
import * as common from './Common';

// ---------------------------------------------------------------------
// 1️⃣ CONFIGURAÇÃO & CONSTANTES (Single Source of Truth)
// ---------------------------------------------------------------------

const CONFIG = {
    // Local / Ollama
    OLLAMA_HOST: 'http://127.0.0.1:11434',
    OLLAMA_API_KEY: process.env.EXPO_PUBLIC_OLLAMA_API_KEY || '',
    
    // Configurações Gerais
    MAX_TOOL_LOOPS: 5,
};

// Modelos Homologados (Local + Cloud)
const APPROVED_MODELS = [
    { 
        id: 'gpt-oss:20b-cloud', 
        name: 'W3Labs 20B (Local)', 
        desc: 'Execução local via Ollama. Gratuito e Privado.',
        provider: 'ollama'
    }
];

const MODES = {
    WELCOME: 'welcome',
    OPTIONS: 'options',
    AI: 'ai',
};

// ---------------------------------------------------------------------
// 2️⃣ CAMADA DE SERVIÇO (Robust Network Layer)
// ---------------------------------------------------------------------

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

// Instanciação
const ollamaService = new OllamaService(CONFIG.OLLAMA_HOST, CONFIG.OLLAMA_API_KEY);

// ---------------------------------------------------------------------
// 3️⃣ INTEGRAÇÃO DE DADOS (Data Science & SQL/NoSQL)
// ---------------------------------------------------------------------

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
    const userUid = auth.currentUser?.uid;
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

// ---------------------------------------------------------------------
// 4️⃣ UTILS
// ---------------------------------------------------------------------

async function processAttachment(uri) {
    try {
        return await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
        });
    } catch (error) {
        throw new Error("Falha na leitura do arquivo.");
    }
}

// ---------------------------------------------------------------------
// 5️⃣ UI COMPONENTS (Frontend - Clean & Warning Free)
// ---------------------------------------------------------------------

const SettingsModal = ({ visible, onClose, currentModel, onSelectModel, location, onRequestLocation, locationLoading }) => (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
        <common.View style={common.styles.modalOverlay}>
            <common.View style={common.styles.modalContainer}>
                <common.View style={common.styles.modalHeader}>
                    <common.Text style={common.styles.modalTitle}>Configurações</common.Text>
                    <common.TouchableOpacity onPress={onClose} style={common.styles.headerButton}>
                        <common.Icon name="close" size={24} color={common.theme.colors.secondaryText} />
                    </common.TouchableOpacity>
                </common.View>
                
                <common.ScrollView contentContainerStyle={{ padding: 20 }}>
                    <common.Text style={{ fontSize: 16, fontWeight: 'bold', color: common.theme.colors.textBlack, marginBottom: 15 }}>
                        Motor de Inferência
                    </common.Text>
                    {APPROVED_MODELS.map((model) => (
                        <common.TouchableOpacity
                            key={model.id}
                            style={[
                                common.styles.modelOptionCard, 
                                currentModel === model.id && common.styles.modelOptionCardActive
                            ]}
                            onPress={() => onSelectModel(model.id)}
                        >
                            <common.View style={{ flex: 1 }}>
                                <common.Text style={[
                                    common.styles.modelName, 
                                    currentModel === model.id && { color: common.theme.colors.primary }
                                ]}>
                                    {model.name}
                                </common.Text>
                                <common.Text style={common.styles.modelDesc}>{model.desc}</common.Text>
                            </common.View>
                            <common.View style={[
                                common.styles.radioButtonOuter, 
                                currentModel === model.id && { borderColor: common.theme.colors.primary }
                            ]}>
                                {currentModel === model.id && <common.View style={common.styles.radioButtonInner} />}
                            </common.View>
                        </common.TouchableOpacity>
                    ))}

                    <common.View style={{ height: 30 }} />

                    <common.Text style={{ fontSize: 16, fontWeight: 'bold', color: common.theme.colors.textBlack, marginBottom: 15 }}>
                        Dados da Sessão
                    </common.Text>
                    <common.TouchableOpacity 
                        onPress={onRequestLocation} 
                        disabled={locationLoading}
                        style={{ backgroundColor: 'rgba(0,0,0,0.05)', padding: 15, borderRadius: 10, flexDirection: 'row', alignItems: 'center' }}
                    >
                        <common.Icon name="location-outline" size={24} color={common.theme.colors.secondaryText} />
                        <common.View style={{ marginLeft: 15, flex: 1 }}>
                            <common.Text style={{ fontWeight: 'bold', color: common.theme.colors.textBlack, fontSize: 14 }}>Localização</common.Text>
                            <common.Text style={{ color: common.theme.colors.secondaryText, fontSize: 13 }}>
                                {locationLoading 
                                    ? 'Buscando...'
                                    : location
                                    ? `${location.city || 'N/A'}, ${location.region || 'N/A'} - ${location.country || 'N/A'}`
                                    : 'Toque para buscar... (habilite a permissão)'}
                            </common.Text>
                        </common.View>
                        {locationLoading && <ActivityIndicator size="small" color={common.theme.colors.primary} />}
                    </common.TouchableOpacity>

                    <common.View style={{ height: 40 }} />
                </common.ScrollView>
            </common.View>
        </common.View>
    </Modal>
);

const WelcomeView = React.memo(({ onModeChange }) => (
    <common.View style={common.styles.chatbotWelcomeContainer}>
        <common.View style={{ alignItems: 'center', width: '100%' }}>
            <common.MaterialCommunityIcons name="robot-happy-outline" size={64} color={common.theme.colors.primary} />
            <common.Text style={common.styles.chatbotWelcomeTitle}>Olá! Sou a AgronomIA</common.Text>
            <common.Text style={common.styles.chatbotWelcomeSubtitle}>Sua assistente W3Labs. Como posso ajudar hoje?</common.Text>
        </common.View>
        <common.View style={{width: '100%', marginTop: 32}}>
            <common.TouchableOpacity style={common.styles.chatbotPromptCard} onPress={() => onModeChange(MODES.AI)}>
                <common.Text style={common.styles.chatbotPromptCardText}>Fazer uma pergunta por texto</common.Text>
                <common.Icon name="chatbubbles-outline" size={24} color={common.theme.colors.primary} />
            </common.TouchableOpacity>
            <common.TouchableOpacity style={common.styles.chatbotPromptCard} onPress={() => onModeChange(MODES.OPTIONS)}>
                <common.Text style={common.styles.chatbotPromptCardText}>Ver ações rápidas e mercado</common.Text>
                <common.Icon name="flash-outline" size={24} color={common.theme.colors.primary} />
            </common.TouchableOpacity>
        </common.View>
    </common.View>
));

const OptionsView = React.memo(({ onOptionSelect }) => {
    const analysisOptions = [
        { label: 'Cotação Soja',  query: 'Qual a cotação da soja hoje?', icon: 'trending-up-outline' },
        { label: 'Histórico Chuva', query: 'Relatório do meu histórico de chuva', icon: 'rainy-outline' },
        { label: 'Estoque', query: 'Análise do meu estoque geral', icon: 'archive-outline' },
        { label: 'Consumo Diesel', query: 'Análise do consumo de diesel', icon: 'speedometer-outline' },
    ];
    
    return (
        <common.ScrollView contentContainerStyle={{ padding: 10 }}>
            <common.Text style={common.styles.formSectionTitle}>Análises Rápidas</common.Text>
            <common.View style={common.styles.quickOptionsGrid}>
                {analysisOptions.map(item => (
                    <common.TouchableOpacity key={item.label} style={common.styles.chatbotQuickOption} onPress={() => onOptionSelect(item.query)}>
                        <common.Icon name={item.icon} size={28} color={common.theme.colors.primary} />
                        <common.Text style={common.styles.chatbotQuickOptionText}>{item.label}</common.Text>
                    </common.TouchableOpacity>
                ))}
            </common.View>
        </common.ScrollView>
    );
});

// ---------------------------------------------------------------------
// 6️⃣ COMPONENTE PRINCIPAL: AgronomIA
// ---------------------------------------------------------------------

export const AgronomiaChatbot = ({ onClose }) => {
  // Estados Principais
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

  // Inicialização (Localização)
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

  // --- Core do Chat (Do Arquivo 2) ---
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

            // A lógica de streaming permanece idêntica ao Arquivo 2 para consistência
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
                        // Passa os argumentos corretos para a função
                        result = await TOOLS_IMPLEMENTATION[fnName](fnArgs);
                    }

                    apiMessages.push({
                        role: 'tool',
                        content: result,
                        tool_name: fnName
                    });
                }
                // Loop continua para o modelo processar o resultado da ferramenta
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

  // ---------------------------------------------------------------------
  // 7️⃣ RENDER UI
  // ---------------------------------------------------------------------

  return (
    <common.View style={common.styles.chatbotPopupContainer}>
        {/* HEADER */}
        <common.View style={common.styles.chatbotHeader}>
            <common.View style={{flexDirection: 'row', alignItems: 'center'}}>
                {chatMode !== MODES.WELCOME && (
                    <common.TouchableOpacity onPress={() => setChatMode(MODES.WELCOME)} style={[common.styles.headerButton, { marginRight: 10, backgroundColor: 'transparent' }]}>
                        <common.Icon name="arrow-back" size={24} color={common.theme.colors.textWhite} />
                    </common.TouchableOpacity>
                )}
                <common.View>
                    <common.Text style={common.styles.chatbotTitle}>
                        AgronomIA
                    </common.Text>
                    <common.Text style={{ fontSize: 11, color: common.theme.colors.textWhite, opacity: 0.7, marginTop: 4 }}>
                        {location ? `📍 ${location.city}` : 'W3Labs Intelligence'}
                    </common.Text>
                </common.View>
            </common.View>
            <common.View style={{ flexDirection: 'row' }}>
                <common.TouchableOpacity onPress={() => setShowSettings(true)} style={[common.styles.headerButton, { backgroundColor: 'transparent' }]}>
                    <common.Icon name="settings-outline" size={22} color={common.theme.colors.textWhite} />
                </common.TouchableOpacity>
                {messages.length > 0 && chatMode === MODES.AI && (
                    <common.TouchableOpacity onPress={handleClearChat} style={[common.styles.headerButton, { backgroundColor: 'transparent' }]}>
                        <common.Icon name="trash-outline" size={22} color={common.theme.colors.textWhite} />
                    </common.TouchableOpacity>
                )}
                <common.TouchableOpacity onPress={onClose} style={[common.styles.headerButton, { backgroundColor: 'transparent' }]}>
                    <common.Icon name="close" size={24} color={common.theme.colors.textWhite} />
                </common.TouchableOpacity>
            </common.View>
        </common.View>

        {/* MODES VIEWS */}
        {chatMode === MODES.WELCOME && <WelcomeView onModeChange={setChatMode} />}
        {chatMode === MODES.OPTIONS && <OptionsView onOptionSelect={(q) => handleSend(q)} />}
        
        {chatMode === MODES.AI && (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <common.FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 15, paddingBottom: 20 }}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    renderItem={({ item }) => (
                        <common.View style={[
                            common.styles.messageBubble,
                            item.sender === 'user' ? common.styles.userMessage : 
                            item.sender === 'system' ? common.styles.systemMessage : common.styles.botMessage
                        ]}>
                            {item.fileData && (
                                <common.View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, opacity: 0.8 }}>
                                    <common.Icon name="document-attach" size={16} color={item.sender === 'user' ? common.theme.colors.textWhite : common.theme.colors.textBlack} />
                                    <common.Text style={{ fontSize: 11, marginLeft: 5, color: item.sender === 'user' ? common.theme.colors.textWhite : common.theme.colors.textBlack }}>
                                        {item.fileData.name}
                                    </common.Text>
                                </common.View>
                            )}
                            {item.thinking ? (
                                <common.View style={{ backgroundColor: 'rgba(0,0,0,0.03)', padding: 8, borderRadius: 6, marginBottom: 6, borderLeftWidth: 2, borderLeftColor: '#aaa' }}>
                                    <common.Text style={{ fontSize: 10, color: common.theme.colors.secondaryText, fontStyle: 'italic' }}>🧠 {item.thinking}</common.Text>
                                </common.View>
                            ) : null}
                            <common.MarkdownDisplay 
                                style={
                                    item.sender === 'user' 
                                    ? { body: { color: common.theme.colors.textWhite } } 
                                    : item.sender === 'system'
                                    ? { body: common.styles.systemMessageText }
                                    : {}
                                }
                            >
                                {item.text}
                            </common.MarkdownDisplay>
                            {item.usage && (
                                <common.Text style={{ 
                                    fontSize: 9, color: item.sender === 'user' ? common.theme.colors.textWhite : common.theme.colors.secondaryText, 
                                    opacity: 0.7, marginTop: 5, textAlign: 'right' 
                                }}>
                                    ⚡ {item.usage.duration}s | Tks: {item.usage.tokens}
                                </common.Text>
                            )}
                        </common.View>
                    )}
                />

                {/* INPUT AREA */}
                <common.View style={common.styles.chatInputContainer}>
                    <common.TouchableOpacity onPress={pickDocument} style={{ padding: 10 }}>
                        <common.Icon name="attach" size={24} color={attachedFile ? common.theme.colors.primary : common.theme.colors.secondaryText} />
                    </common.TouchableOpacity>

                    <TextInput
                        style={common.styles.chatInput}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder={attachedFile ? "Arquivo pronto. Descreva o que fazer." : "Pergunte à AgronomIA..."}
                        multiline
                        placeholderTextColor={common.theme.colors.secondaryText}
                        editable={!loading}
                    />

                    {(inputText.trim().length > 0 || attachedFile) && (
                        <common.TouchableOpacity 
                            onPress={() => handleSend()} 
                            disabled={loading}                            style={[common.styles.chatbotSendButton, loading && { opacity: 0.6 }]}
                        >
                            {loading ? <ActivityIndicator size="small" color={common.theme.colors.textWhite} /> : <common.Icon name="send" size={20} color={common.theme.colors.textWhite} />}
                        </common.TouchableOpacity>
                    )}
                </common.View>
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
    </common.View>
  );
};

export const ChatbotFAB = ({ onPress }) => (
    <common.TouchableOpacity style={common.styles.chatbotFab} onPress={onPress} activeOpacity={0.8}>
        <common.MaterialCommunityIcons name="robot-outline" size={28} color={common.theme.colors.textWhite} />
    </common.TouchableOpacity>
);
import Groq from 'groq-sdk';
import { auth, db } from '../firebaseConfig';
import { collection, doc, setDoc, getDocs, limit, orderBy, query } from 'firebase/firestore';

const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY || process.env.GROQ_API_KEY || '';

// Inicialização oficial do Groq SDK com suporte às versões e ferramentas mais recentes
export const groq = new Groq({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true,
    defaultHeaders: {
        'Groq-Model-Version': 'latest',
    },
});

export const getModels = async () => {
    try {
        return await groq.models.list();
    } catch (e) {
        console.warn("Erro ao listar modelos via groq.models.list():", e);
        return { data: [] };
    }
};

getModels().then((models) => {
    // console.log(models);
});

/**
 * Catálogo exclusivo com os modelos mais precisos da Groq, Meta e OpenAI no GroqCloud
 */
export const GROQ_MODELS = [
    // ⚡ GROQ COMPOUND (SISTEMAS OFICIAIS COM BUSCA WEB & VISITA A SITES EM TEMPO REAL)
    {
        id: 'groq/compound',
        name: 'Groq Compound (Flagship Web & Visita)',
        category: 'groq',
        categoryLabel: '⚡ Groq Compound (Pesquisa & Visita Web)',
        speed: '~350 tps',
        contextWindow: '128.000 tokens',
        maxCompletion: '8.192 tokens',
        desc: 'Sistema flagship da Groq com raciocínio profundo, pesquisa web nativa em tempo real (Tavily), visita automática a URLs e integração com ferramentas da fazenda.',
        badge: 'Groq Compound Flagship',
        isFeatured: true,
        supportsWebSearch: true,
        supportsWebsiteVisit: true,
        supportsCustomTools: true,
        supportsVision: false,
    },
    {
        id: 'groq/compound-mini',
        name: 'Groq Compound Mini Turbo',
        category: 'groq',
        categoryLabel: '⚡ Groq Compound (Pesquisa & Visita Web)',
        speed: '~650 tps',
        contextWindow: '128.000 tokens',
        maxCompletion: '8.192 tokens',
        desc: 'Versão ultrarrápida do Groq Compound. Ideal para buscas ágeis na web, cotações em tempo real e verificação de sites agronômicos.',
        badge: 'Groq Compound Mini',
        isFeatured: true,
        supportsWebSearch: true,
        supportsWebsiteVisit: true,
        supportsCustomTools: true,
        supportsVision: false,
    },

    // 🧠 META LLAMA - RACIOCÍNIO PROFUNDO & BANCO DA FAZENDA
    {
        id: 'llama-3.3-70b-versatile',
        name: 'Meta Llama 3.3 70B Versatile',
        category: 'meta',
        categoryLabel: '🦙 Meta Llama (Alta Precisão)',
        speed: '~280 tps',
        contextWindow: '131.072 tokens',
        maxCompletion: '32.768 tokens',
        desc: 'Modelo topo de linha de 70B da Meta. Máxima precisão agronômica, fitossanidade, manejo e integração com ferramentas do banco da fazenda.',
        badge: 'Meta Flagship 70B',
        isFeatured: true,
        supportsWebSearch: false,
        supportsWebsiteVisit: false,
        supportsVision: false,
        supportsCustomTools: true,
    },
    {
        id: 'llama-3.1-8b-instant',
        name: 'Meta Llama 3.1 8B Instant',
        category: 'meta',
        categoryLabel: '🦙 Meta Llama (Alta Precisão)',
        speed: '~560 tps',
        contextWindow: '131.072 tokens',
        maxCompletion: '131.072 tokens',
        desc: 'Velocidade ultrarrápida de 560 tokens/s da Meta para consultas operacionais dinâmicas e suporte a ferramentas de campo.',
        badge: 'Meta Instant 8B',
        isFeatured: true,
        supportsWebSearch: false,
        supportsWebsiteVisit: false,
        supportsVision: false,
        supportsCustomTools: true,
    },
    {
        id: 'llama-3.1-70b-versatile',
        name: 'Meta Llama 3.1 70B Versatile',
        category: 'meta',
        categoryLabel: '🦙 Meta Llama (Alta Precisão)',
        speed: '~250 tps',
        contextWindow: '131.072 tokens',
        maxCompletion: '32.768 tokens',
        desc: 'Versão de alta estabilidade do Llama 3.1 70B da Meta para diagnósticos e prescrições agronômicas estruturadas.',
        badge: 'Meta 70B',
        isFeatured: false,
        supportsWebSearch: false,
        supportsWebsiteVisit: false,
        supportsVision: false,
        supportsCustomTools: true,
    },

    // 🧠 OPENAI - MODELOS DE RACIOCÍNIO & PESQUISA
    {
        id: 'openai/gpt-oss-120b',
        name: 'OpenAI GPT-OSS 120B',
        category: 'openai',
        categoryLabel: '🧠 OpenAI (Flagship & Turbo)',
        speed: '~500 tps',
        contextWindow: '131.072 tokens',
        maxCompletion: '65.536 tokens',
        desc: 'Flagship de 120 bilhões de parâmetros da OpenAI com pesquisa web e raciocínio avançado para diagnósticos e cotações agrícolas.',
        badge: 'OpenAI 120B',
        isFeatured: true,
        supportsWebSearch: true,
        supportsWebsiteVisit: false,
        supportsVision: false,
        supportsCustomTools: false,
    },
    {
        id: 'openai/gpt-oss-20b',
        name: 'OpenAI GPT-OSS 20B Turbo',
        category: 'openai',
        categoryLabel: '🧠 OpenAI (Flagship & Turbo)',
        speed: '~1000 tps',
        contextWindow: '131.072 tokens',
        maxCompletion: '65.536 tokens',
        desc: 'Velocidade extrema de 1000 tokens por segundo da OpenAI para respostas instantâneas.',
        badge: 'OpenAI 20B Turbo',
        isFeatured: true,
        supportsWebSearch: false,
        supportsWebsiteVisit: false,
        supportsVision: false,
        supportsCustomTools: false,
    },

    // 🎙️ OPENAI WHISPER (ÁUDIO & TRANSCRIÇÃO)
    {
        id: 'whisper-large-v3-turbo',
        name: 'OpenAI Whisper Large V3 Turbo',
        category: 'audio',
        categoryLabel: '🎙️ OpenAI Whisper (Voz & Áudio)',
        speed: 'Tempo Real',
        contextWindow: 'Áudio até 25MB',
        maxCompletion: 'Texto transcrito',
        desc: 'Transcrição de áudios e comandos de voz com precisão em português e termos técnicos agrícolas.',
        badge: 'OpenAI Whisper Turbo',
        isFeatured: true,
        supportsAudioSTT: true,
    },
    {
        id: 'whisper-large-v3',
        name: 'OpenAI Whisper Large V3 Max',
        category: 'audio',
        categoryLabel: '🎙️ OpenAI Whisper (Voz & Áudio)',
        speed: 'Alta Acurácia',
        contextWindow: 'Áudio até 100MB',
        maxCompletion: 'Texto transcrito',
        desc: 'Referência mundial da OpenAI para áudios ruidosos em cabines de tratores e colheitadeiras.',
        badge: 'OpenAI Whisper V3',
        isFeatured: false,
        supportsAudioSTT: true,
    },
];

/**
 * Redimensiona e comprime uma imagem (File, Blob ou DataURL) para JPEG otimizado
 * Evita o erro HTTP 413 (Request Entity Too Large) na API da Groq
 */
export const compressImageFile = (fileOrDataUrl, { maxWidth = 640, maxHeight = 640, quality = 0.5 } = {}) => {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined') return resolve(fileOrDataUrl);

        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > maxWidth || height > maxHeight) {
                if (width > height) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                } else {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            let compressedBase64 = canvas.toDataURL('image/jpeg', quality);

            // Passe 2: se ainda > ~75KB, reduz para 480px e qualidade 0.4
            if (compressedBase64.length > 100000) {
                const c2 = document.createElement('canvas');
                c2.width = Math.min(width, 480);
                c2.height = Math.round((height / width) * c2.width);
                const ctx2 = c2.getContext('2d');
                ctx2.fillStyle = '#FFFFFF';
                ctx2.fillRect(0, 0, c2.width, c2.height);
                ctx2.drawImage(img, 0, 0, c2.width, c2.height);
                compressedBase64 = c2.toDataURL('image/jpeg', 0.4);

                // Passe 3: se ainda > ~55KB, reduz para 320px e qualidade 0.3
                if (compressedBase64.length > 75000) {
                    const c3 = document.createElement('canvas');
                    c3.width = Math.min(c2.width, 320);
                    c3.height = Math.round((c2.height / c2.width) * c3.width);
                    const ctx3 = c3.getContext('2d');
                    ctx3.fillStyle = '#FFFFFF';
                    ctx3.fillRect(0, 0, c3.width, c3.height);
                    ctx3.drawImage(img, 0, 0, c3.width, c3.height);
                    compressedBase64 = c3.toDataURL('image/jpeg', 0.3);
                }
            }

            resolve(compressedBase64);
        };
        img.onerror = (err) => reject(new Error("Falha ao carregar e comprimir imagem."));

        if (typeof fileOrDataUrl === 'string') {
            img.src = fileOrDataUrl;
        } else if (fileOrDataUrl instanceof Blob || fileOrDataUrl instanceof File) {
            const reader = new FileReader();
            reader.onload = (e) => { img.src = e.target.result; };
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(fileOrDataUrl);
        } else {
            reject(new Error("Formato de arquivo inválido para compressão."));
        }
    });
};

/**
 * Âmbitos de Pesquisa Web
 */
export const SEARCH_SCOPES = {
    NACIONAL: {
        id: 'nacional',
        label: 'Nacional (Brasil)',
        shortLabel: 'Nacional',
        flag: '🇧🇷',
        badge: '🇧🇷 Brasil',
        desc: 'Portais nacionais: CEPEA/ESALQ, B3, CONAB, MAPA, Notícias Agrícolas, Canal Rural',
        country: 'brazil',
    },
    REGIONAL: {
        id: 'regional',
        label: 'Regional (Por Estado/Polo)',
        shortLabel: 'Regional',
        flag: '📍',
        badge: '📍 Regional',
        desc: 'Foco no seu Estado, Cooperativas locais e Institutos Regionais (IMEA, DERAL, EMATER, etc.)',
        country: 'brazil',
    },
    GLOBAL: {
        id: 'global',
        label: 'Global (Internacional)',
        shortLabel: 'Global',
        flag: '🌐',
        badge: '🌐 Global',
        desc: 'Internet mundial aberta: Chicago CBOT, USDA, relatórios e mercados globais',
        country: null,
    },
};

/**
 * Perfis e Fontes dos Principais Polos Agrícolas Brasileiros
 */
export const BRAZILIAN_AGRO_REGIONS = {
    'PR': {
        uf: 'PR',
        name: 'Paraná',
        region: 'Sul',
        institutes: 'DERAL/SEAB-PR, FAEP, IDR-Paraná, Cooperativas (Coamo, C.Vale, Cocamar, Lar, Copacol, Agrária)',
        hubs: 'Cascavel, Londrina, Maringá, Ponta Grossa, Guarapuava, Toledo, Pato Branco',
        domains: ['seab.pr.gov.br', 'agricultura.pr.gov.br', 'sistemafaep.org.br', 'idrparana.pr.gov.br', 'coamo.com.br', 'cvale.com.br', 'cocamar.com.br', 'lar.ind.br', 'copacol.com.br', 'noticiasagricolas.com.br', 'cepea.esalq.usp.br'],
        searchKeywords: ['DERAL PR', 'SEAB PR', 'Coamo', 'preço soja Paraná', 'milho safrinha PR']
    },
    'MT': {
        uf: 'MT',
        name: 'Mato Grosso',
        region: 'Centro-Oeste',
        institutes: 'IMEA, Aprosoja MT, Sistema FAMATO, SEDEC-MT',
        hubs: 'Sorriso, Lucas do Rio Verde, Rondonópolis, Sinop, Campo Novo do Parecis, Nova Mutum, Primavera do Leste',
        domains: ['imea.com.br', 'aprosoja.com.br', 'sistemafamato.org.br', 'sedec.mt.gov.br', 'noticiasagricolas.com.br', 'cepea.esalq.usp.br', 'globorural.globo.com'],
        searchKeywords: ['IMEA MT', 'Aprosoja MT', 'cotação soja Sorriso MT', 'frete MT', 'milho MT']
    },
    'RS': {
        uf: 'RS',
        name: 'Rio Grande do Sul',
        region: 'Sul',
        institutes: 'Emater-RS, Sistema FARSUL, Cotrijal, Cotrisoja, Federarroz, CCGL',
        hubs: 'Passo Fundo, Cruz Alta, Santa Maria, Pelotas, Ijuí, Santo Ângelo, Não-Me-Toque',
        domains: ['emater.tche.br', 'farsul.org.br', 'cotrijal.com.br', 'federarroz.com.br', 'noticiasagricolas.com.br', 'cepea.esalq.usp.br'],
        searchKeywords: ['Emater RS', 'Farsul', 'preço soja RS', 'Cotrijal', 'arroz RS']
    },
    'GO': {
        uf: 'GO',
        name: 'Goiás',
        region: 'Centro-Oeste',
        institutes: 'Sistema FAEG/SENAR, Aprosoja GO, Agrodefesa, COMIGO, Caramuru',
        hubs: 'Rio Verde, Jataí, Cristalina, Itumbiara, Montividiu, Mineiros, Catalão',
        domains: ['sistemafaeg.com.br', 'aprosojago.com.br', 'agrodefesa.go.gov.br', 'comigo.com.br', 'noticiasagricolas.com.br'],
        searchKeywords: ['FAEG Goiás', 'Aprosoja GO', 'COMIGO Rio Verde', 'cotação soja Goiás']
    },
    'MS': {
        uf: 'MS',
        name: 'Mato Grosso do Sul',
        region: 'Centro-Oeste',
        institutes: 'Sistema Famasul, Aprosoja MS, Coamo MS, Copasul',
        hubs: 'Dourados, Maracaju, São Gabriel do Oeste, Sidrolândia, Chapadão do Sul, Naviraí',
        domains: ['famasul.com.br', 'aprosojams.org.br', 'copasul.com.br', 'noticiasagricolas.com.br', 'cepea.esalq.usp.br'],
        searchKeywords: ['Famasul MS', 'Aprosoja MS', 'soja Dourados MS', 'milho safrinha MS']
    },
    'MG': {
        uf: 'MG',
        name: 'Minas Gerais',
        region: 'Sudeste',
        institutes: 'Sistema FAEMG, Emater-MG, EPAMIG, Cooxupé, Cooperativa Agropecuária do Alto Paranaíba',
        hubs: 'Patos de Minas, Uberlândia, Unaí, Paracatu, Machado, Guaxupé, Araguari',
        domains: ['sistemafaemg.org.br', 'emater.mg.gov.br', 'epamig.br', 'cooxupe.com.br', 'noticiasagricolas.com.br'],
        searchKeywords: ['FAEMG', 'Emater MG', 'café Cooxupé', 'grãos Triângulo Mineiro', 'soja Unaí']
    },
    'BA': {
        uf: 'BA',
        name: 'Bahia / MATOPIBA',
        region: 'Nordeste',
        institutes: 'AIBA, ABAPA, Fundação Bahia, Aprosoja BA',
        hubs: 'Luís Eduardo Magalhães (LEM), Barreiras, São Desidério, Correntina, Formosa do Rio Preto',
        domains: ['aiba.org.br', 'abapa.com.br', 'fundacaobahia.com.br', 'noticiasagricolas.com.br'],
        searchKeywords: ['AIBA LEM', 'ABAPA algodão', 'soja Oeste da Bahia', 'MATOPIBA']
    },
    'SP': {
        uf: 'SP',
        name: 'São Paulo',
        region: 'Sudeste',
        institutes: 'IEA-SP, FAESP/SENAR, CATI, CEPEA/ESALQ USP, Coopercitrus',
        hubs: 'Ribeirão Preto, Piracicaba, Assis, Barretos, Araraquara, Franca, Itapetininga',
        domains: ['ieaig.sp.gov.br', 'faespsenar.com.br', 'cati.sp.gov.br', 'cepea.esalq.usp.br', 'coopercitrus.com.br', 'noticiasagricolas.com.br'],
        searchKeywords: ['IEA SP', 'CEPEA ESALQ SP', 'cana SP', 'soja Assis SP', 'milho SP']
    },
    'SC': {
        uf: 'SC',
        name: 'Santa Catarina',
        region: 'Sul',
        institutes: 'Epagri, Sistema FAESC, Cooperalfa, Aurora Coop',
        hubs: 'Chapecó, Concórdia, Campos Novos, Xanxerê, Joaçaba',
        domains: ['epagri.sc.gov.br', 'faesc.com.br', 'cooperalfa.com.br', 'noticiasagricolas.com.br'],
        searchKeywords: ['Epagri SC', 'FAESC', 'grãos Chapecó', 'milho Campos Novos']
    },
    'TO': {
        uf: 'TO',
        name: 'Tocantins / MATOPIBA',
        region: 'Norte',
        institutes: 'FAET, Aprosoja TO, Seagro TO',
        hubs: 'Pedro Afonso, Campos Lindos, Gurupi, Porto Nacional',
        domains: ['faet.com.br', 'seagro.to.gov.br', 'noticiasagricolas.com.br'],
        searchKeywords: ['Aprosoja TO', 'soja Tocantins', 'MATOPIBA Pedro Afonso']
    },
    'MA': {
        uf: 'MA',
        name: 'Maranhão / MATOPIBA',
        region: 'Nordeste',
        institutes: 'FAEMA, FAPCEN, Aprosoja MA',
        hubs: 'Balsas, Tasso Fragoso, Chapadinha',
        domains: ['faema.org.br', 'fapcen.org.br', 'noticiasagricolas.com.br'],
        searchKeywords: ['FAPCEN Balsas', 'soja Maranhão', 'MATOPIBA']
    },
    'PI': {
        uf: 'PI',
        name: 'Piauí / MATOPIBA',
        region: 'Nordeste',
        institutes: 'FAEPI, Aprosoja PI',
        hubs: 'Uruçuí, Bom Jesus, Baixa Grande do Ribeiro',
        domains: ['faepi.org.br', 'noticiasagricolas.com.br'],
        searchKeywords: ['Aprosoja PI', 'soja Uruçuí', 'grãos Piauí']
    },
    'RO': {
        uf: 'RO',
        name: 'Rondônia',
        region: 'Norte',
        institutes: 'FAPERON, Emater-RO, Aprosoja RO',
        hubs: 'Vilhena, Cerejeiras, Ariquemes, Ji-Paraná',
        domains: ['faperon.com.br', 'emater-ro.com.br', 'noticiasagricolas.com.br'],
        searchKeywords: ['Aprosoja RO', 'soja Vilhena', 'grãos Rondônia']
    },
    'PA': {
        uf: 'PA',
        name: 'Pará',
        region: 'Norte',
        institutes: 'FAEPA, Emater-PA, Aprosoja PA',
        hubs: 'Santarém, Paragominas, Dom Eliseu, Santana do Araguaia',
        domains: ['faepa.com.br', 'emater.pa.gov.br', 'noticiasagricolas.com.br'],
        searchKeywords: ['Aprosoja PA', 'soja Paragominas', 'grãos Santarém']
    },
};

/**
 * Presets de pesquisa web com filtros temáticos agrícolas
 */
export const WEB_SEARCH_PRESETS = [
    {
        id: 'all',
        label: 'Busca Ampla',
        shortLabel: 'Tudo',
        icon: '🌐',
        desc: 'Pesquisa livre com priorização nacional ou regional conforme o âmbito selecionado',
        domains: [],
    },
    {
        id: 'cotacoes',
        label: 'Cotações & Mercado',
        shortLabel: 'Cotações',
        icon: '📈',
        desc: 'Notícias Agrícolas, CEPEA/ESALQ, Canal Rural, B3, SAFRAS & Mercado e Agrolink',
        domains: ['noticiasagricolas.com.br', 'cepea.esalq.usp.br', 'canalrural.com.br', 'globorural.globo.com', 'b3.com.br', 'agrolink.com.br', 'safras.com.br'],
    },
    {
        id: 'embrapa',
        label: 'Embrapa & Defensivos',
        shortLabel: 'Embrapa / Bula',
        icon: '🛡️',
        desc: 'Bases científicas Embrapa, Agrofit, MAPA, CONAB e universidades agronômicas (USP, UFV, UFLA, UNESP)',
        domains: ['embrapa.br', 'gov.br', 'agrofit.agricultura.gov.br', 'conab.gov.br', '*.usp.br', '*.ufv.br', '*.ufla.br', '*.unesp.br', '*.ufu.br'],
    },
    {
        id: 'clima',
        label: 'Clima & Previsão',
        shortLabel: 'Clima & Radares',
        icon: '🌦️',
        desc: 'INMET, CPTEC/INPE, Climatempo, Tempo.com e radares meteorológicos',
        domains: ['inmet.gov.br', 'cptec.inpe.br', 'climatempo.com.br', 'tempo.com'],
    },
    {
        id: 'cooperativas',
        label: 'Cooperativas & Institutos',
        shortLabel: 'Cooperativas / Órgãos',
        icon: '🏛️',
        desc: 'Portais de cooperativas (Coamo, C.Vale, Cocamar, Cotrijal, COMIGO, Cooxupé) e institutos (IMEA, DERAL, EMATER, AIBA)',
        domains: ['coamo.com.br', 'cvale.com.br', 'cocamar.com.br', 'cotrijal.com.br', 'comigo.com.br', 'cooxupe.com.br', 'seab.pr.gov.br', 'imea.com.br', 'aiba.org.br', 'emater.tche.br'],
    },
];

/**
 * Construtor inteligente de Search Settings para a GroqCloud (Tavily Search)
 * Suporta filtragem por país (country: "brazil"), inclusão/exclusão de domínios com wildcards
 */
export const buildSearchSettings = ({
    scope = 'nacional', // 'nacional' | 'regional' | 'global'
    selectedState = 'AUTO', // 'PR' | 'MT' | 'RS' | etc. ou 'AUTO'
    preset = 'all', // 'all' | 'cotacoes' | 'embrapa' | 'clima' | 'cooperativas'
    customDomains = '',
    excludeDomains = '',
    location = null,
} = {}) => {
    // 1. Escopo Global: sem restrição de país
    if (scope === 'global') {
        const settings = {};
        if (customDomains.trim()) {
            settings.include_domains = customDomains.split(',').map(d => d.trim()).filter(Boolean);
        }
        if (excludeDomains.trim()) {
            settings.exclude_domains = excludeDomains.split(',').map(d => d.trim()).filter(Boolean);
        }
        return Object.keys(settings).length > 0 ? settings : undefined;
    }

    // 2. Escopos Nacional e Regional: priorizam country = 'brazil'
    const settings = {
        country: 'brazil',
    };

    const includeSet = new Set();
    const excludeSet = new Set(['wikipedia.org', '*.pinterest.com']); // Exclusões padrão para focar em dados agronômicos profissionais

    // Aplica domínios do preset selecionado
    const presetObj = WEB_SEARCH_PRESETS.find(p => p.id === preset);
    if (presetObj && presetObj.domains && presetObj.domains.length > 0) {
        presetObj.domains.forEach(d => includeSet.add(d));
    }

    // Se for âmbito Regional, integra os domínios do estado
    if (scope === 'regional') {
        let stateCode = selectedState;
        if (stateCode === 'AUTO' && location?.state) {
            // Tenta mapear nome do estado para a sigla UF
            const stateEntry = Object.entries(BRAZILIAN_AGRO_REGIONS).find(([uf, data]) =>
                location.state.toLowerCase().includes(data.name.toLowerCase()) ||
                location.state.toUpperCase().includes(uf)
            );
            if (stateEntry) {
                stateCode = stateEntry[0];
            }
        }

        if (stateCode && stateCode !== 'AUTO' && BRAZILIAN_AGRO_REGIONS[stateCode]) {
            const regionData = BRAZILIAN_AGRO_REGIONS[stateCode];
            regionData.domains.forEach(d => includeSet.add(d));
        }
    }

    // Domínios adicionais personalizados do usuário
    if (customDomains.trim()) {
        customDomains.split(',').map(d => d.trim()).filter(Boolean).forEach(d => includeSet.add(d));
    }

    if (excludeDomains.trim()) {
        excludeDomains.split(',').map(d => d.trim()).filter(Boolean).forEach(d => excludeSet.add(d));
    }

    if (includeSet.size > 0) {
        settings.include_domains = Array.from(includeSet);
    }
    if (excludeSet.size > 0) {
        settings.exclude_domains = Array.from(excludeSet);
    }

    return settings;
};

/**
 * Ferramentas do banco de dados da fazenda (Firebase Firestore)
 */
export const FARM_TOOLS_DEFINITION = [
    {
        type: 'function',
        function: {
            name: 'get_farm_data',
            description: 'Consulta os registros operacionais internos da fazenda no banco de dados do produtor (Firebase).',
            parameters: {
                type: 'object',
                required: ['topic'],
                properties: {
                    topic: {
                        type: 'string',
                        description: 'Setor ou módulo da fazenda para consulta de dados.',
                        enum: ['colheitas', 'diesel', 'plantios', 'pulverizacoes', 'pluviometro', 'estoqueGeral', 'inventario', 'revisoes', 'manuais'],
                    },
                    filtro: {
                        type: 'string',
                        description: 'Opcional: termo para filtrar (ex: nome de talhão, máquina, variedade ou defensivo).',
                    },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'add_pluviometro',
            description: 'Registra uma nova medição de chuva/precipitação no pluviômetro da fazenda.',
            parameters: {
                type: 'object',
                required: ['milimetros'],
                properties: {
                    milimetros: {
                        type: 'number',
                        description: 'Volume de chuva acumulado em milímetros (ex: 28.5 ou 40).',
                    },
                    dataMedicao: {
                        type: 'string',
                        description: 'Data da chuva no formato YYYY-MM-DD (ex: 2026-08-04). Se omitido, usa a data de hoje.',
                    },
                    talhao: {
                        type: 'string',
                        description: 'Nome do talhão, sede ou retiro onde fica o pluviômetro (ex: Talhão 02, Sede, Ponto 1).',
                    },
                    observacoes: {
                        type: 'string',
                        description: 'Opcional: detalhes da chuva (ex: Chuva forte com vento, garoa contínua).',
                    },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'add_manual',
            description: 'Cadastra ou salva um manual técnico, catálogo de peças ou guia de operação de máquina/implemento na biblioteca da fazenda.',
            parameters: {
                type: 'object',
                required: ['titulo', 'categoria', 'marca'],
                properties: {
                    titulo: {
                        type: 'string',
                        description: 'Título completo do manual ou guia técnico (ex: Manual de Operação e Manutenção Trator 6110J).',
                    },
                    categoria: {
                        type: 'string',
                        description: 'Categoria do equipamento ou manual.',
                        enum: ['Tratores', 'Colheitadeiras', 'Pulverizadores', 'Implementos', 'Agronomia', 'Outro'],
                    },
                    marca: {
                        type: 'string',
                        description: 'Marca ou fabricante (ex: John Deere, Case IH, New Holland, Massey Ferguson, Valtra, Stara, Jacto, Kuhn, Baldan, etc.).',
                    },
                    modelo: {
                        type: 'string',
                        description: 'Modelo do equipamento (ex: 6110J, Magnum 340, Imperador 4000, Fast 24).',
                    },
                    descricao: {
                        type: 'string',
                        description: 'Resumo técnico detalhado com especificações, tabelas de torque, intervalos de troca de óleo, calibragens e manutenções.',
                    },
                    url: {
                        type: 'string',
                        description: 'Opcional: link ou URL do PDF do manual.',
                    },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'add_romaneio',
            description: 'Registra um Romaneio de Carga / Ticket de Pesagem de Grãos colhidos (Soja, Milho, Trigo, etc.) no banco de dados da fazenda.',
            parameters: {
                type: 'object',
                required: ['cultura', 'pesoTotalKg'],
                properties: {
                    cultura: {
                        type: 'string',
                        description: 'Cultura colhida (ex: Soja, Milho, Trigo, Algodão, Feijão, etc.).',
                    },
                    talhao: {
                        type: 'string',
                        description: 'Talhão ou lote colhido (ex: Talhão 04, Piquete 1).',
                    },
                    numeroRomaneio: {
                        type: 'string',
                        description: 'Número do ticket de pesagem ou romaneio (ex: 849201).',
                    },
                    pesoTotalKg: {
                        type: 'number',
                        description: 'Peso líquido principal apurado em kg (ex: 38500).',
                    },
                    pesoTotalSacas: {
                        type: 'number',
                        description: 'Peso convertido em sacas de 60kg (ex: 641.6).',
                    },
                    pesoBrutoKg: {
                        type: 'number',
                        description: 'Opcional: Peso bruto do caminhão em kg.',
                    },
                    taraKg: {
                        type: 'number',
                        description: 'Opcional: Tara do caminhão em kg.',
                    },
                    umidade: {
                        type: 'number',
                        description: 'Opcional: Umidade dos grãos em % (ex: 13.5).',
                    },
                    impureza: {
                        type: 'number',
                        description: 'Opcional: Impureza em % (ex: 1.0).',
                    },
                    avariados: {
                        type: 'number',
                        description: 'Opcional: Percentual de grãos avariados.',
                    },
                    destino: {
                        type: 'string',
                        description: 'Armazém, cooperativa ou silo de destino (ex: Coamo, Cargill, Silo Sede).',
                    },
                    placaVeiculo: {
                        type: 'string',
                        description: 'Placa do caminhão de transporte (ex: ABC-1234).',
                    },
                    motorista: {
                        type: 'string',
                        description: 'Nome do motorista transportador.',
                    },
                    dataColheita: {
                        type: 'string',
                        description: 'Data da colheita/pesagem no formato YYYY-MM-DD (ex: 2026-08-04).',
                    },
                    observacoes: {
                        type: 'string',
                        description: 'Observações sobre a carga e descontos.',
                    },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'add_defensivo_bula',
            description: 'Cadastra ou atualiza um defensivo, fertilizante ou insumo no estoque geral com informações técnicas extraídas da bula ou rótulo.',
            parameters: {
                type: 'object',
                required: ['nomeItem'],
                properties: {
                    nomeItem: {
                        type: 'string',
                        description: 'Nome comercial do produto (ex: Fox Xpro, Engeo Pleno S, Roundup Transorb).',
                    },
                    categoria: {
                        type: 'string',
                        description: 'Categoria do produto no estoque.',
                        enum: ['Defensivos', 'Fertilizantes', 'Sementes', 'Adjuvantes', 'Biológicos', 'Outros'],
                    },
                    principioAtivo: {
                        type: 'string',
                        description: 'Ingrediente ativo e concentração (ex: Trifloxistrobina + Protioconazol + Bixafem).',
                    },
                    fabricante: {
                        type: 'string',
                        description: 'Fabricante do produto (ex: Bayer, Syngenta, BASF, Corteva).',
                    },
                    dosagemRecomendada: {
                        type: 'string',
                        description: 'Dose recomendada por hectare (ex: 0,5 L/ha ou 300 ml/ha).',
                    },
                    carenciaDias: {
                        type: 'number',
                        description: 'Intervalo de segurança / carência antes da colheita em dias.',
                    },
                    alvoPragas: {
                        type: 'string',
                        description: 'Pragas, doenças ou plantas daninhas alvo.',
                    },
                    quantidade: {
                        type: 'number',
                        description: 'Quantidade disponível no estoque físico.',
                    },
                    unidade: {
                        type: 'string',
                        description: 'Unidade de medida (ex: Litros, Kg, Galões 20L, Sacos 50kg).',
                    },
                    observacoes: {
                        type: 'string',
                        description: 'Recomendações técnicas de preparo de calda, EPIs e adjuvantes.',
                    },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'add_diesel_abastecimento',
            description: 'Registra um abastecimento de combustível (Diesel S10, S500 ou Arla) em veículo ou máquina.',
            parameters: {
                type: 'object',
                required: ['veiculo', 'litros'],
                properties: {
                    veiculo: {
                        type: 'string',
                        description: 'Nome ou identificação da máquina/veículo (ex: Trator JD 6110J, Colheitadeira S680).',
                    },
                    litros: {
                        type: 'number',
                        description: 'Volume abastecido em litros.',
                    },
                    horimetro: {
                        type: 'number',
                        description: 'Horímetro ou odômetro no momento do abastecimento.',
                    },
                    data: {
                        type: 'string',
                        description: 'Data do abastecimento (YYYY-MM-DD).',
                    },
                    precoLitro: {
                        type: 'number',
                        description: 'Preço por litro pago em R$.',
                    },
                    tipoCombustivel: {
                        type: 'string',
                        description: 'Tipo de combustível (S10, S500, Arla 32).',
                    },
                    observacoes: {
                        type: 'string',
                        description: 'Observações do abastecimento.',
                    },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'add_revisao_maquina',
            description: 'Registra uma manutenção ou revisão de máquina/equipamento.',
            parameters: {
                type: 'object',
                required: ['maquina', 'tipoRevisao'],
                properties: {
                    maquina: {
                        type: 'string',
                        description: 'Máquina revisada (ex: Trator Case Puma 200).',
                    },
                    tipoRevisao: {
                        type: 'string',
                        description: 'Tipo de revisão (ex: Revisão 250h - Troca de Óleo e Filtros).',
                    },
                    horimetroAtual: {
                        type: 'number',
                        description: 'Horímetro da máquina no momento da manutenção.',
                    },
                    proximaRevisaoHorimetro: {
                        type: 'number',
                        description: 'Horímetro para a próxima revisão preventiva.',
                    },
                    dataRevisao: {
                        type: 'string',
                        description: 'Data da revisão (YYYY-MM-DD).',
                    },
                    descricaoServico: {
                        type: 'string',
                        description: 'Descrição dos serviços e peças substituídas.',
                    },
                    custoTotal: {
                        type: 'number',
                        description: 'Custo total das peças e mão de obra.',
                    },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'add_pulverizacao',
            description: 'Registra uma aplicação de defensivo, fertilizante foliar ou dessecação em talhão.',
            parameters: {
                type: 'object',
                required: ['talhao', 'produto', 'doseHa'],
                properties: {
                    talhao: {
                        type: 'string',
                        description: 'Talhão onde foi realizada a aplicação (ex: Talhão 01).',
                    },
                    produto: {
                        type: 'string',
                        description: 'Nome do defensivo ou calda aplicada (ex: Fox Xpro + Áureo).',
                    },
                    doseHa: {
                        type: 'string',
                        description: 'Dose por hectare (ex: 0.5 L/ha).',
                    },
                    areaAplicadaHa: {
                        type: 'number',
                        description: 'Área total tratada em hectares.',
                    },
                    dataAplicacao: {
                        type: 'string',
                        description: 'Data da aplicação (YYYY-MM-DD).',
                    },
                    responsavel: {
                        type: 'string',
                        description: 'Operador do pulverizador ou engenheiro agrônomo.',
                    },
                    alvo: {
                        type: 'string',
                        description: 'Alvo biológico (ex: Ferrugem da Soja, Lagartas, Capim-amargoso).',
                    },
                    observacoes: {
                        type: 'string',
                        description: 'Condições climáticas, vento ou umidade no momento da aplicação.',
                    },
                },
            },
        },
    },
];

export const FARM_TOOLS_IMPLEMENTATION = {
    // 1. Consulta de dados internos
    get_farm_data: async ({ topic, filtro }) => {
        const userUid = auth?.currentUser?.uid;
        if (!userUid) return JSON.stringify({ error: 'Usuário não autenticado no sistema.' });

        const schemaMap = {
            colheitas: { orderBy: 'dataColheita' },
            diesel: { orderBy: 'data' },
            plantios: { orderBy: 'dataPlantio' },
            pulverizacoes: { orderBy: 'dataAplicacao' },
            pluviometro: { orderBy: 'dataMedicao' },
            estoqueGeral: { orderBy: null },
            inventario: { orderBy: 'dataAquisicao' },
            revisoes: { orderBy: 'dataRevisao' },
            manuais: { orderBy: 'titulo' },
        };

        if (!schemaMap[topic]) return JSON.stringify({ error: `Tópico '${topic}' não reconhecido.` });

        try {
            const config = schemaMap[topic];
            const colRef = collection(db, 'users', userUid, topic);
            let q = config.orderBy ? query(colRef, orderBy(config.orderBy, 'desc'), limit(15)) : query(colRef, limit(15));
            const snapshot = await getDocs(q);

            if (snapshot.empty) return JSON.stringify({ info: `Nenhum registro encontrado no setor: ${topic}` });

            let data = snapshot.docs.map((docSnap) => {
                const raw = docSnap.data();
                const normalized = { id: docSnap.id };
                Object.keys(raw).forEach((key) => {
                    if (raw[key]?.toDate) {
                        normalized[key] = raw[key].toDate().toISOString().split('T')[0];
                    } else {
                        normalized[key] = raw[key];
                    }
                });
                return normalized;
            });

            if (filtro) {
                const f = filtro.toLowerCase();
                data = data.filter((item) => JSON.stringify(item).toLowerCase().includes(f));
            }

            return JSON.stringify(data.slice(0, 10));
        } catch (e) {
            console.error('Erro ao consultar Firestore:', e);
            return JSON.stringify({ error: `Erro no banco de dados: ${e.message}` });
        }
    },

    // 2. Adicionar medição de chuva no Pluviômetro
    add_pluviometro: async ({ milimetros, dataMedicao, talhao, observacoes }) => {
        const userUid = auth?.currentUser?.uid;
        if (!userUid) return JSON.stringify({ error: 'Usuário não autenticado.' });

        try {
            const mmNum = Number(milimetros);
            if (isNaN(mmNum) || mmNum < 0) {
                return JSON.stringify({ error: 'Volume de chuva em milímetros inválido.' });
            }

            const finalDateStr = dataMedicao || new Date().toISOString().split('T')[0];
            const docId = doc(collection(db, 'users', userUid, 'pluviometro')).id;

            const docData = {
                id: docId,
                milimetros: mmNum,
                talhao: talhao ? talhao.trim() : 'Sede',
                dataMedicao: new Date(`${finalDateStr}T12:00:00`),
                observacoes: observacoes ? observacoes.trim() : '',
                criadoViaIA: true,
                atualizadoEm: new Date()
            };

            await setDoc(doc(db, 'users', userUid, 'pluviometro', docId), docData);

            return JSON.stringify({
                success: true,
                message: `🌧️ Medição de ${mmNum} mm de chuva registrada com sucesso no pluviômetro!`,
                registro: {
                    id: docId,
                    milimetros: mmNum,
                    dataMedicao: finalDateStr,
                    talhao: docData.talhao,
                    observacoes: docData.observacoes
                }
            });
        } catch (e) {
            console.error('Erro ao salvar pluviômetro:', e);
            return JSON.stringify({ error: `Falha ao salvar pluviômetro: ${e.message}` });
        }
    },

    // 3. Adicionar manual técnico de máquina/implemento
    add_manual: async ({ titulo, categoria, marca, modelo, descricao, url }) => {
        const userUid = auth?.currentUser?.uid;
        if (!userUid) return JSON.stringify({ error: 'Usuário não autenticado.' });

        try {
            const docId = doc(collection(db, 'users', userUid, 'manuais')).id;
            const docData = {
                id: docId,
                titulo: titulo.trim(),
                categoria: categoria || 'Tratores',
                marca: marca || 'Outra',
                modelo: modelo ? modelo.trim() : '',
                descricao: descricao ? descricao.trim() : '',
                url: url ? url.trim() : '',
                criadoViaIA: true,
                criadoEm: new Date(),
                atualizadoEm: new Date()
            };

            await setDoc(doc(db, 'users', userUid, 'manuais', docId), docData);

            return JSON.stringify({
                success: true,
                message: `🚜 Manual "${titulo}" cadastrado com sucesso na biblioteca técnica!`,
                registro: {
                    id: docId,
                    titulo: docData.titulo,
                    categoria: docData.categoria,
                    marca: docData.marca,
                    modelo: docData.modelo
                }
            });
        } catch (e) {
            console.error('Erro ao salvar manual:', e);
            return JSON.stringify({ error: `Falha ao salvar manual: ${e.message}` });
        }
    },

    // 4. Adicionar Romaneio de Grãos / Colheita
    add_romaneio: async (params) => {
        const userUid = auth?.currentUser?.uid;
        if (!userUid) return JSON.stringify({ error: 'Usuário não autenticado.' });

        try {
            const docId = doc(collection(db, 'users', userUid, 'colheitas')).id;
            const pesoKg = Number(params.pesoTotalKg || 0);
            const sacas = Number(params.pesoTotalSacas || (pesoKg ? (pesoKg / 60).toFixed(2) : 0));
            const dataStr = params.dataColheita || new Date().toISOString().split('T')[0];

            const docData = {
                id: docId,
                cultura: params.cultura || 'Soja',
                talhao: params.talhao || 'Geral',
                numeroRomaneio: params.numeroRomaneio ? String(params.numeroRomaneio).trim() : '',
                pesoTotalKg: pesoKg,
                pesoTotalSacas: sacas,
                pesoBrutoKg: params.pesoBrutoKg ? Number(params.pesoBrutoKg) : null,
                taraKg: params.taraKg ? Number(params.taraKg) : null,
                umidade: params.umidade ? Number(params.umidade) : null,
                impureza: params.impureza ? Number(params.impureza) : null,
                avariados: params.avariados ? Number(params.avariados) : null,
                destino: params.destino ? params.destino.trim() : '',
                placaVeiculo: params.placaVeiculo ? params.placaVeiculo.trim() : '',
                motorista: params.motorista ? params.motorista.trim() : '',
                dataColheita: new Date(`${dataStr}T12:00:00`),
                observacoes: params.observacoes ? params.observacoes.trim() : '',
                criadoViaIA: true,
                atualizadoEm: new Date()
            };

            await setDoc(doc(db, 'users', userUid, 'colheitas', docId), docData);

            return JSON.stringify({
                success: true,
                message: `📄 Romaneio #${docData.numeroRomaneio || docId.slice(0, 6)} de ${docData.cultura} (${pesoKg.toLocaleString('pt-BR')} kg / ${sacas.toLocaleString('pt-BR')} sc) cadastrado com sucesso!`,
                registro: {
                    id: docId,
                    numeroRomaneio: docData.numeroRomaneio,
                    cultura: docData.cultura,
                    talhao: docData.talhao,
                    pesoTotalKg: pesoKg,
                    pesoSacas: sacas,
                    dataColheita: dataStr
                }
            });
        } catch (e) {
            console.error('Erro ao salvar romaneio:', e);
            return JSON.stringify({ error: `Falha ao salvar romaneio: ${e.message}` });
        }
    },

    // 5. Adicionar Defensivo / Insumo a partir de Bula
    add_defensivo_bula: async (params) => {
        const userUid = auth?.currentUser?.uid;
        if (!userUid) return JSON.stringify({ error: 'Usuário não autenticado.' });

        try {
            const docId = doc(collection(db, 'users', userUid, 'estoqueGeral')).id;
            const docData = {
                id: docId,
                nomeItem: params.nomeItem.trim(),
                categoria: params.categoria || 'Defensivos',
                principioAtivo: params.principioAtivo ? params.principioAtivo.trim() : '',
                fabricante: params.fabricante ? params.fabricante.trim() : '',
                dosagemRecomendada: params.dosagemRecomendada ? params.dosagemRecomendada.trim() : '',
                carenciaDias: params.carenciaDias ? Number(params.carenciaDias) : null,
                alvoPragas: params.alvoPragas ? params.alvoPragas.trim() : '',
                quantidade: params.quantidade ? Number(params.quantidade) : 0,
                unidade: params.unidade || 'Litros',
                observacoes: params.observacoes ? params.observacoes.trim() : '',
                criadoViaIA: true,
                atualizadoEm: new Date()
            };

            await setDoc(doc(db, 'users', userUid, 'estoqueGeral', docId), docData);

            return JSON.stringify({
                success: true,
                message: `🧪 Insumo "${docData.nomeItem}" cadastrado no estoque com especificações técnicas da bula!`,
                registro: {
                    id: docId,
                    nomeItem: docData.nomeItem,
                    principioAtivo: docData.principioAtivo,
                    dosagemRecomendada: docData.dosagemRecomendada,
                    carenciaDias: docData.carenciaDias
                }
            });
        } catch (e) {
            console.error('Erro ao salvar defensivo:', e);
            return JSON.stringify({ error: `Falha ao salvar defensivo: ${e.message}` });
        }
    },

    // 6. Adicionar Abastecimento de Diesel
    add_diesel_abastecimento: async (params) => {
        const userUid = auth?.currentUser?.uid;
        if (!userUid) return JSON.stringify({ error: 'Usuário não autenticado.' });

        try {
            const docId = doc(collection(db, 'users', userUid, 'diesel')).id;
            const litrosNum = Number(params.litros || 0);
            const dataStr = params.data || new Date().toISOString().split('T')[0];

            const docData = {
                id: docId,
                veiculo: params.veiculo.trim(),
                litros: litrosNum,
                horimetro: params.horimetro ? Number(params.horimetro) : null,
                data: new Date(`${dataStr}T12:00:00`),
                precoLitro: params.precoLitro ? Number(params.precoLitro) : null,
                tipoCombustivel: params.tipoCombustivel || 'S10',
                observacoes: params.observacoes ? params.observacoes.trim() : '',
                criadoViaIA: true,
                atualizadoEm: new Date()
            };

            await setDoc(doc(db, 'users', userUid, 'diesel', docId), docData);

            return JSON.stringify({
                success: true,
                message: `⛽ Abastecimento de ${litrosNum} L (${docData.veiculo}) registrado com sucesso!`,
                registro: {
                    id: docId,
                    veiculo: docData.veiculo,
                    litros: litrosNum,
                    data: dataStr
                }
            });
        } catch (e) {
            console.error('Erro ao salvar abastecimento:', e);
            return JSON.stringify({ error: `Falha ao salvar diesel: ${e.message}` });
        }
    },

    // 7. Adicionar Revisão de Máquina
    add_revisao_maquina: async (params) => {
        const userUid = auth?.currentUser?.uid;
        if (!userUid) return JSON.stringify({ error: 'Usuário não autenticado.' });

        try {
            const docId = doc(collection(db, 'users', userUid, 'revisoes')).id;
            const dataStr = params.dataRevisao || new Date().toISOString().split('T')[0];

            const docData = {
                id: docId,
                maquina: params.maquina.trim(),
                tipoRevisao: params.tipoRevisao.trim(),
                horimetroAtual: params.horimetroAtual ? Number(params.horimetroAtual) : null,
                proximaRevisaoHorimetro: params.proximaRevisaoHorimetro ? Number(params.proximaRevisaoHorimetro) : null,
                dataRevisao: new Date(`${dataStr}T12:00:00`),
                descricaoServico: params.descricaoServico ? params.descricaoServico.trim() : '',
                custoTotal: params.custoTotal ? Number(params.custoTotal) : 0,
                criadoViaIA: true,
                atualizadoEm: new Date()
            };

            await setDoc(doc(db, 'users', userUid, 'revisoes', docId), docData);

            return JSON.stringify({
                success: true,
                message: `🔧 Revisão de "${docData.maquina}" (${docData.tipoRevisao}) cadastrada com sucesso!`,
                registro: {
                    id: docId,
                    maquina: docData.maquina,
                    tipoRevisao: docData.tipoRevisao,
                    dataRevisao: dataStr
                }
            });
        } catch (e) {
            console.error('Erro ao salvar revisão:', e);
            return JSON.stringify({ error: `Falha ao salvar revisão: ${e.message}` });
        }
    },

    // 8. Adicionar Pulverização
    add_pulverizacao: async (params) => {
        const userUid = auth?.currentUser?.uid;
        if (!userUid) return JSON.stringify({ error: 'Usuário não autenticado.' });

        try {
            const docId = doc(collection(db, 'users', userUid, 'pulverizacoes')).id;
            const dataStr = params.dataAplicacao || new Date().toISOString().split('T')[0];

            const docData = {
                id: docId,
                talhao: params.talhao.trim(),
                produto: params.produto.trim(),
                doseHa: params.doseHa.trim(),
                areaTalhao: params.areaAplicadaHa ? Number(params.areaAplicadaHa) : null,
                dataAplicacao: new Date(`${dataStr}T12:00:00`),
                operador: params.responsavel ? params.responsavel.trim() : '',
                alvo: params.alvo ? params.alvo.trim() : '',
                observacoes: params.observacoes ? params.observacoes.trim() : '',
                criadoViaIA: true,
                atualizadoEm: new Date()
            };

            await setDoc(doc(db, 'users', userUid, 'pulverizacoes', docId), docData);

            return JSON.stringify({
                success: true,
                message: `🌱 Aplicação de ${docData.produto} no ${docData.talhao} registrada com sucesso!`,
                registro: {
                    id: docId,
                    talhao: docData.talhao,
                    produto: docData.produto,
                    doseHa: docData.doseHa,
                    dataAplicacao: dataStr
                }
            });
        } catch (e) {
            console.error('Erro ao salvar pulverização:', e);
            return JSON.stringify({ error: `Falha ao salvar pulverização: ${e.message}` });
        }
    },
};

/**
 * Cliente Groq unificado usando a SDK Oficial `groq-sdk`
 */
class UnifiedGroqClient {
    /**
     * Chat completion padrão e sistemas de busca web com fallback resiliente via Groq SDK
     */
    async chat({ model, messages, tools, tool_choice, temperature = 0.3, search_settings, max_tokens }) {
        const modelMeta = GROQ_MODELS.find(m => m.id === model);
        const allowTools = modelMeta ? modelMeta.supportsCustomTools : false;

        const payload = {
            model,
            messages,
            temperature,
            ...(allowTools && tools && tools.length > 0 && { tools, tool_choice: tool_choice || 'auto' }),
            ...(search_settings && { search_settings }),
            ...(max_tokens && { max_tokens }),
        };

        try {
            return await groq.chat.completions.create(payload);
        } catch (error) {
            const errMsg = error.message || '';
            const statusCode = error.status || error.statusCode || 0;

            // 413: payload muito grande — não adianta retentar com o mesmo conteúdo
            if (statusCode === 413 || errMsg.includes('413') || errMsg.toLowerCase().includes('too large') || errMsg.toLowerCase().includes('request_too_large')) {
                throw Object.assign(error, {
                    friendlyMessage: '⚠️ Mensagem muito longa ou imagem muito grande para o modelo selecionado. Tente reduzir o histórico, compactar a imagem ou usar um modelo com contexto maior.'
                });
            }

            // 400: Se o erro foi especificamente por causa de ferramentas não suportadas, tenta sem tools
            if (payload.tools && (errMsg.toLowerCase().includes('tool') || errMsg.toLowerCase().includes('function'))) {
                delete payload.tools;
                delete payload.tool_choice;
                try {
                    return await groq.chat.completions.create(payload);
                } catch (retryError) {
                    const retryStatus = retryError.status || retryError.statusCode || 0;
                    if (retryStatus === 413 || (retryError.message || '').toLowerCase().includes('too large')) {
                        throw Object.assign(retryError, {
                            friendlyMessage: '⚠️ Payload ainda muito grande após remover ferramentas. Reduza o histórico de mensagens ou o tamanho da imagem.'
                        });
                    }
                    throw retryError;
                }
            }

            // 400: Se o erro foi especificamente por causa de search_settings não suportado, remove e tenta
            if (payload.search_settings && (errMsg.toLowerCase().includes('search_settings') || errMsg.toLowerCase().includes('search'))) {
                delete payload.search_settings;
                return await groq.chat.completions.create(payload);
            }

            throw error;
        }
    }

    /**
     * Análise multimodal de imagens com modelos multimodais ativos e fallback resiliente
     */
    async analyzeImages({ model = 'qwen/qwen3.6-27b', prompt, imageBase64List = [], temperature = 0.2 }) {
        const content = [
            { type: 'text', text: prompt || 'Analise detalhadamente esta imagem agronômica:' },
            ...imageBase64List.map((b64) => ({
                type: 'image_url',
                image_url: {
                    url: b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`,
                },
            })),
        ];

        const visionCandidates = [
            model,
            'qwen/qwen3.6-27b',
        ];

        const uniqueModels = [...new Set(visionCandidates.filter(Boolean))];
        let lastError = null;

        for (const candidate of uniqueModels) {
            try {
                return await groq.chat.completions.create({
                    model: candidate,
                    messages: [{ role: 'user', content }],
                    temperature,
                    max_completion_tokens: 2048,
                });
            } catch (err) {
                console.warn(`Tentativa de visão com ${candidate} falhou:`, err.message);
                lastError = err;
            }
        }

        throw lastError || new Error("Falha na análise de visão.");
    }

    /**
     * Transcrição de áudio via Groq Whisper (whisper-large-v3-turbo) via Groq SDK
     */
    async transcribeAudio({ audioBlob, model = 'whisper-large-v3-turbo', language = 'pt', prompt = 'Agronomia, soja, milho, defensivos, colheita' }) {
        const file = new File([audioBlob], 'audio.webm', { type: audioBlob.type || 'audio/webm' });
        return await groq.audio.transcriptions.create({
            file,
            model,
            language,
            prompt,
            response_format: 'json',
        });
    }

    /**
     * Síntese de texto em áudio via Groq TTS
     */
    async generateSpeech({ text, model = 'canopylabs/orpheus-v1-english', voice = 'troy', response_format = 'wav' }) {
        if (groq.audio?.speech?.create) {
            const response = await groq.audio.speech.create({
                model,
                input: text,
                voice,
                response_format,
            });
            const arrayBuffer = await response.arrayBuffer();
            return new Blob([arrayBuffer], { type: 'audio/wav' });
        } else {
            throw new Error("TTS não suportado na versão atual da SDK");
        }
    }
}

export const groqClient = new UnifiedGroqClient();

/**
 * Utilitário Web Speech Synthesis para fala nativa em Português Brasileiro (pt-BR)
 */
export const speakTextNative = (text, { onEnd, onError } = {}) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
        console.warn('SpeechSynthesis não suportado neste navegador.');
        return null;
    }

    window.speechSynthesis.cancel(); // cancela falas anteriores

    // Remove tags markdown ou formatações para fala natural
    const cleanText = text
        .replace(/[*_#`~\[\]()]/g, ' ')
        .replace(/https?:\/\/\S+/g, 'link web')
        .replace(/\n+/g, '. ')
        .slice(0, 1000);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    // Tenta encontrar uma voz pt-BR natural
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find((v) => v.lang.includes('pt-BR') || v.lang.includes('pt_BR') || v.lang.includes('pt'));
    if (ptVoice) utterance.voice = ptVoice;

    if (onEnd) utterance.onend = onEnd;
    if (onError) utterance.onerror = onError;

    window.speechSynthesis.speak(utterance);
    return utterance;
};

export const stopNativeSpeech = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
};

import { initializeApp } from "firebase/app";
import {
    createUserWithEmailAndPassword,
    getAuth,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signOut,
    updateProfile
} from 'firebase/auth';
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    writeBatch
} from 'firebase/firestore';
import {
    deleteObject,
    getDownloadURL,
    getStorage,
    ref,
    uploadBytes
} from 'firebase/storage';

// ========================================================================
// CONFIGURAÇÃO E INICIALIZAÇÃO DO FIREBASE
// ========================================================================

const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Validação de segurança básica para garantir que as variáveis de ambiente foram carregadas
if (!firebaseConfig.apiKey) {
    console.error("Erro Crítico: Chave da API do Firebase não encontrada. Verifique suas variáveis de ambiente (.env).");
}

const app = initializeApp(firebaseConfig);

// Inicialização dos serviços (Singleton)
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// ========================================================================
// EXPORTAÇÕES DE AUTENTICAÇÃO
// ========================================================================

export {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signOut,
    updateProfile
};

// ========================================================================
// ÍNDICES E ESQUEMAS DO FIRESTORE (FIRESTORE_INDEXES & COLLECTION_SCHEMAS)
// Definições de índices compostos e esquemas de dados de todas as telas,
// módulos da fazenda, chatbot com IA e controle de propriedades.
// ========================================================================

/**
 * Definições oficiais de índices compostos do Firestore (padrão firestore.indexes.json).
 * Permite consultas otimizadas, sem erros de "FAILED_PRECONDITION: The query requires an index".
 */
export const FIRESTORE_INDEXES = {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    indexes: [
        // --------------------------------------------------------------------
        // 1. MÓDULO: PULVERIZAÇÃO (Screens/PulverizacaoScreen.jsx)
        // --------------------------------------------------------------------
        {
            collectionGroup: "pulverizacoes",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "dataAplicacao", order: "DESCENDING" }
            ]
        },
        {
            collectionGroup: "pulverizacoes",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "talhao", order: "ASCENDING" },
                { fieldPath: "dataAplicacao", order: "DESCENDING" }
            ]
        },
        {
            collectionGroup: "pulverizacoes",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "status", order: "ASCENDING" },
                { fieldPath: "dataAplicacao", order: "DESCENDING" }
            ]
        },
        {
            collectionGroup: "pulverizacoes",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "pragaAlvo", order: "ASCENDING" },
                { fieldPath: "dataAplicacao", order: "DESCENDING" }
            ]
        },

        // --------------------------------------------------------------------
        // 2. MÓDULO: PLANTIO (Screens/PlantioColheitaScreen.jsx - Tab Plantios)
        // --------------------------------------------------------------------
        {
            collectionGroup: "plantios",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "dataPlantio", order: "DESCENDING" }
            ]
        },
        {
            collectionGroup: "plantios",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "talhao", order: "ASCENDING" },
                { fieldPath: "dataPlantio", order: "DESCENDING" }
            ]
        },
        {
            collectionGroup: "plantios",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "safra", order: "DESCENDING" },
                { fieldPath: "dataPlantio", order: "DESCENDING" }
            ]
        },
        {
            collectionGroup: "plantios",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "cultura", order: "ASCENDING" },
                { fieldPath: "dataPlantio", order: "DESCENDING" }
            ]
        },

        // --------------------------------------------------------------------
        // 3. MÓDULO: COLHEITA (Screens/PlantioColheitaScreen.jsx - Tab Colheitas)
        // --------------------------------------------------------------------
        {
            collectionGroup: "colheitas",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "dataColheita", order: "DESCENDING" }
            ]
        },
        {
            collectionGroup: "colheitas",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "talhao", order: "ASCENDING" },
                { fieldPath: "dataColheita", order: "DESCENDING" }
            ]
        },
        {
            collectionGroup: "colheitas",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "safra", order: "DESCENDING" },
                { fieldPath: "dataColheita", order: "DESCENDING" }
            ]
        },
        {
            collectionGroup: "colheitas",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "produtividadeScHa", order: "DESCENDING" }
            ]
        },

        // --------------------------------------------------------------------
        // 4. MÓDULO: REVISÕES & MANUTENÇÃO (Screens/RevisoesScreen.jsx)
        // --------------------------------------------------------------------
        {
            collectionGroup: "revisoes",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "dataRevisao", order: "DESCENDING" }
            ]
        },
        {
            collectionGroup: "revisoes",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "status", order: "ASCENDING" },
                { fieldPath: "dataRevisao", order: "DESCENDING" }
            ]
        },
        {
            collectionGroup: "revisoes",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "maquina", order: "ASCENDING" },
                { fieldPath: "dataRevisao", order: "DESCENDING" }
            ]
        },
        {
            collectionGroup: "revisoes",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "tipo", order: "ASCENDING" },
                { fieldPath: "dataRevisao", order: "DESCENDING" }
            ]
        },

        // --------------------------------------------------------------------
        // 5. MÓDULO: DIESEL & ABASTECIMENTOS (Screens/DieselScreen.jsx)
        // --------------------------------------------------------------------
        {
            collectionGroup: "diesel",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "data", order: "DESCENDING" }
            ]
        },
        {
            collectionGroup: "diesel",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "tipo", order: "ASCENDING" },
                { fieldPath: "data", order: "DESCENDING" }
            ]
        },
        {
            collectionGroup: "diesel",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "maquina", order: "ASCENDING" },
                { fieldPath: "data", order: "DESCENDING" }
            ]
        },
        {
            collectionGroup: "diesel",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "fornecedor", order: "ASCENDING" },
                { fieldPath: "data", order: "DESCENDING" }
            ]
        },

        // --------------------------------------------------------------------
        // 6. MÓDULO: ALMOXARIFADO / ESTOQUE GERAL (Screens/ManagerScreen.jsx)
        // --------------------------------------------------------------------
        {
            collectionGroup: "estoqueGeral",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "nome", order: "ASCENDING" }
            ]
        },
        {
            collectionGroup: "estoqueGeral",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "tipo", order: "ASCENDING" },
                { fieldPath: "nome", order: "ASCENDING" }
            ]
        },
        {
            collectionGroup: "estoqueGeral",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "categoria", order: "ASCENDING" },
                { fieldPath: "nome", order: "ASCENDING" }
            ]
        },
        {
            collectionGroup: "estoqueGeral",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "quantidade", order: "ASCENDING" }
            ]
        },

        // --------------------------------------------------------------------
        // 7. MÓDULO: PLUVIÔMETRO & CHUVAS (Screens/PorcentagemPluviometroScreen.jsx)
        // --------------------------------------------------------------------
        {
            collectionGroup: "pluviometro",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "dataMedicao", order: "DESCENDING" }
            ]
        },
        {
            collectionGroup: "pluviometro",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "talhao", order: "ASCENDING" },
                { fieldPath: "dataMedicao", order: "DESCENDING" }
            ]
        },
        {
            collectionGroup: "pluviometro",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "milimetros", order: "DESCENDING" }
            ]
        },

        // --------------------------------------------------------------------
        // 8. MÓDULO: % ANDAMENTO DA SAFRA (Screens/PorcentagemPluviometroScreen.jsx)
        // --------------------------------------------------------------------
        {
            collectionGroup: "porcentagens",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "dataAtualizacao", order: "DESCENDING" }
            ]
        },
        {
            collectionGroup: "porcentagens",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "safra", order: "DESCENDING" },
                { fieldPath: "dataAtualizacao", order: "DESCENDING" }
            ]
        },

        // --------------------------------------------------------------------
        // 9. MÓDULO: TALHÕES & MAPAS (Screens/ManagerScreen.jsx & HomeScreen.jsx)
        // --------------------------------------------------------------------
        {
            collectionGroup: "talhoes",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "nome", order: "ASCENDING" }
            ]
        },
        {
            collectionGroup: "talhoes",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "area", order: "DESCENDING" }
            ]
        },
        {
            collectionGroup: "talhoes",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "status", order: "ASCENDING" },
                { fieldPath: "nome", order: "ASCENDING" }
            ]
        },

        // --------------------------------------------------------------------
        // 10. MÓDULO: INVENTÁRIO DE MÁQUINAS (Screens/ManagerScreen.jsx)
        // --------------------------------------------------------------------
        {
            collectionGroup: "inventario",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "marca", order: "ASCENDING" }
            ]
        },
        {
            collectionGroup: "inventario",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "tipo", order: "ASCENDING" },
                { fieldPath: "marca", order: "ASCENDING" }
            ]
        },
        {
            collectionGroup: "inventario",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "ano", order: "DESCENDING" }
            ]
        },
        {
            collectionGroup: "inventario",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "status", order: "ASCENDING" },
                { fieldPath: "marca", order: "ASCENDING" }
            ]
        },

        // --------------------------------------------------------------------
        // 11. MÓDULO: MANUAIS TÉCNICOS (Screens/ManuaisScreen.jsx)
        // --------------------------------------------------------------------
        {
            collectionGroup: "manuais",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "titulo", order: "ASCENDING" }
            ]
        },
        {
            collectionGroup: "manuais",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "categoria", order: "ASCENDING" },
                { fieldPath: "titulo", order: "ASCENDING" }
            ]
        },
        {
            collectionGroup: "manuais",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "marca", order: "ASCENDING" },
                { fieldPath: "titulo", order: "ASCENDING" }
            ]
        },
        {
            collectionGroup: "manualCategorias",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "nome", order: "ASCENDING" }
            ]
        },

        // --------------------------------------------------------------------
        // 12. MÓDULO: USUÁRIOS & PROPRIEDADES (services/propertyService.js)
        // --------------------------------------------------------------------
        {
            collectionGroup: "users",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "codigoPropriedade", order: "ASCENDING" },
                { fieldPath: "role", order: "ASCENDING" }
            ]
        },
        {
            collectionGroup: "users",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "email", order: "ASCENDING" }
            ]
        },
        {
            collectionGroup: "membros",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "criadoEm", order: "DESCENDING" }
            ]
        },
        {
            collectionGroup: "membros",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "role", order: "ASCENDING" },
                { fieldPath: "criadoEm", order: "DESCENDING" }
            ]
        },

        // --------------------------------------------------------------------
        // 13. MÓDULO: CHATBOT & IA AGRONÔMICA (components/AgronomiaChatbot.jsx)
        // --------------------------------------------------------------------
        {
            collectionGroup: "chatbot_conversas",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "atualizadoEm", order: "DESCENDING" }
            ]
        },
        {
            collectionGroup: "chatbot_conversas",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "criadoEm", order: "DESCENDING" }
            ]
        },
        {
            collectionGroup: "chatbot_mensagens",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "timestamp", order: "ASCENDING" }
            ]
        },
        {
            collectionGroup: "chatbot_mensagens",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "role", order: "ASCENDING" },
                { fieldPath: "timestamp", order: "ASCENDING" }
            ]
        },
        {
            collectionGroup: "consultas_ia",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "data", order: "DESCENDING" }
            ]
        },
        {
            collectionGroup: "consultas_ia",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "topico", order: "ASCENDING" },
                { fieldPath: "data", order: "DESCENDING" }
            ]
        },
        {
            collectionGroup: "consultas_ia",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "tipoDiagnostico", order: "ASCENDING" },
                { fieldPath: "data", order: "DESCENDING" }
            ]
        },

        // --------------------------------------------------------------------
        // 14. MÓDULO: LOGS DE AUDITORIA & METADADOS
        // --------------------------------------------------------------------
        {
            collectionGroup: "auditoria_logs",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "dataHora", order: "DESCENDING" }
            ]
        },
        {
            collectionGroup: "auditoria_logs",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "modulo", order: "ASCENDING" },
                { fieldPath: "dataHora", order: "DESCENDING" }
            ]
        },
        {
            collectionGroup: "auditoria_logs",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "tipoAcao", order: "ASCENDING" },
                { fieldPath: "dataHora", order: "DESCENDING" }
            ]
        }
    ],
    fieldOverrides: []
};

/**
 * Dicionário completo de esquemas e metadados das coleções do sistema W3Labs-Agro.
 */
export const COLLECTION_SCHEMAS = {
    pulverizacoes: {
        screen: "PulverizacaoScreen",
        name: "Pulverizações & Calda",
        icon: "SprayCan",
        primarySort: { field: "dataAplicacao", direction: "desc" },
        fields: ["id", "talhao", "produto", "dosagem", "volumeCaldaHa", "pragaAlvo", "responsavel", "dataAplicacao", "status", "observacoes", "criadoEm"],
        sample: { talhao: "Talhão 01", produto: "Fungicida X", dosagem: "0.5 L/ha", volumeCaldaHa: 120, status: "Concluída" }
    },
    plantios: {
        screen: "PlantioColheitaScreen",
        name: "Plantio & Variedades",
        icon: "Sprout",
        primarySort: { field: "dataPlantio", direction: "desc" },
        fields: ["id", "talhao", "cultura", "variedade", "areaHa", "populacaoPlantasHa", "espacamentoCm", "safra", "dataPlantio", "status", "observacoes", "criadoEm"],
        sample: { talhao: "Talhão 02", cultura: "Soja", variedade: "BMX Potência", areaHa: 45, safra: "2025/2026" }
    },
    colheitas: {
        screen: "PlantioColheitaScreen",
        name: "Colheita & Produtividade",
        icon: "Wheat",
        primarySort: { field: "dataColheita", direction: "desc" },
        fields: ["id", "talhao", "cultura", "areaColhidaHa", "pesoBrutoKg", "umidadePerc", "impurezaPerc", "sacasTotais", "produtividadeScHa", "safra", "dataColheita", "observacoes", "criadoEm"],
        sample: { talhao: "Talhão 02", cultura: "Soja", areaColhidaHa: 45, sacasTotais: 3150, produtividadeScHa: 70, safra: "2025/2026" }
    },
    revisoes: {
        screen: "RevisoesScreen",
        name: "Revisões & Manutenção de Frota",
        icon: "Wrench",
        primarySort: { field: "dataRevisao", direction: "desc" },
        fields: ["id", "maquina", "tipo", "horimetroKm", "descricaoServico", "oficinaMecanico", "custoPecas", "custoMaoObra", "custoTotal", "status", "dataRevisao", "proximaRevisaoHorimetro", "criadoEm"],
        sample: { maquina: "Trator John Deere 6110J", tipo: "Preventiva", horimetroKm: 1500, status: "Concluída", custoTotal: 2500 }
    },
    diesel: {
        screen: "DieselScreen",
        name: "Controle de Diesel",
        icon: "Fuel",
        primarySort: { field: "data", direction: "desc" },
        fields: ["id", "tipo", "fornecedor", "maquina", "quantidadeLitros", "valorTotal", "horimetroKm", "operador", "data", "observacoes", "criadoEm"],
        sample: { tipo: "saida", maquina: "Colheitadeira S680", quantidadeLitros: 350, operador: "João Silva", horimetroKm: "820" }
    },
    estoqueGeral: {
        screen: "ManagerScreen",
        name: "Almoxarifado & Estoque",
        icon: "Warehouse",
        primarySort: { field: "nome", direction: "asc" },
        fields: ["id", "nome", "tipo", "categoria", "quantidade", "unidadeMedida", "precoUnitario", "localizacao", "estoqueMinimo", "atualizadoEm", "criadoEm"],
        sample: { nome: "Óleo 15W40", tipo: "Insumo", quantidade: 120, unidadeMedida: "Litros", precoUnitario: 28.50 }
    },
    pluviometro: {
        screen: "PorcentagemPluviometroScreen",
        name: "Pluviômetro & Chuvas",
        icon: "CloudRain",
        primarySort: { field: "dataMedicao", direction: "desc" },
        fields: ["id", "milimetros", "talhao", "dataMedicao", "observacoes", "criadoViaIA", "criadoEm"],
        sample: { milimetros: 42.5, talhao: "Sede", dataMedicao: "2026-02-15" }
    },
    porcentagens: {
        screen: "PorcentagemPluviometroScreen",
        name: "% Andamento da Safra",
        icon: "Percent",
        primarySort: { field: "dataAtualizacao", direction: "desc" },
        fields: ["id", "safra", "talhao", "preparoSolo", "plantio", "desenvolvimento", "colheita", "dataAtualizacao", "criadoEm"],
        sample: { safra: "2025/2026", talhao: "Geral", plantio: 100, desenvolvimento: 65, colheita: 10 }
    },
    talhoes: {
        screen: "ManagerScreen",
        name: "Talhões & Georreferenciamento",
        icon: "Compass",
        primarySort: { field: "nome", direction: "asc" },
        fields: ["id", "nome", "area", "culturaAtual", "tipoSolo", "coordenadas", "poligonoGeoJson", "status", "criadoEm"],
        sample: { nome: "Talhão 01 - Sede", area: 55.4, culturaAtual: "Soja", status: "Ativo" }
    },
    inventario: {
        screen: "ManagerScreen",
        name: "Inventário & Máquinas",
        icon: "Sliders",
        primarySort: { field: "marca", direction: "asc" },
        fields: ["id", "marca", "modelo", "tipo", "ano", "chassiPlaca", "horimetroAtual", "status", "dataAquisicao", "valorAquisicao", "criadoEm"],
        sample: { marca: "John Deere", modelo: "8R 370", tipo: "Trator", ano: 2023, horimetroAtual: 1250 }
    },
    manuais: {
        screen: "ManuaisScreen",
        name: "Biblioteca de Manuais & PDFs",
        icon: "BookOpen",
        primarySort: { field: "titulo", direction: "asc" },
        fields: ["id", "titulo", "categoria", "marca", "modelo", "arquivoUrl", "storagePath", "tamanhoBytes", "descricao", "criadoEm"],
        sample: { titulo: "Manual do Operador JD 8R", categoria: "Tratores", marca: "John Deere", modelo: "8R 370" }
    },
    manualCategorias: {
        screen: "ManuaisScreen",
        name: "Marcas e Categorias de Manuais",
        icon: "BookOpen",
        primarySort: { field: "nome", direction: "asc" },
        fields: ["id", "nome", "imagem", "ordem", "criadoEm"],
        sample: { nome: "John Deere", imagem: "https://..." }
    },
    users: {
        screen: "LoginScreen",
        name: "Usuários & Propriedades",
        icon: "Users",
        primarySort: { field: "email", direction: "asc" },
        fields: ["uid", "email", "nome", "role", "propriedadeNome", "codigoPropriedade", "adminUid", "criadoEm"],
        sample: { email: "produtor@agro.com", role: "admin", propriedadeNome: "Fazenda Progresso", codigoPropriedade: "FZ-9X2Y" }
    },
    membros: {
        screen: "PropertyControlModal",
        name: "Membros da Equipe",
        icon: "UserCheck",
        primarySort: { field: "criadoEm", direction: "desc" },
        fields: ["uid", "email", "nome", "role", "status", "vinculadoEm", "criadoEm"],
        sample: { nome: "Carlos Oliveira", role: "member", status: "ativo" }
    },
    chatbot_conversas: {
        screen: "AgronomiaChatbot",
        name: "Conversas do Chatbot IA",
        icon: "Bot",
        primarySort: { field: "atualizadoEm", direction: "desc" },
        fields: ["id", "titulo", "modeloIa", "criadoEm", "atualizadoEm"],
        sample: { titulo: "Diagnóstico de Ferrugem Asiática no Talhão 02", modeloIa: "llama-3.3-70b-versatile" }
    },
    chatbot_mensagens: {
        screen: "AgronomiaChatbot",
        name: "Mensagens do Chatbot IA",
        icon: "MessageSquare",
        primarySort: { field: "timestamp", direction: "asc" },
        fields: ["id", "role", "content", "toolCalls", "timestamp"],
        sample: { role: "assistant", content: "Recomendo a aplicação de fungicida..." }
    },
    consultas_ia: {
        screen: "AgronomiaChatbot",
        name: "Consultas & Diagnósticos de IA",
        icon: "Sparkles",
        primarySort: { field: "data", direction: "desc" },
        fields: ["id", "topico", "tipoDiagnostico", "pergunta", "resposta", "dadosContexto", "data", "criadoEm"],
        sample: { topico: "pulverizacoes", tipoDiagnostico: "compatibilidade_calda", data: "2026-02-15" }
    },
    auditoria_logs: {
        screen: "ManagerScreen",
        name: "Logs de Auditoria & Atividades",
        icon: "ShieldAlert",
        primarySort: { field: "dataHora", direction: "desc" },
        fields: ["id", "modulo", "tipoAcao", "documentoId", "usuarioUid", "usuarioNome", "detalhes", "dataHora"],
        sample: { modulo: "diesel", tipoAcao: "abastecimento", usuarioNome: "Admin", dataHora: new Date() }
    }
};

/**
 * Constrói uma consulta do Firestore indexada e tipada com base nos padrões estabelecidos.
 * @param {string} collectionName - Nome da coleção (ex: 'pulverizacoes', 'diesel').
 * @param {string} customUid - UID do usuário ou do Administrador da Propriedade (effectiveUid).
 * @param {object} options - Opções de consulta { filters: [{field, op, value}], orderByField, orderDir, limitCount }.
 * @returns {import('firebase/firestore').Query} Consulta pronta para getDocs ou onSnapshot.
 */
export function buildIndexedQuery(collectionName, customUid = null, options = {}) {
    const uid = customUid || auth.currentUser?.uid;
    if (!uid) {
        throw new Error("UID do usuário é obrigatório para construir a consulta indexada.");
    }

    const collectionRef = collection(db, 'users', uid, collectionName);
    const queryConstraints = [];

    // 1. Aplica filtros where
    if (Array.isArray(options.filters)) {
        options.filters.forEach(f => {
            if (f && f.field && f.op && f.value !== undefined) {
                queryConstraints.push(where(f.field, f.op, f.value));
            }
        });
    }

    // 2. Aplica ordenação (utiliza a ordenação padrão do esquema se não especificada)
    const schema = COLLECTION_SCHEMAS[collectionName];
    const sortField = options.orderByField || schema?.primarySort?.field;
    const sortDir = options.orderDir || schema?.primarySort?.direction || 'desc';

    if (sortField) {
        queryConstraints.push(orderBy(sortField, sortDir));
    }

    // 3. Aplica limite
    if (options.limitCount && typeof options.limitCount === 'number') {
        queryConstraints.push(limit(options.limitCount));
    }

    return query(collectionRef, ...queryConstraints);
}

/**
 * Retorna os índices cadastrados para uma coleção específica.
 * @param {string} collectionName 
 * @returns {Array} Lista de índices associados à coleção.
 */
export function getCollectionIndexes(collectionName) {
    return FIRESTORE_INDEXES.indexes.filter(idx => idx.collectionGroup === collectionName);
}

/**
 * Gera a string JSON completa formatada de acordo com o padrão `firestore.indexes.json` do Firebase CLI.
 * @returns {string} JSON pronto para deploy do Firestore.
 */
export function generateFirestoreIndexesJson() {
    return JSON.stringify(FIRESTORE_INDEXES, null, 2);
}

// ========================================================================
// SERVIÇO DO FIRESTORE (CRUD + REAL-TIME)
// ========================================================================

/**
 * Busca todos os documentos de uma coleção específica do usuário.
 * Garante isolamento de dados por UID.
 * @param {string} collectionName - O nome da coleção (ex: 'inventario').
 * @param {string} customUid - UID opcional (ex: effectiveUid de propriedade compartilhada).
 * @returns {Promise<{success: boolean, data?: any[], error?: Error}>} Objeto com o resultado.
 */
export async function getItems(collectionName, customUid = null) {
    const userUid = customUid || auth.currentUser?.uid;
    if (!userUid) return { success: false, error: new Error("Usuário não autenticado.") };

    try {
        const schema = COLLECTION_SCHEMAS[collectionName];
        let q;
        if (schema?.primarySort?.field) {
            q = query(
                collection(db, 'users', userUid, collectionName),
                orderBy(schema.primarySort.field, schema.primarySort.direction || 'asc')
            );
        } else {
            q = query(collection(db, 'users', userUid, collectionName));
        }

        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return { success: true, data };
    } catch (error) {
        console.error(`[Firestore Error] ao buscar itens de ${collectionName}:`, error);
        return { success: false, error };
    }
}

/**
 * Cria ou atualiza um documento em uma coleção específica do usuário.
 * Implementa lógica de 'Upsert' e timestamps automáticos.
 * @param {string} collectionName - O nome da coleção (ex: 'inventario').
 * @param {object} itemData - O objeto de dados a ser salvo.
 * @param {boolean} isEditing - True se for uma atualização.
 * @param {string} customUid - UID opcional (ex: effectiveUid).
 * @returns {Promise<{success: boolean, id?: string, error?: Error}>} Objeto com o resultado.
 */
export async function addOrUpdateItem(collectionName, itemData, isEditing, customUid = null) {
    const userUid = customUid || auth.currentUser?.uid;
    if (!userUid) return { success: false, error: new Error("Usuário não autenticado.") };
    try {
        let docRef;
        let docId;

        if (isEditing) {
            docId = itemData.id;
            if (!docId) {
                console.error(`[Firestore Error] Tentativa de atualização sem ID em ${collectionName}.`, itemData);
                return { success: false, error: new Error("ID do item é inválido ou não fornecido para atualização.") };
            }
            docRef = doc(db, 'users', userUid, collectionName, docId);
        } else {
            docRef = doc(collection(db, 'users', userUid, collectionName));
            docId = docRef.id;
        }

        const dataToSave = {
            ...itemData,
            id: docId,
            userUid,
            atualizadoEm: serverTimestamp(),
        };

        if (isEditing) {
            await updateDoc(docRef, dataToSave);
            console.log(`[Firestore] Documento ${docId} atualizado em ${collectionName}.`);
        } else {
            dataToSave.criadoEm = serverTimestamp();
            await setDoc(docRef, dataToSave);
            console.log(`[Firestore] Documento ${docId} criado em ${collectionName}.`);
        }
        return { success: true, id: docId };
    } catch (error) {
        console.error(`[Firestore Error] em ${collectionName}:`, error);
        return { success: false, error };
    }
}

/**
 * Deleta um documento do Firestore.
 * @param {string} collectionName - O nome da coleção.
 * @param {string} itemId - O ID do documento a ser deletado.
 * @param {string} customUid - UID opcional (ex: effectiveUid).
 * @returns {Promise<{success: boolean, error?: Error}>} Objeto com o resultado.
 */
export async function deleteItem(collectionName, itemId, customUid = null) {
    const userUid = customUid || auth.currentUser?.uid;
    if (!userUid) return { success: false, error: new Error("Usuário não autenticado.") };

    try {
        const docRef = doc(db, 'users', userUid, collectionName, itemId);
        await deleteDoc(docRef);
        console.log(`[Firestore] Documento ${itemId} deletado de ${collectionName}.`);
        return { success: true };
    } catch (error) {
        console.error(`[Firestore Error] ao deletar de ${collectionName}:`, error);
        return { success: false, error };
    }
}

/**
 * Inscreve-se para escutar atualizações em tempo real de uma coleção.
 * @param {string} collectionName - O nome da coleção a ser observada.
 * @param {function} callback - Função chamada com os novos dados.
 * @param {string} customUid - UID opcional (ex: effectiveUid).
 * @returns {function} Função para cancelar a inscrição (unsubscribe).
 */
export function subscribeToCollection(collectionName, callback, customUid = null) {
    const userUid = customUid || auth.currentUser?.uid;
    if (!userUid) {
        console.error("Usuário não autenticado para inscrição em tempo real.");
        return () => {};
    }

    const schema = COLLECTION_SCHEMAS[collectionName];
    let q;
    if (schema?.primarySort?.field) {
        q = query(
            collection(db, 'users', userUid, collectionName),
            orderBy(schema.primarySort.field, schema.primarySort.direction || 'asc')
        );
    } else {
        q = query(collection(db, 'users', userUid, collectionName));
    }

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(data);
    }, (error) => {
        console.error(`[Firestore Real-time Error] em ${collectionName}:`, error);
    });

    return unsubscribe;
}

// ========================================================================
// SERVIÇO DE ARMAZENAMENTO (STORAGE)
// ========================================================================

/**
 * Faz upload de um arquivo para o Firebase Storage.
 * @param {string} fileUri - O URI local do arquivo.
 * @param {string} path - O caminho no Storage (ex: 'manuais/arquivo.pdf').
 * @returns {Promise<string>} A URL de download do arquivo.
 */
export const uploadFile = async (fileUri, path) => {
    const userUid = auth.currentUser?.uid;
    if (!userUid) throw new Error("Usuário não autenticado.");

    try {
        const storageRef = ref(storage, `users/${userUid}/${path}`);
        const response = await fetch(fileUri);
        const blob = await response.blob();
        await uploadBytes(storageRef, blob);
        return await getDownloadURL(storageRef);
    } catch (error) {
        console.error("Erro no upload do arquivo:", error);
        throw error;
    }
};

/**
 * Deleta um arquivo do Firebase Storage a partir da sua URL de download.
 * @param {string} fileUrl - A URL completa do arquivo a ser deletado.
 */
export const deleteFileByUrl = async (fileUrl) => {
    if (!fileUrl) return;
    try {
        const storageRef = ref(storage, fileUrl);
        await deleteObject(storageRef);
    } catch (error) {
        if (error.code !== 'storage/object-not-found') {
            console.error("Erro ao deletar o arquivo:", error);
        }
    }
};

// ========================================================================
// SERVIÇO DE DADOS INICIAIS (SEED) & BACKUP
// ========================================================================

export const INITIAL_MANUAL_CATEGORIES = [
    { nome: 'Stara', imagem: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS6qtq1SIy-BWZWxleQCqe6Mb8ZT8_dCqbJew&s' },
    { nome: 'New Holland', imagem: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQZkPs8GKQdNNkyPBdmsZSB1VBMwwkasYLrOQ&s' },
    { nome: 'John Deere', imagem: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRZ6TvOxu0S0PvFLB-g8jP5Kvj1QwlVVf4B-A&s' },
    { nome: 'Case IH', imagem: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRjuqQ4DdHXUS2gV8Q0QaNZHZs2fFacEJU7jw&s' },
    { nome: 'Massey Ferguson', imagem: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTZI4AD6PNsAxRyV605Fo7h_QlyJIAnl7bZfg&s' },
    { nome: 'Valtra', imagem: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQdjxN9pqkBIHPNpJWzqFklWyWsnwkE9Zwc5w&s' },
    { nome: 'Jacto', imagem: 'https://jacto.com/assets/imgs/meta-image_c4a3a10168dd05886a9d.png' },
];

/**
 * Cria as categorias de manuais no Firestore para um novo usuário, se ainda não existirem.
 * @param {string} userUid - O UID do usuário.
 */
export const seedInitialFirestoreData = async (userUid) => {
    try {
        const docRef = doc(db, 'users', userUid, 'appMetadata', 'initialSeed');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().manualCategoriesSeeded) {
            console.log('Dados iniciais já populados para este usuário.');
            return;
        }

        console.log('Populando categorias de manuais no Firestore para novo usuário...');
        const initialCategories = INITIAL_MANUAL_CATEGORIES;

        const batch = writeBatch(db);
        const timestamp = serverTimestamp();

        initialCategories.forEach(cat => {
            const newDocRef = doc(collection(db, 'users', userUid, 'manualCategorias'));
            batch.set(newDocRef, {
                ...cat,
                id: newDocRef.id,
                userUid,
                criadoEm: timestamp,
                atualizadoEm: timestamp,
            });
        });

        batch.set(docRef, { manualCategoriesSeeded: true, timestamp: serverTimestamp() });

        await batch.commit();
        console.log('Criação de categorias iniciais no Firestore concluída.');
    } catch (error) {
        console.error("Erro ao criar dados iniciais no Firestore:", error);
    }
};

/**
 * Gera um backup JSON de todas as coleções do usuário.
 * @param {string} customUid - UID opcional (ex: effectiveUid).
 * @returns {Promise<{success: boolean, uri?: string, error?: Error}>}
 */
export const downloadAllUserDataAsJson = async (customUid = null) => {
    const userUid = customUid || auth.currentUser?.uid;
    if (!userUid) {
        return { success: false, error: new Error("Usuário não autenticado.") };
    }

    const collectionsToBackup = Object.keys(COLLECTION_SCHEMAS).filter(k => k !== 'users');

    const allData = {};

    try {
        for (const collectionName of collectionsToBackup) {
            const result = await getItems(collectionName, userUid);
            if (result.success) {
                allData[collectionName] = result.data;
            }
        }

        const jsonString = JSON.stringify(allData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const uri = URL.createObjectURL(blob);
        return { success: true, uri };
    } catch (error) {
        console.error("Erro ao gerar backup de dados:", error);
        return { success: false, error };
    }
};

/**
 * Faz upload de um backup JSON para o Firestore, restaurando os dados.
 * @param {string} jsonString - A string contendo os dados de backup em formato JSON.
 * @param {string} customUid - UID opcional (ex: effectiveUid).
 * @returns {Promise<{success: boolean, error?: Error}>} Objeto com o resultado.
 */
export const uploadUserDataFromJson = async (jsonString, customUid = null) => {
    const userUid = customUid || auth.currentUser?.uid;
    if (!userUid) {
        return { success: false, error: new Error("Usuário não autenticado.") };
    }

    try {
        const data = JSON.parse(jsonString);
        let batch = writeBatch(db);
        let operationCount = 0;

        for (const collectionName in data) {
            if (Object.prototype.hasOwnProperty.call(data, collectionName)) {
                const items = data[collectionName];
                if (Array.isArray(items)) {
                    for (const item of items) {
                        if (item.id) {
                            const docRef = doc(db, 'users', userUid, collectionName, item.id);
                            batch.set(docRef, item);
                            operationCount++;

                            if (operationCount >= 499) {
                                await batch.commit();
                                batch = writeBatch(db);
                                operationCount = 0;
                            }
                        }
                    }
                }
            }
        }

        if (operationCount > 0) {
            await batch.commit();
        }

        return { success: true };
    } catch (error) {
        console.error("Erro ao restaurar backup de dados:", error);
        return { success: false, error };
    }
};

// ========================================================================
// EXPORTAÇÃO PADRÃO (FALLBACK)
// ========================================================================

const FirebaseServices = {
    auth,
    db,
    storage,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
    getItems,
    addOrUpdateItem,
    deleteItem,
    subscribeToCollection,
    uploadFile,
    deleteFileByUrl,
    seedInitialFirestoreData,
    INITIAL_MANUAL_CATEGORIES,
    downloadAllUserDataAsJson,
    uploadUserDataFromJson,
    FIRESTORE_INDEXES,
    COLLECTION_SCHEMAS,
    buildIndexedQuery,
    getCollectionIndexes,
    generateFirestoreIndexesJson
};

export default FirebaseServices;
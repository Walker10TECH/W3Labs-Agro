// -----------------------------------------------------------------------------
// PorcentagemPluviometro.jsx
//
// Módulo de Gestão de Andamento de Atividades (%) e Pluviômetro (mm).
// Adaptado EXCLUSIVAMENTE PARA WEB.
// Integrado ao Firestore, com estatísticas automáticas, gráficos Web e Design W3Labs.
// -----------------------------------------------------------------------------
import React, { useState, useEffect, useMemo } from 'react';
import { collection, doc, getDoc, setDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Chart } from 'react-google-charts';

// Certifique-se de que auth e db estão exportados no seu firebaseConfig
import { auth, db } from '../firebaseConfig';

// =====================================================================
// 1️⃣ CONFIGURAÇÕES, VALIDAÇÕES E TEMA
// =====================================================================

const THEME = {
    primary: '#4CAF50',
    primaryDark: '#388E3C',
    secondary: '#FFFFFF',
    background: '#F9FBF9',    // Cinza/Verde ultra claro para respiro
    textBlack: '#1A1D19',     // Preto mais suave (Off-black)
    textWhite: '#FFFFFF',
    secondaryText: '#4A4A4A', // Cinza médio para subtítulos
    grayInput: '#F0F4F1',     // Fundo dos inputs com leve tom de verde
    border: '#D0D6D0',        // Bordas sutis
    error: '#E53935',
    lightGray: '#F5F5F5'
};

const VALIDATION_CONFIG = {
    minPercentage: 0,
    maxPercentage: 100,
    minMillimeters: 0,
    maxMillimeters: 1000,
    maxTitleLength: 100,
    maxDescriptionLength: 500,
    maxObservationsLength: 300,
};

const ERROR_MESSAGES = {
    REQUIRED_FIELD: 'Campo obrigatório',
    INVALID_PERCENTAGE: 'Deve ser entre 0 e 100',
    INVALID_RAINFALL: 'Deve ser entre 0 e 1000',
    INVALID_NUMBER: 'Valor numérico',
    TITLE_TOO_LONG: `Máx ${VALIDATION_CONFIG.maxTitleLength} caracteres`,
    FUTURE_DATE: 'Data inválida (futuro)',
};

// =====================================================================
// 2️⃣ ÍCONES SVG INLINE (Mobile Web)
// =====================================================================

const Icons = {
    ChevronBack: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>),
    ChevronForward: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>),
    Add: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>),
    Close: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>),
    Calendar: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>),
    Water: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>),
    WaterOutline: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>),
    ChartLine: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>),
    ArrowUp: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>),
    List: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>),
    Trash: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>),
    Tasks: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>),
    CheckCircle: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>),
    WeatherPouring: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path><path d="M16 20l-2 2"></path><path d="M8 20l-2 2"></path><path d="M12 20l-2 2"></path></svg>),
    Leaf: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>)
};

// =====================================================================
// 3️⃣ FUNÇÕES UTILITÁRIAS
// =====================================================================

const parseMoeda = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    let sanitized = value.replace(/[^0-9,.]/g, '');
    if (sanitized.includes(',')) sanitized = sanitized.replace(/\./g, '').replace(',', '.');
    return parseFloat(sanitized) || 0;
};

const formatDate = (date, options = {}) => {
    if (!date) return 'Data inválida';
    try {
        const dateObj = date.toDate ? date.toDate() : (typeof date === 'string' ? new Date(date) : date);
        const defaultOptions = { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' };
        return dateObj.toLocaleDateString('pt-BR', { ...defaultOptions, ...options });
    } catch (error) {
        return 'Data inválida';
    }
};

const calculateRainfallStats = (data) => {
    if (!Array.isArray(data) || data.length === 0) return { total: 0, average: 0, max: 0, min: 0, count: 0 };
    const values = data.map(item => parseFloat(item.milimetros) || 0);
    const total = values.reduce((sum, val) => sum + val, 0);
    return {
        total: parseFloat(total.toFixed(1)),
        average: parseFloat((total / values.length).toFixed(1)),
        max: Math.max(...values),
        min: Math.min(...values),
        count: values.length
    };
};

// =====================================================================
// 4️⃣ COMPONENTES DE UI REUTILIZÁVEIS (CLEAN WEB)
// =====================================================================

const CustomHeader = ({ title, onBack }) => (
    <div style={styles.fullHeader}>
        <div style={styles.headerContent}>
            {onBack ? (
                <button onClick={onBack} style={styles.backButton}>
                    <Icons.ChevronBack size={28} color={THEME.textWhite} />
                </button>
            ) : <div style={{ width: 40 }} />}
            <span style={styles.headerTitle}>{title}</span>
            <div style={{ width: 40 }} />
        </div>
    </div>
);

const FabAdd = ({ onAdd }) => (
    <div style={styles.fabContainer}>
        <button style={styles.fabAdd} onClick={onAdd}>
            <Icons.Add size={30} color={THEME.textWhite} />
        </button>
    </div>
);

const FormInput = ({ label, placeholder, value, onChangeText, required, type = 'text', maxLength, multiline, error }) => (
    <div style={styles.inputContainer}>
        <label style={styles.formLabel}>
            {label} {required && <span style={{ color: THEME.primary }}>*</span>}
        </label>
        {multiline ? (
            <textarea
                style={{ ...styles.input, ...styles.textArea, ...(error ? styles.inputError : {}) }}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChangeText(e.target.value)}
                maxLength={maxLength}
            />
        ) : (
            <input
                type={type}
                inputMode={type === 'number' ? 'decimal' : 'text'}
                style={{ ...styles.input, ...(error ? styles.inputError : {}) }}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChangeText(e.target.value)}
                maxLength={maxLength}
            />
        )}
        {error && <span style={styles.errorText}>{error}</span>}
    </div>
);

const FormDate = ({ label, value, onChange }) => {
    const dateStr = value instanceof Date && !isNaN(value) ? value.toISOString().split('T')[0] : '';
    return (
        <div style={styles.inputContainer}>
            <label style={styles.formLabel}>{label}</label>
            <div style={styles.dateBox}>
                <div style={styles.dateIconWrapper}>
                    <Icons.Calendar size={24} color={THEME.primary} />
                </div>
                <input
                    type="date"
                    style={styles.dateInput}
                    value={dateStr}
                    onChange={(e) => {
                        if (e.target.value) onChange(new Date(`${e.target.value}T12:00:00`));
                    }}
                />
            </div>
        </div>
    );
};

const StatBox = ({ label, value, color, IconComponent }) => (
    <div style={{ ...styles.statBox, borderColor: THEME.border }}>
        <div style={{ ...styles.statIconBadge, backgroundColor: `${color}15` }}>
            <IconComponent size={20} color={color} />
        </div>
        <div style={{ marginLeft: 12 }}>
            <div style={{ ...styles.statValue, color }}>{value}</div>
            <div style={styles.statLabel}>{label}</div>
        </div>
    </div>
);

// =====================================================================
// 5️⃣ MODAIS DE REGISTRO (BOTTOM SHEET STYLE)
// =====================================================================

const BottomSheetHandle = () => (
    <div style={styles.bottomSheetHandleContainer}>
        <div style={styles.bottomSheetHandle} />
    </div>
);

/* --- MODAL: PORCENTAGEM / ANDAMENTO --- */
const AddOrEditPorcentagemModal = ({ itemId, onClose }) => {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [errors, setErrors] = useState({});
    const [data, setData] = useState({ titulo: '', valor: '', descricao: '', dataAtualizacao: new Date() });

    useEffect(() => {
        if (!itemId) return;
        (async () => {
            setLoading(true);
            try {
                const docSnap = await getDoc(doc(db, 'users', auth.currentUser.uid, 'porcentagens', itemId));
                if (docSnap.exists()) {
                    const item = docSnap.data();
                    setData({ ...item, valor: item.valor ? String(item.valor) : '', dataAtualizacao: item.dataAtualizacao?.toDate ? item.dataAtualizacao.toDate() : new Date() });
                }
            } catch (e) { console.error(e); } setLoading(false);
        })();
    }, [itemId]);

    if (!itemId && !loading && !saving && Object.keys(data).length === 0) return null; // Avoid render errors if closed prematurely

    const setField = (field, value) => { 
        setData(prev => ({ ...prev, [field]: value })); 
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null })); 
    };

    const handleSave = async () => {
        const errs = {};
        if (!data.titulo.trim()) errs.titulo = ERROR_MESSAGES.REQUIRED_FIELD;
        const val = parseMoeda(data.valor);
        if (data.valor === '' || isNaN(val) || val < VALIDATION_CONFIG.minPercentage || val > VALIDATION_CONFIG.maxPercentage) errs.valor = ERROR_MESSAGES.INVALID_PERCENTAGE;
        setErrors(errs);
        
        if (Object.keys(errs).length > 0) return window.alert('Por favor, corrija os campos em destaque.');

        setSaving(true);
        try {
            const uid = auth.currentUser.uid;
            const id = itemId || doc(collection(db, 'users', uid, 'porcentagens')).id;
            await setDoc(doc(db, 'users', uid, 'porcentagens', id), { 
                id, titulo: data.titulo.trim(), valor: val, descricao: data.descricao.trim(), dataAtualizacao: new Date() 
            }, { merge: true });
            onClose();
        } catch (e) { window.alert('Falha ao salvar dados.'); }
        setSaving(false);
    };

    const handleDelete = async () => {
        if (window.confirm('Deseja excluir este andamento?')) {
            await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'porcentagens', itemId));
            onClose();
        }
    };

    return (
        <div style={styles.modalOverlay} onClick={onClose}>
            <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                <BottomSheetHandle />
                <div style={styles.modalHeader}>
                    <span style={styles.modalTitle}>{itemId ? 'Editar Andamento' : 'Novo Andamento'}</span>
                    <button style={styles.closeButton} onClick={onClose}>
                        <Icons.Close size={24} color={THEME.textBlack} />
                    </button>
                </div>

                {loading ? <div style={{ margin: '30px 0', textAlign: 'center', color: THEME.primary }}>Carregando...</div> : (
                    <div style={styles.scrollContent}>
                        <FormInput label="Atividade" placeholder="Ex: Plantio da Soja" required value={data.titulo} onChangeText={v => setField('titulo', v)} maxLength={VALIDATION_CONFIG.maxTitleLength} error={errors.titulo} />
                        <FormInput label="Progresso concluído (%)" placeholder="0 a 100" required value={data.valor} onChangeText={v => setField('valor', v.replace(/[^0-9,.]/g, ''))} type="number" maxLength={5} error={errors.valor} />
                        <FormInput label="Observações (Opcional)" placeholder="Detalhes extras sobre a atividade..." value={data.descricao} onChangeText={v => setField('descricao', v)} multiline maxLength={VALIDATION_CONFIG.maxDescriptionLength} />

                        <button style={styles.saveButton} onClick={handleSave} disabled={saving}>
                            {saving ? <span style={{ color: THEME.textWhite }}>Salvando...</span> : <span style={styles.saveButtonText}>Salvar Andamento</span>}
                        </button>
                        
                        {itemId && (
                            <button style={styles.deleteButton} onClick={handleDelete}>
                                <Icons.Trash size={18} color={THEME.error} />
                                <span style={styles.deleteButtonText}>Excluir Andamento</span>
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

/* --- MODAL: PLUVIÔMETRO --- */
const AddOrEditPluviometroModal = ({ itemId, onClose }) => {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [errors, setErrors] = useState({});
    const [data, setData] = useState({ milimetros: '', observacoes: '', dataMedicao: new Date() });

    useEffect(() => {
        if (!itemId) return;
        (async () => {
            setLoading(true);
            try {
                const docSnap = await getDoc(doc(db, 'users', auth.currentUser.uid, 'pluviometro', itemId));
                if (docSnap.exists()) {
                    const item = docSnap.data();
                    setData({ ...item, milimetros: item.milimetros ? String(item.milimetros) : '', dataMedicao: item.dataMedicao?.toDate ? item.dataMedicao.toDate() : new Date() });
                }
            } catch (e) { console.error(e); } setLoading(false);
        })();
    }, [itemId]);

    const setField = (field, value) => { setData(prev => ({ ...prev, [field]: value })); if (errors[field]) setErrors(prev => ({ ...prev, [field]: null })); };

    const handleSave = async () => {
        const errs = {};
        const mm = parseMoeda(data.milimetros);
        if (data.milimetros === '' || isNaN(mm) || mm < VALIDATION_CONFIG.minMillimeters || mm > VALIDATION_CONFIG.maxMillimeters) errs.milimetros = ERROR_MESSAGES.INVALID_RAINFALL;
        if (data.dataMedicao > new Date()) errs.dataMedicao = ERROR_MESSAGES.FUTURE_DATE;
        setErrors(errs);
        
        if (Object.keys(errs).length > 0) return window.alert('Por favor, corrija os campos em destaque.');

        setSaving(true);
        try {
            const uid = auth.currentUser.uid;
            const id = itemId || doc(collection(db, 'users', uid, 'pluviometro')).id;
            await setDoc(doc(db, 'users', uid, 'pluviometro', id), { 
                id, milimetros: mm, observacoes: data.observacoes.trim(), dataMedicao: data.dataMedicao 
            }, { merge: true });
            onClose();
        } catch (e) { window.alert('Falha ao salvar medição.'); }
        setSaving(false);
    };

    const handleDelete = async () => {
        if (window.confirm('Deseja excluir esta medição?')) {
            await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'pluviometro', itemId));
            onClose();
        }
    };

    return (
        <div style={styles.modalOverlay} onClick={onClose}>
            <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                <BottomSheetHandle />
                <div style={styles.modalHeader}>
                    <span style={styles.modalTitle}>{itemId ? 'Editar Medição' : 'Nova Medição'}</span>
                    <button style={styles.closeButton} onClick={onClose}>
                        <Icons.Close size={24} color={THEME.textBlack} />
                    </button>
                </div>

                {loading ? <div style={{ margin: '30px 0', textAlign: 'center', color: THEME.primary }}>Carregando...</div> : (
                    <div style={styles.scrollContent}>
                        <FormDate label="Data da Medição *" value={data.dataMedicao} onChange={d => setField('dataMedicao', d)} />
                        {errors.dataMedicao && <span style={styles.errorText}>{errors.dataMedicao}</span>}
                        
                        <FormInput label="Volume de Chuva (mm) *" placeholder="Ex: 15.5" value={data.milimetros} onChangeText={v => setField('milimetros', v.replace(/[^0-9,.]/g, ''))} type="number" maxLength={6} error={errors.milimetros} />
                        <FormInput label="Observações Climáticas" placeholder="Como estava o tempo? Alguma anomalia?" value={data.observacoes} onChangeText={v => setField('observacoes', v)} multiline maxLength={VALIDATION_CONFIG.maxObservationsLength} />

                        <button style={styles.saveButton} onClick={handleSave} disabled={saving}>
                            {saving ? <span style={{ color: THEME.textWhite }}>Salvando...</span> : <span style={styles.saveButtonText}>Salvar Medição</span>}
                        </button>
                        
                        {itemId && (
                            <button style={styles.deleteButton} onClick={handleDelete}>
                                <Icons.Trash size={18} color={THEME.error} />
                                <span style={styles.deleteButtonText}>Excluir Medição</span>
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// =====================================================================
// 6️⃣ COMPONENTES DE GRÁFICO (GOOGLE CHARTS)
// =====================================================================

const ProgressoChart = ({ data }) => {
    if (!data || data.length === 0) return null;
    const chartData = useMemo(() => {
        const header = ["Atividade", "Progresso", { role: "style" }];
        const rows = data.map(item => [item.titulo, parseFloat(item.valor) || 0, THEME.primary]);
        return [header, ...rows];
    }, [data]);

    return (
        <div style={styles.chartCard}>
            <div style={styles.chartTitle}>Visão Geral do Andamento</div>
            <div style={{ width: '100%', overflow: 'hidden', borderRadius: '12px' }}>
                <Chart chartType="BarChart" width="100%" height="250px" data={chartData}
                    options={{ title: "", chartArea: { width: "65%", height: '80%' }, hAxis: { title: "Progresso (%)", minValue: 0, maxValue: 100 }, legend: { position: "none" } }}
                />
            </div>
        </div>
    );
};

const ChuvaChart = ({ data }) => {
    if (!data || data.length < 2) return null;
    const chartData = useMemo(() => {
        return [
            ['Data', 'Precipitação (mm)'],
            ...data.map(item => {
                const date = item.dataMedicao?.toDate ? item.dataMedicao.toDate() : new Date(item.dataMedicao);
                return [date, parseFloat(item.milimetros) || 0];
            })
        ];
    }, [data]);

    return (
        <div style={styles.chartCard}>
            <div style={styles.chartTitle}>Histórico de Chuvas</div>
            <div style={{ width: '100%', overflow: 'hidden', borderRadius: '12px' }}>
                <Chart chartType="AreaChart" width="100%" height="250px" data={chartData}
                    options={{ hAxis: { format: 'dd/MM', textStyle: { color: THEME.secondaryText } }, vAxis: { minValue: 0 }, legend: { position: 'none' }, colors: [THEME.primary], chartArea: { width: '85%', height: '70%' }, backgroundColor: 'transparent' }}
                />
            </div>
        </div>
    );
};

// =====================================================================
// 7️⃣ TELAS DE LISTAGEM
// =====================================================================

export const PorcentagemListaScreen = ({ navigation }) => {
    const [modal, setModal] = useState({ visible: false, itemId: null });
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!auth?.currentUser) return;
        const q = query(collection(db, 'users', auth.currentUser.uid, 'porcentagens'), orderBy('dataAtualizacao', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    return (
        <div style={styles.container}>
            <CustomHeader title="Andamento de Atividades" onBack={() => navigation?.goBack()} />
            <div style={styles.webContainer}>
                
                <div style={styles.listContainer}>
                    <ProgressoChart data={items} />
                    
                    {loading ? <div style={{ marginTop: '50px', textAlign: 'center', color: THEME.primary }}>Carregando...</div>
                    : items.length === 0 ? (
                        <div style={styles.emptyState}>
                            <Icons.Tasks size={50} color={THEME.border} />
                            <div style={styles.emptyTextTitle}>Nenhuma atividade</div>
                            <div style={styles.emptyText}>Toque no botão + para registrar um novo andamento.</div>
                        </div>
                    )
                    : items.map(item => (
                        <button key={item.id} style={styles.listItem} onClick={() => setModal({ visible: true, itemId: item.id })}>
                            <div style={styles.listIconBox}>
                                <Icons.CheckCircle size={24} color={THEME.primary} />
                            </div>
                            <div style={styles.listContent}>
                                <div style={styles.listTitle} title={item.titulo}>{item.titulo || 'Sem título'}</div>
                                
                                {/* Barra de Progresso Clean */}
                                <div style={styles.progressBarBackground}>
                                    <div style={{ ...styles.progressBarFill, width: `${parseFloat(item.valor) || 0}%` }} />
                                </div>
                                <div style={styles.listSubtitle}>{(parseFloat(item.valor) || 0).toFixed(0)}% concluído</div>
                            </div>
                            <Icons.ChevronForward size={20} color={THEME.secondaryText} />
                        </button>
                    ))}
                </div>

                <FabAdd onAdd={() => setModal({ visible: true, itemId: null })} />
                {modal.visible && <AddOrEditPorcentagemModal itemId={modal.itemId} onClose={() => setModal({ visible: false, itemId: null })} />}
            </div>
        </div>
    );
};

export const PluviometroListaScreen = ({ navigation }) => {
    const [modal, setModal] = useState({ visible: false, itemId: null });
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!auth?.currentUser) return;
        const q = query(collection(db, 'users', auth.currentUser.uid, 'pluviometro'), orderBy('dataMedicao', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const stats = useMemo(() => calculateRainfallStats(items), [items]);

    return (
        <div style={styles.container}>
            <CustomHeader title="Controle Pluviométrico" onBack={() => navigation?.goBack()} />
            <div style={styles.webContainer}>
                
                <div style={styles.listContainer}>
                    {stats.count > 0 && (
                        <div style={styles.statsContainer}>
                            <div style={styles.sectionTitle}>Estatísticas (Geral)</div>
                            <div style={styles.statsRow}>
                                <StatBox label="Total" value={`${stats.total} mm`} color="#0288D1" IconComponent={Icons.Water} />
                                <StatBox label="Média" value={`${stats.average} mm`} color="#388E3C" IconComponent={Icons.ChartLine} />
                                <StatBox label="Máxima" value={`${stats.max} mm`} color="#F57C00" IconComponent={Icons.ArrowUp} />
                                <StatBox label="Registros" value={stats.count} color="#5D4037" IconComponent={Icons.List} />
                            </div>
                        </div>
                    )}

                    <ChuvaChart data={items} />

                    {items.length > 0 && <div style={{ ...styles.sectionTitle, marginTop: '10px' }}>Histórico de Medições</div>}

                    {loading ? <div style={{ marginTop: '50px', textAlign: 'center', color: THEME.primary }}>Carregando...</div>
                    : items.length === 0 ? (
                        <div style={styles.emptyState}>
                            <Icons.WeatherPouring size={56} color={THEME.border} />
                            <div style={styles.emptyTextTitle}>Nenhuma medição</div>
                            <div style={styles.emptyText}>Registre os índices de chuva tocando no botão + abaixo.</div>
                        </div>
                    )
                    : items.map(item => {
                        const mm = parseFloat(item.milimetros) || 0;
                        const color = mm < 5 ? '#66BB6A' : mm < 25 ? '#29B6F6' : mm < 50 ? '#FFA726' : '#EF5350';
                        return (
                            <button key={item.id} style={styles.listItem} onClick={() => setModal({ visible: true, itemId: item.id })}>
                                <div style={{ ...styles.listIconBox, backgroundColor: `${color}15` }}>
                                    <Icons.WaterOutline size={26} color={color} />
                                </div>
                                <div style={styles.listContent}>
                                    <div style={styles.listTitle}>{mm.toFixed(1)} mm</div>
                                    <div style={styles.listSubtitle}>{formatDate(item.dataMedicao)}</div>
                                </div>
                                <Icons.ChevronForward size={20} color={THEME.secondaryText} />
                            </button>
                        );
                    })}
                </div>

                <FabAdd onAdd={() => setModal({ visible: true, itemId: null })} />
                {modal.visible && <AddOrEditPluviometroModal itemId={modal.itemId} onClose={() => setModal({ visible: false, itemId: null })} />}
            </div>
        </div>
    );
};

// =====================================================================
// 8️⃣ WRAPPER DE DEMONSTRAÇÃO (NAVEGAÇÃO PRINCIPAL)
// =====================================================================

export default function PorcentagemPluviometro() {
    const [activeScreen, setActiveScreen] = useState(null);

    if (activeScreen === 'porcentagem') return <PorcentagemListaScreen navigation={{ goBack: () => setActiveScreen(null) }} />;
    if (activeScreen === 'pluviometro') return <PluviometroListaScreen navigation={{ goBack: () => setActiveScreen(null) }} />;

    return (
        <div style={{ ...styles.container, justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '40px' }}>
                <Icons.Leaf size={60} color={THEME.primary} />
                <div style={{ fontSize: '24px', fontWeight: '800', color: THEME.textBlack, marginTop: '10px' }}>W3Labs App</div>
                <div style={{ fontSize: '14px', color: THEME.secondaryText }}>Ambiente de testes (Web Mobile)</div>
            </div>

            <button style={styles.menuButton} onClick={() => setActiveScreen('porcentagem')}>
                <Icons.Tasks size={20} color={THEME.primary} />
                <span style={styles.menuButtonText}>Gestão de Andamento (%)</span>
            </button>

            <button style={styles.menuButton} onClick={() => setActiveScreen('pluviometro')}>
                <Icons.WeatherPouring size={22} color={THEME.primary} />
                <span style={styles.menuButtonText}>Controle Pluviométrico</span>
            </button>
        </div>
    );
}

// =====================================================================
// 9️⃣ ESTILOS CSS-IN-JS (CLEAN WEB UI)
// =====================================================================

const styles = {
    container: { display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: THEME.background, fontFamily: 'system-ui, -apple-system, sans-serif' },
    webContainer: { display: 'flex', flexDirection: 'column', flex: 1, width: '100%', maxWidth: '800px', margin: '0 auto', position: 'relative', backgroundColor: THEME.background },
    
    // Header
    fullHeader: { backgroundColor: THEME.primary, width: '100%', display: 'flex', justifyContent: 'center' },
    headerContent: { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '0 15px', height: '60px', width: '100%', maxWidth: '800px', boxSizing: 'border-box' },
    backButton: { padding: '4px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' },
    headerTitle: { color: THEME.textWhite, fontSize: '22px', fontWeight: '700' },
    
    // Lists & Empty States
    listContainer: { padding: '16px', display: 'flex', flexDirection: 'column', flexGrow: 1, paddingBottom: '100px', overflowY: 'auto' },
    sectionTitle: { fontSize: '20px', fontWeight: '700', color: THEME.textBlack, marginBottom: '12px', marginLeft: '4px' },
    emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: '60px', padding: '0 40px' },
    emptyTextTitle: { color: THEME.textBlack, fontSize: '22px', fontWeight: '600', marginTop: '16px', marginBottom: '8px' },
    emptyText: { color: THEME.secondaryText, fontSize: '18px', textAlign: 'center', lineHeight: '24px' },
    
    // List Items (Flat design)
    listItem: { display: 'flex', flexDirection: 'row', backgroundColor: THEME.secondary, width: '100%', maxWidth: '600px', alignSelf: 'center', padding: '16px', borderRadius: '16px', alignItems: 'center', marginBottom: '12px', border: `1px solid ${THEME.border}`, cursor: 'pointer', transition: 'background-color 0.2s', boxSizing: 'border-box', textAlign: 'left' },
    listIconBox: { width: '48px', height: '48px', backgroundColor: THEME.grayInput, borderRadius: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginRight: '16px', flexShrink: 0 },
    listContent: { flex: 1, marginRight: '10px', overflow: 'hidden' },
    listTitle: { fontSize: '20px', fontWeight: '700', color: THEME.textBlack, marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    listSubtitle: { fontSize: '16px', color: THEME.secondaryText, marginTop: '4px' },
    
    // Progress Bar (Clean)
    progressBarBackground: { height: '6px', backgroundColor: THEME.grayInput, borderRadius: '3px', width: '100%', overflow: 'hidden' },
    progressBarFill: { height: '100%', backgroundColor: THEME.primary, borderRadius: '3px', transition: 'width 0.3s ease' },
    
    // FAB
    fabContainer: { position: 'absolute', right: '24px', bottom: '34px', display: 'flex', alignItems: 'center' },
    fabAdd: { backgroundColor: THEME.primary, width: '60px', height: '60px', borderRadius: '30px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: 'none', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' },
    
    // Modals (Bottom Sheet)
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', zIndex: 1000 },
    modalContent: { backgroundColor: THEME.secondary, borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '0 24px 24px 24px', maxHeight: '90vh', width: '100%', maxWidth: '600px', alignSelf: 'center', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' },
    bottomSheetHandleContainer: { display: 'flex', justifyContent: 'center', paddingTop: '12px', paddingBottom: '16px' },
    bottomSheetHandle: { width: '40px', height: '5px', borderRadius: '3px', backgroundColor: '#D4D4D4' },
    modalHeader: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
    modalTitle: { fontSize: '24px', fontWeight: '800', color: THEME.textBlack },
    closeButton: { padding: '4px', backgroundColor: THEME.lightGray, borderRadius: '20px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' },
    scrollContent: { overflowY: 'auto', flex: 1, paddingBottom: '30px' },
    
    // Forms
    inputContainer: { marginBottom: '18px', display: 'flex', flexDirection: 'column' },
    formLabel: { fontSize: '16px', color: THEME.textBlack, marginBottom: '8px', fontWeight: '600', marginLeft: '4px' },
    input: { backgroundColor: THEME.grayInput, borderRadius: '14px', padding: '0 16px', height: '60px', fontSize: '16px', color: THEME.textBlack, border: '1px solid transparent', outline: 'none', boxSizing: 'border-box', width: '100%', fontFamily: 'inherit' },
    textArea: { height: '100px', paddingTop: '15px', resize: 'vertical' },
    inputError: { border: `1px solid ${THEME.error}` },
    errorText: { color: THEME.error, fontSize: '12px', marginTop: '6px', marginLeft: '4px' },
    
    // Date Input Form
    dateBox: { backgroundColor: THEME.secondary, border: `1px solid ${THEME.border}`, borderRadius: '14px', display: 'flex', flexDirection: 'row', alignItems: 'center', overflow: 'hidden', height: '60px' },
    dateIconWrapper: { padding: '0 16px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRight: `1px solid ${THEME.border}`, height: '100%' },
    dateInput: { flex: 1, height: '100%', border: 'none', padding: '0 16px', fontSize: '16px', color: THEME.textBlack, outline: 'none', background: 'transparent', fontFamily: 'inherit' },
    
    // Buttons
    saveButton: { backgroundColor: THEME.primary, borderRadius: '14px', height: '60px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '16px', marginBottom: '16px', border: 'none', cursor: 'pointer', width: '100%', boxShadow: `0 4px 8px ${THEME.primary}33` },
    saveButtonText: { color: THEME.textWhite, fontWeight: '700', fontSize: '20px' },
    deleteButton: { display: 'flex', flexDirection: 'row', backgroundColor: 'transparent', borderRadius: '14px', height: '60px', justifyContent: 'center', alignItems: 'center', border: 'none', cursor: 'pointer', width: '100%' },
    deleteButtonText: { color: THEME.error, fontWeight: '600', fontSize: '18px', marginLeft: '6px' },

    // Estatísticas (Grid 2x2)
    statsContainer: { width: '100%', maxWidth: '600px', alignSelf: 'center', marginBottom: '24px' },
    statsRow: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
    statBox: { backgroundColor: THEME.secondary, padding: '16px', borderRadius: '16px', width: '48%', marginBottom: '12px', display: 'flex', flexDirection: 'row', alignItems: 'center', border: '1px solid transparent', boxSizing: 'border-box' },
    statIconBadge: { width: '36px', height: '36px', borderRadius: '18px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    statValue: { fontSize: '22px', fontWeight: '800', marginBottom: '2px' },
    statLabel: { fontSize: '14px', color: THEME.secondaryText, fontWeight: '500' },
    
    // Gráficos
    chartCard: { width: '100%', maxWidth: '600px', alignSelf: 'center', backgroundColor: THEME.secondary, padding: '16px', borderRadius: '16px', marginBottom: '24px', border: `1px solid ${THEME.border}`, boxSizing: 'border-box' },
    chartTitle: { fontSize: '20px', fontWeight: '700', color: THEME.textBlack, marginBottom: '16px' },

    // Wrapper Menu
    menuButton: { display: 'flex', flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.secondary, width: '85%', maxWidth: '400px', padding: '20px', borderRadius: '16px', marginBottom: '16px', border: `1px solid ${THEME.border}`, cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', boxSizing: 'border-box' },
    menuButtonText: { fontSize: '18px', fontWeight: '700', color: THEME.textBlack, marginLeft: '16px' }
};
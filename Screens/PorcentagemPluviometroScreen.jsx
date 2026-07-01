import React, { useState, useEffect, useMemo } from 'react';
import { collection, doc, getDoc, setDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Chart } from 'react-google-charts';
import { auth, db } from '../firebaseConfig';

const THEME = {
    primary: '#4CAF50',
    primaryDark: '#388E3C',
    secondary: '#FFFFFF',
    background: '#F9FBF9',
    textBlack: '#1A1D19',
    textWhite: '#FFFFFF',
    secondaryText: '#4A4A4A',
    grayInput: '#F0F4F1',
    border: '#D0D6D0',
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

const Spinner = ({ color = THEME.primary }) => (
    <div style={{
        width: 30, height: 30, border: `4px solid ${color}40`, borderTopColor: color, borderRadius: '50%', animation: 'spin 1s linear infinite'
    }} />
);

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
                        if (e.target.value) {
                            const newDate = new Date(`${e.target.value}T12:00:00`);
                            onChange(newDate);
                        }
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
            } catch (e) {} setLoading(false);
        })();
    }, [itemId]);

    const setField = (field, value) => { setData(prev => ({ ...prev, [field]: value })); if (errors[field]) setErrors(prev => ({ ...prev, [field]: null })); };

    const handleSave = async () => {
        const errs = {};
        if (!data.titulo.trim()) errs.titulo = ERROR_MESSAGES.REQUIRED_FIELD;
        const val = parseMoeda(data.valor);
        if (data.valor === '' || isNaN(val) || val < VALIDATION_CONFIG.minPercentage || val > VALIDATION_CONFIG.maxPercentage) errs.valor = ERROR_MESSAGES.INVALID_PERCENTAGE;
        setErrors(errs);
        
        if (Object.keys(errs).length > 0) return window.alert('Aviso: Por favor, corrija os campos em destaque.');

        setSaving(true);
        try {
            const uid = auth.currentUser.uid;
            const id = itemId || doc(collection(db, 'users', uid, 'porcentagens')).id;
            await setDoc(doc(db, 'users', uid, 'porcentagens', id), { 
                id, titulo: data.titulo.trim(), valor: val, descricao: data.descricao.trim(), dataAtualizacao: new Date() 
            }, { merge: true });
            onClose();
        } catch (e) { window.alert('Erro: Falha ao salvar dados.'); }
        setSaving(false);
    };

    const handleDelete = async () => {
        if (window.confirm('Tem certeza que deseja apagar este andamento?')) {
            await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'porcentagens', itemId));
            onClose();
        }
    };

    return (
        <div style={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={styles.modalContent}>
                <div style={styles.bottomSheetHandleContainer}>
                    <div style={styles.bottomSheetHandle} />
                </div>
                <div style={styles.modalHeader}>
                    <span style={styles.modalTitle}>{itemId ? 'Editar Andamento' : 'Novo Andamento'}</span>
                    <button style={styles.closeButton} onClick={onClose}>
                        <Icons.Close size={24} color={THEME.textBlack} />
                    </button>
                </div>

                {loading ? <div style={styles.loadingContainer}><Spinner /></div> : (
                    <div style={styles.modalScroll}>
                        <FormInput label="Atividade" required placeholder="Ex: Plantio da Soja" value={data.titulo} onChangeText={v => setField('titulo', v)} maxLength={VALIDATION_CONFIG.maxTitleLength} error={errors.titulo} />
                        <FormInput label="Progresso concluído (%)" required placeholder="0 a 100" value={data.valor} onChangeText={v => setField('valor', v.replace(/[^0-9,.]/g, ''))} type="text" maxLength={5} error={errors.valor} />
                        <FormInput label="Observações (Opcional)" placeholder="Detalhes extras sobre a atividade..." value={data.descricao} onChangeText={v => setField('descricao', v)} multiline maxLength={VALIDATION_CONFIG.maxDescriptionLength} />

                        <button style={styles.saveButton} onClick={handleSave} disabled={saving}>
                            {saving ? <Spinner color={THEME.textWhite} /> : <span style={styles.saveButtonText}>Salvar Andamento</span>}
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
            } catch (e) {} setLoading(false);
        })();
    }, [itemId]);

    const setField = (field, value) => { setData(prev => ({ ...prev, [field]: value })); if (errors[field]) setErrors(prev => ({ ...prev, [field]: null })); };

    const handleSave = async () => {
        const errs = {};
        const mm = parseMoeda(data.milimetros);
        if (data.milimetros === '' || isNaN(mm) || mm < VALIDATION_CONFIG.minMillimeters || mm > VALIDATION_CONFIG.maxMillimeters) errs.milimetros = ERROR_MESSAGES.INVALID_RAINFALL;
        if (data.dataMedicao > new Date()) errs.dataMedicao = ERROR_MESSAGES.FUTURE_DATE;
        setErrors(errs);
        
        if (Object.keys(errs).length > 0) return window.alert('Aviso: Por favor, corrija os campos em destaque.');

        setSaving(true);
        try {
            const uid = auth.currentUser.uid;
            const id = itemId || doc(collection(db, 'users', uid, 'pluviometro')).id;
            await setDoc(doc(db, 'users', uid, 'pluviometro', id), { 
                id, milimetros: mm, observacoes: data.observacoes.trim(), dataMedicao: data.dataMedicao 
            }, { merge: true });
            onClose();
        } catch (e) { window.alert('Erro: Falha ao salvar medição.'); }
        setSaving(false);
    };

    const handleDelete = async () => {
        if (window.confirm('Tem certeza que deseja apagar esta medição?')) {
            await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'pluviometro', itemId));
            onClose();
        }
    };

    return (
        <div style={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={styles.modalContent}>
                <div style={styles.bottomSheetHandleContainer}>
                    <div style={styles.bottomSheetHandle} />
                </div>
                <div style={styles.modalHeader}>
                    <span style={styles.modalTitle}>{itemId ? 'Editar Medição' : 'Nova Medição'}</span>
                    <button style={styles.closeButton} onClick={onClose}>
                        <Icons.Close size={24} color={THEME.textBlack} />
                    </button>
                </div>

                {loading ? <div style={styles.loadingContainer}><Spinner /></div> : (
                    <div style={styles.modalScroll}>
                        <FormDate label="Data da Medição *" value={data.dataMedicao} onChange={d => setField('dataMedicao', d)} />
                        {errors.dataMedicao && <span style={styles.errorText}>{errors.dataMedicao}</span>}
                        
                        <FormInput label="Volume de Chuva (mm) *" placeholder="Ex: 15.5" value={data.milimetros} onChangeText={v => setField('milimetros', v.replace(/[^0-9,.]/g, ''))} type="text" maxLength={6} error={errors.milimetros} />
                        <FormInput label="Observações Climáticas" placeholder="Como estava o tempo? Alguma anomalia?" value={data.observacoes} onChangeText={v => setField('observacoes', v)} multiline maxLength={VALIDATION_CONFIG.maxObservationsLength} />

                        <button style={styles.saveButton} onClick={handleSave} disabled={saving}>
                            {saving ? <Spinner color={THEME.textWhite} /> : <span style={styles.saveButtonText}>Salvar Medição</span>}
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
            <div style={{ width: '100%', overflow: 'hidden', borderRadius: 12 }}>
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
            <div style={{ width: '100%', overflow: 'hidden', borderRadius: 12 }}>
                <Chart chartType="AreaChart" width="100%" height="250px" data={chartData}
                    options={{ hAxis: { format: 'dd/MM', textStyle: { color: THEME.secondaryText } }, vAxis: { minValue: 0 }, legend: { position: 'none' }, colors: [THEME.primary], chartArea: { width: '85%', height: '70%' }, backgroundColor: 'transparent' }}
                />
            </div>
        </div>
    );
};

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
            <div style={styles.webContainer} className="web-container-responsive">
                <CustomHeader title="Andamento de Atividades" onBack={() => navigation?.goBack()} />
                
                <div style={styles.listContainer}>
                    <ProgressoChart data={items} />
                    
                    {loading ? <div style={styles.loadingContainer}><Spinner /></div>
                    : items.length === 0 ? (
                        <div style={styles.emptyState}>
                            <Icons.Tasks size={50} color={THEME.border} />
                            <span style={styles.emptyTextTitle}>Nenhuma atividade</span>
                            <span style={styles.emptyText}>Toque no botão + para registrar um novo andamento.</span>
                        </div>
                    )
                    : (
                        <div className="responsive-grid">
                            {items.map(item => (
                                <div key={item.id} style={styles.listItem} className="list-item-responsive" onClick={() => { setModal({ visible: true, itemId: item.id }); }}>
                                    <div style={styles.listIconBox}>
                                        <Icons.CheckCircle size={24} color={THEME.primary} />
                                    </div>
                                    <div style={styles.listContent}>
                                        <span style={styles.listTitle} className="truncate">{item.titulo || 'Sem título'}</span>
                                        
                                        <div style={styles.progressBarBackground}>
                                            <div style={{...styles.progressBarFill, width: `${parseFloat(item.valor) || 0}%` }} />
                                        </div>
                                        <span style={styles.listSubtitle}>{(parseFloat(item.valor) || 0).toFixed(0)}% concluído</span>
                                    </div>
                                    <Icons.ChevronForward size={20} color={THEME.secondaryText} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <FabAdd onAdd={() => { setModal({ visible: true, itemId: null }); }} />
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
            <div style={styles.webContainer} className="web-container-responsive">
                <CustomHeader title="Controle Pluviométrico" onBack={() => navigation?.goBack()} />
                
                <div style={styles.listContainer}>
                    {stats.count > 0 && (
                        <div style={styles.statsContainer}>
                            <div style={styles.sectionTitle}>Estatísticas (Geral)</div>
                            <div className="responsive-stats">
                                <StatBox label="Total" value={`${stats.total} mm`} color="#0288D1" IconComponent={Icons.Water} />
                                <StatBox label="Média" value={`${stats.average} mm`} color="#388E3C" IconComponent={Icons.ChartLine} />
                                <StatBox label="Máxima" value={`${stats.max} mm`} color="#F57C00" IconComponent={Icons.ArrowUp} />
                                <StatBox label="Registros" value={stats.count} color="#5D4037" IconComponent={Icons.List} />
                            </div>
                        </div>
                    )}

                    <ChuvaChart data={items} />

                    {items.length > 0 && <div style={{...styles.sectionTitle, marginTop: 10}}>Histórico de Medições</div>}

                    {loading ? <div style={styles.loadingContainer}><Spinner /></div>
                    : items.length === 0 ? (
                        <div style={styles.emptyState}>
                            <Icons.WeatherPouring size={56} color={THEME.border} />
                            <span style={styles.emptyTextTitle}>Nenhuma medição</span>
                            <span style={styles.emptyText}>Registre os índices de chuva tocando no botão + abaixo.</span>
                        </div>
                    )
                    : (
                        <div className="responsive-grid">
                            {items.map(item => {
                                const mm = parseFloat(item.milimetros) || 0;
                                const color = mm < 5 ? '#66BB6A' : mm < 25 ? '#29B6F6' : mm < 50 ? '#FFA726' : '#EF5350';
                                return (
                                    <div key={item.id} style={styles.listItem} className="list-item-responsive" onClick={() => { setModal({ visible: true, itemId: item.id }); }}>
                                        <div style={{...styles.listIconBox, backgroundColor: `${color}15` }}>
                                            <Icons.WaterOutline size={26} color={color} />
                                        </div>
                                        <div style={styles.listContent}>
                                            <span style={styles.listTitle}>{mm.toFixed(1)} mm</span>
                                            <span style={styles.listSubtitle}>{formatDate(item.dataMedicao)}</span>
                                        </div>
                                        <Icons.ChevronForward size={20} color={THEME.secondaryText} />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <FabAdd onAdd={() => { setModal({ visible: true, itemId: null }); }} />
                {modal.visible && <AddOrEditPluviometroModal itemId={modal.itemId} onClose={() => setModal({ visible: false, itemId: null })} />}
            </div>
        </div>
    );
};

export default function PorcentagemPluviometro() {
    const [activeScreen, setActiveScreen] = useState(null);

    useEffect(() => {
        if (typeof document !== 'undefined' && !document.getElementById('w3-agro-styles')) {
            const style = document.createElement('style');
            style.id = 'w3-agro-styles';
            style.innerHTML = `
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                * { box-sizing: border-box; }
                button { border: none; outline: none; cursor: pointer; background: transparent; padding: 0; }
                input, textarea { border: none; outline: none; font-family: inherit; }
                textarea { resize: vertical; }
                .responsive-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 15px;
                    width: 100%;
                }
                .responsive-stats {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                    width: 100%;
                }
                @media (min-width: 768px) {
                    .responsive-grid { grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
                    .responsive-stats { grid-template-columns: repeat(4, 1fr); }
                    .list-item-responsive { max-width: 100% !important; margin: 0 !important; }
                    .chart-responsive { max-width: 100% !important; }
                    .web-container-responsive { max-width: 1200px !important; }
                    .modal-responsive { max-width: 600px !important; align-self: center !important; margin: 5vh auto !important; border-radius: 24px !important; }
                }
            `;
            document.head.appendChild(style);
        }
    }, []);

    if (activeScreen === 'porcentagem') return <PorcentagemListaScreen navigation={{ goBack: () => setActiveScreen(null) }} />;
    if (activeScreen === 'pluviometro') return <PluviometroListaScreen navigation={{ goBack: () => setActiveScreen(null) }} />;

    return (
        <div style={{...styles.container, justifyContent: 'center', alignItems: 'center', display: 'flex', flexDirection: 'column'}}>
            <div style={{ alignItems: 'center', marginBottom: 40, display: 'flex', flexDirection: 'column' }}>
                <Icons.Leaf size={60} color={THEME.primary} />
                <span style={{ fontSize: 24, fontWeight: '800', color: THEME.textBlack, marginTop: 10 }}>W3Labs App</span>
                <span style={{ fontSize: 14, color: THEME.secondaryText }}>Ambiente de testes</span>
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

const styles = {
    container: { flex: 1, backgroundColor: THEME.background, minHeight: '100vh', display: 'flex', flexDirection: 'column' },
    webContainer: { flex: 1, width: '100%', maxWidth: 800, alignSelf: 'center', margin: '0 auto', display: 'flex', flexDirection: 'column', position: 'relative' },
    
    // Header
    fullHeader: { backgroundColor: THEME.primary, width: '100%' },
    headerContent: { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '15px', height: 60, maxWidth: 1200, margin: '0 auto' },
    backButton: { padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { color: THEME.textWhite, fontSize: 22, fontWeight: '700' },
    
    // Lists & Empty States
    listContainer: { padding: 16, flexGrow: 1, paddingBottom: 100, display: 'flex', flexDirection: 'column' },
    sectionTitle: { fontSize: 20, fontWeight: '700', color: THEME.textBlack, marginBottom: 12, marginLeft: 4 },
    emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: 60, padding: '0 40px' },
    emptyTextTitle: { color: THEME.textBlack, fontSize: 22, fontWeight: '600', marginTop: 16, marginBottom: 8 },
    emptyText: { color: THEME.secondaryText, fontSize: 18, textAlign: 'center', lineHeight: '24px' },
    loadingContainer: { display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 40 },

    // List Items
    listItem: { display: 'flex', flexDirection: 'row', backgroundColor: THEME.secondary, width: '100%', maxWidth: 600, alignSelf: 'center', margin: '0 auto 12px auto', padding: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderStyle: 'solid', borderColor: THEME.border, cursor: 'pointer' },
    listIconBox: { width: 48, height: 48, backgroundColor: THEME.grayInput, borderRadius: 14, display: 'flex', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    listContent: { flex: 1, marginRight: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    listTitle: { fontSize: 20, fontWeight: '700', color: THEME.textBlack, marginBottom: 6 },
    listSubtitle: { fontSize: 16, color: THEME.secondaryText, marginTop: 4 },
    
    // Progress Bar
    progressBarBackground: { height: 6, backgroundColor: THEME.grayInput, borderRadius: 3, width: '100%', overflow: 'hidden', display: 'flex' },
    progressBarFill: { height: '100%', backgroundColor: THEME.primary, borderRadius: 3 },
    
    // FAB
    fabContainer: { position: 'absolute', right: 24, bottom: 34, display: 'flex', alignItems: 'center' },
    fabAdd: { backgroundColor: THEME.primary, width: 60, height: 60, borderRadius: 30, display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0px 4px 5px rgba(0,0,0,0.2)' },
    
    // Modals
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', zIndex: 1000 },
    modalContent: { backgroundColor: THEME.secondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '0 24px 24px 24px', maxHeight: '90%', width: '100%', maxWidth: 600, alignSelf: 'center', margin: '0 auto', display: 'flex', flexDirection: 'column' },
    bottomSheetHandleContainer: { display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 16 },
    bottomSheetHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#D4D4D4' },
    modalHeader: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { fontSize: 24, fontWeight: '800', color: THEME.textBlack },
    closeButton: { padding: 4, backgroundColor: THEME.lightGray, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    modalScroll: { overflowY: 'auto', paddingBottom: 30 },
    
    // Forms
    inputContainer: { marginBottom: 18, display: 'flex', flexDirection: 'column' },
    formLabel: { fontSize: 16, color: THEME.textBlack, marginBottom: 8, fontWeight: '600', marginLeft: 4 },
    input: { backgroundColor: THEME.grayInput, borderRadius: 14, padding: '0 16px', height: 60, fontSize: 18, color: THEME.textBlack },
    inputError: { border: `1px solid ${THEME.error}` },
    textArea: { height: 100, paddingTop: 15 },
    errorText: { color: THEME.error, fontSize: 12, marginTop: 6, marginLeft: 4 },
    
    // Date Input Form
    dateBox: { backgroundColor: THEME.secondary, borderWidth: 1, borderStyle: 'solid', borderColor: THEME.border, borderRadius: 14, display: 'flex', flexDirection: 'row', alignItems: 'center', overflow: 'hidden', height: 60, position: 'relative' },
    dateIconWrapper: { padding: '0 16px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightStyle: 'solid', borderRightColor: THEME.border, height: '100%' },
    dateInput: { flex: 1, border: 'none', background: 'transparent', fontSize: 18, color: THEME.textBlack, padding: '0 16px', outline: 'none' },
    
    // Buttons
    saveButton: { backgroundColor: THEME.primary, borderRadius: 14, height: 60, display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: 16, marginBottom: 16, boxShadow: `0px 4px 8px ${THEME.primary}33`, width: '100%' },
    saveButtonText: { color: THEME.textWhite, fontWeight: '700', fontSize: 20 },
    deleteButton: { display: 'flex', flexDirection: 'row', backgroundColor: 'transparent', borderRadius: 14, height: 60, justifyContent: 'center', alignItems: 'center', width: '100%' },
    deleteButtonText: { color: THEME.error, fontWeight: '600', fontSize: 18, marginLeft: 6 },

    // Estatísticas (Grid 2x2)
    statsContainer: { width: '100%', maxWidth: 600, alignSelf: 'center', margin: '0 auto 24px auto', display: 'flex', flexDirection: 'column' },
    statsRow: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
    statBox: { backgroundColor: THEME.secondary, padding: 16, borderRadius: 16, width: '48%', marginBottom: 12, display: 'flex', flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderStyle: 'solid', borderColor: THEME.border },
    statIconBadge: { width: 36, height: 36, borderRadius: 18, display: 'flex', justifyContent: 'center', alignItems: 'center' },
    statValue: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
    statLabel: { fontSize: 16, color: THEME.secondaryText, fontWeight: '500' },
    
    // Gráficos
    chartCard: { width: '100%', maxWidth: 600, alignSelf: 'center', margin: '0 auto 24px auto', backgroundColor: THEME.secondary, padding: 16, borderRadius: 16, borderWidth: 1, borderStyle: 'solid', borderColor: THEME.border, display: 'flex', flexDirection: 'column' },
    chartTitle: { fontSize: 20, fontWeight: '700', color: THEME.textBlack, marginBottom: 16 },

    // Wrapper Menu
    menuButton: { display: 'flex', flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.secondary, width: '85%', maxWidth: 400, padding: 20, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderStyle: 'solid', borderColor: THEME.border, boxShadow: '0px 2px 4px rgba(0,0,0,0.05)' },
    menuButtonText: { fontSize: 20, fontWeight: '700', color: THEME.textBlack, marginLeft: 16 }
};

// -----------------------------------------------------------------------------
// Revisoes.jsx
//
// Módulo de Gestão de Revisões (Manutenção).
// Adaptado EXCLUSIVAMENTE PARA WEB (Responsivo).
// Integrado ao Firestore, com cálculo automático de custos e 
// baixa de estoque atômica para peças utilizadas.
// Design W3Labs - Clean Web UI
// -----------------------------------------------------------------------------
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, doc, getDoc, getDocs, deleteDoc, writeBatch, onSnapshot, query, orderBy } from 'firebase/firestore';

// Certifique-se de que auth e db estão exportados no seu firebaseConfig
import { auth, db } from '../firebaseConfig';

// =====================================================================
// 1️⃣ CONFIGURAÇÕES E TEMA (CLEAN)
// =====================================================================

const THEME = {
    primary: '#4CAF50',       // Verde mais acessível e suave
    primaryDark: '#388E3C',   // Verde escuro contraste
    secondary: '#FFFFFF',     // Branco
    background: '#F9FBF9',    // Fundo mais claro
    textBlack: '#1A1D19',     // Texto escuro suave
    textWhite: '#FFFFFF',     // Texto branco
    secondaryText: '#4A4A4A', // Cinza mais escuro para melhor leitura (Acessibilidade)
    grayInput: '#F0F4F1',     // Fundo dos inputs
    border: '#D0D6D0',        // Bordas com mais contraste
    error: '#E53935',         // Vermelho (Corretiva / Erros)
    errorBg: '#FFEBEE',       // Fundo vermelho claro
    info: '#0288D1',          // Azul (Preventiva)
    infoBg: '#E1F5FE',        // Fundo azul claro
    lightGray: '#F5F5F5'
};

const CONTAINS_ONLY_NUMBERS_REGEX = /^\d+$/;

// =====================================================================
// 2️⃣ ÍCONES SVG INLINE (Para Web)
// =====================================================================

const Icons = {
    ChevronBack: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>),
    ChevronForward: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>),
    Add: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>),
    Close: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>),
    Tractor: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 14h2l2-3V7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4l3 3h3v2h-2.5"/><circle cx="7" cy="17" r="3"/><circle cx="17" cy="17" r="3"/></svg>),
    Cogs: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>),
    CashMultiple: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2" ry="2"></rect><circle cx="12" cy="12" r="2"></circle><path d="M6 12h.01M18 12h.01"></path></svg>),
    Toolbox: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"></path></svg>),
    Wrench: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>),
    AlertCircle: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>),
    ShieldCheck: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>),
    Trash: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>),
    Calendar: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>),
};

// =====================================================================
// 3️⃣ FUNÇÕES UTILITÁRIAS
// =====================================================================

const parseMoeda = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    let sanitized = value.toString().replace(/[^0-9,.]/g, '');
    if (sanitized.includes(',')) sanitized = sanitized.replace(/\./g, '').replace(',', '.');
    return parseFloat(sanitized) || 0;
};

const formatDate = (date, options = {}) => {
    if (!date) return 'N/A';
    try {
        const dateObj = date.toDate ? date.toDate() : (typeof date === 'string' ? new Date(date) : date);
        return dateObj.toLocaleDateString('pt-BR', options);
    } catch (error) {
        return 'Data inválida';
    }
};

// =====================================================================
// 4️⃣ COMPONENTES DE UI REUTILIZÁVEIS (WEB)
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

const SectionHeader = ({ title, IconComponent }) => (
    <div style={styles.sectionHeader}>
        <IconComponent size={22} color={THEME.primary} />
        <span style={{...styles.sectionTitle, marginLeft: '8px'}}>{title}</span>
    </div>
);

const BottomSheetHandle = () => (
    <div style={styles.bottomSheetHandleContainer}>
        <div style={styles.bottomSheetHandle} />
    </div>
);

const FormInput = ({ label, placeholder, value, onChangeText, required, type = 'text', multiline, error }) => (
    <div style={styles.inputContainer}>
        <label style={styles.formLabel}>{label} {required && <span style={{ color: THEME.primary }}>*</span>}</label>
        {multiline ? (
            <textarea
                style={{ ...styles.input, height: '100px', paddingTop: '16px', resize: 'vertical', ...(error ? styles.inputError : {}) }}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChangeText(e.target.value)}
            />
        ) : (
            <input
                type={type}
                inputMode={type === 'number' ? 'decimal' : 'text'}
                style={{ ...styles.input, ...(error ? styles.inputError : {}) }}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChangeText(e.target.value)}
            />
        )}
        {error && <span style={styles.errorText}>{error}</span>}
    </div>
);

const FormSelect = ({ label, placeholder, value, onValueChange, items, required, disabled, error }) => (
    <div style={styles.inputContainer}>
        <label style={styles.formLabel}>{label} {required && <span style={{ color: THEME.primary }}>*</span>}</label>
        <select
            style={{ 
                ...styles.selectBox, 
                ...(disabled ? { opacity: 0.6, backgroundColor: THEME.border, cursor: 'not-allowed' } : {}),
                ...(error ? styles.inputError : {}) 
            }}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            disabled={disabled}
        >
            <option value="" disabled>{placeholder}</option>
            {items.map((item, index) => (
                <option key={index} value={item.value}>{item.label}</option>
            ))}
        </select>
        {error && <span style={styles.errorText}>{error}</span>}
    </div>
);

const FormDate = ({ label, value, onChange }) => {
    // Formata a data para YYYY-MM-DD (padrão do input type="date")
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
                        if (e.target.value) onChange(new Date(`${e.target.value}T12:00:00`)); // Tempo neutro para não mudar o dia
                    }}
                />
            </div>
        </div>
    );
};

const ChoiceChips = ({ options, selectedValue, onValueChange }) => (
    <div style={{ display: 'flex', overflowX: 'auto', marginBottom: '20px', paddingBottom: '5px' }}>
        {options.map((opt, i) => {
            const isActive = selectedValue === opt.value;
            let activeColor = THEME.primary;
            if (isActive && opt.value === 'Corretiva') activeColor = THEME.error;
            if (isActive && opt.value === 'Preventiva') activeColor = THEME.info;

            return (
                <button
                    key={i}
                    style={{ ...styles.chipButton, ...(isActive ? { backgroundColor: activeColor, borderColor: activeColor } : {}) }}
                    onClick={() => onValueChange(opt.value)}
                >
                    <span style={{ ...styles.chipText, ...(isActive ? styles.chipTextActive : {}) }}>{opt.label}</span>
                </button>
            );
        })}
    </div>
);

// =====================================================================
// 5️⃣ SUB-MODAL: ADICIONAR PEÇA DA REVISÃO
// =====================================================================

const AddPecaModal = ({ visible, onClose, onAddPeca, pecasDisponiveis }) => {
    const [selectedPecaId, setSelectedPecaId] = useState('');
    const [quantidade, setQuantidade] = useState('');
    const [error, setError] = useState('');

    const pecaSelecionada = useMemo(() => pecasDisponiveis.find(p => p.id === selectedPecaId), [selectedPecaId, pecasDisponiveis]);

    const handleAdd = () => {
        const qtdNum = parseMoeda(quantidade);

        if (!selectedPecaId) return setError('Selecione uma peça.');
        if (isNaN(qtdNum) || qtdNum <= 0) return setError('Quantidade inválida.');
        if (pecaSelecionada && qtdNum > pecaSelecionada.quantidade) return setError(`Estoque insuficiente. Disp: ${pecaSelecionada.quantidade}`);

        onAddPeca({
            estoqueItemId: pecaSelecionada.id,
            nome: pecaSelecionada.nome,
            quantidade: qtdNum,
            unidade: pecaSelecionada.unidade,
            valorUnitario: pecaSelecionada.valor || 0,
        });

        setSelectedPecaId('');
        setQuantidade('');
        onClose();
    };

    if (!visible) return null;

    return (
        <div style={styles.modalOverlayCenter} onClick={onClose}>
            <div style={styles.centeredModalContent} onClick={e => e.stopPropagation()}>
                <div style={styles.modalHeader}>
                    <span style={styles.modalTitle}>Adicionar Peça</span>
                    <button style={styles.closeButton} onClick={onClose}>
                        <Icons.Close size={24} color={THEME.textBlack} />
                    </button>
                </div>

                <FormSelect
                    label="Peça do Estoque *"
                    items={pecasDisponiveis.map(p => ({ label: `${p.nome} (Disp: ${p.quantidade} ${p.unidade})`, value: p.id }))}
                    value={selectedPecaId}
                    onValueChange={v => { setSelectedPecaId(v); setError(''); }}
                    placeholder="Selecione uma peça..."
                />

                <FormInput
                    label={`Quantidade (${pecaSelecionada?.unidade || 'un'}) *`}
                    value={quantidade}
                    onChangeText={v => { setQuantidade(v.replace(/[^0-9,.]/g, '')); setError(''); }}
                    type="number"
                    placeholder="Ex: 2"
                />
                {error ? <div style={styles.errorText}>{error}</div> : null}

                <button style={styles.saveButton} onClick={handleAdd}>
                    <span style={styles.saveButtonText}>Confirmar Peça</span>
                </button>
            </div>
        </div>
    );
};

// =====================================================================
// 6️⃣ MODAL PRINCIPAL: ADICIONAR / EDITAR REVISÃO
// =====================================================================

const AddOrEditRevisaoModal = ({ visible, itemId, onClose, onSaveSuccess }) => {
    const [equipamentos, setEquipamentos] = useState([]);
    const [pecasEmEstoque, setPecasEmEstoque] = useState([]);
    const [loadingEquip, setLoadingEquip] = useState(true);
    const [loadingPecas, setLoadingPecas] = useState(true);

    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [errors, setErrors] = useState({});

    const [isPecaModalVisible, setIsPecaModalVisible] = useState(false);
    const [pecasUtilizadas, setPecasUtilizadas] = useState([]);
    const [originalPecas, setOriginalPecas] = useState([]);

    const [data, setData] = useState({
        tipoRevisao: 'Preventiva', equipamentoId: '', descricaoServico: '',
        custoMaoDeObra: '', responsavel: '', dataRevisao: new Date()
    });

    // Busca Listas do Banco
    useEffect(() => {
        if (!visible) return;
        const fetchData = async () => {
            setLoadingEquip(true);
            setLoadingPecas(true);
            const userUid = auth.currentUser?.uid;
            if (!userUid) return;

            try {
                const equipSnap = await getDocs(collection(db, 'users', userUid, 'inventario'));
                setEquipamentos(equipSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.marca?.localeCompare(b.marca)));

                const stockSnap = await getDocs(collection(db, 'users', userUid, 'estoqueGeral'));
                setPecasEmEstoque(stockSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.tipo === 'Peça').sort((a, b) => a.nome?.localeCompare(b.nome)));
            } catch (error) { console.error(error); }

            setLoadingEquip(false);
            setLoadingPecas(false);
        };
        fetchData();
    }, [visible]);

    // Busca o Item para Edição
    useEffect(() => {
        if (!itemId || !visible) return;
        const fetchItem = async () => {
            setLoading(true);
            const userUid = auth.currentUser?.uid;
            if (!userUid) return;
            try {
                const docSnap = await getDoc(doc(db, 'users', userUid, 'revisoes', itemId));
                if (docSnap.exists()) {
                    const item = docSnap.data();
                    setData({
                        ...item,
                        dataRevisao: item.dataRevisao?.toDate ? item.dataRevisao.toDate() : new Date(),
                        custoMaoDeObra: item.custoMaoDeObra ? String(item.custoMaoDeObra).replace('.', ',') : ''
                    });
                    const pecas = item.pecasUtilizadas || [];
                    setPecasUtilizadas(pecas);
                    setOriginalPecas(pecas);
                } else {
                    window.alert("Registro não encontrado.");
                    onClose();
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchItem();
    }, [itemId, visible, onClose]);

    const setField = useCallback((field, value, type = 'text') => {
        let processedValue = value;
        if (type === 'numeric') processedValue = value.replace(/[^0-9,.]/g, '');
        setData(p => ({ ...p, [field]: processedValue }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    }, [errors]);

    const handleAddPeca = (peca) => setPecasUtilizadas(prev => [...prev, peca]);
    const handleRemovePeca = (estoqueItemId) => setPecasUtilizadas(prev => prev.filter(p => p.estoqueItemId !== estoqueItemId));

    const { custoTotal, custoPecas } = useMemo(() => {
        const custoPcs = pecasUtilizadas.reduce((total, peca) => total + (peca.quantidade * (peca.valorUnitario || 0)), 0);
        const custoMaoObj = parseMoeda(data.custoMaoDeObra);
        return { custoPecas: custoPcs, custoTotal: custoPcs + custoMaoObj };
    }, [pecasUtilizadas, data.custoMaoDeObra]);

    const validateForm = useCallback(() => {
        const newErrors = {};
        if (!data.equipamentoId) newErrors.equipamentoId = 'Selecione um equipamento.';
        if (!data.descricaoServico?.trim() && pecasUtilizadas.length === 0) newErrors.descricaoServico = 'Descreva o serviço ou adicione peças.';
        if (data.responsavel?.trim() && CONTAINS_ONLY_NUMBERS_REGEX.test(data.responsavel.trim())) newErrors.responsavel = 'Nome inválido.';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [data, pecasUtilizadas]);

    const onSave = async () => {
        if (!validateForm()) return window.alert('Corrija os campos em destaque.');

        setSaving(true);
        const userUid = auth.currentUser?.uid;
        if (!userUid) return;

        try {
            const batch = writeBatch(db);
            const equip = equipamentos.find(e => e.id === data.equipamentoId);

            // GESTÃO DE ESTOQUE
            const stockChanges = new Map();
            originalPecas.forEach(p => stockChanges.set(p.estoqueItemId, (stockChanges.get(p.estoqueItemId) || 0) + p.quantidade));
            pecasUtilizadas.forEach(p => stockChanges.set(p.estoqueItemId, (stockChanges.get(p.estoqueItemId) || 0) - p.quantidade));

            const stockUpdatePromises = Array.from(stockChanges.entries()).map(async ([stkId, change]) => {
                if (change === 0) return null;
                const ref = doc(db, 'users', userUid, 'estoqueGeral', stkId);
                const stockDoc = await getDoc(ref);
                if (!stockDoc.exists()) throw new Error(`Peça não encontrada no estoque.`);
                const newQty = (stockDoc.data().quantidade || 0) + change;
                if (newQty < 0) throw new Error(`Estoque insuficiente de peças.`);
                return { ref, newQty };
            });

            const stockUpdates = (await Promise.all(stockUpdatePromises)).filter(Boolean);
            stockUpdates.forEach(({ ref, newQty }) => batch.update(ref, { quantidade: newQty }));

            // SALVAR REVISÃO
            const revisaoId = itemId || doc(collection(db, 'users', userUid, 'revisoes')).id;
            const dataToSave = {
                id: revisaoId,
                ...data,
                custoMaoDeObra: parseMoeda(data.custoMaoDeObra),
                custoPecas,
                custoTotal,
                equipamentoNome: equip ? `${equip.marca} ${equip.modelo}` : 'N/A',
                descricaoServico: data.descricaoServico.trim(),
                responsavel: data.responsavel.trim(),
                pecasUtilizadas,
            };

            batch.set(doc(db, 'users', userUid, 'revisoes', revisaoId), dataToSave, { merge: true });
            await batch.commit();
            onSaveSuccess();
        } catch (error) {
            window.alert(`Não foi possível salvar. ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (window.confirm('Deseja excluir esta revisão? As peças serão devolvidas ao estoque.')) {
            setSaving(true);
            try {
                const batch = writeBatch(db);
                const userUid = auth.currentUser.uid;

                // Estorna Peças
                const stockUpdatePromises = originalPecas.map(async (peca) => {
                    const ref = doc(db, 'users', userUid, 'estoqueGeral', peca.estoqueItemId);
                    const stockDoc = await getDoc(ref);
                    if (stockDoc.exists()) return { ref, newQty: (stockDoc.data().quantidade || 0) + peca.quantidade };
                    return null;
                });

                const stockUpdates = (await Promise.all(stockUpdatePromises)).filter(Boolean);
                stockUpdates.forEach(({ ref, newQty }) => batch.update(ref, { quantidade: newQty }));

                // Deleta Revisão
                batch.delete(doc(db, 'users', userUid, 'revisoes', itemId));
                await batch.commit();
                onSaveSuccess();
            } catch (e) {
                window.alert('Falha ao excluir.');
            } finally {
                setSaving(false);
            }
        }
    };

    if (!visible) return null;

    return (
        <div style={styles.modalOverlay} onClick={onClose}>
            <div style={styles.bottomSheetContent} onClick={e => e.stopPropagation()}>
                <BottomSheetHandle />
                <div style={styles.modalHeader}>
                    <span style={styles.modalTitle}>{itemId ? 'Editar Manutenção' : 'Nova Manutenção'}</span>
                    <button style={styles.closeButton} onClick={onClose}>
                        <Icons.Close size={24} color={THEME.textBlack} />
                    </button>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', margin: '40px 0', color: THEME.primary }}>Carregando...</div>
                ) : (
                    <div style={styles.scrollContent}>

                        {/* DADOS PRINCIPAIS */}
                        <SectionHeader title="Dados do Equipamento" IconComponent={Icons.Tractor} />
                        <ChoiceChips options={[{ label: 'Preventiva', value: 'Preventiva' }, { label: 'Corretiva', value: 'Corretiva' }]} selectedValue={data.tipoRevisao} onValueChange={v => setField('tipoRevisao', v)} />

                        <FormSelect
                            label="Veículo / Equipamento *" placeholder={loadingEquip ? 'Carregando...' : 'Selecione'} required disabled={loadingEquip}
                            items={equipamentos.map(e => ({ value: e.id, label: `${e.marca} ${e.modelo}` }))}
                            value={data.equipamentoId} onValueChange={v => setField('equipamentoId', v)} error={errors.equipamentoId}
                        />

                        {/* SERVIÇO E PEÇAS */}
                        <SectionHeader title="Serviços e Peças" IconComponent={Icons.Cogs} />
                        <FormInput label="Descrição do Serviço" value={data.descricaoServico} onChangeText={v => setField('descricaoServico', v)} multiline error={errors.descricaoServico} placeholder="Descreva os reparos ou manutenções efetuadas..." />

                        <div style={{ marginBottom: '20px' }}>
                            <div style={{...styles.formLabel, marginBottom: '12px'}}>Peças Utilizadas do Estoque</div>
                            {pecasUtilizadas.length > 0 ? (
                                pecasUtilizadas.map(peca => (
                                    <div key={peca.estoqueItemId} style={styles.pecaItemBox}>
                                        <div style={{ flex: 1 }}>
                                            <div style={styles.pecaItemTitle} title={peca.nome}>{peca.nome}</div>
                                            <div style={styles.pecaItemSubtitle}>{peca.quantidade} {peca.unidade} • R$ {(peca.valorUnitario * peca.quantidade).toFixed(2)}</div>
                                        </div>
                                        <button onClick={() => handleRemovePeca(peca.estoqueItemId)} style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer' }}>
                                            <Icons.Trash size={20} color={THEME.error} />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div style={{ color: THEME.secondaryText, fontSize: '13px', marginBottom: '10px', fontStyle: 'italic', marginLeft: '4px' }}>
                                    Nenhuma peça vinculada a esta revisão.
                                </div>
                            )}

                            <button style={styles.addPecaBtn} onClick={() => setIsPecaModalVisible(true)} disabled={loadingPecas}>
                                <Icons.Add size={20} color={THEME.primary} />
                                <span style={{...styles.addPecaText, marginLeft: '6px'}}>{loadingPecas ? 'Carregando...' : 'Adicionar Peça'}</span>
                            </button>
                        </div>

                        {/* CUSTOS E FINALIZAÇÃO */}
                        <SectionHeader title="Custos e Finalização" IconComponent={Icons.CashMultiple} />
                        <FormInput label="Mão de Obra (R$)" value={data.custoMaoDeObra} onChangeText={v => setField('custoMaoDeObra', v, 'numeric')} type="number" placeholder="Ex: 150,00" error={errors.custo} />

                        <div style={styles.summaryCard}>
                            <div style={styles.summaryRow}>
                                <span style={styles.summaryText}>Peças:</span>
                                <span style={styles.summaryText}>R$ {custoPecas.toFixed(2)}</span>
                            </div>
                            <div style={styles.summaryRow}>
                                <span style={styles.summaryText}>Mão de Obra:</span>
                                <span style={styles.summaryText}>R$ {parseMoeda(data.custoMaoDeObra).toFixed(2)}</span>
                            </div>
                            <div style={styles.summaryDivider} />
                            <div style={styles.summaryRow}>
                                <span style={styles.summaryTotalLabel}>Custo Total</span>
                                <span style={styles.summaryTotalValue}>R$ {custoTotal.toFixed(2)}</span>
                            </div>
                        </div>

                        <FormInput label="Responsável / Oficina" value={data.responsavel} onChangeText={v => setField('responsavel', v)} placeholder="Nome do mecânico ou empresa" error={errors.responsavel} />
                        <FormDate label="Data da Revisão" value={data.dataRevisao} onChange={d => setField('dataRevisao', d)} />

                        <button style={styles.saveButton} onClick={onSave} disabled={saving}>
                            {saving ? <span style={{ color: THEME.textWhite }}>Salvando...</span> : <span style={styles.saveButtonText}>Salvar Manutenção</span>}
                        </button>

                        {itemId && (
                            <button style={styles.deleteButton} onClick={handleDelete}>
                                <Icons.Trash size={18} color={THEME.error} />
                                <span style={{...styles.deleteButtonText, marginLeft: '6px'}}>Excluir Revisão</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Sub-Modal de Peças */}
            <AddPecaModal visible={isPecaModalVisible} onClose={() => setIsPecaModalVisible(false)} onAddPeca={handleAddPeca} pecasDisponiveis={pecasEmEstoque} />
        </div>
    );
};

// =====================================================================
// 7️⃣ TELA PRINCIPAL (LISTAGEM DE REVISÕES)
// =====================================================================

export default function RevisoesListaScreen({ navigation }) {
    const [modal, setModal] = useState({ visible: false, itemId: null });
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!auth?.currentUser) return;
        const q = query(collection(db, 'users', auth.currentUser.uid, 'revisoes'), orderBy('dataRevisao', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setItems(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const getStatusStyle = (tipo) => {
        if (tipo === 'Corretiva') return { color: THEME.error, bg: THEME.errorBg, IconComponent: Icons.AlertCircle };
        return { color: THEME.info, bg: THEME.infoBg, IconComponent: Icons.ShieldCheck };
    };

    return (
        <div style={styles.container}>
            <CustomHeader title="Histórico de Manutenções" onBack={() => navigation?.goBack()} />
            <div style={styles.webContainer}>

                <div style={styles.listContainer}>
                    {loading ? (
                        <div style={{ textAlign: 'center', marginTop: '50px', color: THEME.primary }}>Carregando...</div>
                    ) : items.length === 0 ? (
                        <div style={styles.emptyState}>
                            <Icons.Toolbox size={64} color={THEME.border} />
                            <div style={styles.emptyTextTitle}>Nenhuma manutenção</div>
                            <div style={styles.emptyText}>Mantenha seu maquinário em dia registrando as revisões no botão + abaixo.</div>
                        </div>
                    ) : (
                        <div style={{ paddingBottom: '100px' }}>
                            {items.map(item => {
                                const status = getStatusStyle(item.tipoRevisao);
                                return (
                                    <button
                                        key={item.id}
                                        style={styles.listItem}
                                        onClick={() => setModal({ visible: true, itemId: item.id })}
                                    >
                                        <div style={{...styles.listIconBox, backgroundColor: status.bg}}>
                                            <Icons.Wrench size={26} color={status.color} />
                                        </div>

                                        <div style={styles.listContent}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                                                <span style={styles.listTitle} title={item.equipamentoNome}>{item.equipamentoNome || 'Equipamento'}</span>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: '6px' }}>
                                                <status.IconComponent size={14} color={status.color} />
                                                <span style={{...styles.listSubtitle, color: status.color, fontWeight: '600', marginLeft: '4px' }}>
                                                    {item.tipoRevisao}
                                                </span>
                                                <span style={styles.listSubtitle}> &nbsp;• {formatDate(item.dataRevisao)}</span>
                                            </div>

                                            <div style={styles.listValueText}>
                                                R$ {parseFloat(item.custoTotal || 0).toFixed(2)}
                                            </div>
                                        </div>
                                        <div style={{ marginLeft: '8px', display: 'flex', alignItems: 'center' }}>
                                            <Icons.ChevronForward size={20} color={THEME.secondaryText} />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <FabAdd onAdd={() => setModal({ visible: true, itemId: null })} />

                <AddOrEditRevisaoModal
                    visible={modal.visible}
                    itemId={modal.itemId}
                    onClose={() => setModal({ visible: false, itemId: null })}
                    onSaveSuccess={() => setModal({ visible: false, itemId: null })}
                />
            </div>
        </div>
    );
}

// =====================================================================
// 8️⃣ ESTILOS GERAIS (CSS-in-JS Otimizado para Web Mobile/Responsivo)
// =====================================================================

const styles = {
    container: { display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: THEME.background, fontFamily: 'system-ui, -apple-system, sans-serif' },
    row: { display: 'flex', flexDirection: 'row' },
    webContainer: { display: 'flex', flexDirection: 'column', flex: 1, width: '100%', maxWidth: '800px', margin: '0 auto', position: 'relative', overflow: 'hidden' },
    
    // Header
    fullHeader: { backgroundColor: THEME.primary, width: '100%', display: 'flex', justifyContent: 'center', flexShrink: 0 },
    headerContent: { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: '60px', width: '100%', maxWidth: '800px', boxSizing: 'border-box' },
    backButton: { padding: '4px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' },
    headerTitle: { color: THEME.textWhite, fontSize: '18px', fontWeight: '700' },
    
    // Lists & Empty States
    listContainer: { padding: '16px', display: 'flex', flexDirection: 'column', flexGrow: 1, paddingBottom: '100px', overflowY: 'auto' },
    emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 40px', marginTop: '50px' },
    emptyTextTitle: { color: THEME.textBlack, fontSize: '20px', fontWeight: '600', marginTop: '16px', marginBottom: '8px' },
    emptyText: { color: THEME.secondaryText, fontSize: '16px', textAlign: 'center', lineHeight: '24px' },
    
    // List Items (Flat design)
    listItem: { display: 'flex', flexDirection: 'row', backgroundColor: THEME.secondary, width: '100%', maxWidth: '600px', alignSelf: 'center', padding: '16px', borderRadius: '16px', alignItems: 'center', marginBottom: '12px', border: `1px solid ${THEME.border}`, cursor: 'pointer', boxSizing: 'border-box', textAlign: 'left', transition: 'box-shadow 0.2s' },
    listIconBox: { width: '50px', height: '50px', borderRadius: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginRight: '16px', flexShrink: 0 },
    listContent: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    listTitle: { fontSize: '18px', fontWeight: '700', color: THEME.textBlack, flex: 1, marginRight: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    listSubtitle: { fontSize: '14px', color: THEME.secondaryText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    listValueText: { fontSize: '18px', fontWeight: '800', color: THEME.textBlack, marginTop: '4px' },
    
    // FAB
    fabContainer: { position: 'absolute', right: '24px', bottom: '34px', display: 'flex', alignItems: 'center' },
    fabAdd: { backgroundColor: THEME.primary, width: '60px', height: '60px', borderRadius: '30px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: 'none', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' },
    
    // Modals (Bottom Sheet)
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', zIndex: 1000 },
    bottomSheetContent: { backgroundColor: THEME.secondary, borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '0 24px 24px 24px', maxHeight: '92vh', width: '100%', maxWidth: '600px', alignSelf: 'center', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' },
    bottomSheetHandleContainer: { display: 'flex', justifyContent: 'center', paddingTop: '12px', paddingBottom: '16px' },
    bottomSheetHandle: { width: '40px', height: '5px', borderRadius: '3px', backgroundColor: '#D4D4D4' },
    modalHeader: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingTop: '10px' },
    modalTitle: { fontSize: '20px', fontWeight: '800', color: THEME.textBlack },
    closeButton: { padding: '4px', backgroundColor: THEME.lightGray, borderRadius: '20px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' },
    scrollContent: { overflowY: 'auto', flex: 1, paddingBottom: '30px' },
    
    // Sub-Modal Centered (Peças)
    modalOverlayCenter: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', zIndex: 1100 },
    centeredModalContent: { backgroundColor: THEME.secondary, borderRadius: '20px', padding: '24px', width: '100%', maxWidth: '450px', boxSizing: 'border-box' },

    // Forms
    inputContainer: { marginBottom: '18px', display: 'flex', flexDirection: 'column' },
    formLabel: { fontSize: '14px', color: THEME.textBlack, marginBottom: '8px', fontWeight: '600', marginLeft: '4px' },
    input: { backgroundColor: THEME.grayInput, borderRadius: '14px', padding: '0 16px', height: '54px', fontSize: '15px', color: THEME.textBlack, border: '1px solid transparent', outline: 'none', boxSizing: 'border-box', width: '100%', fontFamily: 'inherit' },
    inputError: { border: `1px solid ${THEME.error}` },
    errorText: { color: THEME.error, fontSize: '12px', marginTop: '6px', marginLeft: '4px' },

    // Section Header
    sectionHeader: { display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: '24px', marginBottom: '16px', paddingLeft: '4px' },
    sectionTitle: { fontSize: '18px', fontWeight: '800', color: THEME.textBlack },

    // Select Custom
    selectBox: { backgroundColor: THEME.grayInput, borderRadius: '14px', padding: '0 16px', height: '54px', fontSize: '15px', color: THEME.textBlack, border: '1px solid transparent', outline: 'none', boxSizing: 'border-box', width: '100%', fontFamily: 'inherit', appearance: 'none', cursor: 'pointer', backgroundImage: 'url("data:image/svg+xml;utf8,<svg fill=\'%234A4A4A\' height=\'24\' viewBox=\'0 0 24 24\' width=\'24\' xmlns=\'http://www.w3.org/2000/svg\'><path d=\'M7 10l5 5 5-5z\'/></svg>")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px top 50%' },

    // Date
    dateBox: { backgroundColor: THEME.secondary, border: `1px solid ${THEME.border}`, borderRadius: '14px', display: 'flex', flexDirection: 'row', alignItems: 'center', overflow: 'hidden', height: '54px' },
    dateIconWrapper: { padding: '0 16px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRight: `1px solid ${THEME.border}`, height: '100%' },
    dateInput: { flex: 1, height: '100%', border: 'none', padding: '0 16px', fontSize: '15px', color: THEME.textBlack, outline: 'none', background: 'transparent', fontFamily: 'inherit' },

    // Chips
    chipButton: { backgroundColor: THEME.secondary, border: `1px solid ${THEME.border}`, padding: '10px 18px', borderRadius: '20px', marginRight: '10px', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' },
    chipText: { color: THEME.secondaryText, fontWeight: '600', fontSize: '15px' },
    chipTextActive: { color: THEME.textWhite },

    // Lista de Peças no Formulário
    pecaItemBox: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: THEME.secondary, border: `1px solid ${THEME.border}`, padding: '14px', borderRadius: '12px', marginBottom: '8px' },
    pecaItemTitle: { fontSize: '15px', fontWeight: '700', color: THEME.textBlack, marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    pecaItemSubtitle: { fontSize: '13px', color: THEME.secondaryText },
    addPecaBtn: { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: '54px', borderStyle: 'dashed', borderWidth: '1.5px', borderColor: THEME.primary, borderRadius: '14px', backgroundColor: `${THEME.primary}05`, cursor: 'pointer', width: '100%' },
    addPecaText: { color: THEME.primary, fontWeight: '700', fontSize: '16px' },

    // Caixa de Resumo de Custos
    summaryCard: { backgroundColor: '#F9FBF9', padding: '16px', borderRadius: '16px', marginBottom: '20px', border: '1px solid #C5E1A5' },
    summaryRow: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0' },
    summaryText: { fontSize: '15px', color: THEME.secondaryText, fontWeight: '500' },
    summaryDivider: { height: '1px', backgroundColor: '#DDF0C7', margin: '12px 0' },
    summaryTotalLabel: { fontSize: '16px', fontWeight: '700', color: THEME.textBlack },
    summaryTotalValue: { fontSize: '22px', fontWeight: '800', color: THEME.primaryDark },

    // Buttons
    saveButton: { backgroundColor: THEME.primary, borderRadius: '14px', height: '54px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '24px', marginBottom: '16px', border: 'none', cursor: 'pointer', width: '100%', boxShadow: `0 4px 8px ${THEME.primary}33` },
    saveButtonText: { color: THEME.textWhite, fontWeight: '700', fontSize: '18px' },
    deleteButton: { display: 'flex', flexDirection: 'row', backgroundColor: 'transparent', borderRadius: '14px', height: '50px', justifyContent: 'center', alignItems: 'center', border: 'none', cursor: 'pointer', width: '100%' },
    deleteButtonText: { color: THEME.error, fontWeight: '600', fontSize: '16px', marginLeft: '6px' }
};
// -----------------------------------------------------------------------------
// PlantioColheitaScreen.jsx
//
// Módulo de registo de plantios e colheitas.
// Adaptado EXCLUSIVAMENTE PARA WEB.
// Integrado ao Firestore, sem dependências externas de UI.
// -----------------------------------------------------------------------------
import React, { useState, useEffect, useCallback } from 'react';
import { collection, doc, getDoc, deleteDoc, writeBatch } from 'firebase/firestore';

// Assumindo que essas funções estão exportadas no seu firebaseConfig
import {
    auth,
    db,
    getItems,
    addOrUpdateItem,
    subscribeToCollection,
} from '../firebaseConfig'; // Ajuste o caminho conforme sua estrutura

// =====================================================================
// 1️⃣ CONSTANTES, CONFIGURAÇÕES E TEMA
// =====================================================================

const THEME = {
    primary: '#4CAF50',
    primaryDark: '#388E3C',
    secondary: '#FFFFFF',
    background: '#F9FBF9',
    textBlack: '#2C3329',
    textWhite: '#FFFFFF',
    secondaryText: '#4A4A4A',
    grayInput: '#F0F4F1',
    error: '#E53935',
};

const FIELD_VALIDATION = {
    minAreaPlantada: 0.1,
    maxAreaPlantada: 10000,
    minPopulacao: 1,
    maxPopulacao: 1000000,
    minProdutividade: 0,
    maxProdutividade: 200,
    minUmidade: 0,
    maxUmidade: 100,
    minImpurezas: 0,
    maxImpurezas: 100,
    maxPeso: 1000000
};

const CULTURAS_SUGERIDAS = [
    'Soja', 'Milho', 'Trigo', 'Feijão', 'Arroz', 'Algodão', 'Cana-de-açúcar', 'Café'
];

const UNIDADES_MEDIDA = {
    PESO: 'kg',
    AREA: 'ha',
    PRODUTIVIDADE: 'sc/ha',
    PERCENTUAL: '%',
    POPULACAO: 'sementes/ha'
};

const CONTAINS_ONLY_NUMBERS_REGEX = /^\d+$/;

// =====================================================================
// 2️⃣ ÍCONES SVG INLINE (Mobile Web)
// =====================================================================
const Icons = {
    ArrowBack: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>),
    Add: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>),
    Robot: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>),
    Close: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>),
    Leaf: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>),
    Silo: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M7 21V7a5 5 0 0 1 10 0v14"/><path d="M12 2v5"/></svg>),
    ChevronForward: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>)
};

// =====================================================================
// 3️⃣ FUNÇÕES UTILITÁRIAS
// =====================================================================

const validateNumericInput = (value, min = 0, max = Infinity) => {
    if (!value || String(value).trim() === '') return { isValid: true, sanitizedValue: 0, error: null };
    const sanitized = parseFloat(String(value).replace(',', '.'));
    if (isNaN(sanitized)) return { isValid: false, sanitizedValue: 0, error: 'Valor deve ser numérico' };
    if (sanitized < min) return { isValid: false, sanitizedValue: sanitized, error: `Valor deve ser maior que ${min}` };
    if (sanitized > max) return { isValid: false, sanitizedValue: sanitized, error: `Valor deve ser menor que ${max}` };
    return { isValid: true, sanitizedValue: sanitized, error: null };
};

const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
        const dateObj = date.toDate ? date.toDate() : (typeof date === 'string' ? new Date(date) : date);
        return dateObj.toLocaleDateString('pt-BR');
    } catch (error) {
        return 'Data inválida';
    }
};

const calculateProductivity = (peso, area) => {
    if (!peso || !area || area <= 0) return 0;
    const sacas = peso / 60; // 1 saca = 60 kg
    return parseFloat((sacas / area).toFixed(2));
};

// =====================================================================
// 4️⃣ COMPONENTES DE UI REUTILIZÁVEIS
// =====================================================================

const CustomHeader = ({ title, onBack }) => (
    <div style={styles.fullHeader}>
        <div style={styles.headerContent}>
            <button onClick={onBack} style={styles.backButton}>
                <Icons.ArrowBack size={26} color={THEME.textWhite} />
            </button>
            <span style={styles.headerTitle}>{title}</span>
            <div style={{ width: 26 }} />
        </div>
    </div>
);

const FabGroup = ({ onAdd, onOpenAI }) => (
    <div style={styles.fabContainer}>
        <button style={styles.fabAdd} onClick={onAdd}>
            <Icons.Add size={28} color={THEME.textWhite} />
        </button>
        <button style={styles.fabAI} onClick={onOpenAI}>
            <Icons.Robot size={26} color={THEME.textWhite} />
        </button>
    </div>
);

const FormInput = ({ label, placeholder, value, onChangeText, required, type = 'text', editable = true, error }) => (
    <div style={styles.inputContainer}>
        <label style={styles.formLabel}>{label} {required && <span style={{ color: THEME.primary }}>*</span>}</label>
        <input
            type={type}
            inputMode={type === 'number' ? 'decimal' : 'text'}
            style={{ ...styles.input, ...(!editable ? styles.inputDisabled : {}), ...(error ? styles.inputError : {}) }}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChangeText(e.target.value)}
            disabled={!editable}
        />
        {error && <span style={styles.errorText}>{error}</span>}
    </div>
);

// Na web mobile, o <select> nativo é a melhor UX possível.
const FormSelect = ({ label, placeholder, value, onValueChange, items, required, error }) => (
    <div style={styles.inputContainer}>
        <label style={styles.formLabel}>{label} {required && <span style={{ color: THEME.primary }}>*</span>}</label>
        <select
            style={{ ...styles.selectBox, ...(error ? styles.inputError : {}) }}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
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
    // Formata YYYY-MM-DD para o input type="date"
    const dateStr = value instanceof Date && !isNaN(value) ? value.toISOString().split('T')[0] : '';
    return (
        <div style={styles.inputContainer}>
            <label style={styles.formLabel}>{label}</label>
            <input
                type="date"
                style={styles.input}
                value={dateStr}
                onChange={(e) => {
                    if (e.target.value) {
                        onChange(new Date(`${e.target.value}T12:00:00`));
                    }
                }}
            />
        </div>
    );
};

// =====================================================================
// 5️⃣ MODAIS DE CADASTRO COM LÓGICA (PLANTIO E COLHEITA)
// =====================================================================

const AddOrEditColheitaModal = ({ itemId, onClose, onSaveSuccess }) => {
    const [equipamentos, setEquipamentos] = useState([]);
    const [loadingEquip, setLoadingEquip] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [errors, setErrors] = useState({});
    const [data, setData] = useState({
        cultura: '', talhao: '', areaColhida: '', pesoBruto: '', pesoLiquido: '',
        produtividade: '', umidade: '', impurezas: '', observacoes: '',
        equipamentoId: '', dataColheita: new Date(), location: null,
    });

    useEffect(() => {
        let isMounted = true;
        const fetchEquips = async () => {
            setLoadingEquip(true);
            const result = await getItems('inventario');
            if (result.success && isMounted) {
                const colheitadeiras = result.data.filter(e => e.tipoEquipamento === 'Colheitadeira').sort((a, b) => a.marca.localeCompare(b.marca));
                setEquipamentos(colheitadeiras);
            }
            if (isMounted) setLoadingEquip(false);
        };
        fetchEquips();
        return () => { isMounted = false; };
    }, []);

    useEffect(() => {
        let isMounted = true;
        if (itemId) {
            const fetchItem = async () => {
                setLoading(true);
                const userUid = auth.currentUser?.uid;
                if (!userUid) return;
                try {
                    const docSnap = await getDoc(doc(db, 'users', userUid, 'colheitas', itemId));
                    if (docSnap.exists() && isMounted) {
                        const item = docSnap.data();
                        setData({
                            ...item,
                            dataColheita: item.dataColheita?.toDate ? item.dataColheita.toDate() : new Date(),
                            areaColhida: item.areaColhida ? String(item.areaColhida) : '',
                            pesoBruto: item.pesoBruto ? String(item.pesoBruto) : '',
                            pesoLiquido: item.pesoLiquido ? String(item.pesoLiquido) : '',
                            produtividade: item.produtividade ? String(item.produtividade) : '',
                            umidade: item.umidade ? String(item.umidade) : '',
                            impurezas: item.impurezas ? String(item.impurezas) : '',
                        });
                    } else if (isMounted) {
                        window.alert('Erro: Colheita não encontrada.');
                        onClose();
                    }
                } catch (error) {
                    console.error(error);
                } finally {
                    if (isMounted) setLoading(false);
                }
            };
            fetchItem();
        }
        return () => { isMounted = false; };
    }, [itemId, onClose]);

    const setField = useCallback((field, value, type = 'text') => {
        const processedValue = type === 'numeric' ? value.replace(/[^0-9,.]/g, '') : value;
        setData(prev => {
            const nextData = { ...prev, [field]: processedValue };
            if (field === 'pesoLiquido' || field === 'areaColhida') {
                const peso = parseFloat(String(field === 'pesoLiquido' ? processedValue : prev.pesoLiquido).replace(',', '.'));
                const area = parseFloat(String(field === 'areaColhida' ? processedValue : prev.areaColhida).replace(',', '.'));
                if (peso > 0 && area > 0) nextData.produtividade = String(calculateProductivity(peso, area));
            }
            return nextData;
        });
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    }, [errors]);

    const validateForm = useCallback(() => {
        const newErrors = {};
        if (!data.cultura?.trim() || CONTAINS_ONLY_NUMBERS_REGEX.test(data.cultura.trim())) newErrors.cultura = 'Cultura inválida.';
        if (!data.talhao?.trim() || CONTAINS_ONLY_NUMBERS_REGEX.test(data.talhao.trim())) newErrors.talhao = 'Talhão inválido.';
        const areaValidation = validateNumericInput(data.areaColhida, FIELD_VALIDATION.minAreaPlantada, FIELD_VALIDATION.maxAreaPlantada);
        if (!areaValidation.isValid) newErrors.areaColhida = areaValidation.error;
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [data]);

    const onSave = async () => {
        if (!validateForm()) return window.alert('Atenção: Corrija os campos destacados.');
        const userUid = auth.currentUser?.uid;
        if (!userUid) return window.alert("Erro: Utilizador não autenticado.");

        setSaving(true);
        const equip = equipamentos.find(e => e.id === data.equipamentoId);
        const id = itemId || doc(collection(db, 'users', userUid, 'colheitas')).id;

        const dataToSave = {
            id,
            cultura: data.cultura.trim(),
            talhao: data.talhao.trim(),
            equipamentoId: data.equipamentoId,
            equipamentoNome: equip ? `${equip.marca} ${equip.modelo}` : 'N/A',
            dataColheita: data.dataColheita,
            areaColhida: validateNumericInput(data.areaColhida).sanitizedValue,
            pesoBruto: validateNumericInput(data.pesoBruto).sanitizedValue,
            pesoLiquido: validateNumericInput(data.pesoLiquido).sanitizedValue,
            produtividade: validateNumericInput(data.produtividade).sanitizedValue,
            umidade: validateNumericInput(data.umidade).sanitizedValue,
            impurezas: validateNumericInput(data.impurezas).sanitizedValue,
        };

        const result = await addOrUpdateItem('colheitas', dataToSave, !!itemId);
        setSaving(false);
        if (result.success) onSaveSuccess();
        else window.alert('Erro: Não foi possível salvar a colheita.');
    };

    const handleDelete = async () => {
        if (window.confirm('Deseja eliminar esta colheita?')) {
            try {
                await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'colheitas', itemId));
                onSaveSuccess();
            } catch (e) {
                window.alert('Erro: Falha ao eliminar.');
            }
        }
    };

    if (loading || loadingEquip) return (
        <div style={styles.modalOverlay}><span style={{color: '#fff'}}>Carregando...</span></div>
    );

    return (
        <div style={styles.modalOverlay}>
            <div style={styles.modalContent}>
                <div style={styles.modalHeader}>
                    <span style={styles.modalTitle}>{itemId ? 'Editar Colheita' : 'Nova Colheita'}</span>
                    <button style={styles.closeButton} onClick={onClose}>
                        <Icons.Close size={20} color={THEME.textBlack} />
                    </button>
                </div>

                <div style={styles.scrollContent}>
                    <FormSelect 
                        label="Cultura" placeholder="Selecione a cultura" required 
                        items={CULTURAS_SUGERIDAS.map(c => ({ label: c, value: c }))}
                        value={data.cultura} onValueChange={v => setField('cultura', v)}
                        error={errors.cultura}
                    />
                    <FormInput 
                        label="Talhão / Área" placeholder="Ex: Talhão 1" required 
                        value={data.talhao} onChangeText={v => setField('talhao', v)}
                        error={errors.talhao}
                    />
                    <FormSelect 
                        label="Colheitadeira" placeholder="Selecione o equipamento" 
                        items={equipamentos.map(e => ({ label: `${e.marca} ${e.modelo}`, value: e.id }))}
                        value={data.equipamentoId} onValueChange={v => setField('equipamentoId', v)}
                    />
                    <FormInput 
                        label={`Área Colhida (${UNIDADES_MEDIDA.AREA})`} type="number" required 
                        value={data.areaColhida} onChangeText={v => setField('areaColhida', v, 'numeric')}
                        error={errors.areaColhida}
                    />
                    <FormInput 
                        label={`Peso Líquido (${UNIDADES_MEDIDA.PESO})`} type="number" 
                        value={data.pesoLiquido} onChangeText={v => setField('pesoLiquido', v, 'numeric')}
                    />
                    <FormInput 
                        label={`Produtividade (${UNIDADES_MEDIDA.PRODUTIVIDADE})`} editable={false}
                        value={data.produtividade} 
                    />
                    <FormDate label="Data da Colheita" value={data.dataColheita} onChange={d => setField('dataColheita', d, 'date')} />

                    <button style={styles.saveButton} onClick={onSave} disabled={saving}>
                        <span style={styles.saveButtonText}>{saving ? 'Salvando...' : 'Salvar Colheita'}</span>
                    </button>
                    
                    {itemId && (
                        <button style={styles.deleteButton} onClick={handleDelete}>
                            <span style={styles.deleteButtonText}>Excluir Colheita</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const AddOrEditPlantioModal = ({ itemId, onClose, onSaveSuccess }) => {
    const [sementes, setSementes] = useState([]);
    const [loadingSementes, setLoadingSementes] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [originalItem, setOriginalItem] = useState(null);
    const [errors, setErrors] = useState({});
    const [data, setData] = useState({
        cultura: '', variedade: '', talhao: '', areaPlantada: '', populacaoSementes: '',
        dataPlantio: new Date(), estoqueItemId: '', quantidadeUtilizada: '',
    });

    useEffect(() => {
        let isMounted = true;
        const fetchSementes = async () => {
            setLoadingSementes(true);
            const result = await getItems('estoqueGeral');
            if (result.success && isMounted) setSementes(result.data.filter(i => i.tipo === 'Semente'));
            if (isMounted) setLoadingSementes(false);
        };
        fetchSementes();
        return () => { isMounted = false; };
    }, []);

    useEffect(() => {
        let isMounted = true;
        if (itemId) {
            const fetchItem = async () => {
                setLoading(true);
                const userUid = auth.currentUser?.uid;
                if (!userUid) return;
                try {
                    const docSnap = await getDoc(doc(db, 'users', userUid, 'plantios', itemId));
                    if (docSnap.exists() && isMounted) {
                        const item = docSnap.data();
                        const itemData = {
                            ...item,
                            dataPlantio: item.dataPlantio?.toDate ? item.dataPlantio.toDate() : new Date(),
                            areaPlantada: item.areaPlantada ? String(item.areaPlantada) : '',
                            populacaoSementes: item.populacaoSementes ? String(item.populacaoSementes) : '',
                            quantidadeUtilizada: item.quantidadeUtilizada ? String(item.quantidadeUtilizada) : '',
                        };
                        setData(itemData);
                        setOriginalItem(itemData);
                    }
                } catch (err) {
                    console.error(err);
                } finally {
                    if (isMounted) setLoading(false);
                }
            };
            fetchItem();
        }
        return () => { isMounted = false; };
    }, [itemId, onClose]);

    const setField = useCallback((field, value, type = 'text') => {
        setData(prev => ({ ...prev, [field]: type === 'numeric' ? value.replace(/[^0-9,.]/g, '') : value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    }, [errors]);

    const validateForm = useCallback(() => {
        const newErrors = {};
        if (!data.cultura?.trim()) newErrors.cultura = 'Cultura inválida.';
        if (!data.talhao?.trim()) newErrors.talhao = 'Talhão inválido.';
        if (data.estoqueItemId) {
            const qtdNum = parseFloat(String(data.quantidadeUtilizada).replace(',', '.'));
            if (isNaN(qtdNum) || qtdNum <= 0) newErrors.quantidadeUtilizada = 'Quantidade inválida.';
            else {
                const semente = sementes.find(s => s.id === data.estoqueItemId);
                const originalQtd = originalItem ? (parseFloat(String(originalItem.quantidadeUtilizada).replace(',', '.')) || 0) : 0;
                const bonusEstoque = (originalItem?.estoqueItemId === data.estoqueItemId) ? originalQtd : 0;
                const estoqueDisponivel = semente ? (parseFloat(semente.quantidade) || 0) + bonusEstoque : 0;
                if (qtdNum > estoqueDisponivel) newErrors.quantidadeUtilizada = `Stock insuficiente. Disponível: ${estoqueDisponivel.toFixed(2)}`;
            }
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [data, sementes, originalItem]);

    const onSave = async () => {
        if (!validateForm()) return window.alert('Atenção: Por favor, corrija os campos destacados.');
        const userUid = auth.currentUser?.uid;
        if (!userUid) return;

        setSaving(true);
        try {
            const batch = writeBatch(db);
            const qtdAtualNum = parseFloat(String(data.quantidadeUtilizada).replace(',', '.')) || 0;
            const qtdOriginalNum = originalItem ? (parseFloat(String(originalItem.quantidadeUtilizada).replace(',', '.')) || 0) : 0;

            if (originalItem?.estoqueItemId && originalItem.estoqueItemId !== data.estoqueItemId && qtdOriginalNum > 0) {
                const oldStockRef = doc(db, 'users', userUid, 'estoqueGeral', originalItem.estoqueItemId);
                const oldStockDoc = await getDoc(oldStockRef);
                if (oldStockDoc.exists()) batch.update(oldStockRef, { quantidade: (oldStockDoc.data().quantidade || 0) + qtdOriginalNum });
            }

            if (data.estoqueItemId && qtdAtualNum > 0) {
                const stockRef = doc(db, 'users', userUid, 'estoqueGeral', data.estoqueItemId);
                const stockDoc = await getDoc(stockRef);
                if (!stockDoc.exists()) throw new Error("Semente não encontrada.");
                const diff = qtdAtualNum - (originalItem?.estoqueItemId === data.estoqueItemId ? qtdOriginalNum : 0);
                const newStockQty = (stockDoc.data().quantidade || 0) - diff;
                if (newStockQty < 0) throw new Error(`Estoque insuficiente.`);
                batch.update(stockRef, { quantidade: newStockQty });
            }

            const sementeSel = sementes.find(s => s.id === data.estoqueItemId);
            const id = itemId || doc(collection(db, 'users', userUid, 'plantios')).id;
            const dataToSave = {
                id, ...data,
                variedade: sementeSel ? sementeSel.nome : data.variedade.trim(),
                areaPlantada: validateNumericInput(data.areaPlantada).sanitizedValue,
                populacaoSementes: validateNumericInput(data.populacaoSementes).sanitizedValue,
                quantidadeUtilizada: qtdAtualNum,
            };

            Object.keys(dataToSave).forEach(key => dataToSave[key] === undefined && delete dataToSave[key]);
            batch.set(doc(db, 'users', userUid, 'plantios', id), dataToSave, { merge: true });

            await batch.commit();
            onSaveSuccess();
        } catch (error) {
            window.alert(`Erro: Falha ao salvar: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (window.confirm('Deseja eliminar este plantio?')) {
            try {
                await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'plantios', itemId));
                onSaveSuccess();
            } catch (e) {
                window.alert('Erro: Falha ao eliminar.');
            }
        }
    };

    if (loading || loadingSementes) return (
        <div style={styles.modalOverlay}><span style={{color: '#fff'}}>Carregando...</span></div>
    );

    const sementeSel = sementes.find(s => s.id === data.estoqueItemId);
    const uni = sementeSel ? sementeSel.unidade : '';

    return (
        <div style={styles.modalOverlay}>
            <div style={styles.modalContent}>
                <div style={styles.modalHeader}>
                    <span style={styles.modalTitle}>{itemId ? 'Editar Plantio' : 'Novo Plantio'}</span>
                    <button style={styles.closeButton} onClick={onClose}>
                        <Icons.Close size={20} color={THEME.textBlack} />
                    </button>
                </div>

                <div style={styles.scrollContent}>
                    <FormSelect 
                        label="Cultura" placeholder="Selecione a cultura" required 
                        items={CULTURAS_SUGERIDAS.map(c => ({ label: c, value: c }))}
                        value={data.cultura} onValueChange={v => setField('cultura', v)}
                        error={errors.cultura}
                    />
                    <FormInput 
                        label="Talhão / Área" placeholder="Ex: Talhão 1" required 
                        value={data.talhao} onChangeText={v => setField('talhao', v)}
                        error={errors.talhao}
                    />
                    <FormSelect 
                        label="Semente (do Estoque)" placeholder="Selecione para dar baixa" 
                        items={sementes.map(s => ({ label: `${s.nome} (Estoque: ${s.quantidade} ${s.unidade})`, value: s.id }))}
                        value={data.estoqueItemId} onValueChange={v => setField('estoqueItemId', v)}
                    />
                    <FormInput 
                        label="Variedade" placeholder="" editable={!data.estoqueItemId}
                        value={sementeSel ? sementeSel.nome : data.variedade} onChangeText={v => setField('variedade', v)}
                    />
                    {data.estoqueItemId && (
                        <FormInput 
                            label={`Qtd. Utilizada (${uni})`} required type="number"
                            value={data.quantidadeUtilizada} onChangeText={v => setField('quantidadeUtilizada', v, 'numeric')}
                            error={errors.quantidadeUtilizada}
                        />
                    )}
                    <FormInput 
                        label={`Área Plantada (${UNIDADES_MEDIDA.AREA})`} type="number"
                        value={data.areaPlantada} onChangeText={v => setField('areaPlantada', v, 'numeric')}
                    />
                    <FormInput 
                        label={`População (${UNIDADES_MEDIDA.POPULACAO})`} type="number"
                        value={data.populacaoSementes} onChangeText={v => setField('populacaoSementes', v, 'numeric')}
                    />
                    <FormDate label="Data do Plantio" value={data.dataPlantio} onChange={d => setField('dataPlantio', d, 'date')} />

                    <button style={styles.saveButton} onClick={onSave} disabled={saving}>
                        <span style={styles.saveButtonText}>{saving ? 'Salvando...' : 'Salvar Plantio'}</span>
                    </button>

                    {itemId && (
                        <button style={styles.deleteButton} onClick={handleDelete}>
                            <span style={styles.deleteButtonText}>Excluir Plantio</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// =====================================================================
// 6️⃣ TELAS PRINCIPAIS (COM LISTAGEM)
// =====================================================================

export const PlantiosScreen = ({ navigation }) => {
    const [modal, setModal] = useState({ visible: false, itemId: null });
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = subscribeToCollection('plantios', (data) => {
            const sorted = data.sort((a, b) => (b.dataPlantio?.toDate?.() || 0) - (a.dataPlantio?.toDate?.() || 0));
            setItems(sorted);
            if (loading) setLoading(false);
        });
        return () => unsubscribe && unsubscribe();
    }, [loading]);

    return (
        <div style={styles.container}>
            <CustomHeader title="Plantios" onBack={() => navigation?.goBack()} />
            <div style={styles.webContainer} className="web-container-responsive">
                <div style={styles.listContainer}>
                    {loading ? (
                        <div style={{ marginTop: '50px', color: THEME.primary }}>Carregando...</div>
                    ) : items.length === 0 ? (
                        <span style={styles.emptyText}>Nenhum plantio registrado.</span>
                    ) : (
                        <div className="responsive-grid">
                            {items.map(item => (
                                <div key={item.id} style={styles.listItem} className="list-item-responsive" onClick={() => setModal({ visible: true, itemId: item.id })}>
                                <div style={styles.listIconBox}>
                                    <Icons.Leaf size={24} color={THEME.primary} />
                                </div>
                                <div style={styles.listContent}>
                                    <div style={styles.listTitle}>{item.cultura} - {item.variedade}</div>
                                    <div style={styles.listSubtitle}>{formatDate(item.dataPlantio)} • {item.talhao}</div>
                                </div>
                                <Icons.ChevronForward size={24} color={THEME.secondaryText} />
                            </div>
                            ))}
                        </div>
                    )}
                </div>
                
                <FabGroup onAdd={() => setModal({ visible: true, itemId: null })} onOpenAI={() => window.alert('IA Integrada em breve!')} />
                {modal.visible && <AddOrEditPlantioModal itemId={modal.itemId} onClose={() => setModal({ visible: false, itemId: null })} onSaveSuccess={() => setModal({ visible: false, itemId: null })} />}
            </div>
        </div>
    );
};

export const ColheitasScreen = ({ navigation }) => {
    const [modal, setModal] = useState({ visible: false, itemId: null });
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = subscribeToCollection('colheitas', (data) => {
            const sorted = data.sort((a, b) => (b.dataColheita?.toDate?.() || 0) - (a.dataColheita?.toDate?.() || 0));
            setItems(sorted);
            if (loading) setLoading(false);
        });
        return () => unsubscribe && unsubscribe();
    }, [loading]);

    return (
        <div style={styles.container}>
            <CustomHeader title="Colheitas" onBack={() => navigation?.goBack()} />
            <div style={styles.webContainer} className="web-container-responsive">
                <div style={styles.listContainer}>
                    {loading ? (
                        <div style={{ marginTop: '50px', color: THEME.primary }}>Carregando...</div>
                    ) : items.length === 0 ? (
                        <span style={styles.emptyText}>Nenhuma colheita registrada.</span>
                    ) : (
                        <div className="responsive-grid">
                            {items.map(item => (
                                <div key={item.id} style={styles.listItem} className="list-item-responsive" onClick={() => setModal({ visible: true, itemId: item.id })}>
                                <div style={styles.listIconBox}>
                                    <Icons.Silo size={24} color={THEME.primary} />
                                </div>
                                <div style={styles.listContent}>
                                    <div style={styles.listTitle}>{item.cultura} - {item.talhao}</div>
                                    <div style={styles.listSubtitle}>{formatDate(item.dataColheita)} • {item.produtividade || 0} sc/ha</div>
                                </div>
                                <Icons.ChevronForward size={24} color={THEME.secondaryText} />
                            </div>
                            ))}
                        </div>
                    )}
                </div>
                
                <FabGroup onAdd={() => setModal({ visible: true, itemId: null })} onOpenAI={() => window.alert('IA Integrada em breve!')} />
                {modal.visible && <AddOrEditColheitaModal itemId={modal.itemId} onClose={() => setModal({ visible: false, itemId: null })} onSaveSuccess={() => setModal({ visible: false, itemId: null })} />}
            </div>
        </div>
    );
};

// =====================================================================
// WRAPPER DE DEMONSTRAÇÃO
// =====================================================================

export default function PlantioColheita() {
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
                    .web-container-responsive { max-width: 1200px !important; }
                    .modal-responsive { max-width: 600px !important; align-self: center !important; margin: 5vh auto !important; border-radius: 24px !important; }
                }
            `;
            document.head.appendChild(style);
        }
    }, []);

    if (activeScreen === 'plantio') return <PlantiosScreen navigation={{ goBack: () => setActiveScreen(null) }} />;
    if (activeScreen === 'colheita') return <ColheitasScreen navigation={{ goBack: () => setActiveScreen(null) }} />;

    return (
        <div style={{ ...styles.container, justifyContent: 'center', alignItems: 'center' }}>
            <div style={styles.webContainer}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <span style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '30px', color: THEME.textBlack }}>Navegação de Teste</span>
                    <button style={{ ...styles.saveButton, width: '250px' }} onClick={() => setActiveScreen('plantio')}>
                        <span style={styles.saveButtonText}>Abrir Plantios</span>
                    </button>
                    <button style={{ ...styles.saveButton, width: '250px' }} onClick={() => setActiveScreen('colheita')}>
                        <span style={styles.saveButtonText}>Abrir Colheitas</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

// =====================================================================
// 7️⃣ ESTILOS CSS-IN-JS (MOBILE FIRST)
// =====================================================================

const styles = {
    // Fundo geral do navegador para simular a tela do dispositivo
    container: { display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', backgroundColor: '#e5e5e5', fontFamily: 'system-ui, -apple-system, sans-serif' },
    
    webContainer: { display: 'flex', flexDirection: 'column', flex: 1, width: '100%', maxWidth: '1000px', margin: '0 auto', position: 'relative', backgroundColor: THEME.background },

    // Cabeçalho
    fullHeader: { backgroundColor: THEME.primary, width: '100%', display: 'flex', justifyContent: 'center' },
    headerContent: { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '0 15px', height: '60px', width: '100%', maxWidth: '1200px', boxSizing: 'border-box' },
    backButton: { padding: '5px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' },
    headerTitle: { color: THEME.textWhite, fontSize: '22px', fontWeight: 'bold' },

    // Listas e Scroll
    listContainer: { padding: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center', flexGrow: 1, overflowY: 'auto' },
    emptyText: { color: THEME.secondaryText, fontSize: '18px', marginTop: '40px' },
    listItem: { display: 'flex', flexDirection: 'row', backgroundColor: THEME.secondary, width: '100%', padding: '15px', borderRadius: '12px', alignItems: 'center', marginBottom: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', cursor: 'pointer', border: 'none', boxSizing: 'border-box' },
    listIconBox: { width: '50px', height: '50px', backgroundColor: THEME.grayInput, borderRadius: '25px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginRight: '15px', flexShrink: 0 },
    listContent: { flex: 1, display: 'flex', flexDirection: 'column', textAlign: 'left' },
    listTitle: { fontSize: '18px', fontWeight: 'bold', color: THEME.textBlack, marginBottom: '4px' },
    listSubtitle: { fontSize: '14px', color: THEME.secondaryText },

    // FABs (Botões Flutuantes)
    fabContainer: { position: 'absolute', right: '20px', bottom: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
    fabAdd: { backgroundColor: THEME.primary, width: '50px', height: '50px', borderRadius: '25px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '15px', boxShadow: '0 2px 5px rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer' },
    fabAI: { backgroundColor: THEME.primary, width: '50px', height: '50px', borderRadius: '25px', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer' },

    // Modais e Formulários
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', zIndex: 1000 },
    modalContent: { backgroundColor: THEME.secondary, borderTopLeftRadius: '15px', borderTopRightRadius: '15px', padding: '20px', maxHeight: '90vh', width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' },
    modalHeader: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
    modalTitle: { fontSize: '24px', fontWeight: 'bold', color: THEME.textBlack },
    closeButton: { backgroundColor: THEME.grayInput, padding: '6px', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' },
    scrollContent: { overflowY: 'auto', flex: 1, paddingBottom: '20px' },
    
    inputContainer: { marginBottom: '15px', display: 'flex', flexDirection: 'column' },
    formLabel: { fontSize: '16px', color: THEME.secondaryText, marginBottom: '6px', fontWeight: '500' },
    input: { backgroundColor: THEME.grayInput, borderRadius: '8px', padding: '0 15px', height: '50px', fontSize: '16px', color: THEME.textBlack, border: '1px solid transparent', outline: 'none', boxSizing: 'border-box', width: '100%', fontFamily: 'inherit' },
    inputDisabled: { opacity: 0.6, cursor: 'not-allowed' },
    inputError: { border: `1px solid ${THEME.error}` },
    errorText: { color: THEME.error, fontSize: '12px', marginTop: '4px' },
    
    selectBox: { backgroundColor: THEME.grayInput, borderRadius: '8px', padding: '0 15px', height: '50px', fontSize: '16px', color: THEME.textBlack, border: '1px solid transparent', outline: 'none', boxSizing: 'border-box', width: '100%', fontFamily: 'inherit', cursor: 'pointer', appearance: 'none' },

    saveButton: { backgroundColor: THEME.primary, borderRadius: '8px', height: '60px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '10px', marginBottom: '10px', border: 'none', cursor: 'pointer', width: '100%' },
    saveButtonText: { color: THEME.textWhite, fontWeight: 'bold', fontSize: '20px' },
    deleteButton: { backgroundColor: 'transparent', border: `1px solid ${THEME.error}`, borderRadius: '8px', height: '60px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '20px', cursor: 'pointer', width: '100%' },
    deleteButtonText: { color: THEME.error, fontWeight: 'bold', fontSize: '18px' }
};

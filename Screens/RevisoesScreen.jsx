// -----------------------------------------------------------------------------
// RevisoesScreen.jsx
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
    errorBg: '#FFEBEE',       
    info: '#0288D1',          
    infoBg: '#E1F5FE',        
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
    let sanitized = String(value).replace(/[^0-9,.]/g, '');
    if (sanitized.includes(',')) sanitized = sanitized.replace(/\./g, '').replace(',', '.');
    return parseFloat(sanitized) || 0;
};

const formatDate = (date, options = {}) => {
    if (!date) return 'N/A';
    try {
        const dateObj = date.toDate ? date.toDate() : (typeof date === 'string' ? new Date(date) : date);
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        return `${dd}/${mm}/${yyyy}`;
    } catch (error) {
        return 'Data inválida';
    }
};

const formatCurrency = (value) => {
    return (parseFloat(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// =====================================================================
// 4️⃣ SUB-MODAL: ADICIONAR PEÇA DA REVISÃO
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
        <div className="modal-overlay centered">
            <div className="modal-content small-modal">
                <div className="modal-header">
                    <h2 className="modal-title">Adicionar Peça</h2>
                    <button className="icon-button" onClick={onClose}>
                        <Icons.Close size={24} color={THEME.textBlack} />
                    </button>
                </div>
                
                <div className="form-group">
                    <label className="form-label">Peça do Estoque <span className="required">*</span></label>
                    <select 
                        className="form-input" 
                        value={selectedPecaId} 
                        onChange={(e) => { setSelectedPecaId(e.target.value); setError(''); }}
                    >
                        <option value="">Selecione...</option>
                        {pecasDisponiveis.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.nome} (Disp: {p.quantidade} {p.unidade})
                            </option>
                        ))}
                    </select>
                </div>
                
                <div className="form-group">
                    <label className="form-label">Quantidade ({pecaSelecionada?.unidade || 'un'}) <span className="required">*</span></label>
                    <input 
                        type="number"
                        className="form-input"
                        placeholder="Ex: 2"
                        value={quantidade}
                        onChange={(e) => { setQuantidade(e.target.value); setError(''); }}
                        min="0"
                        step="0.01"
                    />
                </div>
                
                {error && <span className="error-text">{error}</span>}
                
                <button className="primary-button" onClick={handleAdd}>
                    Confirmar Peça
                </button>
            </div>
        </div>
    );
};

// =====================================================================
// 5️⃣ MODAL PRINCIPAL: ADICIONAR / EDITAR REVISÃO
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
        tipoRevisao: 'Preventiva', 
        equipamentoId: '', 
        descricaoServico: '',
        custoMaoDeObra: '', 
        responsavel: '', 
        dataRevisao: new Date().toISOString().split('T')[0]
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
        if (!itemId || !visible) {
            if (!itemId && visible) {
                setData({
                    tipoRevisao: 'Preventiva', equipamentoId: '', descricaoServico: '',
                    custoMaoDeObra: '', responsavel: '', dataRevisao: new Date().toISOString().split('T')[0]
                });
                setPecasUtilizadas([]);
                setOriginalPecas([]);
                setErrors({});
            }
            return;
        }
        
        const fetchItem = async () => {
            setLoading(true);
            const userUid = auth.currentUser?.uid;
            if (!userUid) return;
            try {
                const docSnap = await getDoc(doc(db, 'users', userUid, 'revisoes', itemId));
                if (docSnap.exists()) {
                    const item = docSnap.data();
                    let dateStr = new Date().toISOString().split('T')[0];
                    if (item.dataRevisao) {
                        const d = item.dataRevisao.toDate ? item.dataRevisao.toDate() : new Date(item.dataRevisao);
                        dateStr = d.toISOString().split('T')[0];
                    }
                    setData({
                        ...item,
                        dataRevisao: dateStr,
                        custoMaoDeObra: item.custoMaoDeObra ? String(item.custoMaoDeObra).replace('.', ',') : ''
                    });
                    const pecas = item.pecasUtilizadas || [];
                    setPecasUtilizadas(pecas);
                    setOriginalPecas(pecas);
                } else {
                    alert("Registro não encontrado.");
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

    const setField = useCallback((field, value) => {
        setData(p => ({ ...p, [field]: value }));
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
        if (!validateForm()) return alert('Corrija os campos em destaque.');

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
                if (!stockDoc.exists()) throw new Error(`Peça não encontrada.`);
                const newQty = (stockDoc.data().quantidade || 0) + change;
                if (newQty < 0) throw new Error(`Estoque insuficiente de peças.`);
                return { ref, newQty };
            });

            const stockUpdates = (await Promise.all(stockUpdatePromises)).filter(Boolean);
            stockUpdates.forEach(({ ref, newQty }) => batch.update(ref, { quantidade: newQty }));

            // SALVAR REVISÃO
            const revisaoId = itemId || doc(collection(db, 'users', userUid, 'revisoes')).id;
            // Configurar data para Date object para firestore
            const dataToSaveObj = new Date(data.dataRevisao + 'T12:00:00Z');
            
            const dataToSave = {
                id: revisaoId,
                ...data,
                dataRevisao: dataToSaveObj,
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
            alert(`Não foi possível salvar. ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Deseja excluir esta revisão? As peças serão devolvidas ao estoque.')) return;
        
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
            alert('Falha ao excluir.');
        } finally {
            setSaving(false);
        }
    };

    if (!visible) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2 className="modal-title">{itemId ? 'Editar Manutenção' : 'Nova Manutenção'}</h2>
                    <button className="icon-button" onClick={onClose}>
                        <Icons.Close size={24} color={THEME.textBlack} />
                    </button>
                </div>

                {loading ? (
                    <div className="loading-container">
                        <div className="spinner"></div>
                    </div>
                ) : (
                    <div className="modal-body">
                        {/* DADOS PRINCIPAIS */}
                        <div className="section-header">
                            <Icons.Tractor size={22} color={THEME.primary} />
                            <h3 className="section-title">Dados do Equipamento</h3>
                        </div>
                        
                        <div className="chips-container">
                            <button 
                                className={`chip-button ${data.tipoRevisao === 'Preventiva' ? 'active-preventiva' : ''}`}
                                onClick={() => setField('tipoRevisao', 'Preventiva')}
                            >
                                Preventiva
                            </button>
                            <button 
                                className={`chip-button ${data.tipoRevisao === 'Corretiva' ? 'active-corretiva' : ''}`}
                                onClick={() => setField('tipoRevisao', 'Corretiva')}
                            >
                                Corretiva
                            </button>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Veículo / Equipamento <span className="required">*</span></label>
                            <select 
                                className={`form-input ${errors.equipamentoId ? 'input-error' : ''}`}
                                value={data.equipamentoId}
                                onChange={(e) => setField('equipamentoId', e.target.value)}
                                disabled={loadingEquip}
                            >
                                <option value="">{loadingEquip ? 'Carregando...' : 'Selecione'}</option>
                                {equipamentos.map(e => (
                                    <option key={e.id} value={e.id}>{e.marca} {e.modelo}</option>
                                ))}
                            </select>
                            {errors.equipamentoId && <span className="error-text">{errors.equipamentoId}</span>}
                        </div>

                        {/* SERVIÇO E PEÇAS */}
                        <div className="section-header">
                            <Icons.Cogs size={22} color={THEME.primary} />
                            <h3 className="section-title">Serviços e Peças</h3>
                        </div>
                        
                        <div className="form-group">
                            <label className="form-label">Descrição do Serviço</label>
                            <textarea 
                                className={`form-input textarea ${errors.descricaoServico ? 'input-error' : ''}`}
                                placeholder="Descreva os reparos ou manutenções efetuadas..."
                                value={data.descricaoServico}
                                onChange={(e) => setField('descricaoServico', e.target.value)}
                                rows={3}
                            />
                            {errors.descricaoServico && <span className="error-text">{errors.descricaoServico}</span>}
                        </div>

                        <div className="form-group">
                            <label className="form-label" style={{marginBottom: '12px'}}>Peças Utilizadas do Estoque</label>
                            
                            {pecasUtilizadas.length > 0 ? (
                                <div className="pecas-list">
                                    {pecasUtilizadas.map(peca => (
                                        <div key={peca.estoqueItemId} className="peca-item">
                                            <div className="peca-info">
                                                <div className="peca-title">{peca.nome}</div>
                                                <div className="peca-subtitle">
                                                    {peca.quantidade} {peca.unidade} • {formatCurrency(peca.valorUnitario * peca.quantidade)}
                                                </div>
                                            </div>
                                            <button className="icon-button delete" onClick={() => handleRemovePeca(peca.estoqueItemId)}>
                                                <Icons.Trash size={20} color={THEME.error} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-pecas">Nenhuma peça vinculada a esta revisão.</div>
                            )}

                            <button 
                                className="add-peca-btn" 
                                onClick={() => setIsPecaModalVisible(true)} 
                                disabled={loadingPecas}
                            >
                                <Icons.Add size={20} color={THEME.primary} />
                                <span>{loadingPecas ? 'Carregando...' : 'Adicionar Peça'}</span>
                            </button>
                        </div>

                        {/* CUSTOS E FINALIZAÇÃO */}
                        <div className="section-header">
                            <Icons.CashMultiple size={22} color={THEME.primary} />
                            <h3 className="section-title">Custos e Finalização</h3>
                        </div>
                        
                        <div className="form-group">
                            <label className="form-label">Mão de Obra (R$)</label>
                            <input 
                                type="text"
                                className="form-input"
                                placeholder="Ex: 150,00"
                                value={data.custoMaoDeObra}
                                onChange={(e) => setField('custoMaoDeObra', e.target.value.replace(/[^0-9,.]/g, ''))}
                            />
                        </div>

                        <div className="summary-card">
                            <div className="summary-row">
                                <span className="summary-text">Peças:</span>
                                <span className="summary-text">{formatCurrency(custoPecas)}</span>
                            </div>
                            <div className="summary-row">
                                <span className="summary-text">Mão de Obra:</span>
                                <span className="summary-text">{formatCurrency(parseMoeda(data.custoMaoDeObra))}</span>
                            </div>
                            <div className="summary-divider"></div>
                            <div className="summary-row">
                                <span className="summary-total-label">Custo Total</span>
                                <span className="summary-total-value">{formatCurrency(custoTotal)}</span>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Responsável / Oficina</label>
                            <input 
                                type="text"
                                className={`form-input ${errors.responsavel ? 'input-error' : ''}`}
                                placeholder="Nome do mecânico ou empresa"
                                value={data.responsavel}
                                onChange={(e) => setField('responsavel', e.target.value)}
                            />
                            {errors.responsavel && <span className="error-text">{errors.responsavel}</span>}
                        </div>
                        
                        <div className="form-group">
                            <label className="form-label">Data da Revisão</label>
                            <div className="date-input-container">
                                <div className="date-icon">
                                    <Icons.Calendar size={20} color={THEME.primary} />
                                </div>
                                <input 
                                    type="date"
                                    className="form-input with-icon"
                                    value={data.dataRevisao}
                                    onChange={(e) => setField('dataRevisao', e.target.value)}
                                />
                            </div>
                        </div>

                        <button className="primary-button" onClick={onSave} disabled={saving}>
                            {saving ? 'Salvando...' : 'Salvar Manutenção'}
                        </button>

                        {itemId && (
                            <button className="danger-button" onClick={handleDelete} disabled={saving}>
                                <Icons.Trash size={18} color={THEME.error} />
                                <span>Excluir Revisão</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Sub-Modal de Peças */}
            <AddPecaModal 
                visible={isPecaModalVisible} 
                onClose={() => setIsPecaModalVisible(false)} 
                onAddPeca={handleAddPeca} 
                pecasDisponiveis={pecasEmEstoque} 
            />
        </div>
    );
};

// =====================================================================
// 6️⃣ TELA PRINCIPAL (LISTAGEM DE REVISÕES)
// =====================================================================

export default function RevisoesScreen({ navigation }) {
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
        if (tipo === 'Corretiva') return { color: THEME.error, bg: THEME.errorBg, icon: Icons.AlertCircle };
        return { color: THEME.info, bg: THEME.infoBg, icon: Icons.ShieldCheck };
    };

    return (
        <div className="web-container">
            <div className="header">
                <button className="icon-button back-btn" onClick={() => navigation?.goBack()}>
                    <Icons.ChevronBack size={28} color={THEME.textWhite} />
                </button>
                <h1 className="header-title">Histórico de Manutenções</h1>
                <div style={{ width: 40 }}></div>
            </div>

            <div className="content">
                {loading ? (
                    <div className="loading-container" style={{ marginTop: 50 }}>
                        <div className="spinner"></div>
                    </div>
                ) : items.length === 0 ? (
                    <div className="empty-state">
                        <Icons.Toolbox size={64} color={THEME.border} />
                        <h2 className="empty-title">Nenhuma manutenção</h2>
                        <p className="empty-text">Mantenha seu maquinário em dia registrando as revisões no botão + abaixo.</p>
                    </div>
                ) : (
                    <div className="list-container">
                        {items.map(item => {
                            const status = getStatusStyle(item.tipoRevisao);
                            const StatusIcon = status.icon;
                            return (
                                <div key={item.id} className="list-item" onClick={() => setModal({ visible: true, itemId: item.id })}>
                                    <div className="list-icon-box" style={{ backgroundColor: status.bg }}>
                                        <Icons.Wrench size={26} color={status.color} />
                                    </div>
                                    <div className="list-content-box">
                                        <div className="list-title">{item.equipamentoNome || 'Equipamento'}</div>
                                        <div className="list-subtitle-row">
                                            <StatusIcon size={14} color={status.color} />
                                            <span style={{ color: status.color, fontWeight: '600', marginLeft: '4px', marginRight: '4px' }}>
                                                {item.tipoRevisao}
                                            </span>
                                            <span className="list-subtitle">• {formatDate(item.dataRevisao)}</span>
                                        </div>
                                        <div className="list-value">{formatCurrency(item.custoTotal)}</div>
                                    </div>
                                    <Icons.ChevronForward size={20} color={THEME.secondaryText} />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <button className="fab-add" onClick={() => setModal({ visible: true, itemId: null })}>
                <Icons.Add size={30} color={THEME.textWhite} />
            </button>

            <AddOrEditRevisaoModal
                visible={modal.visible}
                itemId={modal.itemId}
                onClose={() => setModal({ visible: false, itemId: null })}
                onSaveSuccess={() => setModal({ visible: false, itemId: null })}
            />

            <style>{`
                /* VARIÁVEIS DE COR E FONTES (Para Web) */
                :root {
                    --primary: ${THEME.primary};
                    --primary-dark: ${THEME.primaryDark};
                    --secondary: ${THEME.secondary};
                    --background: ${THEME.background};
                    --text-black: ${THEME.textBlack};
                    --text-white: ${THEME.textWhite};
                    --secondary-text: ${THEME.secondaryText};
                    --gray-input: ${THEME.grayInput};
                    --border: ${THEME.border};
                    --error: ${THEME.error};
                    --error-bg: ${THEME.errorBg};
                    --info: ${THEME.info};
                    --info-bg: ${THEME.infoBg};
                }

                * {
                    box-sizing: border-box;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                }

                html, body {
                    margin: 0;
                    padding: 0;
                    background-color: var(--background);
                }

                .web-container {
                    display: flex;
                    flex-direction: column;
                    width: 100%;
                    max-width: 1200px;
                    margin: 0 auto;
                    min-height: 100vh;
                    background-color: var(--background);
                    position: relative;
                }

                /* HEADER */
                .header {
                    background-color: var(--primary);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 15px 16px;
                    color: var(--text-white);
                }

                .header-title {
                    font-size: 20px;
                    font-weight: 700;
                    margin: 0;
                }

                .icon-button {
                    background: none;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 4px;
                }
                
                .back-btn {
                    margin-left: -8px;
                }

                /* CONTENT */
                .content {
                    flex: 1;
                    padding: 16px;
                    padding-bottom: 100px;
                    display: flex;
                    flex-direction: column;
                }

                /* LOADING */
                .loading-container {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 40px;
                }

                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid rgba(76, 175, 80, 0.2);
                    border-left-color: var(--primary);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                /* EMPTY STATE */
                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    margin-top: 40px;
                    text-align: center;
                    padding: 0 20px;
                }

                .empty-title {
                    color: var(--text-black);
                    font-size: 22px;
                    font-weight: 600;
                    margin: 16px 0 8px;
                }

                .empty-text {
                    color: var(--secondary-text);
                    font-size: 16px;
                    line-height: 1.5;
                    margin: 0;
                }

                /* LIST ITEM */
                .list-container {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .list-item {
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    background-color: var(--secondary);
                    padding: 16px;
                    border-radius: 16px;
                    border: 1px solid var(--border);
                    cursor: pointer;
                    transition: all 0.2s ease;
                    text-align: left;
                }

                .list-item:hover {
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                    transform: translateY(-2px);
                }

                .list-icon-box {
                    width: 50px;
                    height: 50px;
                    border-radius: 14px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    margin-right: 16px;
                    flex-shrink: 0;
                }

                .list-content-box {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    min-width: 0;
                }

                .list-title {
                    font-size: 18px;
                    font-weight: 700;
                    color: var(--text-black);
                    margin-bottom: 4px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .list-subtitle-row {
                    display: flex;
                    align-items: center;
                    margin-bottom: 6px;
                    font-size: 14px;
                }

                .list-subtitle {
                    color: var(--secondary-text);
                }

                .list-value {
                    font-size: 18px;
                    font-weight: 800;
                    color: var(--text-black);
                }

                /* FAB */
                .fab-add {
                    position: fixed;
                    right: calc(50% - 380px);
                    bottom: 34px;
                    width: 60px;
                    height: 60px;
                    border-radius: 30px;
                    background-color: var(--primary);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    border: none;
                    cursor: pointer;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.2);
                    transition: transform 0.2s;
                    z-index: 100;
                }
                
                @media (max-width: 800px) {
                    .fab-add {
                        right: 24px;
                    }
                }

                .fab-add:hover {
                    transform: scale(1.05);
                }

                /* MODAL OVERLAY */
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: rgba(0,0,0,0.5);
                    display: flex;
                    justify-content: center;
                    align-items: flex-end;
                    z-index: 1000;
                    animation: fadeIn 0.3s ease;
                }

                .modal-overlay.centered {
                    align-items: center;
                    padding: 20px;
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                /* MODAL CONTENT */
                .modal-content {
                    background-color: var(--secondary);
                    width: 100%;
                    max-width: 600px;
                    max-height: 90vh;
                    border-radius: 24px 24px 0 0;
                    display: flex;
                    flex-direction: column;
                    animation: slideUp 0.3s ease;
                }

                .small-modal {
                    border-radius: 20px;
                    padding: 24px;
                    max-width: 450px;
                    max-height: 90vh;
                    animation: scaleUp 0.3s ease;
                }

                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }

                @keyframes scaleUp {
                    from { transform: scale(0.9); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 24px;
                    border-bottom: 1px solid var(--border);
                }

                .small-modal .modal-header {
                    padding: 0 0 20px 0;
                    border-bottom: none;
                }

                .modal-title {
                    font-size: 22px;
                    font-weight: 800;
                    color: var(--text-black);
                    margin: 0;
                }

                .modal-body {
                    padding: 24px;
                    overflow-y: auto;
                }
                
                /* SECTION HEADER */
                .section-header {
                    display: flex;
                    align-items: center;
                    margin-top: 10px;
                    margin-bottom: 16px;
                }
                
                .section-title {
                    font-size: 18px;
                    font-weight: 800;
                    color: var(--text-black);
                    margin: 0 0 0 8px;
                }

                /* CHIPS */
                .chips-container {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 20px;
                    overflow-x: auto;
                    padding-bottom: 5px;
                }
                
                .chip-button {
                    background-color: var(--secondary);
                    border: 1px solid var(--border);
                    color: var(--secondary-text);
                    padding: 10px 18px;
                    border-radius: 20px;
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: all 0.2s;
                }
                
                .chip-button.active-preventiva {
                    background-color: var(--info);
                    border-color: var(--info);
                    color: var(--text-white);
                }
                
                .chip-button.active-corretiva {
                    background-color: var(--error);
                    border-color: var(--error);
                    color: var(--text-white);
                }

                /* FORMS */
                .form-group {
                    margin-bottom: 20px;
                    display: flex;
                    flex-direction: column;
                }

                .form-label {
                    font-size: 15px;
                    color: var(--text-black);
                    font-weight: 600;
                    margin-bottom: 8px;
                    margin-left: 4px;
                    text-align: left;
                }

                .required {
                    color: var(--primary);
                }

                .form-input {
                    background-color: var(--gray-input);
                    border: 1px solid transparent;
                    border-radius: 14px;
                    padding: 0 16px;
                    height: 54px;
                    font-size: 16px;
                    color: var(--text-black);
                    width: 100%;
                    transition: border-color 0.2s;
                    appearance: none;
                }

                .form-input:focus {
                    outline: none;
                    border-color: var(--primary);
                }
                
                .form-input:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .input-error {
                    border-color: var(--error);
                }

                .error-text {
                    color: var(--error);
                    font-size: 12px;
                    margin-top: 6px;
                    margin-left: 4px;
                }
                
                .textarea {
                    height: auto;
                    min-height: 100px;
                    padding-top: 16px;
                    resize: vertical;
                }

                /* DATE INPUT */
                .date-input-container {
                    position: relative;
                    display: flex;
                    align-items: center;
                }
                
                .date-icon {
                    position: absolute;
                    left: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-right: 1px solid var(--border);
                    padding-right: 12px;
                    height: 60%;
                    pointer-events: none;
                }
                
                .form-input.with-icon {
                    padding-left: 60px;
                }

                /* PECAS LIST */
                .pecas-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-bottom: 12px;
                }
                
                .peca-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background-color: var(--secondary);
                    border: 1px solid var(--border);
                    padding: 14px;
                    border-radius: 12px;
                }
                
                .peca-info {
                    display: flex;
                    flex-direction: column;
                }
                
                .peca-title {
                    font-size: 15px;
                    font-weight: 700;
                    color: var(--text-black);
                    margin-bottom: 4px;
                }
                
                .peca-subtitle {
                    font-size: 13px;
                    color: var(--secondary-text);
                }
                
                .empty-pecas {
                    color: var(--secondary-text);
                    font-size: 13px;
                    margin-bottom: 12px;
                    font-style: italic;
                    margin-left: 4px;
                }
                
                .add-peca-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    height: 54px;
                    border: 1.5px dashed var(--primary);
                    border-radius: 14px;
                    background-color: rgba(76, 175, 80, 0.05);
                    color: var(--primary);
                    font-size: 16px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                
                .add-peca-btn:hover {
                    background-color: rgba(76, 175, 80, 0.1);
                }
                
                .add-peca-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                /* SUMMARY CARD */
                .summary-card {
                    background-color: var(--background);
                    padding: 16px;
                    border-radius: 16px;
                    margin-bottom: 20px;
                    border: 1px solid #C5E1A5;
                }
                
                .summary-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin: 4px 0;
                }
                
                .summary-text {
                    font-size: 15px;
                    color: var(--secondary-text);
                    font-weight: 500;
                }
                
                .summary-divider {
                    height: 1px;
                    background-color: #DDF0C7;
                    margin: 12px 0;
                }
                
                .summary-total-label {
                    font-size: 16px;
                    font-weight: 700;
                    color: var(--text-black);
                }
                
                .summary-total-value {
                    font-size: 22px;
                    font-weight: 800;
                    color: var(--primary-dark);
                }

                /* BUTTONS */
                .primary-button {
                    background-color: var(--primary);
                    color: var(--text-white);
                    border: none;
                    border-radius: 14px;
                    height: 54px;
                    font-size: 18px;
                    font-weight: 700;
                    cursor: pointer;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    margin-top: 10px;
                    box-shadow: 0 4px 8px rgba(76, 175, 80, 0.2);
                    transition: all 0.2s;
                    width: 100%;
                }

                .primary-button:hover:not(:disabled) {
                    background-color: var(--primary-dark);
                    transform: translateY(-2px);
                }
                
                .primary-button:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }

                .danger-button {
                    background-color: transparent;
                    color: var(--error);
                    border: none;
                    border-radius: 14px;
                    height: 54px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 8px;
                    margin-top: 10px;
                    transition: background-color 0.2s;
                    width: 100%;
                }

                .danger-button:hover:not(:disabled) {
                    background-color: var(--error-bg);
                }
                
                select {
                    -webkit-appearance: none;
                    -moz-appearance: none;
                    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%234A4A4A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>');
                    background-repeat: no-repeat;
                    background-position: right 16px center;
                    background-size: 20px;
                }
                @media (min-width: 768px) {
                    .list-container {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                        gap: 15px;
                    }
                    .modal-content {
                        border-radius: 24px;
                        align-self: center;
                        margin-bottom: 4vh;
                    }
                    .modal-overlay {
                        align-items: center;
                        padding: 20px;
                    }
                }
            `}</style>
        </div>
    );
}

// -----------------------------------------------------------------------------
// Pulverizacao.jsx
//
// Módulo de Gestão de Pulverizações.
// Adaptado EXCLUSIVAMENTE PARA WEB (Responsivo).
// Integrado ao Firestore, com cálculo automático de doses e baixa de estoque atômica.
// Design W3Labs - Clean Web UI
// -----------------------------------------------------------------------------
import React, { useState, useEffect, useCallback } from 'react';
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
    warning: '#F57C00',
    warningBg: '#FFF3E0',
    success: '#388E3C',
    successBg: '#E8F5E9',
    lightGray: '#F5F5F5'
};

const NUMBER_SANITIZER_REGEX = /[^0-9,.]/g;

const parseMoeda = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    let sanitized = value.toString().replace(NUMBER_SANITIZER_REGEX, '');
    if (sanitized.includes(',')) {
        sanitized = sanitized.replace(/\./g, '').replace(',', '.');
    }
    return parseFloat(sanitized) || 0;
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

// =====================================================================
// 2️⃣ ÍCONES SVG INLINE (Para Web)
// =====================================================================

const Icons = {
    ChevronBack: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>),
    ChevronForward: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>),
    Add: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>),
    Close: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>),
    Clipboard: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>),
    Sprout: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22v-9m0 0C7 13 4 8.5 4 4c4 0 8.5 3 8.5 9zm0 0c5 0 8-4.5 8-9-4 0-8.5 3-8.5 9z"/></svg>),
    Flask: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2v7.31L2.03 20.3a2 2 0 0 0 1.64 3.07h16.66a2 2 0 0 0 1.64-3.07L14 9.31V2"></path><line x1="8.5" y1="2" x2="15.5" y2="2"></line><line x1="6" y1="14" x2="18" y2="14"></line></svg>),
    Cloud: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>),
    Spray: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10h16M10 2v8M14 2v8M6 10v12M18 10v12"/><path d="M22 6a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4h6V6z"/></svg>),
    Trash: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>),
    Calendar: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>),
    TextureBox: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>),
    Leaf: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>),
};

// =====================================================================
// 3️⃣ COMPONENTES DE UI REUTILIZÁVEIS
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

const FormInput = ({ label, placeholder, value, onChangeText, required, type = 'text', editable = true, error }) => (
    <div style={styles.inputContainer}>
        <label style={styles.formLabel}>{label} {required && <span style={{ color: THEME.primary }}>*</span>}</label>
        <input
            type={type}
            style={{ 
                ...styles.input, 
                ...(!editable ? { opacity: 0.6, backgroundColor: THEME.border, cursor: 'not-allowed' } : {}), 
                ...(error ? { borderColor: THEME.error, borderWidth: 1 } : {}) 
            }}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChangeText(e.target.value)}
            disabled={!editable}
        />
        {error && <span style={styles.errorText}>{error}</span>}
    </div>
);

const FormSelect = ({ label, placeholder, value, onValueChange, items, required, error }) => (
    <div style={styles.inputContainer}>
        <label style={styles.formLabel}>{label} {required && <span style={{ color: THEME.primary }}>*</span>}</label>
        <select
            style={{ ...styles.selectBox, ...(error ? { borderColor: THEME.error, borderWidth: 1 } : {}) }}
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
    // Formata a data para YYYY-MM-DD (padrão do input type="date")
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
                        onChange(new Date(`${e.target.value}T12:00:00`)); // Time neutro
                    }
                }}
            />
        </div>
    );
};

const ChoiceChips = ({ options, selectedValue, onValueChange }) => (
    <div style={{ display: 'flex', overflowX: 'auto', marginBottom: '20px', paddingBottom: '5px' }}>
        {options.map((opt, i) => {
            const isActive = selectedValue === opt.value;
            return (
                <button 
                    key={i} 
                    style={{ ...styles.chipButton, ...(isActive ? styles.chipButtonActive : {}) }} 
                    onClick={() => onValueChange(opt.value)}
                >
                    <span style={{ ...styles.chipText, ...(isActive ? styles.chipTextActive : {}) }}>{opt.label}</span>
                </button>
            );
        })}
    </div>
);

// =====================================================================
// 4️⃣ MODAL DE CADASTRO / EDIÇÃO
// =====================================================================

const AddOrEditPulverizacaoModal = ({ itemId, onClose, onSaveSuccess }) => {
    const [equipamentos, setEquipamentos] = useState([]);
    const [defensivosEmEstoque, setDefensivosEmEstoque] = useState([]);
    const [loadingDependencies, setLoadingDependencies] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [originalItem, setOriginalItem] = useState(null);
    const [errors, setErrors] = useState({});

    const [data, setData] = useState({
        status: 'Realizado', operador: '', dataAplicacao: new Date(), equipamentoId: '',
        tipoAplicacao: 'Herbicida', cultura: '', talhao: '', areaTalhao: '',
        estoqueItemId: '', produto: '', dose: '', unidadeDose: 'L/ha', quantidadeUtilizada: '',
        temperatura: '', umidade: '', velocidadeVento: ''
    });

    // Buscar Dependências
    useEffect(() => {
        const fetchDependencies = async () => {
            setLoadingDependencies(true);
            const userUid = auth.currentUser?.uid;
            if (!userUid) return;

            try {
                const equipSnap = await getDocs(collection(db, 'users', userUid, 'inventario'));
                const equipList = equipSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.marca?.localeCompare(b.marca));
                setEquipamentos(equipList);

                const stockSnap = await getDocs(collection(db, 'users', userUid, 'estoqueGeral'));
                const stockList = stockSnap.docs.map(d => ({ id: d.id, ...d.data() }))
                    .filter(p => p.tipo === 'Defensivo' || p.tipo === 'Fertilizante')
                    .sort((a, b) => a.nome?.localeCompare(b.nome));
                setDefensivosEmEstoque(stockList);
            } catch (error) {
                console.error("Erro de dependências:", error);
            } finally {
                setLoadingDependencies(false);
            }
        };
        fetchDependencies();
    }, []);

    // Buscar Item para Edição
    useEffect(() => {
        if (itemId) {
            setLoading(true);
            const fetchItem = async () => {
                const userUid = auth.currentUser?.uid;
                if (!userUid) return;

                try {
                    const docSnap = await getDoc(doc(db, 'users', userUid, 'pulverizacoes', itemId));
                    if (docSnap.exists()) {
                        const item = docSnap.data();
                        setData({
                            ...item,
                            dataAplicacao: item.dataAplicacao?.toDate ? item.dataAplicacao.toDate() : new Date(),
                            quantidadeUtilizada: item.quantidadeUtilizada ? String(item.quantidadeUtilizada).replace('.', ',') : '',
                            areaTalhao: item.areaTalhao ? String(item.areaTalhao).replace('.', ',') : '',
                            dose: item.dose ? String(item.dose).replace('.', ',') : '',
                            temperatura: item.temperatura ? String(item.temperatura).replace('.', ',') : '',
                            umidade: item.umidade ? String(item.umidade).replace('.', ',') : '',
                            velocidadeVento: item.velocidadeVento ? String(item.velocidadeVento).replace('.', ',') : '',
                        });
                        setOriginalItem(item);
                    } else {
                        window.alert("Erro: Registro não encontrado.");
                        onClose();
                    }
                } catch (error) {
                    console.error("Erro ao buscar item", error);
                } finally {
                    setLoading(false);
                }
            };
            fetchItem();
        }
    }, [itemId, onClose]);

    // Cálculo Automático de Quantidade Utilizada
    useEffect(() => {
        if (!loading) {
            const area = parseMoeda(data.areaTalhao);
            const dose = parseMoeda(data.dose);
            if (area > 0 && dose > 0) {
                const total = area * dose;
                setData(prev => ({ ...prev, quantidadeUtilizada: total.toFixed(2).replace('.', ',') }));
            }
        }
    }, [data.areaTalhao, data.dose, loading]);

    const setField = useCallback((field, value, type = 'text') => {
        let processedValue = value;
        if (type === 'numeric') processedValue = value.replace(/[^0-9,.]/g, '');
        setData(p => ({ ...p, [field]: processedValue }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    }, [errors]);

    const validateForm = useCallback(() => {
        const newErrors = {};
        if (!data.cultura?.trim()) newErrors.cultura = 'Obrigatório.';
        if (!data.talhao?.trim()) newErrors.talhao = 'Obrigatório.';
        if (!data.estoqueItemId && !data.produto?.trim()) newErrors.produto = 'Selecione ou digite um produto.';
        
        const qtdTotal = parseMoeda(data.quantidadeUtilizada);
        if (qtdTotal <= 0) newErrors.quantidadeUtilizada = 'Inválido.';

        if (data.estoqueItemId) {
            const defensivo = defensivosEmEstoque.find(d => d.id === data.estoqueItemId);
            const originalQtd = originalItem ? (originalItem.quantidadeUtilizada || 0) : 0;
            const disponivel = (parseFloat(defensivo?.quantidade || 0)) + (originalItem?.estoqueItemId === data.estoqueItemId ? originalQtd : 0);
            if (defensivo && qtdTotal > disponivel) {
                newErrors.quantidadeUtilizada = `Saldo insuficiente. Máx: ${disponivel.toFixed(2)}`;
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [data, defensivosEmEstoque, originalItem]);

    const onSave = async () => {
        if (!validateForm()) return window.alert('Aviso: Verifique os campos destacados.');
        
        setSaving(true);
        const userUid = auth.currentUser?.uid;
        if (!userUid) return;

        try {
            const batch = writeBatch(db);
            const defensivo = defensivosEmEstoque.find(d => d.id === data.estoqueItemId);
            
            const qtdSalvar = parseMoeda(data.quantidadeUtilizada);
            const doseSalvar = parseMoeda(data.dose);
            const areaSalvar = parseMoeda(data.areaTalhao);

            // --- GESTÃO DE ESTOQUE ---
            const stockChanges = new Map();
            if (originalItem?.estoqueItemId && originalItem.quantidadeUtilizada > 0) {
                stockChanges.set(originalItem.estoqueItemId, (stockChanges.get(originalItem.estoqueItemId) || 0) + originalItem.quantidadeUtilizada);
            }
            if (data.estoqueItemId && qtdSalvar > 0) {
                stockChanges.set(data.estoqueItemId, (stockChanges.get(data.estoqueItemId) || 0) - qtdSalvar);
            }

            const stockUpdatePromises = Array.from(stockChanges.entries()).map(async ([stockItemId, change]) => {
                if (change === 0) return null;
                const stockRef = doc(db, 'users', userUid, 'estoqueGeral', stockItemId);
                const stockDoc = await getDoc(stockRef);
                if (!stockDoc.exists()) throw new Error(`Estoque não encontrado.`);
                const newQty = (stockDoc.data().quantidade || 0) + change;
                if (newQty < 0) throw new Error(`Estoque insuficiente para "${stockDoc.data().nome}".`);
                return { ref: stockRef, newQty };
            });

            const stockUpdates = (await Promise.all(stockUpdatePromises)).filter(Boolean);
            stockUpdates.forEach(({ ref, newQty }) => batch.update(ref, { quantidade: newQty }));

            // --- SALVAR REGISTRO ---
            const docId = itemId || doc(collection(db, 'users', userUid, 'pulverizacoes')).id;
            const payload = {
                id: docId,
                status: data.status,
                operador: data.operador,
                tipoAplicacao: data.tipoAplicacao,
                cultura: data.cultura,
                talhao: data.talhao,
                areaTalhao: areaSalvar,
                estoqueItemId: data.estoqueItemId,
                produto: defensivo ? defensivo.nome : data.produto,
                unidade: defensivo ? defensivo.unidade : 'L/kg',
                dose: doseSalvar,
                quantidadeUtilizada: qtdSalvar,
                equipamentoId: data.equipamentoId,
                equipamentoNome: equipamentos.find(e => e.id === data.equipamentoId)?.modelo || 'N/A',
                temperatura: parseMoeda(data.temperatura),
                umidade: parseMoeda(data.umidade),
                velocidadeVento: parseMoeda(data.velocidadeVento),
                dataAplicacao: data.dataAplicacao,
                updatedAt: new Date()
            };

            batch.set(doc(db, 'users', userUid, 'pulverizacoes', docId), payload, { merge: true });
            await batch.commit();
            onSaveSuccess();

        } catch (error) {
            window.alert("Erro ao Salvar: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (window.confirm('Tem certeza que deseja apagar esta aplicação?')) {
            try {
                await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'pulverizacoes', itemId));
                onSaveSuccess();
            } catch (e) {
                window.alert('Erro: Falha ao excluir.');
            }
        }
    };

    const defensivoSelecionado = defensivosEmEstoque.find(d => d.id === data.estoqueItemId);

    return (
        <div style={styles.modalOverlay} onClick={onClose}>
            <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                
                <div style={styles.modalHeader}>
                    <span style={styles.modalTitle}>{itemId ? "Editar Aplicação" : "Nova Aplicação"}</span>
                    <button style={styles.closeButton} onClick={onClose}>
                        <Icons.Close size={24} color={THEME.textBlack} />
                    </button>
                </div>

                {loadingDependencies || loading ? (
                     <div style={{ textAlign: 'center', padding: '40px 0', color: THEME.primary }}>Carregando...</div>
                ) : (
                    <div style={{ overflowY: 'auto', flex: 1, paddingBottom: '30px' }}>
                        {/* OPERACIONAL */}
                        <SectionHeader title="Dados Operacionais" IconComponent={Icons.Clipboard} />
                        <div style={styles.row}>
                            <div style={{ flex: 1 }}>
                                <FormSelect label="Status" items={[{label: 'Realizado', value: 'Realizado'}, {label: 'Planejado', value: 'Planejado'}]} value={data.status} onValueChange={v => setField('status', v)} />
                            </div>
                            <div style={{ flex: 1, marginLeft: '12px' }}>
                                <FormDate label="Data" value={data.dataAplicacao} onChange={d => setField('dataAplicacao', d)} />
                            </div>
                        </div>
                        <FormInput label="Operador" value={data.operador} onChangeText={v => setField('operador', v)} placeholder="Nome do responsável" />
                        <FormSelect label="Equipamento" items={equipamentos.map(e => ({ label: `${e.marca} ${e.modelo}`, value: e.id }))} value={data.equipamentoId} onValueChange={v => setField('equipamentoId', v)} placeholder="Selecione o trator/pulverizador" />

                        {/* AGRONÔMICO */}
                        <SectionHeader title="Local e Cultura" IconComponent={Icons.Sprout} />
                        <ChoiceChips options={[{label:'Herbicida', value:'Herbicida'}, {label:'Fungicida', value:'Fungicida'}, {label:'Inseticida', value:'Inseticida'}, {label:'Adubo Foliar', value:'Adubo'}]} selectedValue={data.tipoAplicacao} onValueChange={v => setField('tipoAplicacao', v)} />
                        <div style={styles.row}>
                            <div style={{ flex: 1 }}><FormInput label="Cultura *" value={data.cultura} onChangeText={v => setField('cultura', v)} error={errors.cultura} placeholder="Ex: Soja" /></div>
                            <div style={{ flex: 1, marginLeft: '12px' }}><FormInput label="Talhão *" value={data.talhao} onChangeText={v => setField('talhao', v)} error={errors.talhao} placeholder="Ex: T-01" /></div>
                        </div>
                        <FormInput label="Área Aplicada (ha)" value={data.areaTalhao} onChangeText={v => setField('areaTalhao', v, 'numeric')} type="number" placeholder="0,00" />

                        {/* PRODUTO */}
                        <SectionHeader title="Insumo e Dosagem" IconComponent={Icons.Flask} />
                        <FormSelect label="Produto do Estoque" items={defensivosEmEstoque.map(d => ({ label: `${d.nome} (Disp: ${d.quantidade} ${d.unidade})`, value: d.id }))} value={data.estoqueItemId} onValueChange={v => setField('estoqueItemId', v)} placeholder="Vincular ao estoque..." />
                        {!data.estoqueItemId && <FormInput label="Produto (Registro Manual)" value={data.produto} onChangeText={v => setField('produto', v)} error={errors.produto} placeholder="Nome do insumo" />}
                        
                        <div style={styles.row}>
                            <div style={{ flex: 1 }}><FormInput label={`Dose (${defensivoSelecionado?.unidade || 'L'}/ha)`} value={data.dose} onChangeText={v => setField('dose', v, 'numeric')} type="number" placeholder="0,00" /></div>
                            <div style={{ flex: 1, marginLeft: '12px' }}><FormInput label="Total Utilizado *" value={data.quantidadeUtilizada} onChangeText={v => setField('quantidadeUtilizada', v, 'numeric')} type="number" error={errors.quantidadeUtilizada} placeholder="0,00" /></div>
                        </div>

                        {/* CLIMA */}
                        <SectionHeader title="Condições Climáticas" IconComponent={Icons.Cloud} />
                        <div style={styles.row}>
                            <div style={{ flex: 1 }}><FormInput label="Temp. (°C)" value={data.temperatura} onChangeText={v => setField('temperatura', v, 'numeric')} type="number" placeholder="0,0" /></div>
                            <div style={{ flex: 1, margin: '0 12px' }}><FormInput label="Umid. (%)" value={data.umidade} onChangeText={v => setField('umidade', v, 'numeric')} type="number" placeholder="0,0" /></div>
                            <div style={{ flex: 1 }}><FormInput label="Vento (km/h)" value={data.velocidadeVento} onChangeText={v => setField('velocidadeVento', v, 'numeric')} type="number" placeholder="0,0" /></div>
                        </div>

                        <button style={styles.saveButton} onClick={onSave} disabled={saving}>
                            <span style={styles.saveButtonText}>{saving ? 'Salvando...' : 'Confirmar Aplicação'}</span>
                        </button>
                        
                        {itemId && (
                            <button style={styles.deleteButton} onClick={handleDelete}>
                                <Icons.Trash size={18} color={THEME.error} />
                                <span style={{...styles.deleteButtonText, marginLeft: '6px'}}>Excluir Aplicação</span>
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// =====================================================================
// 5️⃣ TELA PRINCIPAL DE LISTAGEM
// =====================================================================

export default function PulverizacaoListaScreen({ navigation }) {
    const [modal, setModal] = useState({ visible: false, itemId: null });
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!auth?.currentUser) return;
        const q = query(collection(db, 'users', auth.currentUser.uid, 'pulverizacoes'), orderBy('dataAplicacao', 'desc'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setItems(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const getStatusStyle = (status) => {
        if (status === 'Planejado') return { color: THEME.warning, bg: THEME.warningBg };
        return { color: THEME.success, bg: THEME.successBg };
    };

    return (
        <div style={styles.container}>
            <CustomHeader title="Gestão de Pulverização" onBack={() => { /* Lógica de goBack para Web Router, se necessário */ }} />
            <div style={styles.webContainer}>
                
                <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', marginTop: '50px', color: THEME.primary }}>Carregando...</div>
                    ) : items.length === 0 ? (
                        <div style={styles.emptyState}>
                            <Icons.Spray size={64} color={THEME.border} />
                            <div style={styles.emptyTextTitle}>Nenhuma aplicação</div>
                            <div style={styles.emptyText}>Toque no botão + para registrar sua primeira pulverização ou adubação.</div>
                        </div>
                    ) : (
                        <div style={{ paddingBottom: '100px' }}>
                            {items.map(item => {
                                const statusStyle = getStatusStyle(item.status);
                                return (
                                    <button 
                                        key={item.id}
                                        style={styles.listItem} 
                                        onClick={() => setModal({ visible: true, itemId: item.id })}
                                    >
                                        <div style={{...styles.listIconBox, backgroundColor: `${THEME.primary}15` }}>
                                            {item.tipoAplicacao === 'Adubo' ? 
                                                <Icons.Leaf size={26} color={THEME.primary} /> : 
                                                <Icons.Spray size={26} color={THEME.primary} />
                                            }
                                        </div>
                                        
                                        <div style={styles.listContent}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                <span style={styles.listTitle} title={`${item.cultura} - ${item.talhao}`}>{item.cultura} - {item.talhao}</span>
                                                <div style={{...styles.statusBadge, backgroundColor: statusStyle.bg }}>
                                                    <span style={{...styles.statusText, color: statusStyle.color }}>
                                                        {item.status?.toUpperCase() || 'REALIZADO'}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div style={styles.listSubtitle} title={`${item.produto} • ${item.quantidadeUtilizada} ${item.unidade || 'un'}`}>
                                                <span style={{fontWeight: '600'}}>{item.produto}</span> • {item.quantidadeUtilizada} {item.unidade || 'un'}
                                            </div>
                                            
                                            <div style={styles.listFooter}>
                                                <div style={styles.footerIconRow}>
                                                    <Icons.Calendar size={14} color={THEME.secondaryText} />
                                                    <span style={styles.footerText}>{formatDate(item.dataAplicacao)}</span>
                                                </div>
                                                {!!item.areaTalhao && (
                                                    <div style={{...styles.footerIconRow, marginLeft: '12px'}}>
                                                        <Icons.TextureBox size={14} color={THEME.secondaryText} />
                                                        <span style={styles.footerText}>{item.areaTalhao} ha</span>
                                                    </div>
                                                )}
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

                {modal.visible && (
                    <AddOrEditPulverizacaoModal 
                        itemId={modal.itemId} 
                        onClose={() => setModal({ visible: false, itemId: null })} 
                        onSaveSuccess={() => setModal({ visible: false, itemId: null })} 
                    />
                )}
            </div>
        </div>
    );
}

// =====================================================================
// 6️⃣ ESTILOS GERAIS (CSS-in-JS Otimizado para Web Mobile/Responsivo)
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
    
    // Empty State
    emptyState: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '0 40px', marginTop: '50px' },
    emptyTextTitle: { color: THEME.textBlack, fontSize: '18px', fontWeight: '600', marginTop: '16px', marginBottom: '8px' },
    emptyText: { color: THEME.secondaryText, fontSize: '14px', textAlign: 'center', lineHeight: '20px' },
    
    // Lists (Flat Design)
    listItem: { display: 'flex', flexDirection: 'row', backgroundColor: THEME.secondary, width: '100%', maxWidth: '600px', alignSelf: 'center', padding: '16px', borderRadius: '16px', alignItems: 'center', marginBottom: '12px', border: `1px solid ${THEME.border}`, cursor: 'pointer', boxSizing: 'border-box', textAlign: 'left', transition: 'box-shadow 0.2s' },
    listIconBox: { width: '50px', height: '50px', borderRadius: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginRight: '16px', flexShrink: 0 },
    listContent: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    listTitle: { fontSize: '16px', fontWeight: '700', color: THEME.textBlack, flex: 1, marginRight: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    listSubtitle: { fontSize: '14px', color: THEME.textBlack, marginBottom: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    listFooter: { display: 'flex', flexDirection: 'row', alignItems: 'center' },
    footerIconRow: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '4px' },
    footerText: { fontSize: '12px', color: THEME.secondaryText, fontWeight: '500' },
    
    // Status Badge
    statusBadge: { padding: '4px 8px', borderRadius: '8px', flexShrink: 0 },
    statusText: { fontSize: '10px', fontWeight: '800' },
    
    // FAB
    fabContainer: { position: 'absolute', right: '24px', bottom: '34px', display: 'flex', alignItems: 'center' },
    fabAdd: { backgroundColor: THEME.primary, width: '60px', height: '60px', borderRadius: '30px', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.2)', border: 'none', cursor: 'pointer' },
    
    // Modals (Bottom Sheet)
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', zIndex: 1000 },
    modalContent: { backgroundColor: THEME.secondary, borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '0 24px 24px 24px', maxHeight: '92vh', width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' },
    modalHeader: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingTop: '20px' },
    modalTitle: { fontSize: '20px', fontWeight: '800', color: THEME.textBlack },
    closeButton: { padding: '4px', backgroundColor: THEME.lightGray, borderRadius: '20px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' },
    
    // Forms
    inputContainer: { marginBottom: '18px', display: 'flex', flexDirection: 'column' },
    formLabel: { fontSize: '13px', color: THEME.textBlack, marginBottom: '8px', fontWeight: '600', marginLeft: '4px' },
    input: { backgroundColor: THEME.grayInput, borderRadius: '14px', padding: '0 16px', height: '54px', fontSize: '15px', color: THEME.textBlack, border: '1px solid transparent', outline: 'none', boxSizing: 'border-box', width: '100%', fontFamily: 'inherit' },
    errorText: { color: THEME.error, fontSize: '12px', marginTop: '6px', marginLeft: '4px' },
    
    // Section Header
    sectionHeader: { display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: '24px', marginBottom: '16px', paddingLeft: '4px' },
    sectionTitle: { fontSize: '16px', fontWeight: '800', color: THEME.textBlack },

    // Select Custom
    selectBox: { backgroundColor: THEME.grayInput, borderRadius: '14px', padding: '0 16px', height: '54px', fontSize: '15px', color: THEME.textBlack, border: '1px solid transparent', outline: 'none', boxSizing: 'border-box', width: '100%', fontFamily: 'inherit', appearance: 'none', cursor: 'pointer', backgroundImage: 'url("data:image/svg+xml;utf8,<svg fill=\'%234A4A4A\' height=\'24\' viewBox=\'0 0 24 24\' width=\'24\' xmlns=\'http://www.w3.org/2000/svg\'><path d=\'M7 10l5 5 5-5z\'/></svg>")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px top 50%' },
    
    // Chips
    chipButton: { backgroundColor: THEME.secondary, border: `1px solid ${THEME.border}`, padding: '10px 18px', borderRadius: '20px', marginRight: '10px', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' },
    chipButtonActive: { backgroundColor: THEME.primary, borderColor: THEME.primary },
    chipText: { color: THEME.secondaryText, fontWeight: '600', fontSize: '14px' },
    chipTextActive: { color: THEME.textWhite },
    
    // Actions
    saveButton: { backgroundColor: THEME.primary, borderRadius: '14px', height: '54px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '24px', marginBottom: '16px', boxShadow: `0 4px 8px ${THEME.primary}33`, border: 'none', cursor: 'pointer', width: '100%' },
    saveButtonText: { color: THEME.textWhite, fontWeight: '700', fontSize: '16px' },
    deleteButton: { display: 'flex', flexDirection: 'row', backgroundColor: 'transparent', borderRadius: '14px', height: '50px', justifyContent: 'center', alignItems: 'center', border: 'none', cursor: 'pointer', width: '100%' },
    deleteButtonText: { color: THEME.error, fontWeight: '600', fontSize: '15px' }
};
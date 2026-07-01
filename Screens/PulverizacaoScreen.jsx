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

const Spinner = ({ primary }) => (
    <div style={primary ? styles.spinnerPrimary : styles.spinner}></div>
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

const SectionHeader = ({ title, IconComponent }) => (
    <div style={styles.sectionHeader}>
        <IconComponent size={22} color={THEME.primary} />
        <span style={{ ...styles.sectionTitle, marginLeft: '8px' }}>{title}</span>
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

const ChoiceChips = ({ options, selectedValue, onValueChange }) => (
    <div style={{ display: 'flex', overflowX: 'auto', marginBottom: '20px', paddingBottom: '5px', gap: '10px' }}>
        {options.map((opt, i) => {
            const isActive = selectedValue === opt.value;
            return (
                <button 
                    key={i} 
                    style={{ ...styles.chipButton, ...(isActive ? styles.chipButtonActive : {}) }}
                    onClick={() => onValueChange(opt.value)}
                    type="button"
                >
                    <span style={{ ...styles.chipText, ...(isActive ? styles.chipTextActive : {}) }}>
                        {opt.label}
                    </span>
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
                        alert("Registro não encontrado.");
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
        if (!validateForm()) return alert('Verifique os campos destacados.');
        
        setSaving(true);
        const userUid = auth.currentUser?.uid;
        if (!userUid) return;

        try {
            const batch = writeBatch(db);
            const defensivo = defensivosEmEstoque.find(d => d.id === data.estoqueItemId);
            
            const qtdSalvar = parseMoeda(data.quantidadeUtilizada);
            const doseSalvar = parseMoeda(data.dose);
            const areaSalvar = parseMoeda(data.areaTalhao);

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
            alert(error.message);
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
                alert('Falha ao excluir.');
            }
        }
    };
    const defensivoSelecionado = defensivosEmEstoque.find(d => d.id === data.estoqueItemId);

    return (
        <div style={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="responsive-modal">
                <div style={styles.bottomSheetHandleContainer}>
                    <div style={styles.bottomSheetHandle} />
                </div>
                
                <div style={styles.modalHeader}>
                    <h2 style={styles.modalTitle}>{itemId ? "Editar Aplicação" : "Nova Aplicação"}</h2>
                    <button style={styles.closeButton} onClick={onClose}>
                        <Icons.Close size={24} color={THEME.textBlack} />
                    </button>
                </div>

                {loadingDependencies || loading ? (
                    <Spinner primary />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                        
                        <SectionHeader title="Dados Operacionais" IconComponent={Icons.Clipboard} />
                        <div className="responsive-form-row">
                            <div style={styles.flex1}>
                                <FormSelect label="Status" items={[{label: 'Realizado', value: 'Realizado'}, {label: 'Planejado', value: 'Planejado'}]} value={data.status} onValueChange={v => setField('status', v)} />
                            </div>
                            <div style={styles.flex1}>
                                <FormDate label="Data" value={data.dataAplicacao} onChange={d => setField('dataAplicacao', d, 'date')} />
                            </div>
                        </div>
                        <FormInput label="Operador" value={data.operador} onChangeText={v => setField('operador', v)} placeholder="Nome do responsável" />
                        <FormSelect label="Equipamento" items={equipamentos.map(e => ({ label: `${e.marca} ${e.modelo}`, value: e.id }))} value={data.equipamentoId} onValueChange={v => setField('equipamentoId', v)} placeholder="Selecione o trator/pulverizador" />

                        <SectionHeader title="Local e Cultura" IconComponent={Icons.Sprout} />
                        <ChoiceChips options={[{label:'Herbicida', value:'Herbicida'}, {label:'Fungicida', value:'Fungicida'}, {label:'Inseticida', value:'Inseticida'}, {label:'Adubo Foliar', value:'Adubo'}]} selectedValue={data.tipoAplicacao} onValueChange={v => setField('tipoAplicacao', v)} />
                        <div className="responsive-form-row">
                            <div style={styles.flex1}><FormInput label="Cultura *" value={data.cultura} onChangeText={v => setField('cultura', v)} error={errors.cultura} placeholder="Ex: Soja" /></div>
                            <div style={styles.flex1}><FormInput label="Talhão *" value={data.talhao} onChangeText={v => setField('talhao', v)} error={errors.talhao} placeholder="Ex: T-01" /></div>
                        </div>
                        <FormInput label="Área Aplicada (ha)" value={data.areaTalhao} onChangeText={v => setField('areaTalhao', v, 'numeric')} type="text" placeholder="0,00" />

                        <SectionHeader title="Insumo e Dosagem" IconComponent={Icons.Flask} />
                        <FormSelect label="Produto do Estoque" items={defensivosEmEstoque.map(d => ({ label: `${d.nome} (Disp: ${d.quantidade} ${d.unidade})`, value: d.id }))} value={data.estoqueItemId} onValueChange={v => setField('estoqueItemId', v)} placeholder="Vincular ao estoque..." />
                        {!data.estoqueItemId && <FormInput label="Produto (Registro Manual)" value={data.produto} onChangeText={v => setField('produto', v)} error={errors.produto} placeholder="Nome do insumo" />}
                        
                        <div className="responsive-form-row">
                            <div style={styles.flex1}><FormInput label={`Dose (${defensivoSelecionado?.unidade || 'L'}/ha)`} value={data.dose} onChangeText={v => setField('dose', v, 'numeric')} type="text" placeholder="0,00" /></div>
                            <div style={styles.flex1}><FormInput label="Total Utilizado *" value={data.quantidadeUtilizada} onChangeText={v => setField('quantidadeUtilizada', v, 'numeric')} type="text" error={errors.quantidadeUtilizada} placeholder="0,00" /></div>
                        </div>

                        <SectionHeader title="Condições Climáticas" IconComponent={Icons.Cloud} />
                        <div className="responsive-form-row">
                            <div style={styles.flex1}><FormInput label="Temp. (°C)" value={data.temperatura} onChangeText={v => setField('temperatura', v, 'numeric')} type="text" placeholder="0,0" /></div>
                            <div style={styles.flex1}><FormInput label="Umid. (%)" value={data.umidade} onChangeText={v => setField('umidade', v, 'numeric')} type="text" placeholder="0,0" /></div>
                            <div style={styles.flex1}><FormInput label="Vento (km/h)" value={data.velocidadeVento} onChangeText={v => setField('velocidadeVento', v, 'numeric')} type="text" placeholder="0,0" /></div>
                        </div>

                        <button style={styles.saveButton} onClick={onSave} disabled={saving}>
                            {saving ? <Spinner /> : <span style={styles.saveButtonText}>Confirmar Aplicação</span>}
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
            <style>{`
                .responsive-wrapper {
                    width: 100%;
                    max-width: 1200px;
                    margin: 0 auto;
                    display: flex;
                    flex-direction: column;
                    position: relative;
                }
                .responsive-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 12px;
                    padding: 16px;
                    padding-bottom: 100px;
                }
                .responsive-modal {
                    background-color: #FFFFFF;
                    width: 100%;
                    max-width: 100%;
                    border-top-left-radius: 24px;
                    border-top-right-radius: 24px;
                    padding: 0 24px 24px 24px;
                    max-height: 92vh;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                }
                .responsive-form-row {
                    display: flex;
                    flex-direction: column;
                }
                @media (min-width: 768px) {
                    .responsive-grid {
                        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                    }
                    .responsive-modal {
                        max-width: 600px;
                        border-radius: 24px;
                        align-self: center;
                        margin-bottom: 4vh;
                    }
                    .responsive-form-row {
                        flex-direction: row;
                        gap: 16px;
                    }
                    .responsive-form-row > * {
                        flex: 1;
                    }
                }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
            <div className="responsive-wrapper">
                <CustomHeader title="Pulverização / Adubação" onBack={() => navigation?.goBack()} />
            
                {loading ? (
                    <Spinner primary />
                ) : items.length === 0 ? (
                    <div style={styles.emptyState}>
                        <Icons.Spray size={64} color={THEME.border} />
                        <h3 style={styles.emptyTextTitle}>Nenhuma aplicação</h3>
                        <p style={styles.emptyText}>Toque no botão + para registrar sua primeira pulverização ou adubação.</p>
                    </div>
                ) : (
                    <div className="responsive-grid">
                        {items.map((item) => {
                            const statusStyle = getStatusStyle(item.status);
                            return (
                                <button 
                                    key={item.id}
                                    style={styles.listItem} 
                                    onClick={() => setModal({ visible: true, itemId: item.id })}
                                >
                                    <div style={{ ...styles.listIconBox, backgroundColor: `${THEME.primary}15` }}>
                                        {item.tipoAplicacao === 'Adubo' 
                                            ? <Icons.Leaf size={26} color={THEME.primary} />
                                            : <Icons.Spray size={26} color={THEME.primary} />
                                        }
                                    </div>
                                    
                                    <div style={styles.listContent}>
                                        <div style={styles.listTitleRow}>
                                            <span style={styles.listTitle} title={`${item.cultura} - ${item.talhao}`}>{item.cultura} - {item.talhao}</span>
                                            <div style={{ ...styles.statusBadge, backgroundColor: statusStyle.bg }}>
                                                <span style={{ ...styles.statusText, color: statusStyle.color }}>
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
                                                <div style={styles.footerIconRow}>
                                                    <Icons.TextureBox size={14} color={THEME.secondaryText} />
                                                    <span style={styles.footerText}>{item.areaTalhao} ha</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ marginLeft: '8px' }}>
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
    );
}

// =====================================================================
// 6️⃣ ESTILOS GERAIS (CLEAN UI)
// =====================================================================

const styles = {
    container: { display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: THEME.background, fontFamily: 'system-ui, -apple-system, sans-serif' },
    webContainer: {},
    
    fullHeader: { backgroundColor: THEME.primary, width: '100%' },
    headerContent: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: '60px', maxWidth: '1200px', margin: '0 auto' },
    backButton: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { color: THEME.textWhite, fontSize: '18px', fontWeight: '700' },
    
    emptyState: { display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', alignItems: 'center', padding: '0 40px', marginTop: '50px' },
    emptyTextTitle: { color: THEME.textBlack, fontSize: '18px', fontWeight: '600', marginTop: '16px', marginBottom: '8px' },
    emptyText: { color: THEME.secondaryText, fontSize: '14px', textAlign: 'center', lineHeight: '20px' },
    
    listContainer: { padding: '16px', paddingBottom: '100px', display: 'flex', flexDirection: 'column', gap: '12px' },
    listItem: { display: 'flex', flexDirection: 'row', backgroundColor: THEME.secondary, padding: '16px', borderRadius: '16px', alignItems: 'center', boxShadow: '0px 2px 3px rgba(0,0,0,0.05)', cursor: 'pointer', border: 'none', textAlign: 'left', width: '100%' },
    listIconBox: { width: '50px', height: '50px', borderRadius: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginRight: '16px', flexShrink: 0 },
    listContent: { flex: 1, minWidth: 0 },
    listTitleRow: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' },
    listTitle: { fontSize: '16px', fontWeight: '700', color: THEME.textBlack, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginRight: '8px' },
    listSubtitle: { fontSize: '14px', color: THEME.textBlack, marginBottom: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    listFooter: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' },
    footerIconRow: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '4px' },
    footerText: { fontSize: '12px', color: THEME.secondaryText, fontWeight: '500' },
    
    statusBadge: { padding: '4px 8px', borderRadius: '8px', display: 'inline-block' },
    statusText: { fontSize: '10px', fontWeight: '800' },
    
    fabContainer: { position: 'fixed', right: '24px', bottom: '34px', zIndex: 10 },
    fabAdd: { backgroundColor: THEME.primary, width: '60px', height: '60px', borderRadius: '30px', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0px 4px 6px rgba(0,0,0,0.2)', border: 'none', cursor: 'pointer' },
    
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', zIndex: 100 },
    modalContent: {},
    bottomSheetHandleContainer: { display: 'flex', justifyContent: 'center', paddingTop: '12px', paddingBottom: '16px', position: 'sticky', top: 0, backgroundColor: THEME.secondary, zIndex: 2 },
    bottomSheetHandle: { width: '40px', height: '5px', borderRadius: '3px', backgroundColor: '#D4D4D4' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
    modalTitle: { fontSize: '20px', fontWeight: '800', color: THEME.textBlack, margin: 0 },
    closeButton: { padding: '4px', backgroundColor: THEME.lightGray, borderRadius: '20px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    
    inputContainer: { display: 'flex', flexDirection: 'column', marginBottom: '18px' },
    formLabel: { fontSize: '13px', color: THEME.textBlack, marginBottom: '8px', fontWeight: '600', marginLeft: '4px' },
    input: { backgroundColor: THEME.grayInput, borderRadius: '14px', padding: '0 16px', height: '54px', fontSize: '15px', color: THEME.textBlack, border: '1px solid transparent', outline: 'none', boxSizing: 'border-box', width: '100%' },
    selectBox: { backgroundColor: THEME.grayInput, borderRadius: '14px', padding: '0 16px', height: '54px', fontSize: '15px', color: THEME.textBlack, border: '1px solid transparent', outline: 'none', boxSizing: 'border-box', width: '100%' },
    errorText: { color: THEME.error, fontSize: '12px', marginTop: '6px', marginLeft: '4px' },
    
    sectionHeader: { display: 'flex', alignItems: 'center', marginTop: '24px', marginBottom: '16px', paddingLeft: '4px' },
    sectionTitle: { fontSize: '16px', fontWeight: '800', color: THEME.textBlack },
    
    chipButton: { backgroundColor: THEME.secondary, border: `1px solid ${THEME.border}`, padding: '10px 18px', borderRadius: '20px', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s' },
    chipButtonActive: { backgroundColor: THEME.primary, borderColor: THEME.primary },
    chipText: { color: THEME.secondaryText, fontWeight: '600', fontSize: '14px' },
    chipTextActive: { color: THEME.textWhite },
    
    saveButton: { backgroundColor: THEME.primary, borderRadius: '14px', height: '54px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '24px', marginBottom: '16px', boxShadow: `0px 4px 8px ${THEME.primary}33`, border: 'none', cursor: 'pointer', width: '100%' },
    saveButtonText: { color: THEME.textWhite, fontWeight: '700', fontSize: '16px' },
    deleteButton: { display: 'flex', flexDirection: 'row', backgroundColor: 'transparent', borderRadius: '14px', height: '50px', justifyContent: 'center', alignItems: 'center', border: 'none', cursor: 'pointer', width: '100%' },
    deleteButtonText: { color: THEME.error, fontWeight: '600', fontSize: '15px' },

    row: { display: 'flex', flexDirection: 'row', gap: '12px', width: '100%' },
    flex1: { flex: 1 },

    spinner: {
        width: '24px',
        height: '24px',
        border: '3px solid rgba(255,255,255,0.3)',
        borderRadius: '50%',
        borderTopColor: THEME.textWhite,
        animation: 'spin 1s ease-in-out infinite'
    },
    spinnerPrimary: {
        width: '40px',
        height: '40px',
        border: '4px solid rgba(76,175,80,0.2)',
        borderRadius: '50%',
        borderTopColor: THEME.primary,
        animation: 'spin 1s ease-in-out infinite',
        margin: '40px auto'
    }
};

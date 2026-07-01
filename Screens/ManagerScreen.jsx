import React, { useState, useEffect } from 'react';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { collection, doc, getDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

// Configuração do Firebase
import { auth, db } from '../firebaseConfig';

// =====================================================================
// 1️⃣ CONFIGURAÇÕES, CONSTANTES E TEMA
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

const agriculturalBrands = [
    { label: 'John Deere', value: 'John Deere' },
    { label: 'Case IH', value: 'Case IH' },
    { label: 'New Holland', value: 'New Holland' },
    { label: 'Massey Ferguson', value: 'Massey Ferguson' },
    { label: 'Valtra', value: 'Valtra' },
    { label: 'Stara', value: 'Stara' },
    { label: 'Jacto', value: 'Jacto' },
    { label: 'Outra', value: 'Outra' },
];

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
// 2️⃣ COMPONENTES DE UI REUTILIZÁVEIS (WEB OPTIMIZED)
// =====================================================================

const CustomHeader = ({ title, onBack }) => (
    <div style={styles.fullHeader}>
        <div style={styles.headerContent}>
            {onBack ? (
                <button onClick={onBack} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={26} color={THEME.textWhite} />
                </button>
            ) : <div style={{ width: 36 }} />}
            <span style={styles.headerTitle}>{title}</span>
            <div style={{ width: 36 }} />
        </div>
    </div>
);

const FabAdd = ({ onAdd }) => (
    <div style={styles.fabContainer}>
        <button style={styles.fabAdd} onClick={onAdd}>
            <Ionicons name="add" size={28} color={THEME.textWhite} />
        </button>
    </div>
);

const FormInput = ({ label, placeholder, value, onChangeText, required, type = 'text', editable = true, error, maxLength, multiline = false }) => (
    <div style={styles.inputContainer}>
        <span style={styles.formLabel}>{label} {required && <span style={{ color: THEME.primary }}>*</span>}</span>
        {multiline ? (
            <textarea
                style={{ ...styles.input, ...( !editable ? { opacity: 0.6 } : {} ), ...( error ? { borderColor: THEME.error, borderWidth: 1 } : {} ), height: 100, resize: 'vertical' }}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChangeText(e.target.value)}
                disabled={!editable}
                maxLength={maxLength}
            />
        ) : (
            <input
                type={type}
                style={{ ...styles.input, ...( !editable ? { opacity: 0.6 } : {} ), ...( error ? { borderColor: THEME.error, borderWidth: 1 } : {} ) }}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChangeText(e.target.value)}
                disabled={!editable}
                maxLength={maxLength}
            />
        )}
        {error && <span style={styles.errorText}>{error}</span>}
    </div>
);

const FormSelect = ({ label, placeholder, value, onValueChange, items, required, error }) => {
    return (
        <div style={styles.inputContainer}>
            <span style={styles.formLabel}>{label} {required && <span style={{ color: THEME.primary }}>*</span>}</span>
            <select
                style={{ ...styles.selectBox, ...( error ? { borderColor: THEME.error, borderWidth: 1 } : {} ) }}
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
};

const FormDate = ({ label, value, onChange }) => {
    const dateValue = value instanceof Date && !isNaN(value) ? value.toISOString().split('T')[0] : '';
    return (
        <div style={styles.inputContainer}>
            <span style={styles.formLabel}>{label}</span>
            <input
                type="date"
                value={dateValue}
                onChange={(e) => {
                    if (e.target.value) {
                        onChange(new Date(`${e.target.value}T12:00:00`));
                    }
                }}
                style={{ ...styles.input, backgroundColor: THEME.grayInput, width: '100%', boxSizing: 'border-box', border: 'none', color: THEME.textBlack }}
            />
        </div>
    );
};

const ChoiceChips = ({ options, selectedValue, onValueChange }) => (
    <div style={{ display: 'flex', flexDirection: 'row', overflowX: 'auto', marginBottom: 15, paddingBottom: 5 }}>
        {options.map((opt, i) => {
            const isActive = selectedValue === opt.value;
            return (
                <button
                    key={i}
                    style={{ ...styles.chipButton, ...( isActive ? styles.chipButtonActive : {} ) }}
                    onClick={() => onValueChange(opt.value)}
                >
                    <span style={{ ...styles.chipText, ...( isActive ? styles.chipTextActive : {} ) }}>{opt.label}</span>
                </button>
            );
        })}
    </div>
);

const Spinner = () => <div className="spinner" style={{width:40,height:40,borderRadius:"50%",border:`4px solid ${THEME.primary}40`,borderTopColor:THEME.primary,animation:"spin 1s linear infinite",margin:"auto"}} />;

// =====================================================================
// 3️⃣ MODAIS DE CADASTRO
// =====================================================================

const AddOrEditPropriedadeModal = ({ itemId, onClose }) => {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [errors, setErrors] = useState({});
    const [data, setData] = useState({
        nome: '', proprietario: '', area: '', areaMecanizada: '', tipo: 'propria',
        valorArrendamento: '', inicioContrato: new Date(), fimContrato: new Date(), observacoes: '',
    });

    useEffect(() => {
        if (!itemId) return;
        (async () => {
            setLoading(true);
            try {
                const docSnap = await getDoc(doc(db, 'users', auth.currentUser.uid, 'propriedades', itemId));
                if (docSnap.exists()) {
                    const item = docSnap.data();
                    setData({
                        ...item,
                        area: item.area ? String(item.area) : '',
                        areaMecanizada: item.areaMecanizada ? String(item.areaMecanizada) : '',
                        valorArrendamento: item.valorArrendamento ? String(item.valorArrendamento) : '',
                        inicioContrato: item.inicioContrato?.toDate ? item.inicioContrato.toDate() : new Date(),
                        fimContrato: item.fimContrato?.toDate ? item.fimContrato.toDate() : new Date(),
                    });
                }
            } catch (e) { window.alert('Erro: Propriedade não encontrada.'); onClose(); }
            setLoading(false);
        })();
    }, [itemId]);

    const setField = (field, value, type = 'text') => {
        setData(prev => ({ ...prev, [field]: type === 'numeric' ? value.replace(/[^0-9,.]/g, '') : value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    };

    const validate = () => {
        const errs = {};
        if (!data.nome.trim()) errs.nome = 'Nome inválido.';
        if (!data.proprietario.trim()) errs.proprietario = 'Proprietário inválido.';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return window.alert('Atenção: Corrija os campos destacados.');
        setSaving(true);
        try {
            const uid = auth.currentUser.uid;
            const id = itemId || doc(collection(db, 'users', uid, 'propriedades')).id;
            const payload = {
                ...data, id,
                area: parseFloat(data.area.replace(',', '.')) || 0,
                areaMecanizada: parseFloat(data.areaMecanizada.replace(',', '.')) || 0,
                valorArrendamento: data.tipo === 'arrendada' ? (parseFloat(data.valorArrendamento.replace(',', '.')) || 0) : 0,
            };
            await setDoc(doc(db, 'users', uid, 'propriedades', id), payload, { merge: true });
            onClose();
        } catch (e) { window.alert('Erro: Falha ao salvar.'); }
        setSaving(false);
    };

    const handleDelete = async () => {
        if (window.confirm('Deseja excluir esta propriedade?')) {
            await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'propriedades', itemId));
            onClose();
        }
    };

    if (loading) return <div style={styles.modalOverlay}><Spinner /></div>;

    return (
        <div style={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal-responsive">
                <div style={styles.modalHeader}>
                    <span style={styles.modalTitle}>{itemId ? 'Editar Propriedade' : 'Nova Propriedade'}</span>
                    <button style={styles.closeButton} onClick={onClose}><Ionicons name="close" size={20} /></button>
                </div>
                <div style={{ overflowY: 'auto', maxHeight: 'calc(90vh - 80px)' }}>
                    <ChoiceChips
                        options={[{ label: 'Própria', value: 'propria' }, { label: 'Arrendada', value: 'arrendada' }]}
                        selectedValue={data.tipo} onValueChange={v => setField('tipo', v)}
                    />
                    <FormInput label="Nome da Propriedade" required value={data.nome} onChangeText={v => setField('nome', v)} error={errors.nome} />
                    <FormInput label="Proprietário" required value={data.proprietario} onChangeText={v => setField('proprietario', v)} error={errors.proprietario} />
                    <FormInput label="Área Total (ha)" type="number" value={data.area} onChangeText={v => setField('area', v, 'numeric')} />
                    <FormInput label="Área Mecanizada (ha)" type="number" value={data.areaMecanizada} onChangeText={v => setField('areaMecanizada', v, 'numeric')} />

                    {data.tipo === 'arrendada' && (
                        <>
                            <FormInput label="Valor Arrendamento (R$)" type="number" value={data.valorArrendamento} onChangeText={v => setField('valorArrendamento', v, 'numeric')} />
                            <FormDate label="Início do Contrato" value={data.inicioContrato} onChange={d => setField('inicioContrato', d, 'date')} />
                            <FormDate label="Fim do Contrato" value={data.fimContrato} onChange={d => setField('fimContrato', d, 'date')} />
                        </>
                    )}
                    <FormInput label="Observações" value={data.observacoes} onChangeText={v => setField('observacoes', v)} multiline />

                    <button style={styles.saveButton} onClick={handleSave} disabled={saving}>
                        {saving ? <Spinner /> : <span style={styles.saveButtonText}>Salvar Propriedade</span>}
                    </button>
                    {itemId && <button style={styles.deleteButton} onClick={handleDelete}><span style={styles.deleteButtonText}>Excluir Propriedade</span></button>}
                </div>
            </div>
        </div>
    );
};

const AddOrEditUnidadeModal = ({ itemId, onClose }) => {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [errors, setErrors] = useState({});
    const [data, setData] = useState({ nome: '', tipo: 'Cooperativa', contato: '', telefone: '', email: '', cnpj: '', observacoes: '' });

    useEffect(() => {
        if (!itemId) return;
        (async () => {
            setLoading(true);
            try {
                const docSnap = await getDoc(doc(db, 'users', auth.currentUser.uid, 'unidades', itemId));
                if (docSnap.exists()) setData(docSnap.data());
            } catch (e) { } setLoading(false);
        })();
    }, [itemId]);

    const setField = (field, value) => { setData(prev => ({ ...prev, [field]: value })); if (errors[field]) setErrors(prev => ({ ...prev, [field]: null })); };

    const handleSave = async () => {
        if (!data.nome.trim()) return setErrors({ nome: 'Obrigatório' });
        setSaving(true);
        try {
            const uid = auth.currentUser.uid;
            const id = itemId || doc(collection(db, 'users', uid, 'unidades')).id;
            await setDoc(doc(db, 'users', uid, 'unidades', id), { ...data, id }, { merge: true });
            onClose();
        } catch (e) { } setSaving(false);
    };

    const handleDelete = async () => {
        if (window.confirm('Deseja excluir esta unidade?')) {
            await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'unidades', itemId));
            onClose();
        }
    };

    if (loading) return <div style={styles.modalOverlay}><Spinner /></div>;

    return (
        <div style={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal-responsive">
                <div style={styles.modalHeader}>
                    <span style={styles.modalTitle}>{itemId ? 'Editar Unidade' : 'Nova Unidade'}</span>
                    <button style={styles.closeButton} onClick={onClose}><Ionicons name="close" size={20} /></button>
                </div>
                <div style={{ overflowY: 'auto', maxHeight: 'calc(90vh - 80px)' }}>
                    <ChoiceChips
                        options={[{ label: 'Coop', value: 'Cooperativa' }, { label: 'Fornecedor', value: 'Fornecedor' }, { label: 'Cliente', value: 'Cliente' }, { label: 'Outro', value: 'Outro' }]}
                        selectedValue={data.tipo} onValueChange={v => setField('tipo', v)}
                    />
                    <FormInput label="Nome da Unidade" required value={data.nome} onChangeText={v => setField('nome', v)} error={errors.nome} />
                    <FormInput label="Contato" value={data.contato} onChangeText={v => setField('contato', v)} />
                    <FormInput label="Telefone" type="tel" value={data.telefone} onChangeText={v => setField('telefone', v)} />
                    <FormInput label="Email" type="email" value={data.email} onChangeText={v => setField('email', v)} />
                    <FormInput label="Observações" value={data.observacoes} onChangeText={v => setField('observacoes', v)} multiline />

                    <button style={styles.saveButton} onClick={handleSave} disabled={saving}>
                        {saving ? <Spinner /> : <span style={styles.saveButtonText}>Salvar Unidade</span>}
                    </button>
                    {itemId && <button style={styles.deleteButton} onClick={handleDelete}><span style={styles.deleteButtonText}>Excluir Unidade</span></button>}
                </div>
            </div>
        </div>
    );
};

const AddOrEditEquipamentoModal = ({ itemId, onClose }) => {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [errors, setErrors] = useState({});
    const [selectedBrand, setSelectedBrand] = useState('Outra');
    const [data, setData] = useState({
        marca: '', modelo: '', ano: '', tipoEquipamento: 'Trator', dataAquisicao: new Date(),
        horasUso: '', status: 'Ativo', nrChassi: '', nrSerie: '', cor: '', valor: '',
        combustaoAtiva: false, tipoCombustivel: 'Diesel S10',
    });

    useEffect(() => {
        if (!itemId) return;
        (async () => {
            setLoading(true);
            try {
                const docSnap = await getDoc(doc(db, 'users', auth.currentUser.uid, 'inventario', itemId));
                if (docSnap.exists()) {
                    const item = docSnap.data();
                    setData({
                        ...item,
                        horasUso: item.horasUso ? String(item.horasUso) : '',
                        valor: item.valor ? String(item.valor) : '',
                        dataAquisicao: item.dataAquisicao?.toDate ? item.dataAquisicao.toDate() : new Date(),
                    });
                    if (agriculturalBrands.some(b => b.value === item.marca)) setSelectedBrand(item.marca);
                    else setSelectedBrand('Outra');
                }
            } catch (e) { } setLoading(false);
        })();
    }, [itemId]);

    const setField = (field, value) => { setData(prev => ({ ...prev, [field]: value })); if (errors[field]) setErrors(prev => ({ ...prev, [field]: null })); };

    const handleSave = async () => {
        if (!data.marca.trim() || !data.modelo.trim()) return window.alert('Erro: Marca e Modelo são obrigatórios.');
        setSaving(true);
        try {
            const uid = auth.currentUser.uid;
            const id = itemId || doc(collection(db, 'users', uid, 'inventario')).id;
            const payload = {
                ...data, id,
                horasUso: parseFloat(String(data.horasUso).replace(',', '.')) || 0,
                valor: parseFloat(String(data.valor).replace(',', '.')) || 0,
            };
            await setDoc(doc(db, 'users', uid, 'inventario', id), payload, { merge: true });
            onClose();
        } catch (e) { } setSaving(false);
    };

    const handleDelete = async () => {
        if (window.confirm('Deseja excluir este equipamento?')) {
            await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'inventario', itemId));
            onClose();
        }
    };

    if (loading) return <div style={styles.modalOverlay}><Spinner /></div>;

    return (
        <div style={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal-responsive">
                <div style={styles.modalHeader}>
                    <span style={styles.modalTitle}>{itemId ? 'Editar Equipamento' : 'Novo Equipamento'}</span>
                    <button style={styles.closeButton} onClick={onClose}><Ionicons name="close" size={20} /></button>
                </div>
                <div style={{ overflowY: 'auto', maxHeight: 'calc(90vh - 80px)' }}>
                    <ChoiceChips
                        options={[{ label: 'Trator', value: 'Trator' }, { label: 'Colheitadeira', value: 'Colheitadeira' }, { label: 'Pulverizador', value: 'Pulverizador' }, { label: 'Outro', value: 'Outro' }]}
                        selectedValue={data.tipoEquipamento} onValueChange={v => setField('tipoEquipamento', v)}
                    />
                    <FormSelect
                        label="Marca Padrão" placeholder="Selecione"
                        items={agriculturalBrands} value={selectedBrand}
                        onValueChange={v => { setSelectedBrand(v); setField('marca', v === 'Outra' ? '' : v); }}
                    />
                    {selectedBrand === 'Outra' && <FormInput label="Especifique a Marca" required value={data.marca} onChangeText={v => setField('marca', v)} />}

                    <FormInput label="Modelo" required value={data.modelo} onChangeText={v => setField('modelo', v)} />
                    <FormInput label="Ano" type="number" maxLength={4} value={data.ano} onChangeText={v => setField('ano', v)} />
                    <FormInput label="Número Chassi" value={data.nrChassi} onChangeText={v => setField('nrChassi', v)} />
                    <FormInput label="Valor (R$)" type="number" value={data.valor} onChangeText={v => setField('valor', v)} />

                    <div style={styles.switchBox}>
                        <span style={styles.switchLabel}>Status Ativo</span>
                        <input type="checkbox" checked={data.status === 'Ativo'} onChange={() => setField('status', data.status === 'Ativo' ? 'Inativo' : 'Ativo')} />
                    </div>
                    <div style={styles.switchBox}>
                        <span style={styles.switchLabel}>Requer Combustível</span>
                        <input type="checkbox" checked={data.combustaoAtiva} onChange={() => setField('combustaoAtiva', !data.combustaoAtiva)} />
                    </div>

                    {data.combustaoAtiva && (
                        <ChoiceChips
                            options={[{ label: 'Diesel S10', value: 'Diesel S10' }, { label: 'Diesel S500', value: 'Diesel S500' }, { label: 'Gasolina', value: 'Gasolina' }]}
                            selectedValue={data.tipoCombustivel} onValueChange={v => setField('tipoCombustivel', v)}
                        />
                    )}

                    <button style={styles.saveButton} onClick={handleSave} disabled={saving}>
                        {saving ? <Spinner /> : <span style={styles.saveButtonText}>Salvar Equipamento</span>}
                    </button>
                    {itemId && <button style={styles.deleteButton} onClick={handleDelete}><span style={styles.deleteButtonText}>Excluir Equipamento</span></button>}
                </div>
            </div>
        </div>
    );
};

const AddOrEditEstoqueGeralModal = ({ itemId, onClose }) => {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [errors, setErrors] = useState({});
    const [data, setData] = useState({ nome: '', tipo: 'Semente', quantidade: '', unidade: 'sc', fornecedor: '', local: '', obs: '' });

    useEffect(() => {
        if (!itemId) return;
        (async () => {
            setLoading(true);
            try {
                const docSnap = await getDoc(doc(db, 'users', auth.currentUser.uid, 'estoqueGeral', itemId));
                if (docSnap.exists()) {
                    const item = docSnap.data();
                    setData({ ...item, quantidade: item.quantidade ? String(item.quantidade) : '' });
                }
            } catch (e) { } setLoading(false);
        })();
    }, [itemId]);

    const setField = (field, value) => { setData(prev => ({ ...prev, [field]: value })); if (errors[field]) setErrors(prev => ({ ...prev, [field]: null })); };

    const handleSave = async () => {
        if (!data.nome.trim()) return setErrors({ nome: 'Obrigatório' });
        setSaving(true);
        try {
            const uid = auth.currentUser.uid;
            const id = itemId || doc(collection(db, 'users', uid, 'estoqueGeral')).id;
            await setDoc(doc(db, 'users', uid, 'estoqueGeral', id), {
                ...data, id, quantidade: parseFloat(String(data.quantidade).replace(',', '.')) || 0
            }, { merge: true });
            onClose();
        } catch (e) { } setSaving(false);
    };

    const handleDelete = async () => {
        if (window.confirm('Deseja excluir este item do estoque?')) {
            await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'estoqueGeral', itemId));
            onClose();
        }
    };

    if (loading) return <div style={styles.modalOverlay}><Spinner /></div>;

    return (
        <div style={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal-responsive">
                <div style={styles.modalHeader}>
                    <span style={styles.modalTitle}>{itemId ? 'Editar Item' : 'Novo Item Estoque'}</span>
                    <button style={styles.closeButton} onClick={onClose}><Ionicons name="close" size={20} /></button>
                </div>
                <div style={{ overflowY: 'auto', maxHeight: 'calc(90vh - 80px)' }}>
                    <ChoiceChips
                        options={[{ label: 'Semente', value: 'Semente' }, { label: 'Fertilizante', value: 'Fertilizante' }, { label: 'Defensivo', value: 'Defensivo' }, { label: 'Peça', value: 'Peça' }]}
                        selectedValue={data.tipo} onValueChange={v => setField('tipo', v)}
                    />
                    <FormInput label="Nome do Item" required value={data.nome} onChangeText={v => setField('nome', v)} error={errors.nome} />
                    <FormInput label="Quantidade" type="number" value={data.quantidade} onChangeText={v => setField('quantidade', v)} />
                    <FormInput label="Unidade (Ex: sc, L, kg)" value={data.unidade} onChangeText={v => setField('unidade', v)} />
                    <FormInput label="Fornecedor" value={data.fornecedor} onChangeText={v => setField('fornecedor', v)} />
                    <FormInput label="Local (Ex: Galpão 1)" value={data.local} onChangeText={v => setField('local', v)} />
                    <FormInput label="Observações" value={data.obs} onChangeText={v => setField('obs', v)} multiline />

                    <button style={styles.saveButton} onClick={handleSave} disabled={saving}>
                        {saving ? <Spinner /> : <span style={styles.saveButtonText}>Salvar Estoque</span>}
                    </button>
                    {itemId && <button style={styles.deleteButton} onClick={handleDelete}><span style={styles.deleteButtonText}>Excluir Item</span></button>}
                </div>
            </div>
        </div>
    );
};

// =====================================================================
// 4️⃣ TELAS DE LISTAGEM
// =====================================================================

const ListScreen = ({ title, collectionName, icon, renderSubtitle, onBack }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState({ visible: false, itemId: null });

    useEffect(() => {
        if (!auth.currentUser) return;
        const q = collection(db, 'users', auth.currentUser.uid, collectionName);
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => doc.data());
            setItems(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [collectionName]);

    return (
        <div style={styles.container}>
            <div className="web-container-responsive">
                <CustomHeader title={title} onBack={onBack} />
                <div style={styles.listContainer}>
                    {loading ? <Spinner />
                        : items.length === 0 ? <span style={styles.emptyText}>Nenhum registro encontrado.</span>
                            : (
                                <div className="responsive-grid">
                                    {items.map(item => (
                                        <button key={item.id} style={styles.listItem} className="list-item-responsive" onClick={() => { setModal({ visible: true, itemId: item.id }); }}>
                                            <div style={styles.listIconBox}>
                                                <MaterialCommunityIcons name={icon} size={24} color={THEME.primary} />
                                            </div>
                                            <div style={styles.listContent}>
                                                <span style={styles.listTitle}>{item.nome || item.marca || 'Sem título'}</span>
                                                <span style={styles.listSubtitle}>{renderSubtitle(item)}</span>
                                            </div>
                                            <Ionicons name="chevron-forward" size={24} color={THEME.secondaryText} />
                                        </button>
                                    ))}
                                </div>
                            )}
                </div>

                <FabAdd onAdd={() => { setModal({ visible: true, itemId: null }); }} />

                {modal.visible && collectionName === 'propriedades' && <AddOrEditPropriedadeModal itemId={modal.itemId} onClose={() => setModal({ visible: false, itemId: null })} />}
                {modal.visible && collectionName === 'unidades' && <AddOrEditUnidadeModal itemId={modal.itemId} onClose={() => setModal({ visible: false, itemId: null })} />}
                {modal.visible && collectionName === 'inventario' && <AddOrEditEquipamentoModal itemId={modal.itemId} onClose={() => setModal({ visible: false, itemId: null })} />}
                {modal.visible && collectionName === 'estoqueGeral' && <AddOrEditEstoqueGeralModal itemId={modal.itemId} onClose={() => setModal({ visible: false, itemId: null })} />}
            </div>
        </div>
    );
};

// =====================================================================
// 5️⃣ TELA PRINCIPAL (GERENCIADOR)
// =====================================================================

export default function ManagerScreen({ navigation, route }) {
    const initialView = route?.params?.initialView || 'menu';
    const [currentView, setCurrentView] = useState(initialView);

    useEffect(() => {
        if (typeof document !== 'undefined' && !document.getElementById('w3-agro-styles')) {
            const style = document.createElement('style');
            style.id = 'w3-agro-styles';
            style.innerHTML = `
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                * { box-sizing: border-box; }
                button { border: none; outline: none; cursor: pointer; background: transparent; padding: 0; }
                input, textarea, select { border: none; outline: none; font-family: inherit; }
                textarea { resize: vertical; }
                .responsive-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 15px;
                    width: 100%;
                }
                .modal-responsive {
                    background-color: ${THEME.secondary};
                    border-top-left-radius: 20px;
                    border-top-right-radius: 20px;
                    padding: 20px;
                    max-height: 90vh;
                    width: 100%;
                    max-width: 800px;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                }
                .web-container-responsive {
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                    width: 100%;
                    max-width: 800px;
                    align-self: center;
                    margin: 0 auto;
                    position: relative;
                }
                @media (min-width: 768px) {
                    .responsive-grid { grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
                    .list-item-responsive { max-width: 100% !important; margin: 0 !important; }
                    .web-container-responsive { max-width: 1200px !important; }
                    .modal-responsive { border-radius: 20px; align-self: center; margin-bottom: 5vh; }
                }
            `;
            document.head.appendChild(style);
        }
    }, []);

    const handleBack = initialView !== 'menu'
        ? () => { if (navigation?.goBack) navigation.goBack(); else window.history.back(); }
        : () => {
            setCurrentView('menu');
        };

    if (currentView === 'propriedades') return <ListScreen title="Propriedades" collectionName="propriedades" icon="barn" renderSubtitle={i => `${i.proprietario} • ${i.tipo === 'propria' ? 'Própria' : 'Arrendada'}`} onBack={handleBack} />;
    if (currentView === 'unidades') return <ListScreen title="Unidades/Empresas" collectionName="unidades" icon="office-building" renderSubtitle={i => `${i.tipo} • ${i.contato || i.telefone}`} onBack={handleBack} />;
    if (currentView === 'inventario') return <ListScreen title="Inventário de Máquinas" collectionName="inventario" icon="tractor-variant" renderSubtitle={i => `${i.modelo} • ${i.ano} • ${i.status}`} onBack={handleBack} />;
    if (currentView === 'estoque') return <ListScreen title="Estoque Geral" collectionName="estoqueGeral" icon="archive-outline" renderSubtitle={i => `${i.quantidade} ${i.unidade} • ${i.tipo}`} onBack={handleBack} />;

    const menuOptions = [
        { title: 'Propriedades', icon: 'barn', view: 'propriedades', desc: 'Gerir propriedades rurais' },
        { title: 'Unidades / Empresas', icon: 'office-building', view: 'unidades', desc: 'Cooperativas, fornecedores e clientes' },
        { title: 'Inventário de Equipamentos', icon: 'tractor-variant', view: 'inventario', desc: 'Tratores, implementos e máquinas' },
        { title: 'Estoque Geral', icon: 'archive-outline', view: 'estoque', desc: 'Sementes, fertilizantes e defensivos' }
    ];

    return (
        <div style={styles.container}>
            <div className="web-container-responsive">
                <CustomHeader title="Gerenciador" onBack={() => { if (navigation?.goBack) navigation.goBack(); else window.history.back(); }} />
                <div style={{ padding: 20 }}>
                    <div className="responsive-grid">
                        {menuOptions.map((opt, i) => (
                            <button key={i} style={styles.managerButton} className="list-item-responsive" onClick={() => { setCurrentView(opt.view); }}>
                                <div style={styles.managerButtonIcon}>
                                    <MaterialCommunityIcons name={opt.icon} size={28} color={THEME.textWhite} />
                                </div>
                                <div style={{ flex: 1, marginLeft: 15, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                    <span style={styles.managerButtonTitle}>{opt.title}</span>
                                    <span style={styles.managerButtonDesc}>{opt.desc}</span>
                                </div>
                                <Ionicons name="chevron-forward" size={24} color={THEME.primary} />
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// =====================================================================
// 6️⃣ ESTILOS GERAIS (WEB OPTIMIZED)
// =====================================================================

const styles = {
    container: { display: 'flex', flexDirection: 'column', flex: 1, backgroundColor: THEME.background, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' },

    // Header
    fullHeader: { backgroundColor: THEME.primary, width: '100%', display: 'flex', justifyContent: 'center' },
    headerContent: { width: '100%', maxWidth: 1200, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '0 15px', height: 60, boxSizing: 'border-box' },
    backButton: { padding: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { color: THEME.textWhite, fontSize: 22, fontWeight: 'bold' },

    // Manager Menu
    managerButton: { display: 'flex', flexDirection: 'row', backgroundColor: THEME.secondary, padding: 15, borderRadius: 15, alignItems: 'center', marginBottom: 15, boxShadow: '0px 2px 3px rgba(0,0,0,0.05)', textAlign: 'left', cursor: 'pointer', border: 'none', width: '100%', boxSizing: 'border-box' },
    managerButtonIcon: { backgroundColor: THEME.primary, padding: 12, borderRadius: 12, display: 'flex', justifyContent: 'center', alignItems: 'center' },
    managerButtonTitle: { fontSize: 20, fontWeight: 'bold', color: THEME.textBlack, marginBottom: 4 },
    managerButtonDesc: { fontSize: 16, color: THEME.secondaryText },

    // Lists
    listContainer: { padding: 15, display: 'flex', flexDirection: 'column', alignItems: 'center', flexGrow: 1 },
    emptyText: { color: THEME.secondaryText, fontSize: 18, marginTop: 40 },
    listItem: { display: 'flex', flexDirection: 'row', backgroundColor: THEME.secondary, width: '100%', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 10, boxShadow: '0px 2px 3px rgba(0,0,0,0.05)', cursor: 'pointer', border: 'none', textAlign: 'left', boxSizing: 'border-box' },
    listIconBox: { width: 50, height: 50, backgroundColor: THEME.grayInput, borderRadius: 25, display: 'flex', justifyContent: 'center', alignItems: 'center', marginRight: 15, flexShrink: 0 },
    listContent: { flex: 1, display: 'flex', flexDirection: 'column' },
    listTitle: { fontSize: 20, fontWeight: 'bold', color: THEME.textBlack, marginBottom: 4 },
    listSubtitle: { fontSize: 16, color: THEME.secondaryText },

    // FAB
    fabContainer: { position: 'absolute', right: 20, bottom: 30, display: 'flex', flexDirection: 'column', alignItems: 'center' },
    fabAdd: { backgroundColor: THEME.primary, width: 55, height: 55, borderRadius: 27.5, display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0px 2px 5px rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer' },

    // Modals & Forms
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', zIndex: 1000 },
    modalHeader: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 24, fontWeight: 'bold', color: THEME.textBlack },
    closeButton: { backgroundColor: THEME.grayInput, padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' },
    inputContainer: { marginBottom: 15, display: 'flex', flexDirection: 'column' },
    formLabel: { fontSize: 16, color: THEME.secondaryText, marginBottom: 6, fontWeight: '500' },
    input: { backgroundColor: THEME.grayInput, borderRadius: 8, padding: '12px 15px', height: 60, fontSize: 18, color: THEME.textBlack, border: '1px solid transparent', boxSizing: 'border-box', width: '100%', fontFamily: 'inherit' },
    errorText: { color: THEME.error, fontSize: 11, marginTop: 4 },

    // Select
    selectBox: { backgroundColor: THEME.grayInput, borderRadius: 8, padding: '14px 15px', height: 60, display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', fontSize: 18, color: THEME.textBlack, border: '1px solid transparent', boxSizing: 'border-box', width: '100%', cursor: 'pointer', appearance: 'none', fontFamily: 'inherit' },

    // Date & Switch
    switchBox: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: THEME.grayInput, padding: 15, borderRadius: 8, marginBottom: 15 },
    switchLabel: { fontSize: 18, color: THEME.textBlack, fontWeight: '500' },

    // Chips
    chipButton: { backgroundColor: THEME.grayInput, padding: '8px 15px', borderRadius: 20, marginRight: 10, display: 'inline-flex', alignItems: 'center', border: 'none', cursor: 'pointer', flexShrink: 0 },
    chipButtonActive: { backgroundColor: THEME.primary },
    chipText: { color: THEME.secondaryText, fontWeight: 'bold', fontSize: 16 },
    chipTextActive: { color: THEME.textWhite },

    // Actions
    saveButton: { backgroundColor: THEME.primary, borderRadius: 8, height: 60, display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: 10, marginBottom: 10, border: 'none', cursor: 'pointer', width: '100%' },
    saveButtonText: { color: THEME.textWhite, fontWeight: 'bold', fontSize: 20 },
    deleteButton: { backgroundColor: 'transparent', border: `1px solid ${THEME.error}`, borderRadius: 8, height: 60, display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 20, cursor: 'pointer', width: '100%' },
    deleteButtonText: { color: THEME.error, fontWeight: 'bold', fontSize: 18 }
};

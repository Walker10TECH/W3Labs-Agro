// -----------------------------------------------------------------------------
// Manager.jsx
//
// Módulo de Gerenciamento (Propriedades, Unidades, Inventário e Estoque).
// Totalmente integrado ao Firestore e otimizado EXCLUSIVAMENTE PARA WEB.
// -----------------------------------------------------------------------------
import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
    Modal,
    TextInput,
    SafeAreaView,
    ActivityIndicator,
    Switch,
    useWindowDimensions
} from 'react-native';
import { createElement } from 'react-native-web'; // Essencial para injetar HTML nativo na Web
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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

// =====================================================================
// 2️⃣ COMPONENTES DE UI REUTILIZÁVEIS (WEB OPTIMIZED)
// =====================================================================

const CustomHeader = ({ title, onBack }) => (
    <View style={styles.fullHeader}>
        <View style={styles.headerContent}>
            {onBack ? (
                <TouchableOpacity onPress={onBack} style={[styles.backButton, { outlineStyle: 'none' }]}>
                    <Ionicons name="arrow-back" size={26} color={THEME.textWhite} />
                </TouchableOpacity>
            ) : <View style={{ width: 36 }} />}
            <Text style={styles.headerTitle}>{title}</Text>
            <View style={{ width: 36 }} />
        </View>
    </View>
);

const FabAdd = ({ onAdd }) => (
    <View style={styles.fabContainer}>
        <TouchableOpacity style={[styles.fabAdd, { outlineStyle: 'none' }]} onPress={onAdd}>
            <Ionicons name="add" size={28} color={THEME.textWhite} />
        </TouchableOpacity>
    </View>
);

const FormInput = ({ label, placeholder, value, onChangeText, required, keyboardType = 'default', editable = true, error, maxLength, multiline = false }) => (
    <View style={styles.inputContainer}>
        <Text style={styles.formLabel}>{label} {required && <Text style={{ color: THEME.primary }}>*</Text>}</Text>
        <TextInput
            style={[
                styles.input, 
                !editable && { opacity: 0.6 }, 
                error && { borderColor: THEME.error, borderWidth: 1 }, 
                multiline && { height: 100, textAlignVertical: 'top' },
                { outlineStyle: 'none' }
            ]}
            placeholder={placeholder}
            placeholderTextColor={THEME.secondaryText}
            value={value}
            onChangeText={onChangeText}
            keyboardType={keyboardType}
            editable={editable}
            maxLength={maxLength}
            multiline={multiline}
        />
        {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
);

const FormSelect = ({ label, placeholder, value, onValueChange, items, required, error }) => {
    const [modalVisible, setModalVisible] = useState(false);
    const selectedItem = items.find(i => i.value === value);

    return (
        <View style={styles.inputContainer}>
            <Text style={styles.formLabel}>{label} {required && <Text style={{ color: THEME.primary }}>*</Text>}</Text>
            <TouchableOpacity style={[styles.selectBox, error && { borderColor: THEME.error, borderWidth: 1 }, { outlineStyle: 'none' }]} onPress={() => setModalVisible(true)}>
                <Text style={[styles.selectText, !selectedItem && { color: THEME.secondaryText }]}>
                    {selectedItem ? selectedItem.label : placeholder}
                </Text>
                <Ionicons name="chevron-down" size={20} color={THEME.textBlack} />
            </TouchableOpacity>
            {error && <Text style={styles.errorText}>{error}</Text>}

            <Modal visible={modalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.selectModalContent}>
                        <Text style={styles.selectModalTitle}>Selecione uma opção</Text>
                        <ScrollView style={{ maxHeight: 300 }}>
                            {items.map((item, index) => (
                                <TouchableOpacity key={index} style={[styles.selectModalItem, { outlineStyle: 'none' }]} onPress={() => { onValueChange(item.value); setModalVisible(false); }}>
                                    <Text style={styles.selectModalItemText}>{item.label}</Text>
                                    {value === item.value && <Ionicons name="checkmark-circle" size={24} color={THEME.primary} />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity style={[styles.saveButton, { marginTop: 15, outlineStyle: 'none' }]} onPress={() => setModalVisible(false)}>
                            <Text style={styles.saveButtonText}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

// Input de Data utilizando o Native Date Picker do HTML5 via createElement
const FormDateWeb = ({ label, value, onChange }) => {
    const dateStr = value && !isNaN(value) ? value.toISOString().split('T')[0] : '';
    
    return (
        <View style={styles.inputContainer}>
            <Text style={styles.formLabel}>{label}</Text>
            {createElement('input', {
                type: 'date',
                value: dateStr,
                onChange: (e) => {
                    const val = e.target.value;
                    if (val) {
                        const newDate = new Date(`${val}T12:00:00`);
                        onChange(newDate);
                    }
                },
                style: {
                    backgroundColor: THEME.grayInput,
                    borderRadius: '8px',
                    padding: '0 15px',
                    height: '60px',
                    fontSize: '16px',
                    color: THEME.textBlack,
                    border: 'none',
                    outline: 'none',
                    width: '100%',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    cursor: 'pointer'
                }
            })}
        </View>
    );
};

const ChoiceChips = ({ options, selectedValue, onValueChange }) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        {options.map((opt, i) => {
            const isActive = selectedValue === opt.value;
            return (
                <TouchableOpacity
                    key={i}
                    style={[styles.chipButton, isActive && styles.chipButtonActive, { outlineStyle: 'none' }]}
                    onPress={() => onValueChange(opt.value)}
                >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
            );
        })}
    </View>
);

// Wrapper para Modal (Centralizado para Web)
const WebModalContainer = ({ children }) => (
    <View style={styles.modalOverlay}>
        {children}
    </View>
);

// =====================================================================
// 3️⃣ MODAIS DE CADASTRO
// =====================================================================

/* --- 1. Propriedade Modal --- */
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
            } catch (e) { window.alert('Propriedade não encontrada.'); onClose(); }
            setLoading(false);
        })();
    }, [itemId]);

    const setField = (field, value, type = 'text') => {
        setData(prev => ({ ...prev, [field]: type === 'numeric' ? value.replace(/[^0-9,.]/g, '') : value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    };

    const validate = () => {
        const errs = {};
        if (!data.nome.trim()) errs.nome = 'Nome obrigatório.';
        if (!data.proprietario.trim()) errs.proprietario = 'Proprietário obrigatório.';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return window.alert('Corrija os campos destacados.');
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
        } catch (e) { window.alert('Falha ao salvar.'); }
        setSaving(false);
    };

    const handleDelete = () => {
        if (window.confirm('Deseja realmente excluir esta propriedade?')) {
            deleteDoc(doc(db, 'users', auth.currentUser.uid, 'propriedades', itemId)).then(onClose);
        }
    };

    if (loading) return <View style={styles.modalOverlay}><ActivityIndicator size="large" color={THEME.primary} /></View>;

    return (
        <Modal visible animationType="fade" transparent>
            <WebModalContainer>
                <View style={styles.modalContentDesktop}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{itemId ? 'Editar Propriedade' : 'Nova Propriedade'}</Text>
                        <TouchableOpacity style={[styles.closeButton, { outlineStyle: 'none' }]} onPress={onClose}><Ionicons name="close" size={24} /></TouchableOpacity>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <ChoiceChips
                            options={[{ label: 'Própria', value: 'propria' }, { label: 'Arrendada', value: 'arrendada' }]}
                            selectedValue={data.tipo} onValueChange={v => setField('tipo', v)}
                        />
                        <View style={styles.row}>
                            <View style={styles.col}><FormInput label="Nome da Propriedade" required value={data.nome} onChangeText={v => setField('nome', v)} error={errors.nome} /></View>
                            <View style={styles.col}><FormInput label="Proprietário" required value={data.proprietario} onChangeText={v => setField('proprietario', v)} error={errors.proprietario} /></View>
                        </View>
                        <View style={styles.row}>
                            <View style={styles.col}><FormInput label="Área Total (ha)" keyboardType="numeric" value={data.area} onChangeText={v => setField('area', v, 'numeric')} /></View>
                            <View style={styles.col}><FormInput label="Área Mecanizada (ha)" keyboardType="numeric" value={data.areaMecanizada} onChangeText={v => setField('areaMecanizada', v, 'numeric')} /></View>
                        </View>

                        {data.tipo === 'arrendada' && (
                            <>
                                <FormInput label="Valor Arrendamento (R$)" keyboardType="numeric" value={data.valorArrendamento} onChangeText={v => setField('valorArrendamento', v, 'numeric')} />
                                <View style={styles.row}>
                                    <View style={styles.col}><FormDateWeb label="Início do Contrato" value={data.inicioContrato} onChange={d => setField('inicioContrato', d)} /></View>
                                    <View style={styles.col}><FormDateWeb label="Fim do Contrato" value={data.fimContrato} onChange={d => setField('fimContrato', d)} /></View>
                                </View>
                            </>
                        )}
                        <FormInput label="Observações" value={data.observacoes} onChangeText={v => setField('observacoes', v)} multiline />

                        <TouchableOpacity style={[styles.saveButton, { outlineStyle: 'none' }]} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator color={THEME.textWhite} /> : <Text style={styles.saveButtonText}>Salvar Propriedade</Text>}
                        </TouchableOpacity>
                        {itemId && <TouchableOpacity style={[styles.deleteButton, { outlineStyle: 'none' }]} onPress={handleDelete}><Text style={styles.deleteButtonText}>Excluir Propriedade</Text></TouchableOpacity>}
                    </ScrollView>
                </View>
            </WebModalContainer>
        </Modal>
    );
};

/* --- 2. Unidade Modal --- */
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
        if (!data.nome.trim()) return setErrors({ nome: 'Nome é obrigatório' });
        setSaving(true);
        try {
            const uid = auth.currentUser.uid;
            const id = itemId || doc(collection(db, 'users', uid, 'unidades')).id;
            await setDoc(doc(db, 'users', uid, 'unidades', id), { ...data, id }, { merge: true });
            onClose();
        } catch (e) { window.alert('Erro ao salvar'); } 
        setSaving(false);
    };

    const handleDelete = () => {
        if (window.confirm('Deseja excluir esta unidade?')) {
            deleteDoc(doc(db, 'users', auth.currentUser.uid, 'unidades', itemId)).then(onClose);
        }
    };

    if (loading) return <View style={styles.modalOverlay}><ActivityIndicator size="large" color={THEME.primary} /></View>;

    return (
        <Modal visible animationType="fade" transparent>
            <WebModalContainer>
                <View style={styles.modalContentDesktop}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{itemId ? 'Editar Unidade' : 'Nova Unidade'}</Text>
                        <TouchableOpacity style={[styles.closeButton, { outlineStyle: 'none' }]} onPress={onClose}><Ionicons name="close" size={24} /></TouchableOpacity>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <ChoiceChips
                            options={[{ label: 'Cooperativa', value: 'Cooperativa' }, { label: 'Fornecedor', value: 'Fornecedor' }, { label: 'Cliente', value: 'Cliente' }, { label: 'Outro', value: 'Outro' }]}
                            selectedValue={data.tipo} onValueChange={v => setField('tipo', v)}
                        />
                        <FormInput label="Nome da Empresa / Pessoa" required value={data.nome} onChangeText={v => setField('nome', v)} error={errors.nome} />
                        
                        <View style={styles.row}>
                            <View style={styles.col}><FormInput label="Contato" value={data.contato} onChangeText={v => setField('contato', v)} /></View>
                            <View style={styles.col}><FormInput label="Telefone" value={data.telefone} onChangeText={v => setField('telefone', v)} /></View>
                        </View>
                        
                        <FormInput label="Email" value={data.email} onChangeText={v => setField('email', v)} />
                        <FormInput label="Observações" value={data.observacoes} onChangeText={v => setField('observacoes', v)} multiline />

                        <TouchableOpacity style={[styles.saveButton, { outlineStyle: 'none' }]} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator color={THEME.textWhite} /> : <Text style={styles.saveButtonText}>Salvar Unidade</Text>}
                        </TouchableOpacity>
                        {itemId && <TouchableOpacity style={[styles.deleteButton, { outlineStyle: 'none' }]} onPress={handleDelete}><Text style={styles.deleteButtonText}>Excluir Unidade</Text></TouchableOpacity>}
                    </ScrollView>
                </View>
            </WebModalContainer>
        </Modal>
    );
};

/* --- 3. Equipamento Modal --- */
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
        if (!data.marca.trim() || !data.modelo.trim()) return window.alert('Marca e Modelo são obrigatórios.');
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
        } catch (e) { window.alert('Erro ao salvar.'); } 
        setSaving(false);
    };

    const handleDelete = () => {
        if (window.confirm('Deseja excluir este equipamento?')) {
            deleteDoc(doc(db, 'users', auth.currentUser.uid, 'inventario', itemId)).then(onClose);
        }
    };

    if (loading) return <View style={styles.modalOverlay}><ActivityIndicator size="large" color={THEME.primary} /></View>;

    return (
        <Modal visible animationType="fade" transparent>
            <WebModalContainer>
                <View style={styles.modalContentDesktop}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{itemId ? 'Editar Equipamento' : 'Novo Equipamento'}</Text>
                        <TouchableOpacity style={[styles.closeButton, { outlineStyle: 'none' }]} onPress={onClose}><Ionicons name="close" size={24} /></TouchableOpacity>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false}>
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

                        <View style={styles.row}>
                            <View style={[styles.col, { flex: 2 }]}><FormInput label="Modelo" required value={data.modelo} onChangeText={v => setField('modelo', v)} /></View>
                            <View style={styles.col}><FormInput label="Ano" keyboardType="numeric" maxLength={4} value={data.ano} onChangeText={v => setField('ano', v)} /></View>
                        </View>
                        
                        <View style={styles.row}>
                            <View style={styles.col}><FormInput label="Número Chassi" value={data.nrChassi} onChangeText={v => setField('nrChassi', v)} /></View>
                            <View style={styles.col}><FormInput label="Valor (R$)" keyboardType="numeric" value={data.valor} onChangeText={v => setField('valor', v)} /></View>
                        </View>

                        <View style={styles.switchBox}>
                            <Text style={styles.switchLabel}>Status Ativo</Text>
                            <Switch trackColor={{ false: "#d3d3d3", true: THEME.primary }} thumbColor="#FFF" onValueChange={() => setField('status', data.status === 'Ativo' ? 'Inativo' : 'Ativo')} value={data.status === 'Ativo'} />
                        </View>
                        <View style={styles.switchBox}>
                            <Text style={styles.switchLabel}>Requer Combustível</Text>
                            <Switch trackColor={{ false: "#d3d3d3", true: THEME.primary }} thumbColor="#FFF" onValueChange={() => setField('combustaoAtiva', !data.combustaoAtiva)} value={data.combustaoAtiva} />
                        </View>

                        {data.combustaoAtiva && (
                            <ChoiceChips
                                options={[{ label: 'Diesel S10', value: 'Diesel S10' }, { label: 'Diesel S500', value: 'Diesel S500' }, { label: 'Gasolina', value: 'Gasolina' }]}
                                selectedValue={data.tipoCombustivel} onValueChange={v => setField('tipoCombustivel', v)}
                            />
                        )}

                        <TouchableOpacity style={[styles.saveButton, { outlineStyle: 'none' }]} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator color={THEME.textWhite} /> : <Text style={styles.saveButtonText}>Salvar Equipamento</Text>}
                        </TouchableOpacity>
                        {itemId && <TouchableOpacity style={[styles.deleteButton, { outlineStyle: 'none' }]} onPress={handleDelete}><Text style={styles.deleteButtonText}>Excluir Equipamento</Text></TouchableOpacity>}
                    </ScrollView>
                </View>
            </WebModalContainer>
        </Modal>
    );
};

/* --- 4. Estoque Geral Modal --- */
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
        } catch (e) { window.alert('Erro ao salvar.'); } 
        setSaving(false);
    };

    const handleDelete = () => {
        if (window.confirm('Deseja excluir este item do estoque?')) {
            deleteDoc(doc(db, 'users', auth.currentUser.uid, 'estoqueGeral', itemId)).then(onClose);
        }
    };

    if (loading) return <View style={styles.modalOverlay}><ActivityIndicator size="large" color={THEME.primary} /></View>;

    return (
        <Modal visible animationType="fade" transparent>
            <WebModalContainer>
                <View style={styles.modalContentDesktop}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{itemId ? 'Editar Item' : 'Novo Item Estoque'}</Text>
                        <TouchableOpacity style={[styles.closeButton, { outlineStyle: 'none' }]} onPress={onClose}><Ionicons name="close" size={24} /></TouchableOpacity>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <ChoiceChips
                            options={[{ label: 'Semente', value: 'Semente' }, { label: 'Fertilizante', value: 'Fertilizante' }, { label: 'Defensivo', value: 'Defensivo' }, { label: 'Peça', value: 'Peça' }]}
                            selectedValue={data.tipo} onValueChange={v => setField('tipo', v)}
                        />
                        <FormInput label="Nome do Item" required value={data.nome} onChangeText={v => setField('nome', v)} error={errors.nome} />
                        
                        <View style={styles.row}>
                            <View style={styles.col}><FormInput label="Quantidade" keyboardType="numeric" value={data.quantidade} onChangeText={v => setField('quantidade', v)} /></View>
                            <View style={styles.col}><FormInput label="Unidade (Ex: sc, L, kg)" value={data.unidade} onChangeText={v => setField('unidade', v)} /></View>
                        </View>
                        
                        <View style={styles.row}>
                            <View style={styles.col}><FormInput label="Fornecedor" value={data.fornecedor} onChangeText={v => setField('fornecedor', v)} /></View>
                            <View style={styles.col}><FormInput label="Local (Ex: Galpão 1)" value={data.local} onChangeText={v => setField('local', v)} /></View>
                        </View>
                        
                        <FormInput label="Observações" value={data.obs} onChangeText={v => setField('obs', v)} multiline />

                        <TouchableOpacity style={[styles.saveButton, { outlineStyle: 'none' }]} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator color={THEME.textWhite} /> : <Text style={styles.saveButtonText}>Salvar Estoque</Text>}
                        </TouchableOpacity>
                        {itemId && <TouchableOpacity style={[styles.deleteButton, { outlineStyle: 'none' }]} onPress={handleDelete}><Text style={styles.deleteButtonText}>Excluir Item</Text></TouchableOpacity>}
                    </ScrollView>
                </View>
            </WebModalContainer>
        </Modal>
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
        <SafeAreaView style={styles.container}>
            <CustomHeader title={title} onBack={onBack} />
            <View style={styles.webContainer}>
                <ScrollView contentContainerStyle={styles.listContainer}>
                    <View style={styles.listGridWeb}>
                        {loading ? <ActivityIndicator size="large" color={THEME.primary} style={{ marginTop: 50, gridColumn: '1 / -1' }} />
                            : items.length === 0 ? <Text style={[styles.emptyText, { gridColumn: '1 / -1' }]}>Nenhum registro encontrado.</Text>
                                : items.map(item => (
                                    <TouchableOpacity key={item.id} style={[styles.listItem, { outlineStyle: 'none' }]} onPress={() => setModal({ visible: true, itemId: item.id })}>
                                        <View style={styles.listIconBox}>
                                            <MaterialCommunityIcons name={icon} size={24} color={THEME.primary} />
                                        </View>
                                        <View style={styles.listContent}>
                                            <Text style={styles.listTitle}>{item.nome || item.marca || 'Sem título'}</Text>
                                            <Text style={styles.listSubtitle}>{renderSubtitle(item)}</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={24} color={THEME.secondaryText} />
                                    </TouchableOpacity>
                                ))}
                    </View>
                </ScrollView>

                <FabAdd onAdd={() => setModal({ visible: true, itemId: null })} />

                {/* Injeta o Modal correto dinamicamente */}
                {modal.visible && collectionName === 'propriedades' && <AddOrEditPropriedadeModal itemId={modal.itemId} onClose={() => setModal({ visible: false, itemId: null })} />}
                {modal.visible && collectionName === 'unidades' && <AddOrEditUnidadeModal itemId={modal.itemId} onClose={() => setModal({ visible: false, itemId: null })} />}
                {modal.visible && collectionName === 'inventario' && <AddOrEditEquipamentoModal itemId={modal.itemId} onClose={() => setModal({ visible: false, itemId: null })} />}
                {modal.visible && collectionName === 'estoqueGeral' && <AddOrEditEstoqueGeralModal itemId={modal.itemId} onClose={() => setModal({ visible: false, itemId: null })} />}
            </View>
        </SafeAreaView>
    );
};

// =====================================================================
// 5️⃣ TELA PRINCIPAL (GERENCIADOR)
// =====================================================================

export default function Manager({ navigation, route }) {
    const initialView = route?.params?.initialView || 'menu';
    const [currentView, setCurrentView] = useState(initialView);

    const handleBack = initialView !== 'menu'
        ? () => navigation.goBack()
        : () => setCurrentView('menu');

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
        <SafeAreaView style={styles.container}>
            <CustomHeader title="Gerenciador" onBack={() => navigation.goBack()} />
            <View style={styles.webContainer}>
                <ScrollView contentContainerStyle={{ padding: 30 }}>
                    <View style={styles.menuGrid}>
                        {menuOptions.map((opt, i) => (
                            <TouchableOpacity 
                                key={i} 
                                style={[styles.managerButton, { outlineStyle: 'none' }]} 
                                onPress={() => setCurrentView(opt.view)}
                            >
                                <View style={styles.managerButtonIcon}>
                                    <MaterialCommunityIcons name={opt.icon} size={32} color={THEME.textWhite} />
                                </View>
                                <View style={{ flex: 1, marginLeft: 20 }}>
                                    <Text style={styles.managerButtonTitle}>{opt.title}</Text>
                                    <Text style={styles.managerButtonDesc}>{opt.desc}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={28} color={THEME.primary} />
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}

// =====================================================================
// 6️⃣ ESTILOS GERAIS (WEB FOCUSED)
// =====================================================================

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.background },
    webContainer: {
        flex: 1,
        width: '100%',
        maxWidth: 1000, 
        alignSelf: 'center',
        position: 'relative',
        boxShadow: '0 0 20px rgba(0,0,0,0.05)',
        backgroundColor: THEME.background,
    },
    
    // Auxiliares de Layout Flexível
    row: { flexDirection: 'row', gap: 15, width: '100%' },
    col: { flex: 1 },

    // Header
    fullHeader: { backgroundColor: THEME.primary, width: '100%', alignItems: 'center' },
    headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 70, width: '100%', maxWidth: 1000 },
    backButton: { padding: 5, cursor: 'pointer' },
    headerTitle: { color: THEME.textWhite, fontSize: 24, fontWeight: 'bold' },

    // Manager Menu (Grid Responsivo Web)
    menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, justifyContent: 'space-between' },
    managerButton: { flexDirection: 'row', backgroundColor: THEME.secondary, padding: 25, borderRadius: 15, alignItems: 'center', flex: 1, minWidth: 320, boxShadow: '0 4px 10px rgba(0,0,0,0.05)', transition: 'transform 0.2s', cursor: 'pointer' },
    managerButtonIcon: { backgroundColor: THEME.primary, padding: 18, borderRadius: 12 },
    managerButtonTitle: { fontSize: 22, fontWeight: 'bold', color: THEME.textBlack, marginBottom: 6 },
    managerButtonDesc: { fontSize: 16, color: THEME.secondaryText },

    // Lists
    listContainer: { padding: 25, flexGrow: 1 },
    listGridWeb: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
    emptyText: { color: THEME.secondaryText, fontSize: 18, marginTop: 40, textAlign: 'center', width: '100%' },
    listItem: { flexDirection: 'row', backgroundColor: THEME.secondary, padding: 20, borderRadius: 12, alignItems: 'center', flex: 1, minWidth: 320, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer' },
    listIconBox: { width: 55, height: 55, backgroundColor: THEME.grayInput, borderRadius: 27.5, justifyContent: 'center', alignItems: 'center', marginRight: 20 },
    listContent: { flex: 1 },
    listTitle: { fontSize: 18, fontWeight: 'bold', color: THEME.textBlack, marginBottom: 4 },
    listSubtitle: { fontSize: 15, color: THEME.secondaryText },

    // FAB
    fabContainer: { position: 'absolute', right: 30, bottom: 40, alignItems: 'center', zIndex: 10 },
    fabAdd: { backgroundColor: THEME.primary, width: 65, height: 65, borderRadius: 32.5, justifyContent: 'center', alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', cursor: 'pointer' },

    // Modals Web Centered
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContentDesktop: { backgroundColor: THEME.secondary, borderRadius: 20, padding: 30, width: '100%', maxWidth: 700, maxHeight: '90%', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, borderBottomWidth: 1, borderBottomColor: THEME.grayInput, paddingBottom: 15 },
    modalTitle: { fontSize: 24, fontWeight: 'bold', color: THEME.textBlack },
    closeButton: { backgroundColor: THEME.grayInput, padding: 8, borderRadius: 8, cursor: 'pointer' },
    
    // Forms
    inputContainer: { marginBottom: 20 },
    formLabel: { fontSize: 15, color: THEME.secondaryText, marginBottom: 8, fontWeight: '600' },
    input: { backgroundColor: THEME.grayInput, borderRadius: 10, paddingHorizontal: 15, paddingVertical: 14, fontSize: 16, color: THEME.textBlack },
    errorText: { color: THEME.error, fontSize: 12, marginTop: 5, fontWeight: '500' },

    // Selects Nativo Visual
    selectBox: { backgroundColor: THEME.grayInput, borderRadius: 10, paddingHorizontal: 15, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' },
    selectText: { fontSize: 16, color: THEME.textBlack },
    selectModalContent: { backgroundColor: THEME.secondary, width: '100%', maxWidth: 400, borderRadius: 15, padding: 25 },
    selectModalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: THEME.textBlack, textAlign: 'center' },
    selectModalItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: THEME.grayInput, cursor: 'pointer' },
    selectModalItemText: { fontSize: 18, color: THEME.textBlack },

    // Switches & Chips
    switchBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: THEME.grayInput, padding: 18, borderRadius: 10, marginBottom: 20 },
    switchLabel: { fontSize: 16, color: THEME.textBlack, fontWeight: '600' },
    chipButton: { backgroundColor: THEME.grayInput, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, cursor: 'pointer' },
    chipButtonActive: { backgroundColor: THEME.primary },
    chipText: { color: THEME.secondaryText, fontWeight: 'bold', fontSize: 14 },
    chipTextActive: { color: THEME.textWhite },

    // Actions
    saveButton: { backgroundColor: THEME.primary, borderRadius: 10, height: 60, justifyContent: 'center', alignItems: 'center', marginTop: 10, marginBottom: 15, cursor: 'pointer' },
    saveButtonText: { color: THEME.textWhite, fontWeight: 'bold', fontSize: 18 },
    deleteButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: THEME.error, borderRadius: 10, height: 60, justifyContent: 'center', alignItems: 'center', marginBottom: 15, cursor: 'pointer' },
    deleteButtonText: { color: THEME.error, fontWeight: 'bold', fontSize: 16 }
});
// -----------------------------------------------------------------------------
// Manager.jsx
//
// Módulo de Gerenciamento (Propriedades, Unidades, Inventário e Estoque).
// Totalmente integrado ao Firestore e com o Design Padrão W3Labs otimizado para Mobile.
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
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
    Switch,
    LayoutAnimation,
    UIManager
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { collection, doc, getDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Certifique-se de que auth e db estão corretamente exportados do seu firebaseConfig
import { auth, db } from '../firebaseConfig';

// =====================================================================
// 1️⃣ CONFIGURAÇÕES, CONSTANTES E TEMA
// =====================================================================

const THEME = {
    primary: '#4CAF50',
    primaryDark: '#388E3C',
    secondary: '#FFFFFF',     // Branco
    background: '#F9FBF9',    // Fundo cinza bem claro
    textBlack: '#2C3329',     // Texto escuro
    textWhite: '#FFFFFF',     // Texto branco
    secondaryText: '#4A4A4A', // Cinza para subtítulos
    grayInput: '#F0F4F1',     // Fundo dos inputs
    error: '#E53935',         // Vermelho para erros
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

// Funções Utilitárias
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
// 2️⃣ COMPONENTES DE UI REUTILIZÁVEIS
// =====================================================================

const CustomHeader = ({ title, onBack }) => (
    <View style={styles.header}>
        {onBack ? (
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
                <Ionicons name="arrow-back" size={26} color={THEME.textWhite} />
            </TouchableOpacity>
        ) : <View style={{ width: 36 }} />}
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 36 }} />
    </View>
);

const FabAdd = ({ onAdd }) => (
    <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fabAdd} onPress={onAdd}>
            <Ionicons name="add" size={28} color={THEME.textWhite} />
        </TouchableOpacity>
    </View>
);

const FormInput = ({ label, placeholder, value, onChangeText, required, keyboardType = 'default', editable = true, error, maxLength }) => (
    <View style={styles.inputContainer}>
        <Text style={styles.formLabel}>{label} {required && <Text style={{ color: THEME.primary }}>*</Text>}</Text>
        <TextInput
            style={[styles.input, !editable && { opacity: 0.6 }, error && { borderColor: THEME.error, borderWidth: 1 }]}
            placeholder={placeholder}
            placeholderTextColor={THEME.secondaryText}
            value={value}
            onChangeText={onChangeText}
            keyboardType={keyboardType}
            editable={editable}
            maxLength={maxLength}
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
            <TouchableOpacity style={[styles.selectBox, error && { borderColor: THEME.error, borderWidth: 1 }]} onPress={() => setModalVisible(true)}>
                <Text style={[styles.selectText, !selectedItem && { color: THEME.secondaryText }]}>
                    {selectedItem ? selectedItem.label : placeholder}
                </Text>
                <Ionicons name="chevron-down" size={20} color={THEME.textBlack} />
            </TouchableOpacity>
            {error && <Text style={styles.errorText}>{error}</Text>}

            <Modal visible={modalVisible} transparent animationType="fade">
                <TouchableOpacity style={styles.selectModalOverlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
                    <View style={styles.selectModalContent}>
                        <Text style={styles.selectModalTitle}>Selecione uma opção</Text>
                        <ScrollView style={{ maxHeight: 300 }}>
                            {items.map((item, index) => (
                                <TouchableOpacity key={index} style={styles.selectModalItem} onPress={() => { onValueChange(item.value); setModalVisible(false); }}>
                                    <Text style={styles.selectModalItemText}>{item.label}</Text>
                                    {value === item.value && <Ionicons name="checkmark-circle" size={24} color={THEME.primary} />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};

const FormDate = ({ label, value, onChange }) => {
    const [show, setShow] = useState(false);
    const dateValue = value instanceof Date && !isNaN(value) ? value : new Date();
    return (
        <View style={styles.inputContainer}>
            <Text style={styles.formLabel}>{label}</Text>
            <TouchableOpacity style={styles.dateBox} onPress={() => setShow(true)} activeOpacity={0.7}>
                <View style={styles.dateIconWrapper}>
                    <FontAwesome5 name="calendar-alt" size={24} color={THEME.textWhite} />
                </View>
                <Text style={styles.dateText}>{formatDate(dateValue)}</Text>
            </TouchableOpacity>
            {show && (
                <DateTimePicker
                    value={dateValue}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => {
                        setShow(Platform.OS === 'ios');
                        if (selectedDate && onChange) onChange(selectedDate);
                    }}
                />
            )}
        </View>
    );
};

const ChoiceChips = ({ options, selectedValue, onValueChange }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
        {options.map((opt, i) => {
            const isActive = selectedValue === opt.value;
            return (
                <TouchableOpacity
                    key={i}
                    style={[styles.chipButton, isActive && styles.chipButtonActive]}
                    onPress={() => onValueChange(opt.value)}
                >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
            );
        })}
    </ScrollView>
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
            } catch (e) { Alert.alert('Erro', 'Propriedade não encontrada.'); onClose(); }
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
        if (!validate()) return Alert.alert('Atenção', 'Corrija os campos destacados.');
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
        } catch (e) { Alert.alert('Erro', 'Falha ao salvar.'); }
        setSaving(false);
    };

    const handleDelete = () => {
        Alert.alert('Excluir', 'Deseja excluir esta propriedade?', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Excluir',
                style: 'destructive',
                onPress: async () => {
                    await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'propriedades', itemId));
                    onClose();
                }
            }
        ]);
    };

    if (loading) return <View style={styles.modalOverlay}><ActivityIndicator size="large" color={THEME.primary} /></View>;

    return (
        <Modal visible animationType="slide" transparent>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{itemId ? 'Editar Propriedade' : 'Nova Propriedade'}</Text>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}><Ionicons name="close" size={20} /></TouchableOpacity>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <ChoiceChips
                            options={[{ label: 'Própria', value: 'propria' }, { label: 'Arrendada', value: 'arrendada' }]}
                            selectedValue={data.tipo} onValueChange={v => setField('tipo', v)}
                        />
                        <FormInput label="Nome da Propriedade" required value={data.nome} onChangeText={v => setField('nome', v)} error={errors.nome} />
                        <FormInput label="Proprietário" required value={data.proprietario} onChangeText={v => setField('proprietario', v)} error={errors.proprietario} />
                        <FormInput label="Área Total (ha)" keyboardType="numeric" value={data.area} onChangeText={v => setField('area', v, 'numeric')} />
                        <FormInput label="Área Mecanizada (ha)" keyboardType="numeric" value={data.areaMecanizada} onChangeText={v => setField('areaMecanizada', v, 'numeric')} />

                        {data.tipo === 'arrendada' && (
                            <>
                                <FormInput label="Valor Arrendamento (R$)" keyboardType="numeric" value={data.valorArrendamento} onChangeText={v => setField('valorArrendamento', v, 'numeric')} />
                                <FormDate label="Início do Contrato" value={data.inicioContrato} onChange={d => setField('inicioContrato', d, 'date')} />
                                <FormDate label="Fim do Contrato" value={data.fimContrato} onChange={d => setField('fimContrato', d, 'date')} />
                            </>
                        )}
                        <FormInput label="Observações" value={data.observacoes} onChangeText={v => setField('observacoes', v)} multiline />

                        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator color={THEME.textWhite} /> : <Text style={styles.saveButtonText}>Salvar Propriedade</Text>}
                        </TouchableOpacity>
                        {itemId && <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}><Text style={styles.deleteButtonText}>Excluir Propriedade</Text></TouchableOpacity>}
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

/* --- 2. Unidade Modal --- */
const AddOrEditUnidadeModal = ({ itemId, onClose }) => {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [errors, setErrors] = useState({});
    const [data, setData] = useState({ nome: '', tipo: 'Cooperativa', contato: '', telefone: '', email: '', cnpj: '', observacoes: '' });

    const triggerAnimation = () => {
        if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    };

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

    const handleDelete = () => {
        Alert.alert('Excluir', 'Deseja excluir esta unidade?', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Excluir',
                style: 'destructive',
                onPress: async () => {
                    await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'unidades', itemId));
                    onClose();
                }
            }
        ]);
    };

    if (loading) return <View style={styles.modalOverlay}><ActivityIndicator size="large" color={THEME.primary} /></View>;

    return (
        <Modal visible animationType="slide" transparent>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{itemId ? 'Editar Unidade' : 'Nova Unidade'}</Text>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}><Ionicons name="close" size={20} /></TouchableOpacity>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <ChoiceChips
                            options={[{ label: 'Coop', value: 'Cooperativa' }, { label: 'Fornecedor', value: 'Fornecedor' }, { label: 'Cliente', value: 'Cliente' }, { label: 'Outro', value: 'Outro' }]}
                            selectedValue={data.tipo} onValueChange={v => setField('tipo', v)}
                        />
                        <FormInput label="Nome da Unidade" required value={data.nome} onChangeText={v => setField('nome', v)} error={errors.nome} />
                        <FormInput label="Contato" value={data.contato} onChangeText={v => setField('contato', v)} />
                        <FormInput label="Telefone" keyboardType="phone-pad" value={data.telefone} onChangeText={v => setField('telefone', v)} />
                        <FormInput label="Email" keyboardType="email-address" value={data.email} onChangeText={v => setField('email', v)} />
                        <FormInput label="Observações" value={data.observacoes} onChangeText={v => setField('observacoes', v)} multiline />

                        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator color={THEME.textWhite} /> : <Text style={styles.saveButtonText}>Salvar Unidade</Text>}
                        </TouchableOpacity>
                        {itemId && <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}><Text style={styles.deleteButtonText}>Excluir Unidade</Text></TouchableOpacity>}
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
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
        if (!data.marca.trim() || !data.modelo.trim()) return Alert.alert('Erro', 'Marca e Modelo são obrigatórios.');
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

    const handleDelete = () => {
        Alert.alert('Excluir', 'Deseja excluir este equipamento?', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Excluir',
                style: 'destructive',
                onPress: async () => {
                    await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'inventario', itemId));
                    onClose();
                }
            }
        ]);
    };

    if (loading) return <View style={styles.modalOverlay}><ActivityIndicator size="large" color={THEME.primary} /></View>;

    return (
        <Modal visible animationType="slide" transparent>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{itemId ? 'Editar Equipamento' : 'Novo Equipamento'}</Text>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}><Ionicons name="close" size={20} /></TouchableOpacity>
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

                        <FormInput label="Modelo" required value={data.modelo} onChangeText={v => setField('modelo', v)} />
                        <FormInput label="Ano" keyboardType="numeric" maxLength={4} value={data.ano} onChangeText={v => setField('ano', v)} />
                        <FormInput label="Número Chassi" value={data.nrChassi} onChangeText={v => setField('nrChassi', v)} />
                        <FormInput label="Valor (R$)" keyboardType="numeric" value={data.valor} onChangeText={v => setField('valor', v)} />

                        {/* Switches Customizados */}
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

                        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator color={THEME.textWhite} /> : <Text style={styles.saveButtonText}>Salvar Equipamento</Text>}
                        </TouchableOpacity>
                        {itemId && <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}><Text style={styles.deleteButtonText}>Excluir Equipamento</Text></TouchableOpacity>}
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
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
        } catch (e) { } setSaving(false);
    };

    const handleDelete = () => {
        Alert.alert('Excluir', 'Deseja excluir este item do estoque?', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Excluir',
                style: 'destructive',
                onPress: async () => {
                    await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'estoqueGeral', itemId));
                    onClose();
                }
            }
        ]);
    };

    if (loading) return <View style={styles.modalOverlay}><ActivityIndicator size="large" color={THEME.primary} /></View>;

    return (
        <Modal visible animationType="slide" transparent>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{itemId ? 'Editar Item' : 'Novo Item Estoque'}</Text>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}><Ionicons name="close" size={20} /></TouchableOpacity>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <ChoiceChips
                            options={[{ label: 'Semente', value: 'Semente' }, { label: 'Fertilizante', value: 'Fertilizante' }, { label: 'Defensivo', value: 'Defensivo' }, { label: 'Peça', value: 'Peça' }]}
                            selectedValue={data.tipo} onValueChange={v => setField('tipo', v)}
                        />
                        <FormInput label="Nome do Item" required value={data.nome} onChangeText={v => setField('nome', v)} error={errors.nome} />
                        <FormInput label="Quantidade" keyboardType="numeric" value={data.quantidade} onChangeText={v => setField('quantidade', v)} />
                        <FormInput label="Unidade (Ex: sc, L, kg)" value={data.unidade} onChangeText={v => setField('unidade', v)} />
                        <FormInput label="Fornecedor" value={data.fornecedor} onChangeText={v => setField('fornecedor', v)} />
                        <FormInput label="Local (Ex: Galpão 1)" value={data.local} onChangeText={v => setField('local', v)} />
                        <FormInput label="Observações" value={data.obs} onChangeText={v => setField('obs', v)} multiline />

                        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator color={THEME.textWhite} /> : <Text style={styles.saveButtonText}>Salvar Estoque</Text>}
                        </TouchableOpacity>
                        {itemId && <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}><Text style={styles.deleteButtonText}>Excluir Item</Text></TouchableOpacity>}
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
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
            triggerAnimation();
            setItems(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [collectionName]);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.webContainer}>
            <CustomHeader title={title} onBack={onBack} />
            <ScrollView contentContainerStyle={styles.listContainer}>
                {loading ? <ActivityIndicator size="large" color={THEME.primary} style={{ marginTop: 50 }} />
                    : items.length === 0 ? <Text style={styles.emptyText}>Nenhum registro encontrado.</Text>
                        : items.map(item => (
                            <TouchableOpacity key={item.id} style={styles.listItem} onPress={() => { triggerAnimation(); setModal({ visible: true, itemId: item.id }); }}>
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
            </ScrollView>

            <FabAdd onAdd={() => { triggerAnimation(); setModal({ visible: true, itemId: null }); }} />

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

    const triggerAnimation = () => {
        if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    };

    // Se a tela foi aberta diretamente em uma lista, o botão "voltar" deve retornar à tela anterior (Dashboard).
    // Caso contrário, ele volta para o menu do Gerenciador.
    const handleBack = initialView !== 'menu'
        ? () => navigation.goBack()
        : () => {
            triggerAnimation();
            setCurrentView('menu');
        };

    // Roteador Interno Simples
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
            <View style={styles.webContainer}>
            <CustomHeader title="Gerenciador" onBack={() => navigation.goBack()} />
            <ScrollView contentContainerStyle={{ padding: 20 }}>
                {menuOptions.map((opt, i) => (
                    <TouchableOpacity key={i} style={styles.managerButton} onPress={() => { triggerAnimation(); setCurrentView(opt.view); }}>
                        <View style={styles.managerButtonIcon}>
                            <MaterialCommunityIcons name={opt.icon} size={28} color={THEME.textWhite} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 15 }}>
                            <Text style={styles.managerButtonTitle}>{opt.title}</Text>
                            <Text style={styles.managerButtonDesc}>{opt.desc}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={24} color={THEME.primary} />
                    </TouchableOpacity>
                ))}
            </ScrollView>
            </View>
        </SafeAreaView>
    );
}

// =====================================================================
// 6️⃣ ESTILOS GERAIS
// =====================================================================

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.background },
    webContainer: {
        flex: 1,
        width: '100%',
        maxWidth: 800,
        alignSelf: 'center',
    },
    // Header
    header: { backgroundColor: THEME.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, height: 60, ...Platform.select({ android: { marginTop: 24 } }) },
    backButton: { padding: 5 },
    headerTitle: { color: THEME.textWhite, fontSize: 22, fontWeight: 'bold' },

    // Manager Menu
    managerButton: { flexDirection: 'row', backgroundColor: THEME.secondary, padding: 15, borderRadius: 15, alignItems: 'center', marginBottom: 15, ...Platform.select({ web: { boxShadow: '0px 2px 3px rgba(0,0,0,0.05)' }, default: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3 } }), elevation: 3 },
    managerButtonIcon: { backgroundColor: THEME.primary, padding: 12, borderRadius: 12 },
    managerButtonTitle: { fontSize: 20, fontWeight: 'bold', color: THEME.textBlack, marginBottom: 4 },
    managerButtonDesc: { fontSize: 16, color: THEME.secondaryText },

    // Lists
    listContainer: { padding: 15, alignItems: 'center', flexGrow: 1 },
    emptyText: { color: THEME.secondaryText, fontSize: 18, marginTop: 40 },
    listItem: { flexDirection: 'row', backgroundColor: THEME.secondary, width: '100%', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 10, ...Platform.select({ web: { boxShadow: '0px 2px 3px rgba(0,0,0,0.05)' }, default: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3 } }), elevation: 2 },
    listIconBox: { width: 50, height: 50, backgroundColor: THEME.grayInput, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    listContent: { flex: 1 },
    listTitle: { fontSize: 20, fontWeight: 'bold', color: THEME.textBlack, marginBottom: 4 },
    listSubtitle: { fontSize: 16, color: THEME.secondaryText },

    // FAB
    fabContainer: { position: 'absolute', right: 20, bottom: 30, alignItems: 'center' },
    fabAdd: { backgroundColor: THEME.primary, width: 55, height: 55, borderRadius: 27.5, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 5 },

    // Modals & Forms
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: THEME.secondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%', width: '100%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 24, fontWeight: 'bold', color: THEME.textBlack },
    closeButton: { backgroundColor: THEME.grayInput, padding: 6, borderRadius: 8 },
    inputContainer: { marginBottom: 15 },
    formLabel: { fontSize: 16, color: THEME.secondaryText, marginBottom: 6, fontWeight: '500' },
    input: { backgroundColor: THEME.grayInput, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12, height: 60, fontSize: 18, color: THEME.textBlack },
    errorText: { color: THEME.error, fontSize: 11, marginTop: 4 },

    // Select
    selectBox: { backgroundColor: THEME.grayInput, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 14, height: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    selectText: { fontSize: 18, color: THEME.textBlack },
    selectModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    selectModalContent: { backgroundColor: THEME.secondary, width: '100%', borderRadius: 15, padding: 20 },
    selectModalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 15, color: THEME.textBlack, textAlign: 'center' },
    selectModalItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: THEME.grayInput },
    selectModalItemText: { fontSize: 18, color: THEME.textBlack },

    // Date & Switch
    dateBox: { backgroundColor: THEME.grayInput, borderRadius: 8, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', height: 60 },
    dateIconWrapper: { backgroundColor: THEME.primary, paddingVertical: 12, paddingHorizontal: 15, justifyContent: 'center', alignItems: 'center' },
    dateText: { fontSize: 18, color: THEME.textBlack, marginLeft: 15 },
    switchBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: THEME.grayInput, padding: 15, borderRadius: 8, marginBottom: 15 },
    switchLabel: { fontSize: 18, color: THEME.textBlack, fontWeight: '500' },

    // Chips
    chipButton: { backgroundColor: THEME.grayInput, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginRight: 10 },
    chipButtonActive: { backgroundColor: THEME.primary },
    chipText: { color: THEME.secondaryText, fontWeight: 'bold', fontSize: 16 },
    chipTextActive: { color: THEME.textWhite },

    // Actions
    saveButton: { backgroundColor: THEME.primary, borderRadius: 8, height: 60, justifyContent: 'center', alignItems: 'center', marginTop: 10, marginBottom: 10 },
    saveButtonText: { color: THEME.textWhite, fontWeight: 'bold', fontSize: 20 },
    deleteButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: THEME.error, borderRadius: 8, height: 60, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    deleteButtonText: { color: THEME.error, fontWeight: 'bold', fontSize: 18 }
});
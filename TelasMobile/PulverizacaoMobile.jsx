// -----------------------------------------------------------------------------
// Pulverizacao.jsx
//
// Módulo de Gestão de Pulverizações.
// Integrado ao Firestore, com cálculo automático de doses e baixa de estoque atômica.
// Design W3Labs - Clean Mobile UI
// -----------------------------------------------------------------------------
import React, { useState, useEffect, useCallback } from 'react';
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
    FlatList,
    StatusBar,
    LayoutAnimation,
    UIManager
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { collection, doc, getDoc, getDocs, deleteDoc, writeBatch, onSnapshot, query, orderBy } from 'firebase/firestore';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Certifique-se de que auth e db estão exportados no seu firebaseConfig
import { auth, db } from '../firebaseConfig';

// =====================================================================
// 1️⃣ CONFIGURAÇÕES E TEMA (CLEAN)
// =====================================================================

const THEME = {
    primary: '#4CAF50',
    primaryDark: '#388E3C',
    secondary: '#FFFFFF',     // Branco
    background: '#F9FBF9',    // Fundo cinza bem claro/esverdeado
    textBlack: '#1A1D19',     // Texto escuro suave
    textWhite: '#FFFFFF',     // Texto branco
    secondaryText: '#4A4A4A', // Cinza para subtítulos
    grayInput: '#F0F4F1',     // Fundo dos inputs
    border: '#D0D6D0',        // Bordas sutis
    error: '#E53935',         // Vermelho para erros
    warning: '#F57C00',       // Laranja para status 'Planejado'
    warningBg: '#FFF3E0',     // Fundo laranja claro
    success: '#388E3C',       // Verde para status 'Realizado'
    successBg: '#E8F5E9',     // Fundo verde claro
    lightGray: '#F5F5F5'
};

const NUMBER_SANITIZER_REGEX = /[^0-9,.]/g;

const parseMoeda = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    let sanitized = value.replace(NUMBER_SANITIZER_REGEX, '');
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
// 2️⃣ COMPONENTES DE UI REUTILIZÁVEIS
// =====================================================================

const CustomHeader = ({ title, onBack }) => (
    <View style={styles.header}>
        <StatusBar barStyle="light-content" backgroundColor={THEME.primaryDark} />
        {onBack ? (
            <TouchableOpacity onPress={onBack} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="chevron-back" size={28} color={THEME.textWhite} />
            </TouchableOpacity>
        ) : <View style={{ width: 40 }} />}
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 40 }} />
    </View>
);

const FabAdd = ({ onAdd }) => (
    <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fabAdd} onPress={onAdd} activeOpacity={0.8}>
            <Ionicons name="add" size={30} color={THEME.textWhite} />
        </TouchableOpacity>
    </View>
);

const SectionHeader = ({ title, icon }) => (
    <View style={styles.sectionHeader}>
        <MaterialCommunityIcons name={icon} size={22} color={THEME.primary} style={{ marginRight: 8 }} />
        <Text style={styles.sectionTitle}>{title}</Text>
    </View>
);

const BottomSheetHandle = () => (
    <View style={styles.bottomSheetHandleContainer}>
        <View style={styles.bottomSheetHandle} />
    </View>
);

const FormInput = ({ label, placeholder, value, onChangeText, required, keyboardType = 'default', editable = true, error }) => (
    <View style={styles.inputContainer}>
        <Text style={styles.formLabel}>{label} {required && <Text style={{ color: THEME.primary }}>*</Text>}</Text>
        <TextInput
            style={[styles.input, !editable && { opacity: 0.6, backgroundColor: THEME.border }, error && { borderColor: THEME.error, borderWidth: 1 }]}
            placeholder={placeholder}
            placeholderTextColor={THEME.secondaryText}
            value={value}
            onChangeText={onChangeText}
            keyboardType={keyboardType}
            editable={editable}
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
            <TouchableOpacity style={[styles.selectBox, error && { borderColor: THEME.error, borderWidth: 1 }]} onPress={() => setModalVisible(true)} activeOpacity={0.7}>
                <Text style={[styles.selectText, !selectedItem && { color: THEME.secondaryText }]} numberOfLines={1}>
                    {selectedItem ? selectedItem.label : placeholder}
                </Text>
                <Ionicons name="chevron-down" size={20} color={THEME.secondaryText} />
            </TouchableOpacity>
            {error && <Text style={styles.errorText}>{error}</Text>}

            <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
                    <View style={[styles.modalContent, { maxHeight: '60%' }]}>
                        <BottomSheetHandle />
                        <Text style={styles.selectModalTitle}>Selecione uma opção</Text>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {items.map((item, index) => (
                                <TouchableOpacity key={index} style={styles.selectModalItem} onPress={() => { onValueChange(item.value); setModalVisible(false); }}>
                                    <Text style={[styles.selectModalItemText, value === item.value && { fontWeight: 'bold', color: THEME.primary }]}>
                                        {item.label}
                                    </Text>
                                    {value === item.value && <Ionicons name="checkmark-circle" size={24} color={THEME.primary} />}
                                </TouchableOpacity>
                            ))}
                            <View style={{ height: 20 }} />
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
                    <FontAwesome5 name="calendar-alt" size={24} color={THEME.primary} />
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }} contentContainerStyle={{ paddingRight: 20 }}>
        {options.map((opt, i) => {
            const isActive = selectedValue === opt.value;
            return (
                <TouchableOpacity key={i} style={[styles.chipButton, isActive && styles.chipButtonActive]} onPress={() => onValueChange(opt.value)} activeOpacity={0.7}>
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
            );
        })}
    </ScrollView>
);

// =====================================================================
// 3️⃣ MODAL DE CADASTRO / EDIÇÃO
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
                        Alert.alert("Erro", "Registro não encontrado.");
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
        if (!validateForm()) return Alert.alert('Aviso', 'Verifique os campos destacados.');
        
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
            Alert.alert("Erro ao Salvar", error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        const deleteAction = async () => {
            try {
                await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'pulverizacoes', itemId));
                onSaveSuccess();
            } catch (e) {
                Alert.alert('Erro', 'Falha ao excluir.');
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm('Deseja excluir esta aplicação?')) deleteAction();
        } else {
            Alert.alert('Excluir', 'Tem certeza que deseja apagar esta aplicação?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Excluir', style: 'destructive', onPress: deleteAction }
            ]);
        }
    };

    const defensivoSelecionado = defensivosEmEstoque.find(d => d.id === data.estoqueItemId);

    return (
        <Modal visible animationType="slide" transparent onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <BottomSheetHandle />
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{itemId ? "Editar Aplicação" : "Nova Aplicação"}</Text>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                            <Ionicons name="close" size={24} color={THEME.textBlack} />
                        </TouchableOpacity>
                    </View>

                    {loadingDependencies || loading ? (
                         <ActivityIndicator size="large" color={THEME.primary} style={{ marginVertical: 40 }} />
                    ) : (
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
                            {/* OPERACIONAL */}
                            <SectionHeader title="Dados Operacionais" icon="clipboard-text-outline" />
                            <View style={styles.row}>
                                <View style={{ flex: 1 }}>
                                    <FormSelect label="Status" items={[{label: 'Realizado', value: 'Realizado'}, {label: 'Planejado', value: 'Planejado'}]} value={data.status} onValueChange={v => setField('status', v)} />
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <FormDate label="Data" value={data.dataAplicacao} onChange={d => setField('dataAplicacao', d, 'date')} />
                                </View>
                            </View>
                            <FormInput label="Operador" value={data.operador} onChangeText={v => setField('operador', v)} placeholder="Nome do responsável" />
                            <FormSelect label="Equipamento" items={equipamentos.map(e => ({ label: `${e.marca} ${e.modelo}`, value: e.id }))} value={data.equipamentoId} onValueChange={v => setField('equipamentoId', v)} placeholder="Selecione o trator/pulverizador" />

                            {/* AGRONÔMICO */}
                            <SectionHeader title="Local e Cultura" icon="sprout-outline" />
                            <ChoiceChips options={[{label:'Herbicida', value:'Herbicida'}, {label:'Fungicida', value:'Fungicida'}, {label:'Inseticida', value:'Inseticida'}, {label:'Adubo Foliar', value:'Adubo'}]} selectedValue={data.tipoAplicacao} onValueChange={v => setField('tipoAplicacao', v)} />
                            <View style={styles.row}>
                                <View style={{ flex: 1 }}><FormInput label="Cultura *" value={data.cultura} onChangeText={v => setField('cultura', v)} error={errors.cultura} placeholder="Ex: Soja" /></View>
                                <View style={{ flex: 1, marginLeft: 12 }}><FormInput label="Talhão *" value={data.talhao} onChangeText={v => setField('talhao', v)} error={errors.talhao} placeholder="Ex: T-01" /></View>
                            </View>
                            <FormInput label="Área Aplicada (ha)" value={data.areaTalhao} onChangeText={v => setField('areaTalhao', v, 'numeric')} keyboardType="numeric" placeholder="0,00" />

                            {/* PRODUTO */}
                            <SectionHeader title="Insumo e Dosagem" icon="flask-outline" />
                            <FormSelect label="Produto do Estoque" items={defensivosEmEstoque.map(d => ({ label: `${d.nome} (Disp: ${d.quantidade} ${d.unidade})`, value: d.id }))} value={data.estoqueItemId} onValueChange={v => setField('estoqueItemId', v)} placeholder="Vincular ao estoque..." />
                            {!data.estoqueItemId && <FormInput label="Produto (Registro Manual)" value={data.produto} onChangeText={v => setField('produto', v)} error={errors.produto} placeholder="Nome do insumo" />}
                            
                            <View style={styles.row}>
                                <View style={{ flex: 1 }}><FormInput label={`Dose (${defensivoSelecionado?.unidade || 'L'}/ha)`} value={data.dose} onChangeText={v => setField('dose', v, 'numeric')} keyboardType="numeric" placeholder="0,00" /></View>
                                <View style={{ flex: 1, marginLeft: 12 }}><FormInput label="Total Utilizado *" value={data.quantidadeUtilizada} onChangeText={v => setField('quantidadeUtilizada', v, 'numeric')} keyboardType="numeric" error={errors.quantidadeUtilizada} placeholder="0,00" /></View>
                            </View>

                            {/* CLIMA */}
                            <SectionHeader title="Condições Climáticas" icon="weather-partly-cloudy" />
                            <View style={styles.row}>
                                <View style={{ flex: 1 }}><FormInput label="Temp. (°C)" value={data.temperatura} onChangeText={v => setField('temperatura', v, 'numeric')} keyboardType="numeric" placeholder="0,0" /></View>
                                <View style={{ flex: 1, marginHorizontal: 12 }}><FormInput label="Umid. (%)" value={data.umidade} onChangeText={v => setField('umidade', v, 'numeric')} keyboardType="numeric" placeholder="0,0" /></View>
                                <View style={{ flex: 1 }}><FormInput label="Vento (km/h)" value={data.velocidadeVento} onChangeText={v => setField('velocidadeVento', v, 'numeric')} keyboardType="numeric" placeholder="0,0" /></View>
                            </View>

                            <TouchableOpacity style={styles.saveButton} onPress={onSave} disabled={saving} activeOpacity={0.8}>
                                {saving ? <ActivityIndicator color={THEME.textWhite} /> : <Text style={styles.saveButtonText}>Confirmar Aplicação</Text>}
                            </TouchableOpacity>
                            
                            {itemId && (
                                <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} activeOpacity={0.7}>
                                    <Ionicons name="trash-outline" size={18} color={THEME.error} style={{marginRight: 6}} />
                                    <Text style={styles.deleteButtonText}>Excluir Aplicação</Text>
                                </TouchableOpacity>
                            )}
                        </ScrollView>
                    )}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

// =====================================================================
// 4️⃣ TELA PRINCIPAL DE LISTAGEM
// =====================================================================

export default function PulverizacaoListaScreen({ navigation }) {
    const [modal, setModal] = useState({ visible: false, itemId: null });
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    const triggerAnimation = () => {
        if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    };

    useEffect(() => {
        if (!auth?.currentUser) return;
        const q = query(collection(db, 'users', auth.currentUser.uid, 'pulverizacoes'), orderBy('dataAplicacao', 'desc'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setItems(data);
            triggerAnimation();
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const getStatusStyle = (status) => {
        if (status === 'Planejado') return { color: THEME.warning, bg: THEME.warningBg };
        return { color: THEME.success, bg: THEME.successBg };
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.webContainer}>
            <CustomHeader title="Gestão de Pulverização" onBack={() => navigation?.goBack()} />
            
            <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
                {loading ? (
                    <ActivityIndicator size="large" color={THEME.primary} style={{ marginTop: 50 }} />
                ) : items.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialCommunityIcons name="spray-bottle" size={64} color={THEME.border} />
                        <Text style={styles.emptyTextTitle}>Nenhuma aplicação</Text>
                        <Text style={styles.emptyText}>Toque no botão + para registrar sua primeira pulverização ou adubação.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={items}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{ paddingBottom: 100 }}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => {
                            const statusStyle = getStatusStyle(item.status);
                            return (
                                <TouchableOpacity 
                                    style={styles.listItem} 
                                    onPress={() => {
                                        triggerAnimation();
                                        setModal({ visible: true, itemId: item.id });
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.listIconBox, { backgroundColor: `${THEME.primary}15` }]}>
                                        <MaterialCommunityIcons name={item.tipoAplicacao === 'Adubo' ? 'leaf' : 'spray'} size={26} color={THEME.primary} />
                                    </View>
                                    
                                    <View style={styles.listContent}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                            <Text style={styles.listTitle} numberOfLines={1}>{item.cultura} - {item.talhao}</Text>
                                            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                                                <Text style={[styles.statusText, { color: statusStyle.color }]}>
                                                    {item.status?.toUpperCase() || 'REALIZADO'}
                                                </Text>
                                            </View>
                                        </View>
                                        
                                        <Text style={styles.listSubtitle} numberOfLines={1}>
                                            <Text style={{fontWeight: '600'}}>{item.produto}</Text> • {item.quantidadeUtilizada} {item.unidade || 'un'}
                                        </Text>
                                        
                                        <View style={styles.listFooter}>
                                            <View style={styles.footerIconRow}>
                                                <Ionicons name="calendar-outline" size={14} color={THEME.secondaryText} />
                                                <Text style={styles.footerText}>{formatDate(item.dataAplicacao)}</Text>
                                            </View>
                                            {!!item.areaTalhao && (
                                                <View style={styles.footerIconRow}>
                                                    <MaterialCommunityIcons name="texture-box" size={14} color={THEME.secondaryText} />
                                                    <Text style={styles.footerText}>{item.areaTalhao} ha</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={THEME.secondaryText} style={{ marginLeft: 8 }} />
                                </TouchableOpacity>
                            );
                        }}
                    />
                )}
            </View>

            <FabAdd onAdd={() => setModal({ visible: true, itemId: null })} />

            {modal.visible && (
                <AddOrEditPulverizacaoModal 
                    itemId={modal.itemId} 
                    onClose={() => setModal({ visible: false, itemId: null })} 
                    onSaveSuccess={() => setModal({ visible: false, itemId: null })} 
                />
            )}
            </View>
        </SafeAreaView>
    );
}

// =====================================================================
// 5️⃣ ESTILOS GERAIS (CLEAN UI)
// =====================================================================

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.background },
    row: { flexDirection: 'row' },
    webContainer: {
        flex: 1,
        width: '100%',
        maxWidth: 800,
        alignSelf: 'center',
    },
    
    // Header
    header: { backgroundColor: THEME.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 60, ...Platform.select({ android: { paddingTop: 10 } }) },
    backButton: { padding: 4 },
    headerTitle: { color: THEME.textWhite, fontSize: 18, fontWeight: '700' },
    
    // Empty State
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, marginTop: -50 },
    emptyTextTitle: { color: THEME.textBlack, fontSize: 18, fontWeight: '600', marginTop: 16, marginBottom: 8 },
    emptyText: { color: THEME.secondaryText, fontSize: 14, textAlign: 'center', lineHeight: 20 },
    
    // Lists (Flat Design)
    listItem: { flexDirection: 'row', backgroundColor: THEME.secondary, width: '100%', maxWidth: 600, alignSelf: 'center', padding: 16, borderRadius: 16, alignItems: 'center', marginBottom: 12, ...Platform.select({ web: { boxShadow: '0px 2px 3px rgba(0,0,0,0.05)' }, default: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3 } }), elevation: 2 },
    listIconBox: { width: 50, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    listContent: { flex: 1 },
    listTitle: { fontSize: 16, fontWeight: '700', color: THEME.textBlack, flex: 1, marginRight: 8 },
    listSubtitle: { fontSize: 14, color: THEME.textBlack, marginBottom: 8 },
    listFooter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    footerIconRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    footerText: { fontSize: 12, color: THEME.secondaryText, fontWeight: '500' },
    
    // Status Badge
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    statusText: { fontSize: 10, fontWeight: '800' },
    
    // FAB
    fabContainer: { position: 'absolute', right: 24, bottom: 34, alignItems: 'center' },
    fabAdd: { backgroundColor: THEME.primary, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 6 },
    
    // Modals (Bottom Sheet)
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: THEME.secondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingBottom: 24, maxHeight: '92%', width: '100%', maxWidth: 600, alignSelf: 'center' },
    bottomSheetHandleContainer: { alignItems: 'center', paddingTop: 12, paddingBottom: 16 },
    bottomSheetHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#D4D4D4' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: '800', color: THEME.textBlack },
    closeButton: { padding: 4, backgroundColor: THEME.lightGray, borderRadius: 20 },
    
    // Forms
    inputContainer: { marginBottom: 18 },
    formLabel: { fontSize: 13, color: THEME.textBlack, marginBottom: 8, fontWeight: '600', marginLeft: 4 },
    input: { backgroundColor: THEME.grayInput, borderRadius: 14, paddingHorizontal: 16, height: 54, fontSize: 15, color: THEME.textBlack },
    errorText: { color: THEME.error, fontSize: 12, marginTop: 6, marginLeft: 4 },
    
    // Section Header
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 16, paddingLeft: 4 },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: THEME.textBlack },

    // Select Custom
    selectBox: { backgroundColor: THEME.grayInput, borderRadius: 14, paddingHorizontal: 16, height: 54, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    selectText: { fontSize: 15, color: THEME.textBlack, flex: 1 },
    selectModalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16, color: THEME.textBlack, textAlign: 'center' },
    selectModalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: THEME.border },
    selectModalItemText: { fontSize: 16, color: THEME.textBlack },
    
    // Date
    dateBox: { backgroundColor: THEME.secondary, borderWidth: 1, borderColor: THEME.border, borderRadius: 14, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', height: 54 },
    dateIconWrapper: { paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: THEME.border, height: '100%' },
    dateText: { fontSize: 15, color: THEME.textBlack, marginLeft: 16, fontWeight: '500' },
    
    // Chips
    chipButton: { backgroundColor: THEME.secondary, borderWidth: 1, borderColor: THEME.border, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, marginRight: 10 },
    chipButtonActive: { backgroundColor: THEME.primary, borderColor: THEME.primary },
    chipText: { color: THEME.secondaryText, fontWeight: '600', fontSize: 14 },
    chipTextActive: { color: THEME.textWhite },
    
    // Actions
    saveButton: { backgroundColor: THEME.primary, borderRadius: 14, height: 54, justifyContent: 'center', alignItems: 'center', marginTop: 24, marginBottom: 16, ...Platform.select({ web: { boxShadow: `0px 4px 8px ${THEME.primary}33` }, default: { shadowColor: THEME.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 } }), elevation: 4 },
    saveButtonText: { color: THEME.textWhite, fontWeight: '700', fontSize: 16 },
    deleteButton: { flexDirection: 'row', backgroundColor: 'transparent', borderRadius: 14, height: 50, justifyContent: 'center', alignItems: 'center' },
    deleteButtonText: { color: THEME.error, fontWeight: '600', fontSize: 15 }
});
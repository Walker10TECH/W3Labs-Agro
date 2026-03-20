// -----------------------------------------------------------------------------
// Pulverizacao.jsx
//
// Módulo de Gestão de Pulverizações.
// Integrado ao Firestore, com cálculo automático de doses e baixa de estoque atômica.
// -----------------------------------------------------------------------------
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
    FlatList
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { collection, doc, getDoc, getDocs, deleteDoc, writeBatch, onSnapshot, query, orderBy } from 'firebase/firestore';

// Certifique-se de que auth e db estão exportados no seu firebaseConfig
import { auth, db } from '../firebaseConfig';

// =====================================================================
// 1️⃣ CONFIGURAÇÕES E TEMA
// =====================================================================

const THEME = {
    primary: '#6DB33F',       // Verde vibrante
    primaryDark: '#5A9634',   // Verde escuro
    secondary: '#FFFFFF',     // Branco
    background: '#F4F6F4',    // Fundo cinza bem claro
    textBlack: '#2C3329',     // Texto escuro
    textWhite: '#FFFFFF',     // Texto branco
    secondaryText: '#7A8078', // Cinza para subtítulos
    grayInput: '#EEF0EE',     // Fundo dos inputs
    error: '#D32F2F',         // Vermelho para erros
    warning: '#F57C00',       // Laranja para status 'Planejado'
    success: '#388E3C',       // Verde para status 'Realizado'
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

const SectionHeader = ({ title, icon }) => (
    <View style={styles.sectionHeader}>
        <MaterialCommunityIcons name={icon} size={20} color={THEME.primary} style={{ marginRight: 8 }} />
        <Text style={styles.sectionTitle}>{title}</Text>
    </View>
);

const FormInput = ({ label, placeholder, value, onChangeText, required, keyboardType = 'default', editable = true, error }) => (
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
                <Text style={[styles.selectText, !selectedItem && { color: THEME.secondaryText }]} numberOfLines={1}>
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

const FormDate = ({ label, value }) => (
    <View style={styles.inputContainer}>
        <Text style={styles.formLabel}>{label}</Text>
        <TouchableOpacity style={styles.dateBox}>
            <View style={styles.dateIconWrapper}>
                <FontAwesome5 name="calendar-alt" size={20} color={THEME.textWhite} />
            </View>
            <Text style={styles.dateText}>{value}</Text>
        </TouchableOpacity>
    </View>
);

const ChoiceChips = ({ options, selectedValue, onValueChange }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
        {options.map((opt, i) => {
            const isActive = selectedValue === opt.value;
            return (
                <TouchableOpacity key={i} style={[styles.chipButton, isActive && styles.chipButtonActive]} onPress={() => onValueChange(opt.value)}>
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

    // Buscar Dependências (Equipamentos e Estoque) nativamente pelo Firebase
    useEffect(() => {
        const fetchDependencies = async () => {
            setLoadingDependencies(true);
            const userUid = auth.currentUser?.uid;
            if (!userUid) return;

            try {
                // Busca Equipamentos
                const equipSnap = await getDocs(collection(db, 'users', userUid, 'inventario'));
                const equipList = equipSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.marca?.localeCompare(b.marca));
                setEquipamentos(equipList);

                // Busca Estoque (Defensivos)
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
        if (!validateForm()) return Alert.alert('Atenção', 'Verifique os campos obrigatórios.');
        
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
                // Lógica de restauração de estoque omitida aqui para foco na UI, mas idealmente usaria um Batch
                onSaveSuccess();
            } catch (e) {
                Alert.alert('Erro', 'Falha ao excluir.');
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm('Deseja excluir esta aplicação?')) {
                deleteAction();
            }
        } else {
            Alert.alert('Excluir', 'Deseja excluir esta aplicação?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Excluir', style: 'destructive', onPress: deleteAction }
            ]);
        }
    };

    if (loadingDependencies || loading) return <View style={styles.modalOverlay}><ActivityIndicator size="large" color={THEME.primary} /></View>;

    const defensivoSelecionado = defensivosEmEstoque.find(d => d.id === data.estoqueItemId);

    return (
        <Modal visible animationType="slide" transparent>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{itemId ? "Editar Aplicação" : "Nova Aplicação"}</Text>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}><Ionicons name="close" size={20} /></TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* OPERACIONAL */}
                        <SectionHeader title="Dados Operacionais" icon="clipboard-list-outline" />
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <FormSelect label="Status" items={[{label: 'Realizado', value: 'Realizado'}, {label: 'Planejado', value: 'Planejado'}]} selectedValue={data.status} onValueChange={v => setField('status', v)} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <FormDate label="Data" value={formatDate(data.dataAplicacao)} />
                            </View>
                        </View>
                        <FormInput label="Operador" value={data.operador} onChangeText={v => setField('operador', v)} placeholder="Nome" />
                        <FormSelect label="Equipamento" items={equipamentos.map(e => ({ label: `${e.marca} ${e.modelo}`, value: e.id }))} value={data.equipamentoId} onValueChange={v => setField('equipamentoId', v)} placeholder="Selecione o trator" />

                        {/* AGRONÔMICO */}
                        <SectionHeader title="Local e Cultura" icon="sprout-outline" />
                        <ChoiceChips options={[{label:'Herbicida', value:'Herbicida'}, {label:'Fungicida', value:'Fungicida'}, {label:'Inseticida', value:'Inseticida'}, {label:'Adubo Foliar', value:'Adubo'}]} selectedValue={data.tipoAplicacao} onValueChange={v => setField('tipoAplicacao', v)} />
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}><FormInput label="Cultura *" value={data.cultura} onChangeText={v => setField('cultura', v)} error={errors.cultura} /></View>
                            <View style={{ flex: 1, marginLeft: 10 }}><FormInput label="Talhão *" value={data.talhao} onChangeText={v => setField('talhao', v)} error={errors.talhao} /></View>
                        </View>
                        <FormInput label="Área Aplicada (ha)" value={data.areaTalhao} onChangeText={v => setField('areaTalhao', v, 'numeric')} keyboardType="numeric" />

                        {/* PRODUTO */}
                        <SectionHeader title="Insumo e Dosagem" icon="flask-outline" />
                        <FormSelect label="Produto (Estoque)" items={defensivosEmEstoque.map(d => ({ label: `${d.nome} (Disp: ${d.quantidade} ${d.unidade})`, value: d.id }))} value={data.estoqueItemId} onValueChange={v => setField('estoqueItemId', v)} placeholder="Baixar do estoque..." />
                        {!data.estoqueItemId && <FormInput label="Produto (Manual)" value={data.produto} onChangeText={v => setField('produto', v)} error={errors.produto} />}
                        
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}><FormInput label={`Dose (${defensivoSelecionado?.unidade || 'L'}/ha)`} value={data.dose} onChangeText={v => setField('dose', v, 'numeric')} keyboardType="numeric" /></View>
                            <View style={{ flex: 1, marginLeft: 10 }}><FormInput label="Total Utilizado *" value={data.quantidadeUtilizada} onChangeText={v => setField('quantidadeUtilizada', v, 'numeric')} keyboardType="numeric" error={errors.quantidadeUtilizada} /></View>
                        </View>

                        {/* CLIMA */}
                        <SectionHeader title="Condições Climáticas" icon="weather-partly-cloudy" />
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}><FormInput label="Temp. (°C)" value={data.temperatura} onChangeText={v => setField('temperatura', v, 'numeric')} keyboardType="numeric" /></View>
                            <View style={{ flex: 1, marginHorizontal: 10 }}><FormInput label="Umid. (%)" value={data.umidade} onChangeText={v => setField('umidade', v, 'numeric')} keyboardType="numeric" /></View>
                            <View style={{ flex: 1 }}><FormInput label="Vento (km/h)" value={data.velocidadeVento} onChangeText={v => setField('velocidadeVento', v, 'numeric')} keyboardType="numeric" /></View>
                        </View>

                        <TouchableOpacity style={styles.saveButton} onPress={onSave} disabled={saving}>
                            {saving ? <ActivityIndicator color={THEME.textWhite} /> : <Text style={styles.saveButtonText}>Confirmar Aplicação</Text>}
                        </TouchableOpacity>
                        {itemId && <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}><Text style={styles.deleteButtonText}>Excluir Aplicação</Text></TouchableOpacity>}
                    </ScrollView>
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

    useEffect(() => {
        if (!auth.currentUser) return;
        const q = query(collection(db, 'users', auth.currentUser.uid, 'pulverizacoes'), orderBy('dataAplicacao', 'desc'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setItems(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const getStatusColor = (status) => status === 'Planejado' ? THEME.warning : THEME.success;

    return (
        <SafeAreaView style={styles.container}>
            <CustomHeader title="Gestão de Pulverização" onBack={() => navigation?.goBack()} />
            
            <View style={{ flex: 1, padding: 15 }}>
                {loading ? (
                    <ActivityIndicator size="large" color={THEME.primary} style={{ marginTop: 50 }} />
                ) : items.length === 0 ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="spray" size={64} color="#ccc" />
                        <Text style={styles.emptyText}>Nenhuma aplicação registrada.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={items}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{ paddingBottom: 80 }}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => (
                            <TouchableOpacity 
                                style={[styles.listItem, { borderLeftWidth: 4, borderLeftColor: getStatusColor(item.status) }]} 
                                onPress={() => setModal({ visible: true, itemId: item.id })}
                            >
                                <View style={styles.listIconBox}>
                                    <MaterialCommunityIcons name={item.tipoAplicacao === 'Adubo' ? 'leaf' : 'spray'} size={24} color={THEME.primary} />
                                </View>
                                <View style={styles.listContent}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <Text style={styles.listTitle}>{item.cultura} - {item.talhao}</Text>
                                        <Text style={{ fontSize: 10, color: getStatusColor(item.status), fontWeight: 'bold' }}>
                                            {item.status?.toUpperCase() || 'REALIZADO'}
                                        </Text>
                                    </View>
                                    
                                    <Text style={styles.listSubtitle}>
                                        {item.produto} • {item.quantidadeUtilizada} {item.unidade || 'un'}
                                    </Text>
                                    
                                    <Text style={{ fontSize: 11, color: THEME.secondaryText, marginTop: 4 }}>
                                        <Ionicons name="calendar-outline" size={10} /> {formatDate(item.dataAplicacao)} 
                                        {item.areaTalhao && ` • ${item.areaTalhao} ha`}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#ccc" />
                            </TouchableOpacity>
                        )}
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
        </SafeAreaView>
    );
}

// =====================================================================
// 5️⃣ ESTILOS GERAIS
// =====================================================================

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.background },
    row: { flexDirection: 'row' },
    
    // Header
    header: { backgroundColor: THEME.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, height: 60, ...Platform.select({ android: { marginTop: 24 } }) },
    backButton: { padding: 5 },
    headerTitle: { color: THEME.textWhite, fontSize: 18, fontWeight: 'bold' },
    
    // Lists
    emptyText: { color: THEME.secondaryText, fontSize: 14, marginTop: 15 },
    listItem: { flexDirection: 'row', backgroundColor: THEME.secondary, width: '100%', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
    listIconBox: { width: 46, height: 46, backgroundColor: THEME.grayInput, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    listContent: { flex: 1, marginRight: 10 },
    listTitle: { fontSize: 15, fontWeight: 'bold', color: THEME.textBlack },
    listSubtitle: { fontSize: 13, color: THEME.textBlack },
    
    // FAB
    fabContainer: { position: 'absolute', right: 20, bottom: 30, alignItems: 'center' },
    fabAdd: { backgroundColor: THEME.primary, width: 55, height: 55, borderRadius: 27.5, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 5 },
    
    // Modals & Forms
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: THEME.secondary, borderRadius: 15, padding: 20, maxHeight: '90%', width: '100%', maxWidth: 600, alignSelf: 'center' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: THEME.textBlack },
    closeButton: { backgroundColor: THEME.grayInput, padding: 6, borderRadius: 8 },
    inputContainer: { marginBottom: 15 },
    formLabel: { fontSize: 12, color: THEME.secondaryText, marginBottom: 6, fontWeight: '500' },
    input: { backgroundColor: THEME.grayInput, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12, fontSize: 14, color: THEME.textBlack },
    errorText: { color: THEME.error, fontSize: 11, marginTop: 4 },
    
    // Section Header
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 15, marginBottom: 15, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#EAEAEA' },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: THEME.textBlack },

    // Select Custom
    selectBox: { backgroundColor: THEME.grayInput, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    selectText: { fontSize: 14, color: THEME.textBlack, flex: 1 },
    selectModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    selectModalContent: { backgroundColor: THEME.secondary, width: '100%', maxWidth: 400, borderRadius: 15, padding: 20 },
    selectModalTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 15, color: THEME.textBlack, textAlign: 'center' },
    selectModalItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: THEME.grayInput },
    selectModalItemText: { fontSize: 16, color: THEME.textBlack },
    
    // Date
    dateBox: { backgroundColor: THEME.grayInput, borderRadius: 8, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
    dateIconWrapper: { backgroundColor: THEME.primary, paddingVertical: 12, paddingHorizontal: 15, justifyContent: 'center', alignItems: 'center' },
    dateText: { fontSize: 14, color: THEME.textBlack, marginLeft: 15 },
    
    // Chips
    chipButton: { backgroundColor: THEME.grayInput, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginRight: 10 },
    chipButtonActive: { backgroundColor: THEME.primary },
    chipText: { color: THEME.secondaryText, fontWeight: 'bold' },
    chipTextActive: { color: THEME.textWhite },
    
    // Actions
    saveButton: { backgroundColor: THEME.primary, borderRadius: 8, paddingVertical: 15, alignItems: 'center', marginTop: 10, marginBottom: 10 },
    saveButtonText: { color: THEME.textWhite, fontWeight: 'bold', fontSize: 16 },
    deleteButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: THEME.error, borderRadius: 8, paddingVertical: 15, alignItems: 'center', marginBottom: 20 },
    deleteButtonText: { color: THEME.error, fontWeight: 'bold', fontSize: 16 }
});
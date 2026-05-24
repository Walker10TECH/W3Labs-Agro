// -----------------------------------------------------------------------------
// Diesel.jsx
//
// Módulo de Gestão de Estoque e Consumo de Diesel.
// Integrado ao Firestore, com gráfico Nativo (Mobile) e Design W3Labs.
// -----------------------------------------------------------------------------
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
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
    LayoutAnimation,
    UIManager
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

import { auth, db } from '../firebaseConfig'; // Ajuste o caminho se necessário

// =====================================================================
// 1️⃣ CONFIGURAÇÕES E TEMA
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
    error: '#E53935',         // Vermelho
    warning: '#F57C00',       // Laranja
};

const VALIDATION_LIMITS = {
    MAX_LITROS_ENTRADA: 50000,
    MAX_LITROS_SAIDA: 2000,
    MAX_STRING_LENGTH: 255,
    MAX_ODOMETRO: 999999,
};

const CONTAINS_ONLY_NUMBERS_REGEX = /^\d+$/;

// =====================================================================
// 2️⃣ FUNÇÕES UTILITÁRIAS E HOOKS
// =====================================================================

const parseMoeda = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    let sanitized = value.replace(/[^0-9,.]/g, '');
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

// Hook Customizado para Firestore
const useFirestoreCollection = (collectionName, options = {}) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!auth.currentUser) {
            setLoading(false);
            return;
        }
        const userId = auth.currentUser.uid;
        const q = query(
            collection(db, `users/${userId}/${collectionName}`),
            orderBy(options.sortBy || 'data', options.order || 'desc')
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const data = querySnapshot.docs.map(d => ({
                id: d.id,
                ...d.data(),
                data: d.data().data?.toDate ? d.data().data.toDate() : new Date(),
            }));
            setItems(data);
            setLoading(false);
        }, (err) => {
            console.error(`Erro ${collectionName}:`, err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [collectionName, options.sortBy, options.order]);

    return { items, loading };
};

// =====================================================================
// 3️⃣ COMPONENTES DE UI REUTILIZÁVEIS
// =====================================================================

const CustomHeader = ({ title, onBack }) => (
    <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={26} color={THEME.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 26 }} />
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

// =====================================================================
// 4️⃣ MODAIS DE REGISTRO
// =====================================================================

// MODAL: COMPRAR DIESEL (ENTRADA)
const AddEstoqueDieselModal = ({ visible, onClose }) => {
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState({ litros: '', data: new Date(), observacoes: '', fornecedor: '' });
    const [errors, setErrors] = useState({});

    const setField = (field, value, type = 'text') => {
        setData(prev => ({ ...prev, [field]: type === 'numeric' ? value.replace(/[^0-9,.]/g, '') : value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    };

    const validate = () => {
        const errs = {};
        const litros = parseMoeda(data.litros);
        if (!data.litros || litros <= 0) errs.litros = 'Quantidade obrigatória.';
        else if (litros > VALIDATION_LIMITS.MAX_LITROS_ENTRADA) errs.litros = `Máx: ${VALIDATION_LIMITS.MAX_LITROS_ENTRADA}L`;

        if (data.fornecedor.trim() && CONTAINS_ONLY_NUMBERS_REGEX.test(data.fornecedor.trim())) errs.fornecedor = 'Inválido.';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const onSave = async () => {
        if (!validate()) return Alert.alert('Erro', 'Corrija os campos.');
        setSaving(true);
        try {
            const uid = auth.currentUser.uid;
            const docRef = doc(collection(db, `users/${uid}/dieselEstoque`));
            await setDoc(docRef, {
                litros: parseMoeda(data.litros),
                data: data.data,
                observacoes: data.observacoes.trim(),
                fornecedor: data.fornecedor.trim(),
                tipo: 'entrada',
                createdAt: serverTimestamp(),
                userId: uid,
            });
            onClose();
        } catch (e) { Alert.alert('Erro', 'Falha ao salvar.'); }
        setSaving(false);
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Comprar Diesel (Entrada)</Text>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}><Ionicons name="close" size={20} /></TouchableOpacity>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <FormInput label="Litros Adquiridos *" value={data.litros} onChangeText={v => setField('litros', v, 'numeric')} keyboardType="numeric" error={errors.litros} placeholder="Ex: 1000" />
                        <FormInput label="Fornecedor" value={data.fornecedor} onChangeText={v => setField('fornecedor', v)} error={errors.fornecedor} />
                        <FormDate label="Data da Compra" value={data.data} onChange={d => setField('data', d, 'date')} />
                        <FormInput label="Observações" value={data.observacoes} onChangeText={v => setField('observacoes', v)} multiline />

                        <TouchableOpacity style={styles.saveButton} onPress={onSave} disabled={saving}>
                            {saving ? <ActivityIndicator color={THEME.textWhite} /> : <Text style={styles.saveButtonText}>Adicionar ao Estoque</Text>}
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

// MODAL: ABASTECIMENTO (SAÍDA)
const AddOrEditDieselModal = ({ visible, itemId, onClose, estoqueAtual }) => {
    const { items: equipamentos, loading: loadingEquip } = useFirestoreCollection('inventario', { sortBy: 'marca', order: 'asc' });
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const originalItem = useRef(null);
    const [data, setData] = useState({ data: new Date(), equipamentoId: '', litros: '', odometro: '', observacoes: '', localAbastecimento: '' });
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (!itemId) return;
        (async () => {
            setLoading(true);
            try {
                const docSnap = await getDoc(doc(db, `users/${auth.currentUser.uid}/diesel`, itemId));
                if (docSnap.exists()) {
                    const item = docSnap.data();
                    const itemData = { ...item, id: docSnap.id, data: item.data?.toDate ? item.data.toDate() : new Date(), litros: String(item.litros), odometro: item.odometro ? String(item.odometro) : '' };
                    setData(itemData);
                    originalItem.current = itemData;
                }
            } catch (e) { } setLoading(false);
        })();
    }, [itemId]);

    const setField = (field, value, type = 'text') => {
        setData(prev => ({ ...prev, [field]: type === 'numeric' ? value.replace(/[^0-9,.]/g, '') : value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    };

    const validate = () => {
        const errs = {};
        const litros = parseMoeda(data.litros);
        const odometro = parseMoeda(data.odometro);

        if (!data.equipamentoId) errs.equipamentoId = 'Obrigatório.';
        if (!data.litros || litros <= 0) errs.litros = 'Quantidade inválida.';
        else if (litros > VALIDATION_LIMITS.MAX_LITROS_SAIDA) errs.litros = `Máx permitido: ${VALIDATION_LIMITS.MAX_LITROS_SAIDA}L`;
        else {
            const originalLitros = originalItem.current ? parseFloat(originalItem.current.litros) : 0;
            if (litros > (estoqueAtual + originalLitros)) errs.litros = `Estoque insuficiente.`;
        }

        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const onSave = async () => {
        if (!validate()) return Alert.alert('Erro', 'Corrija os campos.');
        setSaving(true);
        try {
            const uid = auth.currentUser.uid;
            const equip = equipamentos.find(e => e.id === data.equipamentoId);
            const docRef = itemId ? doc(db, `users/${uid}/diesel`, itemId) : doc(collection(db, `users/${uid}/diesel`));

            await setDoc(docRef, {
                data: data.data,
                equipamentoId: data.equipamentoId,
                equipamentoNome: equip ? `${equip.marca} ${equip.modelo}` : 'N/A',
                litros: parseMoeda(data.litros),
                odometro: data.odometro ? parseMoeda(data.odometro) : null,
                observacoes: data.observacoes.trim(),
                localAbastecimento: data.localAbastecimento.trim(),
                userId: uid,
                updatedAt: serverTimestamp(),
                ...(!itemId ? { createdAt: serverTimestamp() } : {})
            }, { merge: true });

            onClose();
        } catch (e) { Alert.alert('Erro', 'Falha ao salvar.'); }
        setSaving(false);
    };

    const handleDelete = () => {
        Alert.alert('Excluir', 'Deseja excluir este abastecimento?', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Excluir',
                style: 'destructive',
                onPress: async () => {
                    await deleteDoc(doc(db, `users/${auth.currentUser.uid}/diesel`, itemId));
                    onClose();
                }
            }
        ]);
    };

    if (loading || loadingEquip) return <Modal visible transparent><View style={styles.modalOverlay}><ActivityIndicator size="large" color={THEME.primary} /></View></Modal>;

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{itemId ? 'Editar Abastecimento' : 'Registrar Abastecimento'}</Text>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}><Ionicons name="close" size={20} /></TouchableOpacity>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <FormSelect
                            label="Máquina *" placeholder="Selecione o equipamento" required
                            items={equipamentos.map(e => ({ value: e.id, label: `${e.marca} ${e.modelo}` }))}
                            value={data.equipamentoId} onValueChange={v => setField('equipamentoId', v)} error={errors.equipamentoId}
                        />
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}><FormInput label="Litros *" value={data.litros} onChangeText={v => setField('litros', v, 'numeric')} keyboardType="numeric" error={errors.litros} /></View>
                            <View style={{ flex: 1, marginLeft: 10 }}><FormInput label="Horímetro/Odômetro" value={data.odometro} onChangeText={v => setField('odometro', v, 'numeric')} keyboardType="numeric" error={errors.odometro} /></View>
                        </View>
                        <FormInput label="Local do Abastecimento" value={data.localAbastecimento} onChangeText={v => setField('localAbastecimento', v)} />
                        <FormDate label="Data do Abastecimento" value={data.data} onChange={d => setField('data', d, 'date')} />
                        <FormInput label="Observações" value={data.observacoes} onChangeText={v => setField('observacoes', v)} multiline />

                        <TouchableOpacity style={styles.saveButton} onPress={onSave} disabled={saving}>
                            {saving ? <ActivityIndicator color={THEME.textWhite} /> : <Text style={styles.saveButtonText}>Salvar Abastecimento</Text>}
                        </TouchableOpacity>
                        {itemId && <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}><Text style={styles.deleteButtonText}>Excluir Abastecimento</Text></TouchableOpacity>}
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

// =====================================================================
// 5️⃣ COMPONENTE DE GRÁFICO (100% NATIVO PARA MOBILE)
// =====================================================================

const NativeDieselChart = ({ abastecimentos }) => {
    // Processando os dados para exibir um gráfico de barras simples nativo
    const chartData = useMemo(() => {
        const dataMap = {};

        abastecimentos.forEach(item => {
            const dateStr = formatDate(item.data).substring(0, 5); // Pega apenas DD/MM para caber na tela
            const litros = parseFloat(item.litros) || 0;
            dataMap[dateStr] = (dataMap[dateStr] || 0) + litros;
        });

        // Ordenando pelas datas
        const sortedDates = Object.keys(dataMap).sort((a, b) => {
            const [d1, m1] = a.split('/');
            const [d2, m2] = b.split('/');
            // Ano fictício apenas para organizar a ordem de meses e dias próximos
            return new Date(2026, m1 - 1, d1) - new Date(2026, m2 - 1, d2);
        });

        // Pegar apenas os últimos 7 dias com registros para não poluir a tela do celular
        const recentDates = sortedDates.slice(-7);

        if (recentDates.length === 0) return null;

        const maxLitros = Math.max(...recentDates.map(d => dataMap[d]), 1); // Evitar divisão por zero

        return recentDates.map(date => ({
            date,
            litros: dataMap[date],
            heightPercent: (dataMap[date] / maxLitros) * 100 // Calcula a % da altura da barra baseada no maior valor
        }));
    }, [abastecimentos]);

    if (!chartData) return null;

    return (
        <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Consumo Recente Diário (L)</Text>
            <View style={styles.nativeChartContainer}>
                {chartData.map((item, index) => (
                    <View key={index} style={styles.barWrapper}>
                        <Text style={styles.barLabelTop}>{item.litros.toFixed(0)}</Text>
                        <View style={styles.barTrack}>
                            <View style={[styles.barFill, { height: `${item.heightPercent}%` }]} />
                        </View>
                        <Text style={styles.barLabelBottom}>{item.date}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
};

// =====================================================================
// 6️⃣ TELA PRINCIPAL (DASHBOARD DO DIESEL)
// =====================================================================

export default function DieselScreen({ navigation }) {
    const { items: abastecimentos, loading: loadA } = useFirestoreCollection('diesel');
    const { items: estoque, loading: loadE } = useFirestoreCollection('dieselEstoque');

    const [modalEstoque, setModalEstoque] = useState(false);
    const [modalAbastecimento, setModalAbastecimento] = useState({ visible: false, itemId: null });

    const triggerAnimation = () => {
        if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    };

    const estoqueAtual = useMemo(() => {
        if (loadE || loadA) return 0;
        const entradas = estoque.filter(e => e.tipo === 'entrada').reduce((sum, e) => sum + (parseFloat(e.litros) || 0), 0);
        const saidas = abastecimentos.reduce((sum, a) => sum + (parseFloat(a.litros) || 0), 0);
        return entradas - saidas;
    }, [estoque, abastecimentos, loadE, loadA]);

    const handleOpenAbastecimento = (id = null) => {
        if (!id && estoqueAtual <= 0) {
            return Alert.alert("Estoque Vazio", "Adicione uma compra de diesel primeiro.");
        }
        triggerAnimation();
        setModalAbastecimento({ visible: true, itemId: id });
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.webContainer}>
            <CustomHeader title="Controle de Diesel" onBack={() => navigation?.goBack()} />

            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* CARD RESUMO DE ESTOQUE */}
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Estoque no Reservatório</Text>
                    {loadE || loadA ? (
                        <ActivityIndicator color={THEME.primary} size="large" />
                    ) : (
                        <Text style={[styles.summaryValue, estoqueAtual <= 100 && { color: THEME.warning }, estoqueAtual <= 0 && { color: THEME.error }]}>
                            {estoqueAtual.toFixed(1)} L
                        </Text>
                    )}
                    <View style={styles.summaryActions}>
                        <TouchableOpacity style={styles.btnSecondary} onPress={() => { triggerAnimation(); setModalEstoque(true); }}>
                            <Ionicons name="add-circle-outline" size={20} color={THEME.primary} />
                            <Text style={styles.btnSecondaryText}>Comprar Diesel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.btnPrimary} onPress={() => handleOpenAbastecimento(null)}>
                            <FontAwesome5 name="gas-pump" size={16} color={THEME.textWhite} />
                            <Text style={styles.btnPrimaryText}>Abastecer</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* GRÁFICO DE CONSUMO NATIVO */}
                <NativeDieselChart abastecimentos={abastecimentos} />

                {/* HISTÓRICO DE SAÍDAS */}
                <Text style={styles.historyTitle}>Histórico de Abastecimentos</Text>
                {loadA ? (
                    <ActivityIndicator size="large" color={THEME.primary} style={{ marginTop: 20 }} />
                ) : abastecimentos.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <MaterialCommunityIcons name="gas-station" size={50} color="#D0D0D0" />
                        <Text style={styles.emptyText}>Nenhum abastecimento registrado.</Text>
                    </View>
                ) : (
                    abastecimentos.map(item => (
                        <TouchableOpacity key={item.id} style={styles.listItem} onPress={() => handleOpenAbastecimento(item.id)}>
                            <View style={styles.listIconBox}>
                                <FontAwesome5 name="tractor" size={20} color={THEME.primary} />
                            </View>
                            <View style={styles.listContent}>
                                <Text style={styles.listTitle} numberOfLines={1}>{item.equipamentoNome}</Text>
                                <Text style={styles.listSubtitle}>{formatDate(item.data)} • {item.odometro ? `${item.odometro}h` : 'Sem hora'}</Text>
                            </View>
                            <Text style={styles.listLiters}>{parseFloat(item.litros).toFixed(1)} L</Text>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>

            {modalEstoque && <AddEstoqueDieselModal visible={true} onClose={() => setModalEstoque(false)} />}
            {modalAbastecimento.visible && <AddOrEditDieselModal visible={true} itemId={modalAbastecimento.itemId} onClose={() => setModalAbastecimento({ visible: false, itemId: null })} estoqueAtual={estoqueAtual} />}
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
    scrollContent: { padding: 15, paddingBottom: 60 },
    row: { flexDirection: 'row' },

    // Header
    header: { backgroundColor: THEME.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, height: 60, ...Platform.select({ android: { marginTop: 24 } }) },
    backButton: { padding: 5 },
    headerTitle: { color: THEME.textWhite, fontSize: 22, fontWeight: 'bold' },

    // Resumo de Estoque
    summaryCard: { backgroundColor: THEME.secondary, borderRadius: 15, padding: 20, alignItems: 'center', ...Platform.select({ web: { boxShadow: '0px 2px 3px rgba(0,0,0,0.05)' }, default: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3 } }), elevation: 3, marginBottom: 20 },
    summaryTitle: { fontSize: 18, color: THEME.secondaryText, fontWeight: '600' },
    summaryValue: { fontSize: 48, fontWeight: 'bold', color: THEME.primary, marginVertical: 10 },
    summaryActions: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 10, gap: 10 },
    btnPrimary: { flex: 1, backgroundColor: THEME.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 60, borderRadius: 10 },
    btnPrimaryText: { color: THEME.textWhite, fontWeight: 'bold', marginLeft: 8, fontSize: 18 },
    btnSecondary: { flex: 1, backgroundColor: THEME.grayInput, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 60, borderRadius: 10 },
    btnSecondaryText: { color: THEME.primary, fontWeight: 'bold', marginLeft: 5, fontSize: 18 },

    // Gráfico Nativo
    chartCard: { backgroundColor: THEME.secondary, borderRadius: 15, padding: 15, marginBottom: 20, ...Platform.select({ web: { boxShadow: '0px 2px 3px rgba(0,0,0,0.05)' }, default: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3 } }), elevation: 3 },
    chartTitle: { fontSize: 20, fontWeight: 'bold', color: THEME.textBlack, marginBottom: 10 },
    nativeChartContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 140, marginTop: 10 },
    barWrapper: { alignItems: 'center', flex: 1 },
    barTrack: { width: 14, height: 100, backgroundColor: THEME.grayInput, borderRadius: 7, justifyContent: 'flex-end', marginVertical: 6, overflow: 'hidden' },
    barFill: { width: '100%', backgroundColor: THEME.primary, borderRadius: 7 },
    barLabelTop: { fontSize: 14, color: THEME.primary, fontWeight: 'bold' },
    barLabelBottom: { fontSize: 14, color: THEME.secondaryText },

    // Lista de Histórico
    historyTitle: { fontSize: 22, fontWeight: 'bold', color: THEME.textBlack, marginBottom: 10, marginLeft: 5 },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 30 },
    emptyText: { color: THEME.secondaryText, marginTop: 10, fontSize: 18 },
    listItem: { flexDirection: 'row', backgroundColor: THEME.secondary, padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 10, ...Platform.select({ web: { boxShadow: '0px 2px 3px rgba(0,0,0,0.05)' }, default: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3 } }), elevation: 2 },
    listIconBox: { width: 44, height: 44, backgroundColor: THEME.grayInput, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    listContent: { flex: 1 },
    listTitle: { fontSize: 20, fontWeight: 'bold', color: THEME.textBlack },
    listSubtitle: { fontSize: 16, color: THEME.secondaryText, marginTop: 3 },
    listLiters: { fontSize: 20, fontWeight: 'bold', color: THEME.primary },

    // Modais e Forms
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: THEME.secondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 24, fontWeight: 'bold', color: THEME.textBlack },
    closeButton: { backgroundColor: THEME.grayInput, padding: 6, borderRadius: 8 },
    inputContainer: { marginBottom: 15 },
    formLabel: { fontSize: 16, color: THEME.secondaryText, marginBottom: 6, fontWeight: '500' },
    input: { backgroundColor: THEME.grayInput, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12, height: 60, fontSize: 18, color: THEME.textBlack },
    errorText: { color: THEME.error, fontSize: 11, marginTop: 4 },
    selectBox: { backgroundColor: THEME.grayInput, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 14, height: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    selectText: { fontSize: 18, color: THEME.textBlack },
    selectModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    selectModalContent: { backgroundColor: THEME.secondary, width: '100%', maxWidth: 400, borderRadius: 15, padding: 20 },
    selectModalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 15, color: THEME.textBlack, textAlign: 'center' },
    selectModalItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: THEME.grayInput },
    selectModalItemText: { fontSize: 18, color: THEME.textBlack },
    dateBox: { backgroundColor: THEME.grayInput, borderRadius: 8, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', height: 60 },
    dateIconWrapper: { backgroundColor: THEME.primary, paddingVertical: 12, paddingHorizontal: 15, justifyContent: 'center', alignItems: 'center' },
    dateText: { fontSize: 18, color: THEME.textBlack, marginLeft: 15 },
    saveButton: { backgroundColor: THEME.primary, borderRadius: 8, height: 60, justifyContent: 'center', alignItems: 'center', marginTop: 10, marginBottom: 10 },
    saveButtonText: { color: THEME.textWhite, fontWeight: 'bold', fontSize: 20 },
    deleteButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: THEME.error, borderRadius: 8, height: 60, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    deleteButtonText: { color: THEME.error, fontWeight: 'bold', fontSize: 18 }
});
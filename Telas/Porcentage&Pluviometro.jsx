// -----------------------------------------------------------------------------
// PorcentagemPluviometro.jsx
//
// Módulo de Gestão de Andamento de Atividades (%) e Pluviômetro (mm).
// Integrado ao Firestore, com estatísticas automáticas, gráficos Web e Design W3Labs.
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
import { Ionicons, MaterialCommunityIcons, FontAwesome5, FontAwesome } from '@expo/vector-icons';
import { collection, doc, getDoc, setDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Chart } from 'react-google-charts';

// Certifique-se de que auth e db estão exportados no seu firebaseConfig
import { auth, db } from '../firebaseConfig';

// =====================================================================
// 1️⃣ CONFIGURAÇÕES, VALIDAÇÕES E TEMA
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
    lightGray: '#EAEAEA'
};

const VALIDATION_CONFIG = {
    minPercentage: 0,
    maxPercentage: 100,
    minMillimeters: 0,
    maxMillimeters: 1000,
    maxTitleLength: 100,
    maxDescriptionLength: 500,
    maxObservationsLength: 300,
};

const ERROR_MESSAGES = {
    REQUIRED_FIELD: 'Este campo é obrigatório',
    INVALID_PERCENTAGE: 'Valor deve ser entre 0 e 100',
    INVALID_RAINFALL: 'Valor deve ser entre 0 e 1000 mm',
    INVALID_NUMBER: 'Valor deve ser numérico',
    TITLE_TOO_LONG: `Máximo ${VALIDATION_CONFIG.maxTitleLength} caracteres`,
    FUTURE_DATE: 'Data não pode ser no futuro',
};

// =====================================================================
// 2️⃣ FUNÇÕES UTILITÁRIAS
// =====================================================================

const parseMoeda = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    let sanitized = value.replace(/[^0-9,.]/g, '');
    if (sanitized.includes(',')) sanitized = sanitized.replace(/\./g, '').replace(',', '.');
    return parseFloat(sanitized) || 0;
};

const formatDate = (date, options = {}) => {
    if (!date) return 'Data inválida';
    try {
        const dateObj = date.toDate ? date.toDate() : (typeof date === 'string' ? new Date(date) : date);
        const defaultOptions = { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' };
        return dateObj.toLocaleDateString('pt-BR', { ...defaultOptions, ...options });
    } catch (error) {
        return 'Data inválida';
    }
};

const calculateRainfallStats = (data) => {
    if (!Array.isArray(data) || data.length === 0) return { total: 0, average: 0, max: 0, min: 0, count: 0 };
    const values = data.map(item => parseFloat(item.milimetros) || 0);
    const total = values.reduce((sum, val) => sum + val, 0);
    return {
        total: parseFloat(total.toFixed(1)),
        average: parseFloat((total / values.length).toFixed(1)),
        max: Math.max(...values),
        min: Math.min(...values),
        count: values.length
    };
};

// =====================================================================
// 3️⃣ COMPONENTES DE UI REUTILIZÁVEIS
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

const FormInput = ({ label, placeholder, value, onChangeText, required, keyboardType = 'default', maxLength, multiline, error }) => (
    <View style={styles.inputContainer}>
        <Text style={styles.formLabel}>{label} {required && <Text style={{ color: THEME.primary }}>*</Text>}</Text>
        <TextInput
            style={[styles.input, multiline && { height: 80, textAlignVertical: 'top' }, error && { borderColor: THEME.error, borderWidth: 1 }]}
            placeholder={placeholder}
            placeholderTextColor={THEME.secondaryText}
            value={value}
            onChangeText={onChangeText}
            keyboardType={keyboardType}
            maxLength={maxLength}
            multiline={multiline}
        />
        {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
);

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

const StatBox = ({ label, value, color }) => (
    <View style={styles.statBox}>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
    </View>
);

// =====================================================================
// 4️⃣ MODAIS DE REGISTRO
// =====================================================================

/* --- MODAL: PORCENTAGEM / ANDAMENTO --- */
const AddOrEditPorcentagemModal = ({ itemId, onClose }) => {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [errors, setErrors] = useState({});
    const [data, setData] = useState({ titulo: '', valor: '', descricao: '', dataAtualizacao: new Date() });

    useEffect(() => {
        if (!itemId) return;
        (async () => {
            setLoading(true);
            try {
                const docSnap = await getDoc(doc(db, 'users', auth.currentUser.uid, 'porcentagens', itemId));
                if (docSnap.exists()) {
                    const item = docSnap.data();
                    setData({ ...item, valor: item.valor ? String(item.valor) : '', dataAtualizacao: item.dataAtualizacao?.toDate ? item.dataAtualizacao.toDate() : new Date() });
                }
            } catch (e) {} setLoading(false);
        })();
    }, [itemId]);

    const setField = (field, value) => { setData(prev => ({ ...prev, [field]: value })); if (errors[field]) setErrors(prev => ({ ...prev, [field]: null })); };

    const handleSave = async () => {
        const errs = {};
        if (!data.titulo.trim()) errs.titulo = ERROR_MESSAGES.REQUIRED_FIELD;
        const val = parseMoeda(data.valor);
        if (data.valor === '' || isNaN(val) || val < VALIDATION_CONFIG.minPercentage || val > VALIDATION_CONFIG.maxPercentage) errs.valor = ERROR_MESSAGES.INVALID_PERCENTAGE;
        setErrors(errs);
        
        if (Object.keys(errs).length > 0) return Alert.alert('Erro', 'Corrija os campos destacados.');

        setSaving(true);
        try {
            const uid = auth.currentUser.uid;
            const id = itemId || doc(collection(db, 'users', uid, 'porcentagens')).id;
            await setDoc(doc(db, 'users', uid, 'porcentagens', id), { 
                id, titulo: data.titulo.trim(), valor: val, descricao: data.descricao.trim(), dataAtualizacao: new Date() 
            }, { merge: true });
            onClose();
        } catch (e) { Alert.alert('Erro', 'Falha ao salvar.'); }
        setSaving(false);
    };

    const handleDelete = async () => {
        const deleteAction = async () => {
            await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'porcentagens', itemId));
            onClose();
        };

        if (Platform.OS === 'web') {
            if (window.confirm('Deseja excluir este andamento?')) {
                deleteAction();
            }
        } else {
            Alert.alert('Excluir', 'Deseja excluir este andamento?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Excluir', style: 'destructive', onPress: deleteAction }
            ]);
        }
    };

    if (loading) return <View style={styles.modalOverlay}><ActivityIndicator size="large" color={THEME.primary} /></View>;

    return (
        <Modal visible animationType="slide" transparent>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{itemId ? 'Editar Andamento' : 'Novo Andamento'}</Text>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}><Ionicons name="close" size={20} /></TouchableOpacity>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <FormInput label="Título *" placeholder="Ex: Plantio da Soja" value={data.titulo} onChangeText={v => setField('titulo', v)} maxLength={VALIDATION_CONFIG.maxTitleLength} error={errors.titulo} />
                        <FormInput label="Progresso (%) *" placeholder="Ex: 75" value={data.valor} onChangeText={v => setField('valor', v.replace(/[^0-9,.]/g, ''))} keyboardType="numeric" maxLength={5} error={errors.valor} />
                        <FormInput label="Descrição" placeholder="Detalhes sobre o andamento..." value={data.descricao} onChangeText={v => setField('descricao', v)} multiline maxLength={VALIDATION_CONFIG.maxDescriptionLength} />

                        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator color={THEME.textWhite} /> : <Text style={styles.saveButtonText}>Salvar Andamento</Text>}
                        </TouchableOpacity>
                        {itemId && <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}><Text style={styles.deleteButtonText}>Excluir Andamento</Text></TouchableOpacity>}
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

/* --- MODAL: PLUVIÔMETRO --- */
const AddOrEditPluviometroModal = ({ itemId, onClose }) => {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [errors, setErrors] = useState({});
    const [data, setData] = useState({ milimetros: '', observacoes: '', dataMedicao: new Date() });

    useEffect(() => {
        if (!itemId) return;
        (async () => {
            setLoading(true);
            try {
                const docSnap = await getDoc(doc(db, 'users', auth.currentUser.uid, 'pluviometro', itemId));
                if (docSnap.exists()) {
                    const item = docSnap.data();
                    setData({ ...item, milimetros: item.milimetros ? String(item.milimetros) : '', dataMedicao: item.dataMedicao?.toDate ? item.dataMedicao.toDate() : new Date() });
                }
            } catch (e) {} setLoading(false);
        })();
    }, [itemId]);

    const setField = (field, value) => { setData(prev => ({ ...prev, [field]: value })); if (errors[field]) setErrors(prev => ({ ...prev, [field]: null })); };

    const handleSave = async () => {
        const errs = {};
        const mm = parseMoeda(data.milimetros);
        if (data.milimetros === '' || isNaN(mm) || mm < VALIDATION_CONFIG.minMillimeters || mm > VALIDATION_CONFIG.maxMillimeters) errs.milimetros = ERROR_MESSAGES.INVALID_RAINFALL;
        if (data.dataMedicao > new Date()) errs.dataMedicao = ERROR_MESSAGES.FUTURE_DATE;
        setErrors(errs);
        
        if (Object.keys(errs).length > 0) return Alert.alert('Erro', 'Corrija os campos.');

        setSaving(true);
        try {
            const uid = auth.currentUser.uid;
            const id = itemId || doc(collection(db, 'users', uid, 'pluviometro')).id;
            await setDoc(doc(db, 'users', uid, 'pluviometro', id), { 
                id, milimetros: mm, observacoes: data.observacoes.trim(), dataMedicao: data.dataMedicao 
            }, { merge: true });
            onClose();
        } catch (e) { Alert.alert('Erro', 'Falha ao salvar.'); }
        setSaving(false);
    };

    const handleDelete = async () => {
        const deleteAction = async () => {
            await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'pluviometro', itemId));
            onClose();
        };

        if (Platform.OS === 'web') {
            if (window.confirm('Deseja excluir esta medição?')) {
                deleteAction();
            }
        } else {
            Alert.alert('Excluir', 'Deseja excluir esta medição?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Excluir', style: 'destructive', onPress: deleteAction }
            ]);
        }
    };

    if (loading) return <View style={styles.modalOverlay}><ActivityIndicator size="large" color={THEME.primary} /></View>;

    return (
        <Modal visible animationType="slide" transparent>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{itemId ? 'Editar Medição' : 'Nova Medição'}</Text>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}><Ionicons name="close" size={20} /></TouchableOpacity>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <FormDate label="Data da Medição *" value={formatDate(data.dataMedicao)} />
                        {errors.dataMedicao && <Text style={styles.errorText}>{errors.dataMedicao}</Text>}
                        <FormInput label="Precipitação (mm) *" placeholder="Ex: 15.5" value={data.milimetros} onChangeText={v => setField('milimetros', v.replace(/[^0-9,.]/g, ''))} keyboardType="numeric" maxLength={6} error={errors.milimetros} />
                        <FormInput label="Observações" placeholder="Condições climáticas..." value={data.observacoes} onChangeText={v => setField('observacoes', v)} multiline maxLength={VALIDATION_CONFIG.maxObservationsLength} />

                        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator color={THEME.textWhite} /> : <Text style={styles.saveButtonText}>Salvar Medição</Text>}
                        </TouchableOpacity>
                        {itemId && <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}><Text style={styles.deleteButtonText}>Excluir Medição</Text></TouchableOpacity>}
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

// =====================================================================
// 5️⃣ COMPONENTES DE GRÁFICO (GOOGLE CHARTS - WEB ONLY)
// =====================================================================

const ProgressoChart = ({ data }) => {
    if (Platform.OS !== 'web' || !data || data.length === 0) return null;
    const chartData = useMemo(() => {
        const header = ["Atividade", "Progresso", { role: "style" }];
        const rows = data.map(item => [item.titulo, parseFloat(item.valor) || 0, THEME.primary]);
        return [header, ...rows];
    }, [data]);

    return (
        <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Visão Geral do Andamento</Text>
            <div style={{ width: '100%', overflow: 'hidden', borderRadius: 10 }}>
                <Chart chartType="BarChart" width="100%" height="250px" data={chartData}
                    options={{ title: "Andamento das Atividades (%)", chartArea: { width: "60%" }, hAxis: { title: "Progresso", minValue: 0, maxValue: 100 }, legend: { position: "none" } }}
                />
            </div>
        </View>
    );
};

const ChuvaChart = ({ data }) => {
    if (Platform.OS !== 'web' || !data || data.length < 2) return null;
    const chartData = useMemo(() => {
        return [
            ['Data', 'Precipitação (mm)'],
            ...data.map(item => {
                const date = item.dataMedicao?.toDate ? item.dataMedicao.toDate() : new Date(item.dataMedicao);
                return [date, parseFloat(item.milimetros) || 0];
            })
        ];
    }, [data]);

    return (
        <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Histórico de Precipitação</Text>
            <div style={{ width: '100%', overflow: 'hidden', borderRadius: 10 }}>
                <Chart chartType="AreaChart" width="100%" height="250px" data={chartData}
                    options={{ hAxis: { format: 'dd/MM', textStyle: { color: THEME.secondaryText } }, vAxis: { minValue: 0 }, legend: { position: 'none' }, colors: [THEME.primary], chartArea: { width: '85%', height: '70%' }, backgroundColor: 'transparent' }}
                />
            </div>
        </View>
    );
};

// =====================================================================
// 6️⃣ TELAS DE LISTAGEM
// =====================================================================

export const PorcentagemListaScreen = ({ navigation }) => {
    const [modal, setModal] = useState({ visible: false, itemId: null });
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!auth.currentUser) return;
        const q = query(collection(db, 'users', auth.currentUser.uid, 'porcentagens'), orderBy('dataAtualizacao', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <CustomHeader title="Andamento" onBack={() => navigation.goBack()} />
            <ScrollView contentContainerStyle={styles.listContainer}>
                <ProgressoChart data={items} />
                
                {loading ? <ActivityIndicator size="large" color={THEME.primary} style={{ marginTop: 50 }} />
                : items.length === 0 ? <Text style={styles.emptyText}>Nenhum andamento encontrado.</Text>
                : items.map(item => (
                    <TouchableOpacity key={item.id} style={styles.listItem} onPress={() => setModal({ visible: true, itemId: item.id })}>
                        <View style={styles.listIconBox}>
                            <FontAwesome name="percent" size={24} color={THEME.primary} />
                        </View>
                        <View style={styles.listContent}>
                            <Text style={styles.listTitle}>{item.titulo || 'Sem título'}</Text>
                            <Text style={styles.listSubtitle}>Progresso: {(parseFloat(item.valor) || 0).toFixed(1)}%</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={24} color={THEME.secondaryText} />
                    </TouchableOpacity>
                ))}
            </ScrollView>
            <FabAdd onAdd={() => setModal({ visible: true, itemId: null })} />
            {modal.visible && <AddOrEditPorcentagemModal itemId={modal.itemId} onClose={() => setModal({ visible: false, itemId: null })} />}
        </SafeAreaView>
    );
};

export const PluviometroListaScreen = ({ navigation }) => {
    const [modal, setModal] = useState({ visible: false, itemId: null });
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!auth.currentUser) return;
        const q = query(collection(db, 'users', auth.currentUser.uid, 'pluviometro'), orderBy('dataMedicao', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const stats = useMemo(() => calculateRainfallStats(items), [items]);

    return (
        <SafeAreaView style={styles.container}>
            <CustomHeader title="Pluviômetro" onBack={() => navigation.goBack()} />
            <ScrollView contentContainerStyle={styles.listContainer}>
                {stats.count > 0 && (
                    <View style={styles.statsContainer}>
                        <Text style={styles.statsTitle}>Estatísticas de Precipitação</Text>
                        <View style={styles.statsRow}>
                            <StatBox label="Total" value={`${stats.total}mm`} color="#2196F3" />
                            <StatBox label="Média" value={`${stats.average}mm`} color="#4CAF50" />
                            <StatBox label="Máxima" value={`${stats.max}mm`} color="#FF9800" />
                            <StatBox label="Registros" value={stats.count} color="#795548" />
                        </View>
                    </View>
                )}

                <ChuvaChart data={items} />

                {loading ? <ActivityIndicator size="large" color={THEME.primary} style={{ marginTop: 50 }} />
                : items.length === 0 ? <View style={{ alignItems: 'center', marginTop: 50 }}><MaterialCommunityIcons name="weather-pouring" size={50} color={THEME.secondaryText}/><Text style={styles.emptyText}>Nenhuma medição registrada.</Text></View>
                : items.map(item => {
                    const mm = parseFloat(item.milimetros) || 0;
                    const color = mm < 5 ? '#81C784' : mm < 25 ? '#42A5F5' : mm < 50 ? '#FF9800' : '#F44336';
                    return (
                        <TouchableOpacity key={item.id} style={styles.listItem} onPress={() => setModal({ visible: true, itemId: item.id })}>
                            <View style={[styles.listIconBox, { backgroundColor: `${color}20` }]}>
                                <MaterialCommunityIcons name="weather-pouring" size={24} color={color} />
                            </View>
                            <View style={styles.listContent}>
                                <Text style={styles.listTitle}>{mm.toFixed(1)} mm</Text>
                                <Text style={styles.listSubtitle}>{formatDate(item.dataMedicao)}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={24} color={THEME.secondaryText} />
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
            <FabAdd onAdd={() => setModal({ visible: true, itemId: null })} />
            {modal.visible && <AddOrEditPluviometroModal itemId={modal.itemId} onClose={() => setModal({ visible: false, itemId: null })} />}
        </SafeAreaView>
    );
};

// =====================================================================
// WRAPPER DE DEMONSTRAÇÃO
// =====================================================================

export default function PorcentagemPluviometro() {
    const [activeScreen, setActiveScreen] = useState(null);

    if (activeScreen === 'porcentagem') return <PorcentagemListaScreen onBack={() => setActiveScreen(null)} />;
    if (activeScreen === 'pluviometro') return <PluviometroListaScreen onBack={() => setActiveScreen(null)} />;

    return (
        <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 30, color: THEME.textBlack }}>Navegação de Teste</Text>
            <TouchableOpacity style={[styles.saveButton, { width: 250 }]} onPress={() => setActiveScreen('porcentagem')}>
                <Text style={styles.saveButtonText}>Abrir % Andamento</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveButton, { width: 250 }]} onPress={() => setActiveScreen('pluviometro')}>
                <Text style={styles.saveButtonText}>Abrir Pluviômetro</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
}

// =====================================================================
// 7️⃣ ESTILOS GERAIS
// =====================================================================

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.background },
    
    // Header
    header: { backgroundColor: THEME.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, height: 60, ...Platform.select({ android: { marginTop: 24 } }) },
    backButton: { padding: 5 },
    headerTitle: { color: THEME.textWhite, fontSize: 18, fontWeight: 'bold' },
    
    // Lists
    listContainer: { padding: 15, alignItems: 'center', flexGrow: 1 },
    emptyText: { color: THEME.secondaryText, fontSize: 14, marginTop: 15 },
    listItem: { flexDirection: 'row', backgroundColor: THEME.secondary, width: '100%', maxWidth: 600, padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
    listIconBox: { width: 46, height: 46, backgroundColor: THEME.grayInput, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    listContent: { flex: 1, marginRight: 10 },
    listTitle: { fontSize: 16, fontWeight: 'bold', color: THEME.textBlack, marginBottom: 4 },
    listSubtitle: { fontSize: 13, color: THEME.secondaryText },
    
    // FAB
    fabContainer: { position: 'absolute', right: 20, bottom: 30, alignItems: 'center' },
    fabAdd: { backgroundColor: THEME.primary, width: 55, height: 55, borderRadius: 27.5, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 5 },
    
    // Modals & Forms
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: THEME.secondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%', width: '100%', maxWidth: 600, alignSelf: 'center' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: THEME.textBlack },
    closeButton: { backgroundColor: THEME.grayInput, padding: 6, borderRadius: 8 },
    inputContainer: { marginBottom: 15 },
    formLabel: { fontSize: 12, color: THEME.secondaryText, marginBottom: 6, fontWeight: '500' },
    input: { backgroundColor: THEME.grayInput, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12, fontSize: 14, color: THEME.textBlack },
    errorText: { color: THEME.error, fontSize: 11, marginTop: 4 },
    
    // Date Input
    dateBox: { backgroundColor: THEME.grayInput, borderRadius: 8, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
    dateIconWrapper: { backgroundColor: THEME.primary, paddingVertical: 12, paddingHorizontal: 15, justifyContent: 'center', alignItems: 'center' },
    dateText: { fontSize: 14, color: THEME.textBlack, marginLeft: 15 },
    
    // Buttons
    saveButton: { backgroundColor: THEME.primary, borderRadius: 8, paddingVertical: 15, alignItems: 'center', marginTop: 10, marginBottom: 10 },
    saveButtonText: { color: THEME.textWhite, fontWeight: 'bold', fontSize: 16 },
    deleteButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: THEME.error, borderRadius: 8, paddingVertical: 15, alignItems: 'center', marginBottom: 20 },
    deleteButtonText: { color: THEME.error, fontWeight: 'bold', fontSize: 16 },

    // Estatísticas e Gráficos
    statsContainer: { width: '100%', maxWidth: 600, backgroundColor: THEME.secondary, padding: 15, borderRadius: 12, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
    statsTitle: { fontSize: 16, fontWeight: 'bold', color: THEME.textBlack, marginBottom: 15, textAlign: 'center' },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
    statBox: { backgroundColor: THEME.grayInput, padding: 12, borderRadius: 8, alignItems: 'center', width: '23%', minWidth: 70 },
    statValue: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
    statLabel: { fontSize: 10, color: THEME.secondaryText, textAlign: 'center' },
    chartCard: { width: '100%', maxWidth: 600, backgroundColor: THEME.secondary, padding: 15, borderRadius: 12, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
    chartTitle: { fontSize: 16, fontWeight: 'bold', color: THEME.textBlack, marginBottom: 15 }
});
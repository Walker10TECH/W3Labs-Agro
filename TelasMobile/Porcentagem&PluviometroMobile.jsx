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
    FlatList,
    StatusBar,
    LayoutAnimation,
    UIManager
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons, MaterialCommunityIcons, FontAwesome5, FontAwesome } from '@expo/vector-icons';
import { collection, doc, getDoc, setDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Chart } from 'react-google-charts';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Certifique-se de que auth e db estão exportados no seu firebaseConfig
import { auth, db } from '../firebaseConfig';

// =====================================================================
// 1️⃣ CONFIGURAÇÕES, VALIDAÇÕES E TEMA
// =====================================================================

const THEME = {
    primary: '#4CAF50',
    primaryDark: '#388E3C',
    secondary: '#FFFFFF',
    background: '#F9FBF9',    // Cinza/Verde ultra claro para respiro
    textBlack: '#1A1D19',     // Preto mais suave (Off-black)
    textWhite: '#FFFFFF',
    secondaryText: '#4A4A4A', // Cinza médio para subtítulos
    grayInput: '#F0F4F1',     // Fundo dos inputs com leve tom de verde
    border: '#D0D6D0',        // Bordas sutis
    error: '#E53935',
    lightGray: '#F5F5F5'
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
    REQUIRED_FIELD: 'Campo obrigatório',
    INVALID_PERCENTAGE: 'Deve ser entre 0 e 100',
    INVALID_RAINFALL: 'Deve ser entre 0 e 1000',
    INVALID_NUMBER: 'Valor numérico',
    TITLE_TOO_LONG: `Máx ${VALIDATION_CONFIG.maxTitleLength} caracteres`,
    FUTURE_DATE: 'Data inválida (futuro)',
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
// 3️⃣ COMPONENTES DE UI REUTILIZÁVEIS (CLEAN)
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

const FormInput = ({ label, placeholder, value, onChangeText, required, keyboardType = 'default', maxLength, multiline, error }) => (
    <View style={styles.inputContainer}>
        <Text style={styles.formLabel}>
            {label} {required && <Text style={{ color: THEME.primary }}>*</Text>}
        </Text>
        <TextInput
            style={[
                styles.input, 
                multiline && { height: 100, textAlignVertical: 'top', paddingTop: 15 }, 
                error && { borderColor: THEME.error, borderWidth: 1 }
            ]}
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

const StatBox = ({ label, value, color, icon }) => (
    <View style={styles.statBox}>
        <View style={[styles.statIconBadge, { backgroundColor: `${color}15` }]}>
            <MaterialCommunityIcons name={icon} size={20} color={color} />
        </View>
        <View style={{ marginLeft: 12 }}>
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    </View>
);

// =====================================================================
// 4️⃣ MODAIS DE REGISTRO (BOTTOM SHEET STYLE)
// =====================================================================

const BottomSheetHandle = () => (
    <View style={styles.bottomSheetHandleContainer}>
        <View style={styles.bottomSheetHandle} />
    </View>
);

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
        
        if (Object.keys(errs).length > 0) return Alert.alert('Aviso', 'Por favor, corrija os campos em destaque.');

        setSaving(true);
        try {
            const uid = auth.currentUser.uid;
            const id = itemId || doc(collection(db, 'users', uid, 'porcentagens')).id;
            await setDoc(doc(db, 'users', uid, 'porcentagens', id), { 
                id, titulo: data.titulo.trim(), valor: val, descricao: data.descricao.trim(), dataAtualizacao: new Date() 
            }, { merge: true });
            onClose();
        } catch (e) { Alert.alert('Erro', 'Falha ao salvar dados.'); }
        setSaving(false);
    };

    const handleDelete = async () => {
        const deleteAction = async () => {
            await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'porcentagens', itemId));
            onClose();
        };

        if (Platform.OS === 'web') {
            if (window.confirm('Deseja excluir este andamento?')) deleteAction();
        } else {
            Alert.alert('Excluir', 'Tem certeza que deseja apagar este andamento?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Excluir', style: 'destructive', onPress: deleteAction }
            ]);
        }
    };

    return (
        <Modal visible animationType="slide" transparent onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <BottomSheetHandle />
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{itemId ? 'Editar Andamento' : 'Novo Andamento'}</Text>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                            <Ionicons name="close" size={24} color={THEME.textBlack} />
                        </TouchableOpacity>
                    </View>

                    {loading ? <ActivityIndicator size="large" color={THEME.primary} style={{ marginVertical: 30 }} /> : (
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
                            <FormInput label="Atividade *" placeholder="Ex: Plantio da Soja" value={data.titulo} onChangeText={v => setField('titulo', v)} maxLength={VALIDATION_CONFIG.maxTitleLength} error={errors.titulo} />
                            <FormInput label="Progresso concluído (%) *" placeholder="0 a 100" value={data.valor} onChangeText={v => setField('valor', v.replace(/[^0-9,.]/g, ''))} keyboardType="numeric" maxLength={5} error={errors.valor} />
                            <FormInput label="Observações (Opcional)" placeholder="Detalhes extras sobre a atividade..." value={data.descricao} onChangeText={v => setField('descricao', v)} multiline maxLength={VALIDATION_CONFIG.maxDescriptionLength} />

                            <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
                                {saving ? <ActivityIndicator color={THEME.textWhite} /> : <Text style={styles.saveButtonText}>Salvar Andamento</Text>}
                            </TouchableOpacity>
                            
                            {itemId && (
                                <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} activeOpacity={0.7}>
                                    <Ionicons name="trash-outline" size={18} color={THEME.error} style={{marginRight: 6}} />
                                    <Text style={styles.deleteButtonText}>Excluir Andamento</Text>
                                </TouchableOpacity>
                            )}
                        </ScrollView>
                    )}
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
        
        if (Object.keys(errs).length > 0) return Alert.alert('Aviso', 'Por favor, corrija os campos em destaque.');

        setSaving(true);
        try {
            const uid = auth.currentUser.uid;
            const id = itemId || doc(collection(db, 'users', uid, 'pluviometro')).id;
            await setDoc(doc(db, 'users', uid, 'pluviometro', id), { 
                id, milimetros: mm, observacoes: data.observacoes.trim(), dataMedicao: data.dataMedicao 
            }, { merge: true });
            onClose();
        } catch (e) { Alert.alert('Erro', 'Falha ao salvar medição.'); }
        setSaving(false);
    };

    const handleDelete = async () => {
        const deleteAction = async () => {
            await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'pluviometro', itemId));
            onClose();
        };

        if (Platform.OS === 'web') {
            if (window.confirm('Deseja excluir esta medição?')) deleteAction();
        } else {
            Alert.alert('Excluir', 'Tem certeza que deseja apagar esta medição?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Excluir', style: 'destructive', onPress: deleteAction }
            ]);
        }
    };

    return (
        <Modal visible animationType="slide" transparent onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <BottomSheetHandle />
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{itemId ? 'Editar Medição' : 'Nova Medição'}</Text>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                            <Ionicons name="close" size={24} color={THEME.textBlack} />
                        </TouchableOpacity>
                    </View>

                    {loading ? <ActivityIndicator size="large" color={THEME.primary} style={{ marginVertical: 30 }} /> : (
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
                            <FormDate label="Data da Medição *" value={data.dataMedicao} onChange={d => setField('dataMedicao', d)} />
                            {errors.dataMedicao && <Text style={styles.errorText}>{errors.dataMedicao}</Text>}
                            
                            <FormInput label="Volume de Chuva (mm) *" placeholder="Ex: 15.5" value={data.milimetros} onChangeText={v => setField('milimetros', v.replace(/[^0-9,.]/g, ''))} keyboardType="numeric" maxLength={6} error={errors.milimetros} />
                            <FormInput label="Observações Climáticas" placeholder="Como estava o tempo? Alguma anomalia?" value={data.observacoes} onChangeText={v => setField('observacoes', v)} multiline maxLength={VALIDATION_CONFIG.maxObservationsLength} />

                            <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
                                {saving ? <ActivityIndicator color={THEME.textWhite} /> : <Text style={styles.saveButtonText}>Salvar Medição</Text>}
                            </TouchableOpacity>
                            
                            {itemId && (
                                <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} activeOpacity={0.7}>
                                    <Ionicons name="trash-outline" size={18} color={THEME.error} style={{marginRight: 6}} />
                                    <Text style={styles.deleteButtonText}>Excluir Medição</Text>
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
            <div style={{ width: '100%', overflow: 'hidden', borderRadius: 12 }}>
                <Chart chartType="BarChart" width="100%" height="250px" data={chartData}
                    options={{ title: "", chartArea: { width: "65%", height: '80%' }, hAxis: { title: "Progresso (%)", minValue: 0, maxValue: 100 }, legend: { position: "none" } }}
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
            <Text style={styles.chartTitle}>Histórico de Chuvas</Text>
            <div style={{ width: '100%', overflow: 'hidden', borderRadius: 12 }}>
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

    const triggerAnimation = () => {
        if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    };

    useEffect(() => {
        if (!auth?.currentUser) return;
        const q = query(collection(db, 'users', auth.currentUser.uid, 'porcentagens'), orderBy('dataAtualizacao', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            triggerAnimation();
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.webContainer}>
            <CustomHeader title="Andamento de Atividades" onBack={() => navigation?.goBack()} />
            
            <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
                <ProgressoChart data={items} />
                
                {loading ? <ActivityIndicator size="large" color={THEME.primary} style={{ marginTop: 50 }} />
                : items.length === 0 ? (
                    <View style={styles.emptyState}>
                        <FontAwesome name="tasks" size={50} color={THEME.border} />
                        <Text style={styles.emptyTextTitle}>Nenhuma atividade</Text>
                        <Text style={styles.emptyText}>Toque no botão + para registrar um novo andamento.</Text>
                    </View>
                )
                : items.map(item => (
                    <TouchableOpacity key={item.id} style={styles.listItem} onPress={() => { triggerAnimation(); setModal({ visible: true, itemId: item.id }); }} activeOpacity={0.7}>
                        <View style={styles.listIconBox}>
                            <FontAwesome name="check-circle" size={24} color={THEME.primary} />
                        </View>
                        <View style={styles.listContent}>
                            <Text style={styles.listTitle} numberOfLines={1}>{item.titulo || 'Sem título'}</Text>
                            
                            {/* Barra de Progresso Clean */}
                            <View style={styles.progressBarBackground}>
                                <View style={[styles.progressBarFill, { width: `${parseFloat(item.valor) || 0}%` }]} />
                            </View>
                            <Text style={styles.listSubtitle}>{(parseFloat(item.valor) || 0).toFixed(0)}% concluído</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={THEME.secondaryText} />
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <FabAdd onAdd={() => { triggerAnimation(); setModal({ visible: true, itemId: null }); }} />
            {modal.visible && <AddOrEditPorcentagemModal itemId={modal.itemId} onClose={() => setModal({ visible: false, itemId: null })} />}
            </View>
        </SafeAreaView>
    );
};

export const PluviometroListaScreen = ({ navigation }) => {
    const [modal, setModal] = useState({ visible: false, itemId: null });
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    const triggerAnimation = () => {
        if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    };

    useEffect(() => {
        if (!auth?.currentUser) return;
        const q = query(collection(db, 'users', auth.currentUser.uid, 'pluviometro'), orderBy('dataMedicao', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            triggerAnimation();
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const stats = useMemo(() => calculateRainfallStats(items), [items]);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.webContainer}>
            <CustomHeader title="Controle Pluviométrico" onBack={() => navigation?.goBack()} />
            
            <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
                {stats.count > 0 && (
                    <View style={styles.statsContainer}>
                        <Text style={styles.sectionTitle}>Estatísticas (Geral)</Text>
                        <View style={styles.statsRow}>
                            <StatBox label="Total" value={`${stats.total} mm`} color="#0288D1" icon="water" />
                            <StatBox label="Média" value={`${stats.average} mm`} color="#388E3C" icon="chart-line" />
                            <StatBox label="Máxima" value={`${stats.max} mm`} color="#F57C00" icon="arrow-up-bold" />
                            <StatBox label="Registros" value={stats.count} color="#5D4037" icon="format-list-bulleted" />
                        </View>
                    </View>
                )}

                <ChuvaChart data={items} />

                {items.length > 0 && <Text style={[styles.sectionTitle, {marginTop: 10}]}>Histórico de Medições</Text>}

                {loading ? <ActivityIndicator size="large" color={THEME.primary} style={{ marginTop: 50 }} />
                : items.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialCommunityIcons name="weather-pouring" size={56} color={THEME.border} />
                        <Text style={styles.emptyTextTitle}>Nenhuma medição</Text>
                        <Text style={styles.emptyText}>Registre os índices de chuva tocando no botão + abaixo.</Text>
                    </View>
                )
                : items.map(item => {
                    const mm = parseFloat(item.milimetros) || 0;
                    const color = mm < 5 ? '#66BB6A' : mm < 25 ? '#29B6F6' : mm < 50 ? '#FFA726' : '#EF5350';
                    return (
                        <TouchableOpacity key={item.id} style={styles.listItem} onPress={() => { triggerAnimation(); setModal({ visible: true, itemId: item.id }); }} activeOpacity={0.7}>
                            <View style={[styles.listIconBox, { backgroundColor: `${color}15` }]}>
                                <MaterialCommunityIcons name="water-outline" size={26} color={color} />
                            </View>
                            <View style={styles.listContent}>
                                <Text style={styles.listTitle}>{mm.toFixed(1)} mm</Text>
                                <Text style={styles.listSubtitle}>{formatDate(item.dataMedicao)}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={THEME.secondaryText} />
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <FabAdd onAdd={() => { triggerAnimation(); setModal({ visible: true, itemId: null }); }} />
            {modal.visible && <AddOrEditPluviometroModal itemId={modal.itemId} onClose={() => setModal({ visible: false, itemId: null })} />}
            </View>
        </SafeAreaView>
    );
};

// =====================================================================
// WRAPPER DE DEMONSTRAÇÃO
// =====================================================================

export default function PorcentagemPluviometro() {
    const [activeScreen, setActiveScreen] = useState(null);

    const triggerAnimation = () => {
        if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    };

    if (activeScreen === 'porcentagem') return <PorcentagemListaScreen navigation={{ goBack: () => setActiveScreen(null) }} />;
    if (activeScreen === 'pluviometro') return <PluviometroListaScreen navigation={{ goBack: () => setActiveScreen(null) }} />;

    return (
        <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
            <View style={{ alignItems: 'center', marginBottom: 40 }}>
                <MaterialCommunityIcons name="leaf" size={60} color={THEME.primary} />
                <Text style={{ fontSize: 24, fontWeight: '800', color: THEME.textBlack, marginTop: 10 }}>W3Labs App</Text>
                <Text style={{ fontSize: 14, color: THEME.secondaryText }}>Ambiente de testes</Text>
            </View>

            <TouchableOpacity style={styles.menuButton} onPress={() => { triggerAnimation(); setActiveScreen('porcentagem'); }} activeOpacity={0.8}>
                <FontAwesome name="tasks" size={20} color={THEME.primary} />
                <Text style={styles.menuButtonText}>Gestão de Andamento (%)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuButton} onPress={() => { triggerAnimation(); setActiveScreen('pluviometro'); }} activeOpacity={0.8}>
                <MaterialCommunityIcons name="weather-pouring" size={22} color={THEME.primary} />
                <Text style={styles.menuButtonText}>Controle Pluviométrico</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
}

// =====================================================================
// 7️⃣ ESTILOS GERAIS (CLEAN UI)
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
    header: { backgroundColor: THEME.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, height: 60, ...Platform.select({ android: { paddingTop: 10 } }) },
    backButton: { padding: 4 },
    headerTitle: { color: THEME.textWhite, fontSize: 22, fontWeight: '700' },
    
    // Lists & Empty States
    listContainer: { padding: 16, flexGrow: 1, paddingBottom: 100 },
    sectionTitle: { fontSize: 20, fontWeight: '700', color: THEME.textBlack, marginBottom: 12, marginLeft: 4 },
    emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 60, paddingHorizontal: 40 },
    emptyTextTitle: { color: THEME.textBlack, fontSize: 22, fontWeight: '600', marginTop: 16, marginBottom: 8 },
    emptyText: { color: THEME.secondaryText, fontSize: 18, textAlign: 'center', lineHeight: 24 },
    
    // List Items (Flat design)
    listItem: { flexDirection: 'row', backgroundColor: THEME.secondary, width: '100%', maxWidth: 600, alignSelf: 'center', padding: 16, borderRadius: 16, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: THEME.border },
    listIconBox: { width: 48, height: 48, backgroundColor: THEME.grayInput, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    listContent: { flex: 1, marginRight: 10 },
    listTitle: { fontSize: 20, fontWeight: '700', color: THEME.textBlack, marginBottom: 6 },
    listSubtitle: { fontSize: 16, color: THEME.secondaryText, marginTop: 4 },
    
    // Progress Bar (Clean)
    progressBarBackground: { height: 6, backgroundColor: THEME.grayInput, borderRadius: 3, width: '100%', overflow: 'hidden' },
    progressBarFill: { height: '100%', backgroundColor: THEME.primary, borderRadius: 3 },
    
    // FAB
    fabContainer: { position: 'absolute', right: 24, bottom: 34, alignItems: 'center' },
    fabAdd: { backgroundColor: THEME.primary, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 6 },
    
    // Modals (Bottom Sheet)
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: THEME.secondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingBottom: 24, maxHeight: '90%', width: '100%', maxWidth: 600, alignSelf: 'center' },
    bottomSheetHandleContainer: { alignItems: 'center', paddingTop: 12, paddingBottom: 16 },
    bottomSheetHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#D4D4D4' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { fontSize: 24, fontWeight: '800', color: THEME.textBlack },
    closeButton: { padding: 4, backgroundColor: THEME.lightGray, borderRadius: 20 },
    
    // Forms
    inputContainer: { marginBottom: 18 },
    formLabel: { fontSize: 16, color: THEME.textBlack, marginBottom: 8, fontWeight: '600', marginLeft: 4 },
    input: { backgroundColor: THEME.grayInput, borderRadius: 14, paddingHorizontal: 16, height: 60, fontSize: 18, color: THEME.textBlack },
    errorText: { color: THEME.error, fontSize: 12, marginTop: 6, marginLeft: 4 },
    
    // Date Input Form
    dateBox: { backgroundColor: THEME.secondary, borderWidth: 1, borderColor: THEME.border, borderRadius: 14, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', height: 60 },
    dateIconWrapper: { paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: THEME.border, height: '100%' },
    dateText: { fontSize: 18, color: THEME.textBlack, marginLeft: 16, fontWeight: '500' },
    
    // Buttons
    saveButton: { backgroundColor: THEME.primary, borderRadius: 14, height: 60, justifyContent: 'center', alignItems: 'center', marginTop: 16, marginBottom: 16, ...Platform.select({ web: { boxShadow: `0px 4px 8px ${THEME.primary}33` }, default: { shadowColor: THEME.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 } }), elevation: 4 },
    saveButtonText: { color: THEME.textWhite, fontWeight: '700', fontSize: 20 },
    deleteButton: { flexDirection: 'row', backgroundColor: 'transparent', borderRadius: 14, height: 60, justifyContent: 'center', alignItems: 'center' },
    deleteButtonText: { color: THEME.error, fontWeight: '600', fontSize: 18 },

    // Estatísticas (Grid 2x2)
    statsContainer: { width: '100%', maxWidth: 600, alignSelf: 'center', marginBottom: 24 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
    statBox: { backgroundColor: THEME.secondary, padding: 16, borderRadius: 16, width: '48%', marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: THEME.border },
    statIconBadge: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    statValue: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
    statLabel: { fontSize: 16, color: THEME.secondaryText, fontWeight: '500' },
    
    // Gráficos
    chartCard: { width: '100%', maxWidth: 600, alignSelf: 'center', backgroundColor: THEME.secondary, padding: 16, borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: THEME.border },
    chartTitle: { fontSize: 20, fontWeight: '700', color: THEME.textBlack, marginBottom: 16 },

    // Wrapper Menu
    menuButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.secondary, width: '85%', maxWidth: 400, padding: 20, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: THEME.border, ...Platform.select({ web: { boxShadow: '0px 2px 4px rgba(0,0,0,0.05)' }, default: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 } }), elevation: 2 },
    menuButtonText: { fontSize: 20, fontWeight: '700', color: THEME.textBlack, marginLeft: 16 }
});
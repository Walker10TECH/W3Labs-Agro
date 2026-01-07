import { doc, getDoc } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Chart } from "react-google-charts";
import {
    addOrUpdateItem,
    auth,
    db,
    subscribeToCollection
} from '../firebaseConfig'; // Supondo que este arquivo exporta as funções de interação com o Firebase
import * as common from './Common'; // Supondo que este arquivo exporta componentes comuns (View, Text, etc.) e estilos

// --- CONSTANTES E CONFIGURAÇÕES ---
const VALIDATION_CONFIG = {
    minPercentage: 0,
    maxPercentage: 100,
    minMillimeters: 0,
    maxMillimeters: 1000,
    maxTitleLength: 100,
    maxDescriptionLength: 500,
    maxObservationsLength: 300,
    decimalPlaces: 2
};

const FIELD_TYPES = {
    PERCENTAGE: 'percentage',
    RAINFALL: 'rainfall',
};

const CONTAINS_ONLY_NUMBERS_REGEX = /^\d+$/;

const ERROR_MESSAGES = {
    REQUIRED_FIELD: 'Este campo é obrigatório',
    INVALID_PERCENTAGE: 'Valor deve ser entre 0 e 100',
    INVALID_RAINFALL: 'Valor deve ser entre 0 e 1000 mm',
    INVALID_NUMBER: 'Valor deve ser numérico',
    TITLE_TOO_LONG: `Título deve ter no máximo ${VALIDATION_CONFIG.maxTitleLength} caracteres`,
    DESCRIPTION_TOO_LONG: `Descrição deve ter no máximo ${VALIDATION_CONFIG.maxDescriptionLength} caracteres`,
    OBSERVATIONS_TOO_LONG: `Observações devem ter no máximo ${VALIDATION_CONFIG.maxObservationsLength} caracteres`,
    FUTURE_DATE: 'Data não pode ser no futuro',
    INVALID_DATE: 'Data inválida',
    TEXT_ONLY_NUMBERS: 'Este campo não pode conter apenas números.'
};


// --- FUNÇÕES UTILITÁRIAS ---
const validateNumericInput = (value, type) => {
    if (!value || String(value).trim() === '') {
        return { isValid: false, sanitizedValue: 0, error: ERROR_MESSAGES.REQUIRED_FIELD };
    }
    const sanitized = parseFloat(String(value).replace(',', '.'));
    if (isNaN(sanitized)) {
        return { isValid: false, sanitizedValue: 0, error: ERROR_MESSAGES.INVALID_NUMBER };
    }
    switch (type) {
        case FIELD_TYPES.PERCENTAGE:
            if (sanitized < VALIDATION_CONFIG.minPercentage || sanitized > VALIDATION_CONFIG.maxPercentage) {
                return { isValid: false, sanitizedValue: sanitized, error: ERROR_MESSAGES.INVALID_PERCENTAGE };
            }
            break;
        case FIELD_TYPES.RAINFALL:
            if (sanitized < VALIDATION_CONFIG.minMillimeters || sanitized > VALIDATION_CONFIG.maxMillimeters) {
                return { isValid: false, sanitizedValue: sanitized, error: ERROR_MESSAGES.INVALID_RAINFALL };
            }
            break;
        default:
            break;
    }
    return { isValid: true, sanitizedValue: parseFloat(sanitized.toFixed(VALIDATION_CONFIG.decimalPlaces)), error: null };
};

const validateTextInput = (value, maxLength, required = false) => {
    const sanitized = value ? String(value).trim() : '';
    if (required && !sanitized) {
        return { isValid: false, sanitizedValue: sanitized, error: ERROR_MESSAGES.REQUIRED_FIELD };
    }
    if (required && sanitized && CONTAINS_ONLY_NUMBERS_REGEX.test(sanitized)) {
        return { isValid: false, sanitizedValue: sanitized, error: ERROR_MESSAGES.TEXT_ONLY_NUMBERS };
    }
    if (sanitized.length > maxLength) {
        const errorKey = maxLength === VALIDATION_CONFIG.maxTitleLength ? 'TITLE_TOO_LONG' :
            maxLength === VALIDATION_CONFIG.maxDescriptionLength ? 'DESCRIPTION_TOO_LONG' :
            'OBSERVATIONS_TOO_LONG';
        return { isValid: false, sanitizedValue: sanitized, error: ERROR_MESSAGES[errorKey] };
    }
    return { isValid: true, sanitizedValue: sanitized, error: null };
};

const validateDate = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        return { isValid: false, error: ERROR_MESSAGES.INVALID_DATE };
    }
    // Permite selecionar o dia de hoje
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (date > today) {
        return { isValid: false, error: ERROR_MESSAGES.FUTURE_DATE };
    }
    return { isValid: true, error: null };
};

const formatDate = (date, options = {}) => {
    if (!date) return 'Data inválida';
    try {
        // Converte o Timestamp do Firestore para um objeto Date, se necessário
        const dateObj = date.toDate ? date.toDate() : (typeof date === 'string' ? new Date(date) : date);
        const defaultOptions = { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' };
        return dateObj.toLocaleDateString('pt-BR', { ...defaultOptions, ...options });
    } catch (error) {
        console.error("Erro ao formatar data:", error);
        return 'Data inválida';
    }
};

const calculateRainfallStats = (data) => {
    if (!Array.isArray(data) || data.length === 0) {
        return { total: 0, average: 0, max: 0, min: 0, count: 0 };
    }
    const values = data.map(item => parseFloat(item.milimetros) || 0);
    const total = values.reduce((sum, value) => sum + value, 0);
    return {
        total: parseFloat(total.toFixed(VALIDATION_CONFIG.decimalPlaces)),
        average: parseFloat((total / values.length).toFixed(VALIDATION_CONFIG.decimalPlaces)),
        max: Math.max(...values),
        min: Math.min(...values),
        count: values.length
    };
};

// --- MODAL PARA ANDAMENTO/PORCENTAGEM ---
const AddOrEditPorcentagemModal = ({ itemId, onClose, onSaveSuccess }) => {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [errors, setErrors] = useState({});
    const [data, setData] = useState({
        titulo: '',
        valor: '',
        descricao: '',
        dataAtualizacao: new Date()
    });

    useEffect(() => {
        if (itemId) {
            const fetchItem = async () => {
                setLoading(true);
                const userUid = auth.currentUser?.uid;
                if (!userUid) {
                    common.Alert.alert('Erro', 'Usuário não autenticado.');
                    setLoading(false);
                    onClose();
                    return;
                }
                try {
                    // Caminho para o documento do usuário específico
                    const docRef = doc(db, 'users', userUid, 'porcentagens', itemId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const item = docSnap.data();
                        setData({
                            ...item,
                            valor: item.valor ? String(item.valor) : '',
                            dataAtualizacao: item.dataAtualizacao?.toDate ? item.dataAtualizacao.toDate() : new Date()
                        });
                    } else {
                        common.Alert.alert('Erro', 'Registro não encontrado.');
                        onClose();
                    }
                } catch (error) {
                    console.error('Erro ao carregar porcentagem:', error);
                    common.Alert.alert('Erro', 'Falha ao carregar os dados.');
                } finally {
                    setLoading(false);
                }
            };
            fetchItem();
        }
    }, [itemId, onClose]);

    const setField = useCallback((field, value, type = 'text') => {
        setData(prev => ({ ...prev, [field]: type === 'numeric' ? value.replace(/[^0-9,.]/g, '') : value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    }, [errors]);

    const validateForm = useCallback(() => {
        const newErrors = {};
        const titleValidation = validateTextInput(data.titulo, VALIDATION_CONFIG.maxTitleLength, true);
        if (!titleValidation.isValid) newErrors.titulo = titleValidation.error;

        const valueValidation = validateNumericInput(data.valor, FIELD_TYPES.PERCENTAGE);
        if (!valueValidation.isValid) newErrors.valor = valueValidation.error;
        
        if (data.descricao) {
            const descriptionValidation = validateTextInput(data.descricao, VALIDATION_CONFIG.maxDescriptionLength);
            if (!descriptionValidation.isValid) newErrors.descricao = descriptionValidation.error;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [data]);

    const onSave = useCallback(async () => {
        if (!validateForm()) {
            return common.Alert.alert('Erro de Validação', 'Por favor, corrija os campos destacados.');
        }

        setSaving(true);
        const dataToSave = {
            titulo: data.titulo.trim(),
            valor: parseFloat(String(data.valor).replace(',', '.')),
            descricao: data.descricao.trim(),
            dataAtualizacao: new Date()
        };

        const result = await addOrUpdateItem('porcentagens', dataToSave, !!itemId);
        if (result.success) {
            onSaveSuccess();
        } else {
            common.Alert.alert('Erro', result.error || 'Não foi possível salvar o registro.');
        }
        setSaving(false);
    }, [validateForm, data, itemId, onSaveSuccess]);

    const onDelete = useCallback(() => {
        const itemName = data.titulo || 'Registro';
        // A função handleFirestoreDelete já exibe um alerta de confirmação.
        // O último parâmetro 'true' foi removido pois não é utilizado na definição da função em common.jsx
        common.handleFirestoreDelete(
            db, auth, 'porcentagens', itemId, itemName, null, onSaveSuccess
        );
    }, [itemId, data.titulo, onSaveSuccess]);

    if (loading) {
        return <common.ModalFormLayout title="Carregando..." onCancel={onClose} saving={true}><common.View style={common.styles.center}><common.ActivityIndicator size="large" /></common.View></common.ModalFormLayout>;
    }

    return (
        <common.ModalFormLayout
            title={itemId ? 'Editar Andamento' : 'Novo Andamento'}
            onSubmit={onSave} onCancel={onClose} saving={saving}
            onDelete={itemId ? onDelete : null}
            submitText={itemId ? 'Atualizar' : 'Adicionar'}
        >
            <common.FormInput label="Título *" value={data.titulo} onChangeText={v => setField('titulo', v)} placeholder="Ex: Plantio da Soja" maxLength={VALIDATION_CONFIG.maxTitleLength} />
            {errors.titulo && <common.Text style={common.styles.errorText}>{errors.titulo}</common.Text>}
            <common.FormInput label="Progresso (%) *" value={data.valor} onChangeText={v => setField('valor', v, 'numeric')} keyboardType="numeric" placeholder="Ex: 75" maxLength={5} />
            {errors.valor && <common.Text style={common.styles.errorText}>{errors.valor}</common.Text>}
            <common.FormInput label="Descrição" value={data.descricao} onChangeText={v => setField('descricao', v)} multiline numberOfLines={3} placeholder="Detalhes sobre o andamento..." maxLength={VALIDATION_CONFIG.maxDescriptionLength} />
            {errors.descricao && <common.Text style={common.styles.errorText}>{errors.descricao}</common.Text>}
        </common.ModalFormLayout>
    );
};


// --- MODAL PARA PLUVIÔMETRO ---
const AddOrEditPluviometroModal = ({ itemId, onClose, onSaveSuccess }) => {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [errors, setErrors] = useState({});
    const [data, setData] = useState({
        milimetros: '',
        observacoes: '',
        dataMedicao: new Date()
    });

    useEffect(() => {
        if (itemId) {
            const fetchItem = async () => {
                setLoading(true);
                const userUid = auth.currentUser?.uid;
                if (!userUid) {
                    common.Alert.alert('Erro', 'Usuário não autenticado.');
                    setLoading(false);
                    onClose();
                    return;
                }
                try {
                    const docRef = doc(db, 'users', userUid, 'pluviometro', itemId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const item = docSnap.data();
                        setData({
                            ...item,
                            milimetros: item.milimetros ? String(item.milimetros) : '',
                            dataMedicao: item.dataMedicao?.toDate ? item.dataMedicao.toDate() : new Date(),
                        });
                    } else {
                        common.Alert.alert('Erro', 'Registro não encontrado.');
                        onClose();
                    }
                } catch (error) {
                    console.error('Erro ao carregar pluviômetro:', error);
                    common.Alert.alert('Erro', 'Falha ao carregar os dados.');
                } finally {
                    setLoading(false);
                }
            };
            fetchItem();
        }
    }, [itemId, onClose]);

    const setField = useCallback((field, value, type = 'text') => {
        setData(prev => ({ ...prev, [field]: type === 'numeric' ? value.replace(/[^0-9,.]/g, '') : value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    }, [errors]);

    const validateForm = useCallback(() => {
        const newErrors = {};
        const rainfallValidation = validateNumericInput(data.milimetros, FIELD_TYPES.RAINFALL);
        if (!rainfallValidation.isValid) newErrors.milimetros = rainfallValidation.error;

        const dateValidation = validateDate(data.dataMedicao);
        if (!dateValidation.isValid) newErrors.dataMedicao = dateValidation.error;
        
        if (data.observacoes) {
            const obsValidation = validateTextInput(data.observacoes, VALIDATION_CONFIG.maxObservationsLength);
            // Ignorar o erro de "apenas números" para observações, pois pode ser válido (ex: "lote 123")
            if (!obsValidation.isValid && obsValidation.error && obsValidation.error !== ERROR_MESSAGES.TEXT_ONLY_NUMBERS) {
                 newErrors.observacoes = obsValidation.error;
            }
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [data]);

    const onSave = useCallback(async () => {
        if (!validateForm()) {
            return common.Alert.alert('Erro de Validação', 'Por favor, corrija os campos destacados.');
        }
        setSaving(true);
        const dataToSave = {
            milimetros: parseFloat(String(data.milimetros).replace(',', '.')),
            observacoes: data.observacoes.trim(),
            dataMedicao: data.dataMedicao,
        };
        const result = await addOrUpdateItem('pluviometro', dataToSave, !!itemId);
        if (result.success) {
            onSaveSuccess();
        } else {
            common.Alert.alert('Erro', result.error || 'Não foi possível salvar o registro.');
        }
        setSaving(false);
    }, [validateForm, data, itemId, onSaveSuccess]);

    const onDelete = useCallback(() => {
        const displayValue = data.milimetros ? `${data.milimetros}mm` : 'Registro';
        common.handleFirestoreDelete(db, auth, 'pluviometro', itemId, `Medição de ${displayValue}`, null, onSaveSuccess);
    }, [itemId, data.milimetros, onSaveSuccess]);

    if (loading) {
        return <common.ModalFormLayout title="Carregando..." onCancel={onClose} saving={true}><common.View style={common.styles.center}><common.ActivityIndicator size="large" /></common.View></common.ModalFormLayout>;
    }

    return (
        <common.ModalFormLayout
            title={itemId ? 'Editar Medição' : 'Nova Medição'}
            onSubmit={onSave} onCancel={onClose} saving={saving}
            onDelete={itemId ? onDelete : null}
            submitText={itemId ? 'Atualizar' : 'Adicionar'}
        >
            <common.FormDateInput label="Data da Medição *" date={data.dataMedicao} onDateChange={v => setField('dataMedicao', v)} />
            {errors.dataMedicao && <common.Text style={common.styles.errorText}>{errors.dataMedicao}</common.Text>}
            <common.FormInput label="Precipitação (mm) *" value={data.milimetros} onChangeText={v => setField('milimetros', v, 'numeric')} keyboardType="numeric" placeholder="Ex: 15.5" maxLength={6} />
            {errors.milimetros && <common.Text style={common.styles.errorText}>{errors.milimetros}</common.Text>}
            <common.FormInput label="Observações" value={data.observacoes} onChangeText={v => setField('observacoes', v)} multiline numberOfLines={3} placeholder="Condições climáticas, etc." maxLength={VALIDATION_CONFIG.maxObservationsLength} />
            {errors.observacoes && <common.Text style={common.styles.errorText}>{errors.observacoes}</common.Text>}
        </common.ModalFormLayout>
    );
};

// --- COMPONENTE DE GRÁFICO (WEB) ---
const DataChart = ({ data, title }) => {
    // O gráfico só será renderizado na plataforma web
    if (common.Platform.OS !== 'web' || !data || data.length === 0) {
        return null;
    }

    const chartData = useMemo(() => {
        const header = ["Atividade", "Progresso", { role: "style" }];
        const rows = data.map(item => {
            const progress = parseFloat(item.valor) || 0;
            // CORREÇÃO: Adicionada a 3ª coluna para o estilo, que estava faltando.
            return [item.titulo, progress, common.theme.colors.primary];
        });
        return [header, ...rows];
    }, [data]);

    return (
        <common.View style={{ padding: 16, backgroundColor: common.theme.colors.surface, borderRadius: 12, margin: 16 }}>
            <common.Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 12, color: common.theme.colors.textPrimary }}>
                {title}
            </common.Text>
            <Chart
                chartType="BarChart"
                width="100%"
                height="250px"
                data={chartData}
                options={{
                    title: "Andamento das Atividades (%)",
                    chartArea: { width: "60%" },
                    hAxis: { title: "Progresso", minValue: 0, maxValue: 100 },
                    vAxis: { title: "Atividade" },
                    legend: { position: "none" },
                }}
            />
        </common.View>
    );
};

// --- TELA DE LISTA DE PORCENTAGEM ---
export const PorcentagemListaScreen = ({ navigation }) => {
    const [modal, setModal] = useState({ visible: false, itemId: null });
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // subscribeToCollection retorna a função de 'unsubscribe' do Firestore
        const unsubscribe = subscribeToCollection('porcentagens', (data) => {
            const sortedData = data.sort((a, b) => (b.dataAtualizacao?.toDate() || 0) - (a.dataAtualizacao?.toDate() || 0));
            setItems(sortedData);
            if(loading) setLoading(false);
        }, (error) => {
            console.error("Erro ao ouvir coleção de porcentagens:", error);
            setLoading(false);
            common.Alert.alert("Erro", "Não foi possível carregar os dados de andamento.");
        });
        
        // Função de limpeza que será chamada quando o componente for desmontado
        return () => unsubscribe();
    }, []);

    const handleSaveSuccess = useCallback(() => {
        setModal({ visible: false, itemId: null });
    }, []);

    const handleOpenModal = useCallback((itemId = null) => {
        setModal({ visible: true, itemId });
    }, []);

    const renderPorcentagemItem = useCallback(({ item }) => {
        const progress = parseFloat(item.valor) || 0;
        return (
            <common.TouchableOpacity style={common.styles.listItemContainer} onPress={() => handleOpenModal(item.id)} activeOpacity={0.7}>
                <common.View style={common.styles.listItemIconContainer}>
                    <common.FontAwesome name="percent" size={28} />
                </common.View>
                <common.View style={common.styles.listItemContent}>
                    <common.Text style={common.styles.listItemTitle}>{item.titulo || 'Sem título'}</common.Text>
                    <common.Text style={common.styles.listItemSubtitle}>Progresso: {progress.toFixed(1)}%</common.Text>
                </common.View>
                <common.Icon name="chevron-forward" size={24} color={common.theme.colors.alternate} />
            </common.TouchableOpacity>
        );
    }, [handleOpenModal]);
    
    const ListHeaderComponent = useMemo(() => (
        common.Platform.OS === 'web' 
            ? <DataChart data={items} title="Visão Geral do Andamento" />
            : null
    ), [items]);

    return (
        <>
            <common.ScreenLayout
                navigation={navigation}
                screenTitle="Andamento"
                fabAction={() => handleOpenModal()}
                ListHeaderComponent={ListHeaderComponent}
                loading={loading}
                items={items}
                renderItem={renderPorcentagemItem}
                emptyMessage="Nenhum andamento encontrado."
            />
            {modal.visible && <AddOrEditPorcentagemModal itemId={modal.itemId} onClose={() => setModal({ visible: false, itemId: null })} onSaveSuccess={handleSaveSuccess} />}
        </>
    );
};

// --- TELA DE LISTA DO PLUVIÔMETRO ---
export const PluviometroListaScreen = ({ navigation }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState({ visible: false, itemId: null });
    
    useEffect(() => {
        const unsubscribe = subscribeToCollection('pluviometro', (data) => {
            const sortedData = data.sort((a, b) => (b.dataMedicao?.toDate() || 0) - (a.dataMedicao?.toDate() || 0));
            setItems(sortedData);
            if(loading) setLoading(false);
        }, (error) => {
            console.error("Erro ao ouvir coleção de pluviometro:", error);
            setLoading(false);
            common.Alert.alert("Erro", "Não foi possível carregar os dados do pluviômetro.");
        });
        
        return () => unsubscribe();
    }, []);

    const handleSaveSuccess = useCallback(() => {
        setModal({ visible: false, itemId: null });
    }, []);

    const handleOpenModal = useCallback((itemId = null) => {
        setModal({ visible: true, itemId });
    }, []);

    const rainfallStats = useMemo(() => calculateRainfallStats(items), [items]);

    const renderPluviometroItem = useCallback(({ item }) => {
        const rainfall = parseFloat(item.milimetros) || 0;
        const formattedDate = formatDate(item.dataMedicao, { weekday: 'short', day: '2-digit', month: 'short' });
        const intensityColor = rainfall < 5 ? '#81C784' : rainfall < 25 ? '#42A5F5' : rainfall < 50 ? '#FF9800' : '#F44336';
        
        return (
            <common.TouchableOpacity style={common.styles.listItemContainer} onPress={() => handleOpenModal(item.id)} activeOpacity={0.7}>
                <common.View style={[common.styles.listItemIconContainer, { backgroundColor: `${intensityColor}20` }]}>
                    <common.MaterialCommunityIcons name="weather-pouring" size={28} color={intensityColor} />
                </common.View>
                <common.View style={common.styles.listItemContent}>
                    <common.Text style={common.styles.listItemTitle}>{rainfall.toFixed(1)} mm</common.Text>
                    <common.Text style={common.styles.listItemSubtitle}>{formattedDate}</common.Text>
                </common.View>
                <common.Icon name="chevron-forward" size={24} color={common.theme.colors.alternate} />
            </common.TouchableOpacity>
        );
    }, [handleOpenModal]);

    const ListHeaderComponent = useMemo(() => (
        <common.View>
            {rainfallStats.count > 0 && (
                <common.View style={{ backgroundColor: common.theme.colors.lightGray, padding: 16, margin: 16, borderRadius: 12, marginBottom: 8 }}>
                    <common.Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 12, color: common.theme.colors.text }}>Estatísticas de Precipitação</common.Text>
                     <common.View style={{ flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap' }}>
                        <common.StatBox label="Total" value={`${rainfallStats.total}mm`} color="#2196F3" />
                        <common.StatBox label="Média" value={`${rainfallStats.average}mm`} color="#4CAF50" />
                        <common.StatBox label="Máxima" value={`${rainfallStats.max}mm`} color="#FF9800" />
                        <common.StatBox label="Registros" value={rainfallStats.count} color="#795548" />
                    </common.View>
                </common.View>
            )}
            {common.Platform.OS === 'web' && items.length > 1 && (
                <common.View style={{ padding: 16, backgroundColor: common.theme.colors.surface, borderRadius: 12, margin: 16 }}>
                    <Chart
                        chartType="AreaChart"
                        width="100%"
                        height="250px"
                        data={[
                            ['Data', 'Precipitação (mm)'],
                            ...items.map(item => {
                                const date = item.dataMedicao?.toDate ? item.dataMedicao.toDate() : new Date(item.dataMedicao);
                                return [date, parseFloat(item.milimetros) || 0];
                            })
                        ]}
                        options={{
                            title: 'Histórico de Precipitação',
                            hAxis: { 
                                title: 'Data', 
                                titleTextStyle: { color: '#333' },
                                format: 'dd/MM'
                            },
                            vAxis: { 
                                title: 'Milímetros (mm)',
                                minValue: 0 
                            },
                            legend: { position: 'none' },
                            colors: [common.theme.colors.primary],
                        }}
                    />
                </common.View>
            )}
        </common.View>
    ), [rainfallStats, items]);

    return (
        <>
        <common.ScreenLayout
            navigation={navigation}
            screenTitle="Pluviômetro"
            fabAction={() => handleOpenModal()}
            loading={loading}
            items={items}
            renderItem={renderPluviometroItem}
            ListHeaderComponent={ListHeaderComponent}
            emptyMessage="Nenhuma medição registrada."
            emptyIcon="weather-pouring"
        />
        {modal.visible && <AddOrEditPluviometroModal itemId={modal.itemId} onClose={() => setModal({ visible: false, itemId: null })} onSaveSuccess={handleSaveSuccess} />}
        </>
    );
};
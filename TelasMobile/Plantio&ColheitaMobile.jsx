// -----------------------------------------------------------------------------
// PlantioColheita.jsx
//
// Ecrãs e modais para registo de plantios e colheitas, com lógica de
// atualização de stock, totalmente integrado com o Firestore e Design Moderno.
// Otimizado para Mobile.
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
    LayoutAnimation,
    UIManager
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons, MaterialCommunityIcons, FontAwesome5, FontAwesome } from '@expo/vector-icons';
import { collection, doc, getDoc, deleteDoc, writeBatch } from 'firebase/firestore';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Assumindo que essas funções estão exportadas no seu firebaseConfig
import {
    auth,
    db,
    getItems,
    addOrUpdateItem,
    subscribeToCollection,
} from '../firebaseConfig';

// =====================================================================
// 1️⃣ CONSTANTES, CONFIGURAÇÕES E TEMA
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

const FIELD_VALIDATION = {
    minAreaPlantada: 0.1,
    maxAreaPlantada: 10000,
    minPopulacao: 1,
    maxPopulacao: 1000000,
    minProdutividade: 0,
    maxProdutividade: 200,
    minUmidade: 0,
    maxUmidade: 100,
    minImpurezas: 0,
    maxImpurezas: 100,
    maxPeso: 1000000
};

const CULTURAS_SUGERIDAS = [
    'Soja', 'Milho', 'Trigo', 'Feijão', 'Arroz', 'Algodão', 'Cana-de-açúcar', 'Café'
];

const UNIDADES_MEDIDA = {
    PESO: 'kg',
    AREA: 'ha',
    PRODUTIVIDADE: 'sc/ha',
    PERCENTUAL: '%',
    POPULACAO: 'sementes/ha'
};

const CONTAINS_ONLY_NUMBERS_REGEX = /^\d+$/;

// =====================================================================
// 2️⃣ FUNÇÕES UTILITÁRIAS
// =====================================================================

const validateNumericInput = (value, min = 0, max = Infinity) => {
    if (!value || String(value).trim() === '') return { isValid: true, sanitizedValue: 0, error: null };
    const sanitized = parseFloat(String(value).replace(',', '.'));
    if (isNaN(sanitized)) return { isValid: false, sanitizedValue: 0, error: 'Valor deve ser numérico' };
    if (sanitized < min) return { isValid: false, sanitizedValue: sanitized, error: `Valor deve ser maior que ${min}` };
    if (sanitized > max) return { isValid: false, sanitizedValue: sanitized, error: `Valor deve ser menor que ${max}` };
    return { isValid: true, sanitizedValue: sanitized, error: null };
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

const calculateProductivity = (peso, area) => {
    if (!peso || !area || area <= 0) return 0;
    const sacas = peso / 60; // 1 saca = 60 kg
    return parseFloat((sacas / area).toFixed(2));
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

const FabGroup = ({ onAdd, onOpenAI }) => (
    <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fabAdd} onPress={onAdd}>
            <Ionicons name="add" size={28} color={THEME.textWhite} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.fabAI} onPress={onOpenAI}>
            <MaterialCommunityIcons name="robot-outline" size={26} color={THEME.textWhite} />
        </TouchableOpacity>
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
            <TouchableOpacity 
                style={[styles.selectBox, error && { borderColor: THEME.error, borderWidth: 1 }]} 
                onPress={() => setModalVisible(true)}
            >
                <Text style={[styles.selectText, !selectedItem && { color: THEME.secondaryText }]}>
                    {selectedItem ? selectedItem.label : placeholder}
                </Text>
                <Ionicons name="chevron-down" size={20} color={THEME.textBlack} />
            </TouchableOpacity>
            {error && <Text style={styles.errorText}>{error}</Text>}

            <Modal visible={modalVisible} transparent animationType="slide">
                <TouchableOpacity style={styles.selectModalOverlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
                    <View style={styles.selectModalContent}>
                        <Text style={styles.selectModalTitle}>Selecione uma opção</Text>
                        <ScrollView style={{ maxHeight: 300 }}>
                            {items.map((item, index) => (
                                <TouchableOpacity 
                                    key={index} 
                                    style={styles.selectModalItem} 
                                    onPress={() => { onValueChange(item.value); setModalVisible(false); }}
                                >
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
// 4️⃣ MODAIS DE CADASTRO COM LÓGICA (PLANTIO E COLHEITA)
// =====================================================================

const AddOrEditColheitaModal = ({ itemId, onClose, onSaveSuccess }) => {
    const [equipamentos, setEquipamentos] = useState([]);
    const [loadingEquip, setLoadingEquip] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [errors, setErrors] = useState({});
    const [data, setData] = useState({
        cultura: '', talhao: '', areaColhida: '', pesoBruto: '', pesoLiquido: '',
        produtividade: '', umidade: '', impurezas: '', observacoes: '',
        equipamentoId: '', dataColheita: new Date(), location: null,
    });

    useEffect(() => {
        let isMounted = true;
        const fetchEquips = async () => {
            setLoadingEquip(true);
            const result = await getItems('inventario');
            if (result.success && isMounted) {
                const colheitadeiras = result.data.filter(e => e.tipoEquipamento === 'Colheitadeira').sort((a, b) => a.marca.localeCompare(b.marca));
                setEquipamentos(colheitadeiras);
            }
            if (isMounted) setLoadingEquip(false);
        };
        fetchEquips();
        return () => { isMounted = false; };
    }, []);

    useEffect(() => {
        let isMounted = true;
        if (itemId) {
            const fetchItem = async () => {
                setLoading(true);
                const userUid = auth.currentUser?.uid;
                if (!userUid) return;
                try {
                    const docSnap = await getDoc(doc(db, 'users', userUid, 'colheitas', itemId));
                    if (docSnap.exists() && isMounted) {
                        const item = docSnap.data();
                        setData({
                            ...item,
                            dataColheita: item.dataColheita?.toDate ? item.dataColheita.toDate() : new Date(),
                            areaColhida: item.areaColhida ? String(item.areaColhida) : '',
                            pesoBruto: item.pesoBruto ? String(item.pesoBruto) : '',
                            pesoLiquido: item.pesoLiquido ? String(item.pesoLiquido) : '',
                            produtividade: item.produtividade ? String(item.produtividade) : '',
                            umidade: item.umidade ? String(item.umidade) : '',
                            impurezas: item.impurezas ? String(item.impurezas) : '',
                        });
                    } else if (isMounted) {
                        Alert.alert('Erro', 'Colheita não encontrada.');
                        onClose();
                    }
                } catch (error) {
                    console.error(error);
                } finally {
                    if (isMounted) setLoading(false);
                }
            };
            fetchItem();
        }
        return () => { isMounted = false; };
    }, [itemId, onClose]);

    const setField = useCallback((field, value, type = 'text') => {
        const processedValue = type === 'numeric' ? value.replace(/[^0-9,.]/g, '') : value;
        setData(prev => {
            const nextData = { ...prev, [field]: processedValue };
            if (field === 'pesoLiquido' || field === 'areaColhida') {
                const peso = parseFloat(String(field === 'pesoLiquido' ? processedValue : prev.pesoLiquido).replace(',', '.'));
                const area = parseFloat(String(field === 'areaColhida' ? processedValue : prev.areaColhida).replace(',', '.'));
                if (peso > 0 && area > 0) nextData.produtividade = String(calculateProductivity(peso, area));
            }
            return nextData;
        });
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    }, [errors]);

    const validateForm = useCallback(() => {
        const newErrors = {};
        if (!data.cultura?.trim() || CONTAINS_ONLY_NUMBERS_REGEX.test(data.cultura.trim())) newErrors.cultura = 'Cultura inválida.';
        if (!data.talhao?.trim() || CONTAINS_ONLY_NUMBERS_REGEX.test(data.talhao.trim())) newErrors.talhao = 'Talhão inválido.';
        const areaValidation = validateNumericInput(data.areaColhida, FIELD_VALIDATION.minAreaPlantada, FIELD_VALIDATION.maxAreaPlantada);
        if (!areaValidation.isValid) newErrors.areaColhida = areaValidation.error;
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [data]);

    const onSave = async () => {
        if (!validateForm()) return Alert.alert('Atenção', 'Corrija os campos destacados.');
        const userUid = auth.currentUser?.uid;
        if (!userUid) return Alert.alert("Erro", "Utilizador não autenticado.");

        setSaving(true);
        const equip = equipamentos.find(e => e.id === data.equipamentoId);
        const id = itemId || doc(collection(db, 'users', userUid, 'colheitas')).id;

        const dataToSave = {
            id,
            cultura: data.cultura.trim(),
            talhao: data.talhao.trim(),
            equipamentoId: data.equipamentoId,
            equipamentoNome: equip ? `${equip.marca} ${equip.modelo}` : 'N/A',
            dataColheita: data.dataColheita,
            areaColhida: validateNumericInput(data.areaColhida).sanitizedValue,
            pesoBruto: validateNumericInput(data.pesoBruto).sanitizedValue,
            pesoLiquido: validateNumericInput(data.pesoLiquido).sanitizedValue,
            produtividade: validateNumericInput(data.produtividade).sanitizedValue,
            umidade: validateNumericInput(data.umidade).sanitizedValue,
            impurezas: validateNumericInput(data.impurezas).sanitizedValue,
        };

        const result = await addOrUpdateItem('colheitas', dataToSave, !!itemId);
        setSaving(false);
        if (result.success) onSaveSuccess();
        else Alert.alert('Erro', 'Não foi possível salvar a colheita.');
    };

    const handleDelete = () => {
        Alert.alert('Eliminar', 'Deseja remover esta colheita?', [
            { text: 'Cancelar', style: 'cancel' },
            { 
                text: 'Eliminar', 
                style: 'destructive', 
                onPress: async () => {
                    try {
                        await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'colheitas', itemId));
                        onSaveSuccess();
                    } catch (e) {
                        Alert.alert('Erro', 'Falha ao eliminar.');
                    }
                } 
            }
        ]);
    };

    if (loading || loadingEquip) return (
        <Modal visible animationType="fade" transparent>
            <View style={styles.modalOverlay}><ActivityIndicator size="large" color={THEME.primary} /></View>
        </Modal>
    );

    return (
        <Modal visible animationType="fade" transparent>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{itemId ? 'Editar Colheita' : 'Nova Colheita'}</Text>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                            <Ionicons name="close" size={20} color={THEME.textBlack} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        <FormSelect 
                            label="Cultura" placeholder="Selecione a cultura" required 
                            items={CULTURAS_SUGERIDAS.map(c => ({ label: c, value: c }))}
                            value={data.cultura} onValueChange={v => setField('cultura', v)}
                            error={errors.cultura}
                        />
                        <FormInput 
                            label="Talhão / Área" placeholder="Ex: Talhão 1" required 
                            value={data.talhao} onChangeText={v => setField('talhao', v)}
                            error={errors.talhao}
                        />
                        <FormSelect 
                            label="Colheitadeira" placeholder="Selecione o equipamento" 
                            items={equipamentos.map(e => ({ label: `${e.marca} ${e.modelo}`, value: e.id }))}
                            value={data.equipamentoId} onValueChange={v => setField('equipamentoId', v)}
                        />
                        <FormInput 
                            label={`Área Colhida (${UNIDADES_MEDIDA.AREA})`} keyboardType="numeric" required 
                            value={data.areaColhida} onChangeText={v => setField('areaColhida', v, 'numeric')}
                            error={errors.areaColhida}
                        />
                        <FormInput 
                            label={`Peso Líquido (${UNIDADES_MEDIDA.PESO})`} keyboardType="numeric" 
                            value={data.pesoLiquido} onChangeText={v => setField('pesoLiquido', v, 'numeric')}
                        />
                        <FormInput 
                            label={`Produtividade (${UNIDADES_MEDIDA.PRODUTIVIDADE})`} editable={false}
                            value={data.produtividade} 
                        />
                        <FormDate label="Data da Colheita" value={data.dataColheita} onChange={d => setField('dataColheita', d, 'date')} />

                        <TouchableOpacity style={styles.saveButton} onPress={onSave} disabled={saving}>
                            {saving ? <ActivityIndicator color={THEME.textWhite} /> : <Text style={styles.saveButtonText}>Salvar Colheita</Text>}
                        </TouchableOpacity>
                        
                        {itemId && (
                            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                                <Text style={styles.deleteButtonText}>Excluir Colheita</Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const AddOrEditPlantioModal = ({ itemId, onClose, onSaveSuccess }) => {
    const [sementes, setSementes] = useState([]);
    const [loadingSementes, setLoadingSementes] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [originalItem, setOriginalItem] = useState(null);
    const [errors, setErrors] = useState({});
    const [data, setData] = useState({
        cultura: '', variedade: '', talhao: '', areaPlantada: '', populacaoSementes: '',
        dataPlantio: new Date(), estoqueItemId: '', quantidadeUtilizada: '',
    });

    useEffect(() => {
        let isMounted = true;
        const fetchSementes = async () => {
            setLoadingSementes(true);
            const result = await getItems('estoqueGeral');
            if (result.success && isMounted) setSementes(result.data.filter(i => i.tipo === 'Semente'));
            if (isMounted) setLoadingSementes(false);
        };
        fetchSementes();
        return () => { isMounted = false; };
    }, []);

    useEffect(() => {
        let isMounted = true;
        if (itemId) {
            const fetchItem = async () => {
                setLoading(true);
                const userUid = auth.currentUser?.uid;
                if (!userUid) return;
                try {
                    const docSnap = await getDoc(doc(db, 'users', userUid, 'plantios', itemId));
                    if (docSnap.exists() && isMounted) {
                        const item = docSnap.data();
                        const itemData = {
                            ...item,
                            dataPlantio: item.dataPlantio?.toDate ? item.dataPlantio.toDate() : new Date(),
                            areaPlantada: item.areaPlantada ? String(item.areaPlantada) : '',
                            populacaoSementes: item.populacaoSementes ? String(item.populacaoSementes) : '',
                            quantidadeUtilizada: item.quantidadeUtilizada ? String(item.quantidadeUtilizada) : '',
                        };
                        setData(itemData);
                        setOriginalItem(itemData);
                    }
                } catch (err) {
                    console.error(err);
                } finally {
                    if (isMounted) setLoading(false);
                }
            };
            fetchItem();
        }
        return () => { isMounted = false; };
    }, [itemId, onClose]);

    const setField = useCallback((field, value, type = 'text') => {
        setData(prev => ({ ...prev, [field]: type === 'numeric' ? value.replace(/[^0-9,.]/g, '') : value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    }, [errors]);

    const validateForm = useCallback(() => {
        const newErrors = {};
        if (!data.cultura?.trim()) newErrors.cultura = 'Cultura inválida.';
        if (!data.talhao?.trim()) newErrors.talhao = 'Talhão inválido.';
        if (data.estoqueItemId) {
            const qtdNum = parseFloat(String(data.quantidadeUtilizada).replace(',', '.'));
            if (isNaN(qtdNum) || qtdNum <= 0) newErrors.quantidadeUtilizada = 'Quantidade inválida.';
            else {
                const semente = sementes.find(s => s.id === data.estoqueItemId);
                const originalQtd = originalItem ? (parseFloat(String(originalItem.quantidadeUtilizada).replace(',', '.')) || 0) : 0;
                const bonusEstoque = (originalItem?.estoqueItemId === data.estoqueItemId) ? originalQtd : 0;
                const estoqueDisponivel = semente ? (parseFloat(semente.quantidade) || 0) + bonusEstoque : 0;
                if (qtdNum > estoqueDisponivel) newErrors.quantidadeUtilizada = `Stock insuficiente. Disponível: ${estoqueDisponivel.toFixed(2)}`;
            }
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [data, sementes, originalItem]);

    const onSave = async () => {
        if (!validateForm()) return Alert.alert('Atenção', 'Por favor, corrija os campos destacados.');
        const userUid = auth.currentUser?.uid;
        if (!userUid) return;

        setSaving(true);
        try {
            const batch = writeBatch(db);
            const qtdAtualNum = parseFloat(String(data.quantidadeUtilizada).replace(',', '.')) || 0;
            const qtdOriginalNum = originalItem ? (parseFloat(String(originalItem.quantidadeUtilizada).replace(',', '.')) || 0) : 0;

            if (originalItem?.estoqueItemId && originalItem.estoqueItemId !== data.estoqueItemId && qtdOriginalNum > 0) {
                const oldStockRef = doc(db, 'users', userUid, 'estoqueGeral', originalItem.estoqueItemId);
                const oldStockDoc = await getDoc(oldStockRef);
                if (oldStockDoc.exists()) batch.update(oldStockRef, { quantidade: (oldStockDoc.data().quantidade || 0) + qtdOriginalNum });
            }

            if (data.estoqueItemId && qtdAtualNum > 0) {
                const stockRef = doc(db, 'users', userUid, 'estoqueGeral', data.estoqueItemId);
                const stockDoc = await getDoc(stockRef);
                if (!stockDoc.exists()) throw new Error("Semente não encontrada.");
                const diff = qtdAtualNum - (originalItem?.estoqueItemId === data.estoqueItemId ? qtdOriginalNum : 0);
                const newStockQty = (stockDoc.data().quantidade || 0) - diff;
                if (newStockQty < 0) throw new Error(`Estoque insuficiente.`);
                batch.update(stockRef, { quantidade: newStockQty });
            }

            const sementeSel = sementes.find(s => s.id === data.estoqueItemId);
            const id = itemId || doc(collection(db, 'users', userUid, 'plantios')).id;
            const dataToSave = {
                id, ...data,
                variedade: sementeSel ? sementeSel.nome : data.variedade.trim(),
                areaPlantada: validateNumericInput(data.areaPlantada).sanitizedValue,
                populacaoSementes: validateNumericInput(data.populacaoSementes).sanitizedValue,
                quantidadeUtilizada: qtdAtualNum,
            };

            Object.keys(dataToSave).forEach(key => dataToSave[key] === undefined && delete dataToSave[key]);
            batch.set(doc(db, 'users', userUid, 'plantios', id), dataToSave, { merge: true });

            await batch.commit();
            onSaveSuccess();
        } catch (error) {
            Alert.alert('Erro', `Falha ao salvar: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = () => {
        Alert.alert('Eliminar', 'Deseja remover este plantio?', [
            { text: 'Cancelar', style: 'cancel' },
            { 
                text: 'Eliminar', 
                style: 'destructive', 
                onPress: async () => {
                    try {
                        await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'plantios', itemId));
                        // Lógica ideal: restaurar estoque no delete. Omitido para simplicidade da UI local.
                        onSaveSuccess();
                    } catch (e) {
                        Alert.alert('Erro', 'Falha ao eliminar.');
                    }
                } 
            }
        ]);
    };

    if (loading || loadingSementes) return (
        <Modal visible animationType="fade" transparent>
            <View style={styles.modalOverlay}><ActivityIndicator size="large" color={THEME.primary} /></View>
        </Modal>
    );

    const sementeSel = sementes.find(s => s.id === data.estoqueItemId);
    const uni = sementeSel ? sementeSel.unidade : '';

    return (
        <Modal visible animationType="fade" transparent>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{itemId ? 'Editar Plantio' : 'Novo Plantio'}</Text>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                            <Ionicons name="close" size={20} color={THEME.textBlack} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        <FormSelect 
                            label="Cultura" placeholder="Selecione a cultura" required 
                            items={CULTURAS_SUGERIDAS.map(c => ({ label: c, value: c }))}
                            value={data.cultura} onValueChange={v => setField('cultura', v)}
                            error={errors.cultura}
                        />
                        <FormInput 
                            label="Talhão / Área" placeholder="Ex: Talhão 1" required 
                            value={data.talhao} onChangeText={v => setField('talhao', v)}
                            error={errors.talhao}
                        />
                        <FormSelect 
                            label="Semente (do Estoque)" placeholder="Selecione para dar baixa" 
                            items={sementes.map(s => ({ label: `${s.nome} (Estoque: ${s.quantidade} ${s.unidade})`, value: s.id }))}
                            value={data.estoqueItemId} onValueChange={v => setField('estoqueItemId', v)}
                        />
                        <FormInput 
                            label="Variedade" placeholder="" editable={!data.estoqueItemId}
                            value={sementeSel ? sementeSel.nome : data.variedade} onChangeText={v => setField('variedade', v)}
                        />
                        {data.estoqueItemId && (
                            <FormInput 
                                label={`Qtd. Utilizada (${uni})`} required keyboardType="numeric"
                                value={data.quantidadeUtilizada} onChangeText={v => setField('quantidadeUtilizada', v, 'numeric')}
                                error={errors.quantidadeUtilizada}
                            />
                        )}
                        <FormInput 
                            label={`Área Plantada (${UNIDADES_MEDIDA.AREA})`} keyboardType="numeric"
                            value={data.areaPlantada} onChangeText={v => setField('areaPlantada', v, 'numeric')}
                        />
                        <FormInput 
                            label={`População (${UNIDADES_MEDIDA.POPULACAO})`} keyboardType="numeric"
                            value={data.populacaoSementes} onChangeText={v => setField('populacaoSementes', v, 'numeric')}
                        />
                        <FormDate label="Data do Plantio" value={data.dataPlantio} onChange={d => setField('dataPlantio', d, 'date')} />

                        <TouchableOpacity style={styles.saveButton} onPress={onSave} disabled={saving}>
                            {saving ? <ActivityIndicator color={THEME.textWhite} /> : <Text style={styles.saveButtonText}>Salvar Plantio</Text>}
                        </TouchableOpacity>

                        {itemId && (
                            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                                <Text style={styles.deleteButtonText}>Excluir Plantio</Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

// =====================================================================
// 5️⃣ TELAS PRINCIPAIS (COM LISTAGEM)
// =====================================================================

export const PlantiosScreen = ({ navigation }) => {
    const [modal, setModal] = useState({ visible: false, itemId: null });
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    const triggerAnimation = () => {
        if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    };

    useEffect(() => {
        const unsubscribe = subscribeToCollection('plantios', (data) => {
            const sorted = data.sort((a, b) => (b.dataPlantio?.toDate?.() || 0) - (a.dataPlantio?.toDate?.() || 0));
            setItems(sorted);
            triggerAnimation();
            if (loading) setLoading(false);
        });
        return () => unsubscribe && unsubscribe();
    }, [loading]);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.webContainer}>
            <CustomHeader title="Plantios" onBack={() => navigation.goBack()} />
            <ScrollView contentContainerStyle={styles.listContainer}>
                {loading ? (
                    <ActivityIndicator size="large" color={THEME.primary} style={{ marginTop: 50 }} />
                ) : items.length === 0 ? (
                    <Text style={styles.emptyText}>Nenhum plantio registrado.</Text>
                ) : (
                    items.map(item => (
                        <TouchableOpacity key={item.id} style={styles.listItem} onPress={() => { triggerAnimation(); setModal({ visible: true, itemId: item.id }); }}>
                            <View style={styles.listIconBox}>
                                <FontAwesome name="leaf" size={24} color={THEME.primary} />
                            </View>
                            <View style={styles.listContent}>
                                <Text style={styles.listTitle}>{item.cultura} - {item.variedade}</Text>
                                <Text style={styles.listSubtitle}>{formatDate(item.dataPlantio)} • {item.talhao}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={24} color={THEME.secondaryText} />
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
            
            <FabGroup onAdd={() => { triggerAnimation(); setModal({ visible: true, itemId: null }); }} onOpenAI={() => {}} />
            {modal.visible && <AddOrEditPlantioModal itemId={modal.itemId} onClose={() => setModal({ visible: false, itemId: null })} onSaveSuccess={() => setModal({ visible: false, itemId: null })} />}
            </View>
        </SafeAreaView>
    );
};

export const ColheitasScreen = ({ navigation }) => {
    const [modal, setModal] = useState({ visible: false, itemId: null });
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    const triggerAnimation = () => {
        if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    };

    useEffect(() => {
        const unsubscribe = subscribeToCollection('colheitas', (data) => {
            const sorted = data.sort((a, b) => (b.dataColheita?.toDate?.() || 0) - (a.dataColheita?.toDate?.() || 0));
            setItems(sorted);
            triggerAnimation();
            if (loading) setLoading(false);
        });
        return () => unsubscribe && unsubscribe();
    }, [loading]);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.webContainer}>
            <CustomHeader title="Colheitas" onBack={() => navigation.goBack()} />
            <ScrollView contentContainerStyle={styles.listContainer}>
                {loading ? (
                    <ActivityIndicator size="large" color={THEME.primary} style={{ marginTop: 50 }} />
                ) : items.length === 0 ? (
                    <Text style={styles.emptyText}>Nenhuma colheita registrada.</Text>
                ) : (
                    items.map(item => (
                        <TouchableOpacity key={item.id} style={styles.listItem} onPress={() => { triggerAnimation(); setModal({ visible: true, itemId: item.id }); }}>
                            <View style={styles.listIconBox}>
                                <MaterialCommunityIcons name="silo" size={24} color={THEME.primary} />
                            </View>
                            <View style={styles.listContent}>
                                <Text style={styles.listTitle}>{item.cultura} - {item.talhao}</Text>
                                <Text style={styles.listSubtitle}>{formatDate(item.dataColheita)} • {item.produtividade || 0} sc/ha</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={24} color={THEME.secondaryText} />
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
            
            <FabGroup onAdd={() => { triggerAnimation(); setModal({ visible: true, itemId: null }); }} onOpenAI={() => {}} />
            {modal.visible && <AddOrEditColheitaModal itemId={modal.itemId} onClose={() => setModal({ visible: false, itemId: null })} onSaveSuccess={() => setModal({ visible: false, itemId: null })} />}
            </View>
        </SafeAreaView>
    );
};

// =====================================================================
// WRAPPER DE DEMONSTRAÇÃO
// =====================================================================

export default function PlantioColheita() {
    const [activeScreen, setActiveScreen] = useState(null);

    const triggerAnimation = () => {
        if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    };

    if (activeScreen === 'plantio') return <PlantiosScreen onBack={() => setActiveScreen(null)} />;
    if (activeScreen === 'colheita') return <ColheitasScreen onBack={() => setActiveScreen(null)} />;

    return (
        <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 30, color: THEME.textBlack }}>Navegação de Teste</Text>
            <TouchableOpacity style={[styles.saveButton, { width: 250 }]} onPress={() => { triggerAnimation(); setActiveScreen('plantio'); }}>
                <Text style={styles.saveButtonText}>Abrir Plantios</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveButton, { width: 250 }]} onPress={() => { triggerAnimation(); setActiveScreen('colheita'); }}>
                <Text style={styles.saveButtonText}>Abrir Colheitas</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
}

// =====================================================================
// 6️⃣ ESTILOS GERAIS
// =====================================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: THEME.background,
    },
    webContainer: {
        flex: 1,
        width: '100%',
        maxWidth: 800,
        alignSelf: 'center',
    },
    // Cabeçalho
    header: {
        backgroundColor: THEME.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        height: 60,
        ...Platform.select({ android: { marginTop: 24 } })
    },
    backButton: { padding: 5 },
    headerTitle: {
        color: THEME.textWhite,
        fontSize: 22,
        fontWeight: 'bold',
    },
    // Listas
    listContainer: {
        padding: 15,
        alignItems: 'center',
        flexGrow: 1,
    },
    emptyText: {
        color: THEME.secondaryText,
        fontSize: 18,
        marginTop: 40,
    },
    listItem: {
        flexDirection: 'row',
        backgroundColor: THEME.secondary,
        width: '100%',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    listIconBox: {
        width: 50,
        height: 50,
        backgroundColor: THEME.grayInput,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    listContent: {
        flex: 1,
    },
    listTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: THEME.textBlack,
        marginBottom: 4,
    },
    listSubtitle: {
        fontSize: 16,
        color: THEME.secondaryText,
    },
    // Botões Flutuantes (FABs)
    fabContainer: {
        position: 'absolute',
        right: 20,
        bottom: 30,
        alignItems: 'center',
    },
    fabAdd: {
        backgroundColor: THEME.primary,
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 5,
    },
    fabAI: {
        backgroundColor: THEME.primary,
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 5,
    },
    // Modais e Formulários
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: THEME.secondary,
        borderTopLeftRadius: 15,
        borderTopRightRadius: 15,
        padding: 20,
        maxHeight: '90%',
        width: '100%',
        alignSelf: 'center',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: THEME.textBlack,
    },
    closeButton: {
        backgroundColor: THEME.grayInput,
        padding: 6,
        borderRadius: 8,
    },
    inputContainer: {
        marginBottom: 15,
    },
    formLabel: {
        fontSize: 16,
        color: THEME.secondaryText,
        marginBottom: 6,
        fontWeight: '500',
    },
    input: {
        backgroundColor: THEME.grayInput,
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: 12,
        height: 60,
        fontSize: 18,
        color: THEME.textBlack,
    },
    errorText: {
        color: THEME.error,
        fontSize: 11,
        marginTop: 4,
    },
    selectBox: {
        backgroundColor: THEME.grayInput,
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: 14,
        height: 60,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    selectText: {
        fontSize: 18,
        color: THEME.textBlack,
    },
    // Modal Customizado de Select
    selectModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    selectModalContent: {
        backgroundColor: THEME.secondary,
        width: '100%',
        borderRadius: 15,
        padding: 20,
    },
    selectModalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 15,
        color: THEME.textBlack,
        textAlign: 'center',
    },
    selectModalItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: THEME.grayInput,
    },
    selectModalItemText: {
        fontSize: 18,
        color: THEME.textBlack,
    },
    // Custom Date
    dateBox: {
        backgroundColor: THEME.grayInput,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        height: 60,
        overflow: 'hidden',
    },
    dateIconWrapper: {
        backgroundColor: THEME.primary,
        paddingVertical: 12,
        paddingHorizontal: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dateText: {
        fontSize: 18,
        color: THEME.textBlack,
        marginLeft: 15,
    },
    // Buttons
    saveButton: {
        backgroundColor: THEME.primary,
        borderRadius: 8,
        height: 60,
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 10,
    },
    saveButtonText: {
        color: THEME.textWhite,
        fontWeight: 'bold',
        fontSize: 20,
    },
    deleteButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: THEME.error,
        borderRadius: 8,
        height: 60,
        alignItems: 'center',
        marginBottom: 20,
    },
    deleteButtonText: {
        color: THEME.error,
        fontWeight: 'bold',
        fontSize: 18,
    }
});
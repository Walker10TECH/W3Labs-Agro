// -----------------------------------------------------------------------------
// Revisoes.jsx
//
// Módulo de Gestão de Revisões (Manutenção).
// Integrado ao Firestore, com cálculo automático de custos e 
// baixa de estoque atômica para peças utilizadas.
// Design W3Labs - Clean Mobile UI
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
import { Ionicons, MaterialCommunityIcons, FontAwesome5, FontAwesome } from '@expo/vector-icons';
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
    primary: '#4CAF50',       // Verde mais acessível e suave
    primaryDark: '#388E3C',   // Verde escuro contraste
    secondary: '#FFFFFF',     // Branco
    background: '#F9FBF9',    // Fundo mais claro
    textBlack: '#1A1D19',     // Texto escuro suave
    textWhite: '#FFFFFF',     // Texto branco
    secondaryText: '#4A4A4A', // Cinza mais escuro para melhor leitura (Acessibilidade)
    grayInput: '#F0F4F1',     // Fundo dos inputs
    border: '#D0D6D0',        // Bordas com mais contraste
    error: '#E53935',         // Vermelho (Corretiva / Erros)
    errorBg: '#FFEBEE',       // Fundo vermelho claro
    info: '#0288D1',          // Azul (Preventiva)
    infoBg: '#E1F5FE',        // Fundo azul claro
    lightGray: '#F5F5F5'
};

const CONTAINS_ONLY_NUMBERS_REGEX = /^\d+$/;

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
    if (!date) return 'N/A';
    try {
        const dateObj = date.toDate ? date.toDate() : (typeof date === 'string' ? new Date(date) : date);
        return dateObj.toLocaleDateString('pt-BR', options);
    } catch (error) {
        return 'Data inválida';
    }
};

// =====================================================================
// 3️⃣ COMPONENTES DE UI REUTILIZÁVEIS
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

const FormInput = ({ label, placeholder, value, onChangeText, required, keyboardType = 'default', multiline, error }) => (
    <View style={styles.inputContainer}>
        <Text style={styles.formLabel}>{label} {required && <Text style={{ color: THEME.primary }}>*</Text>}</Text>
        <TextInput
            style={[styles.input, multiline && { height: 100, textAlignVertical: 'top', paddingTop: 16 }, error && { borderColor: THEME.error, borderWidth: 1 }]}
            placeholder={placeholder}
            placeholderTextColor={THEME.secondaryText}
            value={value}
            onChangeText={onChangeText}
            keyboardType={keyboardType}
            multiline={multiline}
        />
        {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
);

const FormSelect = ({ label, placeholder, value, onValueChange, items, required, disabled, error }) => {
    const [modalVisible, setModalVisible] = useState(false);
    const selectedItem = items.find(i => i.value === value);

    return (
        <View style={styles.inputContainer}>
            <Text style={styles.formLabel}>{label} {required && <Text style={{ color: THEME.primary }}>*</Text>}</Text>
            <TouchableOpacity
                style={[styles.selectBox, disabled && { opacity: 0.6, backgroundColor: THEME.border }, error && { borderColor: THEME.error, borderWidth: 1 }]}
                onPress={() => !disabled && setModalVisible(true)}
                disabled={disabled}
                activeOpacity={0.7}
            >
                <Text style={[styles.selectText, !selectedItem && { color: THEME.secondaryText }]} numberOfLines={1}>
                    {selectedItem ? selectedItem.label : placeholder}
                </Text>
                <Ionicons name="chevron-down" size={20} color={THEME.secondaryText} />
            </TouchableOpacity>
            {error && <Text style={styles.errorText}>{error}</Text>}

            <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
                    <View style={[styles.bottomSheetContent, { maxHeight: '60%' }]}>
                        <BottomSheetHandle />
                        <Text style={styles.selectModalTitle}>Selecione uma opção</Text>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {items.map((item, index) => (
                                <TouchableOpacity key={index} style={styles.selectModalItem} onPress={() => { onValueChange(item.value); setModalVisible(false); }}>
                                    <Text style={[styles.selectModalItemText, value === item.value && { fontWeight: 'bold', color: THEME.primary }]}>{item.label}</Text>
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
            // Cores especificas baseadas no valor para revisões
            let activeColor = THEME.primary;
            if (isActive && opt.value === 'Corretiva') activeColor = THEME.error;
            if (isActive && opt.value === 'Preventiva') activeColor = THEME.info;

            return (
                <TouchableOpacity
                    key={i}
                    style={[styles.chipButton, isActive && { backgroundColor: activeColor, borderColor: activeColor }]}
                    onPress={() => onValueChange(opt.value)}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
            );
        })}
    </ScrollView>
);

// =====================================================================
// 4️⃣ SUB-MODAL: ADICIONAR PEÇA DA REVISÃO
// =====================================================================

const AddPecaModal = ({ visible, onClose, onAddPeca, pecasDisponiveis }) => {
    const [selectedPecaId, setSelectedPecaId] = useState(null);
    const [quantidade, setQuantidade] = useState('');
    const [error, setError] = useState('');

    const pecaSelecionada = useMemo(() => pecasDisponiveis.find(p => p.id === selectedPecaId), [selectedPecaId, pecasDisponiveis]);

    const handleAdd = () => {
        const qtdNum = parseMoeda(quantidade);

        if (!selectedPecaId) return setError('Selecione uma peça.');
        if (isNaN(qtdNum) || qtdNum <= 0) return setError('Quantidade inválida.');
        if (pecaSelecionada && qtdNum > pecaSelecionada.quantidade) return setError(`Estoque insuficiente. Disp: ${pecaSelecionada.quantidade}`);

        onAddPeca({
            estoqueItemId: pecaSelecionada.id,
            nome: pecaSelecionada.nome,
            quantidade: qtdNum,
            unidade: pecaSelecionada.unidade,
            valorUnitario: pecaSelecionada.valor || 0,
        });

        setSelectedPecaId(null);
        setQuantidade('');
        onClose();
    };

    if (!visible) return null;

    return (
        <Modal visible animationType="fade" transparent onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlayCenter}>
                <View style={styles.centeredModalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Adicionar Peça</Text>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}><Ionicons name="close" size={24} color={THEME.textBlack} /></TouchableOpacity>
                    </View>

                    <FormSelect
                        label="Peça do Estoque *"
                        items={pecasDisponiveis.map(p => ({ label: `${p.nome} (Disp: ${p.quantidade} ${p.unidade})`, value: p.id }))}
                        selectedValue={selectedPecaId}
                        onValueChange={v => { setSelectedPecaId(v); setError(''); }}
                        placeholder="Pesquisar peça..."
                    />

                    <FormInput
                        label={`Quantidade (${pecaSelecionada?.unidade || 'un'}) *`}
                        value={quantidade}
                        onChangeText={v => { setQuantidade(v.replace(/[^0-9,.]/g, '')); setError(''); }}
                        keyboardType="numeric"
                        placeholder="Ex: 2"
                    />
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}

                    <TouchableOpacity style={styles.saveButton} onPress={handleAdd} activeOpacity={0.8}>
                        <Text style={styles.saveButtonText}>Confirmar Peça</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

// =====================================================================
// 5️⃣ MODAL PRINCIPAL: ADICIONAR / EDITAR REVISÃO
// =====================================================================

const AddOrEditRevisaoModal = ({ visible, itemId, onClose, onSaveSuccess }) => {
    const [equipamentos, setEquipamentos] = useState([]);
    const [pecasEmEstoque, setPecasEmEstoque] = useState([]);
    const [loadingEquip, setLoadingEquip] = useState(true);
    const [loadingPecas, setLoadingPecas] = useState(true);

    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [errors, setErrors] = useState({});

    const [isPecaModalVisible, setIsPecaModalVisible] = useState(false);
    const [pecasUtilizadas, setPecasUtilizadas] = useState([]);
    const [originalPecas, setOriginalPecas] = useState([]);

    const [data, setData] = useState({
        tipoRevisao: 'Preventiva', equipamentoId: '', descricaoServico: '',
        custoMaoDeObra: '', responsavel: '', dataRevisao: new Date()
    });

    // Busca Listas do Banco
    useEffect(() => {
        if (!visible) return;
        const fetchData = async () => {
            setLoadingEquip(true);
            setLoadingPecas(true);
            const userUid = auth.currentUser?.uid;
            if (!userUid) return;

            try {
                const equipSnap = await getDocs(collection(db, 'users', userUid, 'inventario'));
                setEquipamentos(equipSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.marca?.localeCompare(b.marca)));

                const stockSnap = await getDocs(collection(db, 'users', userUid, 'estoqueGeral'));
                setPecasEmEstoque(stockSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.tipo === 'Peça').sort((a, b) => a.nome?.localeCompare(b.nome)));
            } catch (error) { console.error(error); }

            setLoadingEquip(false);
            setLoadingPecas(false);
        };
        fetchData();
    }, [visible]);

    // Busca o Item para Edição
    useEffect(() => {
        if (!itemId || !visible) return;
        const fetchItem = async () => {
            setLoading(true);
            const userUid = auth.currentUser?.uid;
            if (!userUid) return;
            try {
                const docSnap = await getDoc(doc(db, 'users', userUid, 'revisoes', itemId));
                if (docSnap.exists()) {
                    const item = docSnap.data();
                    setData({
                        ...item,
                        dataRevisao: item.dataRevisao?.toDate ? item.dataRevisao.toDate() : new Date(),
                        custoMaoDeObra: item.custoMaoDeObra ? String(item.custoMaoDeObra).replace('.', ',') : ''
                    });
                    const pecas = item.pecasUtilizadas || [];
                    setPecasUtilizadas(pecas);
                    setOriginalPecas(pecas);
                } else {
                    Alert.alert("Erro", "Registro não encontrado.");
                    onClose();
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchItem();
    }, [itemId, visible, onClose]);

    const setField = useCallback((field, value, type = 'text') => {
        let processedValue = value;
        if (type === 'numeric') processedValue = value.replace(/[^0-9,.]/g, '');
        setData(p => ({ ...p, [field]: processedValue }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    }, [errors]);

    const handleAddPeca = (peca) => setPecasUtilizadas(prev => [...prev, peca]);
    const handleRemovePeca = (estoqueItemId) => setPecasUtilizadas(prev => prev.filter(p => p.estoqueItemId !== estoqueItemId));

    const { custoTotal, custoPecas } = useMemo(() => {
        const custoPcs = pecasUtilizadas.reduce((total, peca) => total + (peca.quantidade * (peca.valorUnitario || 0)), 0);
        const custoMaoObj = parseMoeda(data.custoMaoDeObra);
        return { custoPecas: custoPcs, custoTotal: custoPcs + custoMaoObj };
    }, [pecasUtilizadas, data.custoMaoDeObra]);

    const validateForm = useCallback(() => {
        const newErrors = {};
        if (!data.equipamentoId) newErrors.equipamentoId = 'Selecione um equipamento.';
        if (!data.descricaoServico?.trim() && pecasUtilizadas.length === 0) newErrors.descricaoServico = 'Descreva o serviço ou adicione peças.';
        if (data.responsavel?.trim() && CONTAINS_ONLY_NUMBERS_REGEX.test(data.responsavel.trim())) newErrors.responsavel = 'Nome inválido.';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [data, pecasUtilizadas]);

    const onSave = async () => {
        if (!validateForm()) return Alert.alert('Aviso', 'Corrija os campos em destaque.');

        setSaving(true);
        const userUid = auth.currentUser?.uid;
        if (!userUid) return;

        try {
            const batch = writeBatch(db);
            const equip = equipamentos.find(e => e.id === data.equipamentoId);

            // GESTÃO DE ESTOQUE
            const stockChanges = new Map();
            originalPecas.forEach(p => stockChanges.set(p.estoqueItemId, (stockChanges.get(p.estoqueItemId) || 0) + p.quantidade));
            pecasUtilizadas.forEach(p => stockChanges.set(p.estoqueItemId, (stockChanges.get(p.estoqueItemId) || 0) - p.quantidade));

            const stockUpdatePromises = Array.from(stockChanges.entries()).map(async ([stkId, change]) => {
                if (change === 0) return null;
                const ref = doc(db, 'users', userUid, 'estoqueGeral', stkId);
                const stockDoc = await getDoc(ref);
                if (!stockDoc.exists()) throw new Error(`Peça não encontrada.`);
                const newQty = (stockDoc.data().quantidade || 0) + change;
                if (newQty < 0) throw new Error(`Estoque insuficiente de peças.`);
                return { ref, newQty };
            });

            const stockUpdates = (await Promise.all(stockUpdatePromises)).filter(Boolean);
            stockUpdates.forEach(({ ref, newQty }) => batch.update(ref, { quantidade: newQty }));

            // SALVAR REVISÃO
            const revisaoId = itemId || doc(collection(db, 'users', userUid, 'revisoes')).id;
            const dataToSave = {
                id: revisaoId,
                ...data,
                custoMaoDeObra: parseMoeda(data.custoMaoDeObra),
                custoPecas,
                custoTotal,
                equipamentoNome: equip ? `${equip.marca} ${equip.modelo}` : 'N/A',
                descricaoServico: data.descricaoServico.trim(),
                responsavel: data.responsavel.trim(),
                pecasUtilizadas,
            };

            batch.set(doc(db, 'users', userUid, 'revisoes', revisaoId), dataToSave, { merge: true });
            await batch.commit();
            onSaveSuccess();
        } catch (error) {
            Alert.alert("Erro", `Não foi possível salvar. ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        const deleteAction = async () => {
            setSaving(true);
            try {
                const batch = writeBatch(db);
                const userUid = auth.currentUser.uid;

                // Estorna Peças
                const stockUpdatePromises = originalPecas.map(async (peca) => {
                    const ref = doc(db, 'users', userUid, 'estoqueGeral', peca.estoqueItemId);
                    const stockDoc = await getDoc(ref);
                    if (stockDoc.exists()) return { ref, newQty: (stockDoc.data().quantidade || 0) + peca.quantidade };
                    return null;
                });

                const stockUpdates = (await Promise.all(stockUpdatePromises)).filter(Boolean);
                stockUpdates.forEach(({ ref, newQty }) => batch.update(ref, { quantidade: newQty }));

                // Deleta Revisão
                batch.delete(doc(db, 'users', userUid, 'revisoes', itemId));
                await batch.commit();
                onSaveSuccess();
            } catch (e) {
                Alert.alert('Erro', 'Falha ao excluir.');
            } finally {
                setSaving(false);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm('Deseja excluir esta revisão? As peças serão devolvidas ao estoque.')) deleteAction();
        } else {
            Alert.alert('Excluir Revisão', 'Deseja excluir esta revisão? As peças serão devolvidas ao estoque.', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Excluir', style: 'destructive', onPress: deleteAction }
            ]);
        }
    };

    if (!visible) return null;

    return (
        <Modal visible animationType="slide" transparent onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                <View style={styles.bottomSheetContent}>
                    <BottomSheetHandle />
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{itemId ? 'Editar Manutenção' : 'Nova Manutenção'}</Text>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="close" size={24} color={THEME.textBlack} />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <ActivityIndicator size="large" color={THEME.primary} style={{ marginVertical: 40 }} />
                    ) : (
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>

                            {/* DADOS PRINCIPAIS */}
                            <SectionHeader title="Dados do Equipamento" icon="tractor" />
                            <ChoiceChips options={[{ label: 'Preventiva', value: 'Preventiva' }, { label: 'Corretiva', value: 'Corretiva' }]} selectedValue={data.tipoRevisao} onValueChange={v => setField('tipoRevisao', v)} />

                            <FormSelect
                                label="Veículo / Equipamento *" placeholder={loadingEquip ? 'Carregando...' : 'Selecione'} required disabled={loadingEquip}
                                items={equipamentos.map(e => ({ value: e.id, label: `${e.marca} ${e.modelo}` }))}
                                value={data.equipamentoId} onValueChange={v => setField('equipamentoId', v)} error={errors.equipamentoId}
                            />

                            {/* SERVIÇO E PEÇAS */}
                            <SectionHeader title="Serviços e Peças" icon="cogs" />
                            <FormInput label="Descrição do Serviço" value={data.descricaoServico} onChangeText={v => setField('descricaoServico', v)} multiline error={errors.descricaoServico} placeholder="Descreva os reparos ou manutenções efetuadas..." />

                            <View style={{ marginBottom: 20 }}>
                                <Text style={[styles.formLabel, { marginBottom: 12 }]}>Peças Utilizadas do Estoque</Text>
                                {pecasUtilizadas.length > 0 ? (
                                    pecasUtilizadas.map(peca => (
                                        <View key={peca.estoqueItemId} style={styles.pecaItemBox}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.pecaItemTitle} numberOfLines={1}>{peca.nome}</Text>
                                                <Text style={styles.pecaItemSubtitle}>{peca.quantidade} {peca.unidade} • R$ {(peca.valorUnitario * peca.quantidade).toFixed(2)}</Text>
                                            </View>
                                            <TouchableOpacity onPress={() => handleRemovePeca(peca.estoqueItemId)} style={{ padding: 8 }}>
                                                <Ionicons name="trash-outline" size={20} color={THEME.error} />
                                            </TouchableOpacity>
                                        </View>
                                    ))
                                ) : (
                                    <Text style={{ color: THEME.secondaryText, fontSize: 13, marginBottom: 10, fontStyle: 'italic', marginLeft: 4 }}>
                                        Nenhuma peça vinculada a esta revisão.
                                    </Text>
                                )}

                                <TouchableOpacity style={styles.addPecaBtn} onPress={() => setIsPecaModalVisible(true)} disabled={loadingPecas} activeOpacity={0.7}>
                                    <Ionicons name="add" size={20} color={THEME.primary} style={{ marginRight: 6 }} />
                                    <Text style={styles.addPecaText}>{loadingPecas ? 'Carregando...' : 'Adicionar Peça'}</Text>
                                </TouchableOpacity>
                            </View>

                            {/* CUSTOS E FINALIZAÇÃO */}
                            <SectionHeader title="Custos e Finalização" icon="cash-multiple" />
                            <FormInput label="Mão de Obra (R$)" value={String(data.custoMaoDeObra)} onChangeText={v => setField('custoMaoDeObra', v, 'numeric')} keyboardType="numeric" placeholder="Ex: 150,00" error={errors.custo} />

                            <View style={styles.summaryCard}>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryText}>Peças:</Text>
                                    <Text style={styles.summaryText}>R$ {custoPecas.toFixed(2)}</Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryText}>Mão de Obra:</Text>
                                    <Text style={styles.summaryText}>R$ {parseMoeda(data.custoMaoDeObra).toFixed(2)}</Text>
                                </View>
                                <View style={styles.summaryDivider} />
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryTotalLabel}>Custo Total</Text>
                                    <Text style={styles.summaryTotalValue}>R$ {custoTotal.toFixed(2)}</Text>
                                </View>
                            </View>

                            <FormInput label="Responsável / Oficina" value={data.responsavel} onChangeText={v => setField('responsavel', v)} placeholder="Nome do mecânico ou empresa" error={errors.responsavel} />
                            <FormDate label="Data da Revisão" value={data.dataRevisao} onChange={d => setField('dataRevisao', d, 'date')} />

                            <TouchableOpacity style={styles.saveButton} onPress={onSave} disabled={saving} activeOpacity={0.8}>
                                {saving ? <ActivityIndicator color={THEME.textWhite} /> : <Text style={styles.saveButtonText}>Salvar Manutenção</Text>}
                            </TouchableOpacity>

                            {itemId && (
                                <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} activeOpacity={0.7}>
                                    <Ionicons name="trash-outline" size={18} color={THEME.error} style={{ marginRight: 6 }} />
                                    <Text style={styles.deleteButtonText}>Excluir Revisão</Text>
                                </TouchableOpacity>
                            )}
                        </ScrollView>
                    )}
                </View>
            </KeyboardAvoidingView>

            {/* Sub-Modal de Peças */}
            <AddPecaModal visible={isPecaModalVisible} onClose={() => setIsPecaModalVisible(false)} onAddPeca={handleAddPeca} pecasDisponiveis={pecasEmEstoque} />
        </Modal>
    );
};

// =====================================================================
// 6️⃣ TELA PRINCIPAL (LISTAGEM DE REVISÕES)
// =====================================================================

export default function RevisoesListaScreen({ navigation }) {
    const [modal, setModal] = useState({ visible: false, itemId: null });
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    const triggerAnimation = () => {
        if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    };

    useEffect(() => {
        if (!auth?.currentUser) return;
        const q = query(collection(db, 'users', auth.currentUser.uid, 'revisoes'), orderBy('dataRevisao', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setItems(data);
            triggerAnimation();
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const getStatusStyle = (tipo) => {
        if (tipo === 'Corretiva') return { color: THEME.error, bg: THEME.errorBg, icon: 'alert-circle' };
        return { color: THEME.info, bg: THEME.infoBg, icon: 'shield-check' };
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.webContainer}>
            <CustomHeader title="Histórico de Manutenções" onBack={() => navigation?.goBack()} />

            <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
                {loading ? (
                    <ActivityIndicator size="large" color={THEME.primary} style={{ marginTop: 50 }} />
                ) : items.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialCommunityIcons name="toolbox-outline" size={64} color={THEME.border} />
                        <Text style={styles.emptyTextTitle}>Nenhuma manutenção</Text>
                        <Text style={styles.emptyText}>Mantenha seu maquinário em dia registrando as revisões no botão + abaixo.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={items}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{ paddingBottom: 100 }}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => {
                            const status = getStatusStyle(item.tipoRevisao);
                            return (
                                <TouchableOpacity
                                    style={styles.listItem}
                                    onPress={() => {
                                        triggerAnimation();
                                        setModal({ visible: true, itemId: item.id });
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.listIconBox, { backgroundColor: status.bg }]}>
                                        <MaterialCommunityIcons name="wrench" size={26} color={status.color} />
                                    </View>

                                    <View style={styles.listContent}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                            <Text style={styles.listTitle} numberOfLines={1}>{item.equipamentoNome || 'Equipamento'}</Text>
                                        </View>

                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                            <MaterialCommunityIcons name={status.icon} size={14} color={status.color} style={{ marginRight: 4 }} />
                                            <Text style={[styles.listSubtitle, { color: status.color, fontWeight: '600' }]}>
                                                {item.tipoRevisao}
                                            </Text>
                                            <Text style={styles.listSubtitle}> • {formatDate(item.dataRevisao)}</Text>
                                        </View>

                                        <Text style={styles.listValueText}>
                                            R$ {parseFloat(item.custoTotal || 0).toFixed(2)}
                                        </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={THEME.secondaryText} style={{ marginLeft: 8 }} />
                                </TouchableOpacity>
                            );
                        }}
                    />
                )}
            </View>

            <FabAdd onAdd={() => setModal({ visible: true, itemId: null })} />

            <AddOrEditRevisaoModal
                visible={modal.visible}
                itemId={modal.itemId}
                onClose={() => setModal({ visible: false, itemId: null })}
                onSaveSuccess={() => setModal({ visible: false, itemId: null })}
            />
            </View>
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
    header: { backgroundColor: THEME.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 60, ...Platform.select({ android: { paddingTop: 10 } }) },
    backButton: { padding: 4 },
    headerTitle: { color: THEME.textWhite, fontSize: 22, fontWeight: '700' },

    // Empty State
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, marginTop: -50 },
    emptyTextTitle: { color: THEME.textBlack, fontSize: 22, fontWeight: '600', marginTop: 16, marginBottom: 8 },
    emptyText: { color: THEME.secondaryText, fontSize: 18, textAlign: 'center', lineHeight: 24 },

    // List Items (Flat Design)
    listItem: { flexDirection: 'row', backgroundColor: THEME.secondary, width: '100%', maxWidth: 600, alignSelf: 'center', padding: 16, borderRadius: 16, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: THEME.border },
    listIconBox: { width: 50, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    listContent: { flex: 1 },
    listTitle: { fontSize: 20, fontWeight: '700', color: THEME.textBlack, flex: 1, marginRight: 8 },
    listSubtitle: { fontSize: 16, color: THEME.secondaryText },
    listValueText: { fontSize: 18, fontWeight: '800', color: THEME.textBlack, marginTop: 4 },

    // FAB
    fabContainer: { position: 'absolute', right: 24, bottom: 34, alignItems: 'center' },
    fabAdd: { backgroundColor: THEME.primary, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 6 },

    // Modals (Bottom Sheet)
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    bottomSheetContent: { backgroundColor: THEME.secondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingBottom: 24, maxHeight: '92%', width: '100%', maxWidth: 600, alignSelf: 'center' },
    bottomSheetHandleContainer: { alignItems: 'center', paddingTop: 12, paddingBottom: 16 },
    bottomSheetHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#D4D4D4' },

    // Sub-Modal Centered (Peças)
    modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    centeredModalContent: { backgroundColor: THEME.secondary, borderRadius: 20, padding: 24, width: '100%', maxWidth: 450 },

    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 24, fontWeight: '800', color: THEME.textBlack },
    closeButton: { padding: 4, backgroundColor: THEME.lightGray, borderRadius: 20 },

    // Forms
    inputContainer: { marginBottom: 18 },
    formLabel: { fontSize: 16, color: THEME.textBlack, marginBottom: 8, fontWeight: '600', marginLeft: 4 },
    input: { backgroundColor: THEME.grayInput, borderRadius: 14, paddingHorizontal: 16, height: 60, fontSize: 18, color: THEME.textBlack },
    errorText: { color: THEME.error, fontSize: 12, marginTop: 6, marginLeft: 4 },

    // Section Header
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 16, paddingLeft: 4 },
    sectionTitle: { fontSize: 20, fontWeight: '800', color: THEME.textBlack },

    // Select Custom
    selectBox: { backgroundColor: THEME.grayInput, borderRadius: 14, paddingHorizontal: 16, height: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    selectText: { fontSize: 18, color: THEME.textBlack, flex: 1 },
    selectModalTitle: { fontSize: 22, fontWeight: '800', marginBottom: 16, color: THEME.textBlack, textAlign: 'center' },
    selectModalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: THEME.border },
    selectModalItemText: { fontSize: 16, color: THEME.textBlack },

    // Date & Chips
    dateBox: { backgroundColor: THEME.secondary, borderWidth: 1, borderColor: THEME.border, borderRadius: 14, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', height: 60 },
    dateIconWrapper: { paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: THEME.border, height: '100%' },
    dateText: { fontSize: 18, color: THEME.textBlack, marginLeft: 16, fontWeight: '500' },

    chipButton: { backgroundColor: THEME.secondary, borderWidth: 1, borderColor: THEME.border, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, marginRight: 10 },
    chipText: { color: THEME.secondaryText, fontWeight: '600', fontSize: 16 },
    chipTextActive: { color: THEME.textWhite },

    // Lista de Peças no Formulário
    pecaItemBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: THEME.secondary, borderWidth: 1, borderColor: THEME.border, padding: 14, borderRadius: 12, marginBottom: 8 },
    pecaItemTitle: { fontSize: 16, fontWeight: '700', color: THEME.textBlack, marginBottom: 4 },
    pecaItemSubtitle: { fontSize: 14, color: THEME.secondaryText },
    addPecaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 60, borderStyle: 'dashed', borderWidth: 1.5, borderColor: THEME.primary, borderRadius: 14, backgroundColor: `${THEME.primary}05` },
    addPecaText: { color: THEME.primary, fontWeight: '700', fontSize: 18 },

    // Caixa de Resumo de Custos
    summaryCard: { backgroundColor: '#F9FBF9', padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#C5E1A5' },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 },
    summaryText: { fontSize: 16, color: THEME.secondaryText, fontWeight: '500' },
    summaryDivider: { height: 1, backgroundColor: '#DDF0C7', marginVertical: 12 },
    summaryTotalLabel: { fontSize: 18, fontWeight: '700', color: THEME.textBlack },
    summaryTotalValue: { fontSize: 24, fontWeight: '800', color: THEME.primaryDark },

    // Buttons
    saveButton: { backgroundColor: THEME.primary, borderRadius: 14, height: 60, justifyContent: 'center', alignItems: 'center', marginTop: 24, marginBottom: 16, ...Platform.select({ web: { boxShadow: `0px 4px 8px ${THEME.primary}33` }, default: { shadowColor: THEME.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 } }), elevation: 4 },
    saveButtonText: { color: THEME.textWhite, fontWeight: '700', fontSize: 20 },
    deleteButton: { flexDirection: 'row', backgroundColor: 'transparent', borderRadius: 14, height: 60, justifyContent: 'center', alignItems: 'center' },
    deleteButtonText: { color: THEME.error, fontWeight: '600', fontSize: 18 }
});
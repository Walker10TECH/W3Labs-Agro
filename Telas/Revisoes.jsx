// -----------------------------------------------------------------------------
// Revisoes.jsx
//
// Módulo de Gestão de Revisões (Manutenção).
// Integrado ao Firestore, com cálculo automático de custos e 
// baixa de estoque atômica para peças utilizadas.
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
    error: '#D32F2F',         // Vermelho para corretiva/erro
    lightGray: '#EAEAEA'
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

const FormInput = ({ label, placeholder, value, onChangeText, required, keyboardType = 'default', multiline, error }) => (
    <View style={styles.inputContainer}>
        <Text style={styles.formLabel}>{label} {required && <Text style={{ color: THEME.primary }}>*</Text>}</Text>
        <TextInput
            style={[styles.input, multiline && { height: 80, textAlignVertical: 'top' }, error && { borderColor: THEME.error, borderWidth: 1 }]}
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
                style={[styles.selectBox, disabled && { opacity: 0.6 }, error && { borderColor: THEME.error, borderWidth: 1 }]} 
                onPress={() => !disabled && setModalVisible(true)}
                disabled={disabled}
            >
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
        <View style={styles.dateBox}>
            <View style={styles.dateIconWrapper}>
                <FontAwesome5 name="calendar-alt" size={20} color={THEME.textWhite} />
            </View>
            <Text style={styles.dateText}>{value}</Text>
        </View>
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
            valorUnitario: pecaSelecionada.valor || 0, // Ajustado para pegar "valor" do estoque
        });
        
        // Reset local state
        setSelectedPecaId(null);
        setQuantidade('');
        onClose();
    };

    if (!visible) return null;

    return (
        <Modal visible animationType="fade" transparent>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Adicionar Peça</Text>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}><Ionicons name="close" size={20} /></TouchableOpacity>
                    </View>
                    <FormSelect 
                        label="Peça do Estoque *" 
                        items={pecasDisponiveis.map(p => ({ label: `${p.nome} (Disp: ${p.quantidade} ${p.unidade})`, value: p.id }))}
                        selectedValue={selectedPecaId} 
                        onValueChange={v => { setSelectedPecaId(v); setError(''); }} 
                        placeholder="Selecione..." 
                    />
                    <FormInput 
                        label={`Quantidade (${pecaSelecionada?.unidade || 'un'}) *`} 
                        value={quantidade} 
                        onChangeText={v => { setQuantidade(v.replace(/[^0-9,.]/g, '')); setError(''); }} 
                        keyboardType="numeric" 
                        placeholder="Ex: 2" 
                    />
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                    
                    <TouchableOpacity style={styles.saveButton} onPress={handleAdd}>
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
        tipoRevisao: 'Preventiva',
        equipamentoId: '',
        descricaoServico: '',
        custoMaoDeObra: '',
        responsavel: '',
        dataRevisao: new Date()
    });

    // Busca Listas do Banco de Dados
    useEffect(() => {
        if (!visible) return;
        const fetchData = async () => {
            setLoadingEquip(true);
            setLoadingPecas(true);
            const userUid = auth.currentUser?.uid;
            if (!userUid) return;

            try {
                // Equipamentos
                const equipSnap = await getDocs(collection(db, 'users', userUid, 'inventario'));
                setEquipamentos(equipSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.marca?.localeCompare(b.marca)));
                
                // Peças do Estoque Geral
                const stockSnap = await getDocs(collection(db, 'users', userUid, 'estoqueGeral'));
                setPecasEmEstoque(stockSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.tipo === 'Peça').sort((a,b) => a.nome?.localeCompare(b.nome)));
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
                    Alert.alert("Erro", "Revisão não encontrada.");
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
        if (!data.descricaoServico?.trim() && pecasUtilizadas.length === 0) newErrors.descricaoServico = 'Adicione peças ou descreva o serviço.';
        if (data.responsavel?.trim() && CONTAINS_ONLY_NUMBERS_REGEX.test(data.responsavel.trim())) newErrors.responsavel = 'Nome inválido.';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [data, pecasUtilizadas]);

    const onSave = async () => {
        if (!validateForm()) return Alert.alert('Erro de Validação', 'Corrija os campos destacados.');
        
        setSaving(true);
        const userUid = auth.currentUser?.uid;
        if (!userUid) return;

        try {
            const batch = writeBatch(db);
            const equip = equipamentos.find(e => e.id === data.equipamentoId);

            // GESTÃO DE ESTOQUE (Adiciona o antigo de volta e Subtrai o novo)
            const stockChanges = new Map();
            originalPecas.forEach(p => stockChanges.set(p.estoqueItemId, (stockChanges.get(p.estoqueItemId) || 0) + p.quantidade));
            pecasUtilizadas.forEach(p => stockChanges.set(p.estoqueItemId, (stockChanges.get(p.estoqueItemId) || 0) - p.quantidade));

            const stockUpdatePromises = Array.from(stockChanges.entries()).map(async ([stkId, change]) => {
                if (change === 0) return null; 
                const ref = doc(db, 'users', userUid, 'estoqueGeral', stkId);
                const stockDoc = await getDoc(ref); 
                if (!stockDoc.exists()) throw new Error(`Peça não encontrada.`);
                const newQty = (stockDoc.data().quantidade || 0) + change;
                if (newQty < 0) throw new Error(`Estoque insuficiente.`);
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
            if (window.confirm('Deseja excluir esta revisão? As peças serão devolvidas ao estoque.')) {
                deleteAction();
            }
        } else {
            Alert.alert('Atenção', 'Deseja excluir esta revisão? As peças serão devolvidas ao estoque.', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Excluir', style: 'destructive', onPress: deleteAction }
            ]);
        }
    };

    if (!visible) return null;
    if (loading) return <Modal visible transparent><View style={styles.modalOverlay}><ActivityIndicator size="large" color={THEME.primary}/></View></Modal>;

    return (
        <Modal visible animationType="slide" transparent>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{itemId ? 'Editar Revisão' : 'Nova Revisão'}</Text>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}><Ionicons name="close" size={20} /></TouchableOpacity>
                    </View>
                    
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <FormSelect 
                            label="Equipamento *" placeholder={loadingEquip ? 'Carregando...' : 'Selecione'} required disabled={loadingEquip}
                            items={equipamentos.map(e => ({ value: e.id, label: `${e.marca} ${e.modelo}` }))}
                            value={data.equipamentoId} onValueChange={v => setField('equipamentoId', v)} error={errors.equipamentoId}
                        />

                        <ChoiceChips options={[{ label: 'Preventiva', value: 'Preventiva' }, { label: 'Corretiva', value: 'Corretiva' }]} selectedValue={data.tipoRevisao} onValueChange={v => setField('tipoRevisao', v)} />

                        {/* BLOCO DE PEÇAS */}
                        <Text style={styles.sectionTitle}>Peças Utilizadas do Estoque</Text>
                        <View style={styles.pecasContainer}>
                            {pecasUtilizadas.map(peca => (
                                <View key={peca.estoqueItemId} style={styles.pecaChip}>
                                    <Text style={styles.pecaText}>{peca.nome} - {peca.quantidade} {peca.unidade}</Text>
                                    <TouchableOpacity onPress={() => handleRemovePeca(peca.estoqueItemId)}><Ionicons name="close-circle" size={20} color={THEME.error} /></TouchableOpacity>
                                </View>
                            ))}
                            <TouchableOpacity style={styles.addPecaBtn} onPress={() => setIsPecaModalVisible(true)} disabled={loadingPecas}>
                                <Ionicons name="add-circle-outline" size={20} color={THEME.primary} style={{ marginRight: 6 }} />
                                <Text style={styles.addPecaText}>{loadingPecas ? 'Carregando...' : 'Adicionar Peça'}</Text>
                            </TouchableOpacity>
                        </View>

                        <FormInput label="Descrição do Serviço" value={data.descricaoServico} onChangeText={v => setField('descricaoServico', v)} multiline error={errors.descricaoServico} placeholder="Descreva os serviços ou reparos efetuados..." />
                        
                        <FormInput label="Custo de Mão de Obra (R$)" value={String(data.custoMaoDeObra)} onChangeText={v => setField('custoMaoDeObra', v, 'numeric')} keyboardType="numeric" placeholder="Ex: 150,00" error={errors.custo} />

                        <View style={styles.summaryBox}>
                            <View style={styles.summaryRow}><Text style={styles.summaryText}>Custo de Peças:</Text><Text style={styles.summaryText}>R$ {custoPecas.toFixed(2)}</Text></View>
                            <View style={styles.summaryRow}><Text style={styles.summaryTotalText}>Custo Total da Revisão:</Text><Text style={styles.summaryTotalText}>R$ {custoTotal.toFixed(2)}</Text></View>
                        </View>

                        <FormInput label="Responsável / Oficina" value={data.responsavel} onChangeText={v => setField('responsavel', v)} placeholder="Quem executou o serviço" error={errors.responsavel} />
                        <FormDate label="Data da Revisão" value={formatDate(data.dataRevisao)} />

                        <TouchableOpacity style={styles.saveButton} onPress={onSave} disabled={saving}>
                            {saving ? <ActivityIndicator color={THEME.textWhite} /> : <Text style={styles.saveButtonText}>Salvar Revisão</Text>}
                        </TouchableOpacity>
                        
                        {itemId && <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}><Text style={styles.deleteButtonText}>Excluir Revisão</Text></TouchableOpacity>}
                    </ScrollView>
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

    useEffect(() => {
        if (!auth.currentUser) return;
        const q = query(collection(db, 'users', auth.currentUser.uid, 'revisoes'), orderBy('dataRevisao', 'desc'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setItems(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <CustomHeader title="Gestão de Revisões" onBack={() => navigation?.goBack()} />

            <View style={{ flex: 1, padding: 15 }}>
                {loading ? (
                    <ActivityIndicator size="large" color={THEME.primary} style={{ marginTop: 50 }} />
                ) : items.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <FontAwesome name="wrench" size={64} color={THEME.lightGray} />
                        <Text style={styles.emptyText}>Nenhuma revisão registrada.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={items}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{ paddingBottom: 80 }}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => {
                            const isCorretiva = item.tipoRevisao === 'Corretiva';
                            return (
                                <TouchableOpacity 
                                    style={[styles.listItem, { borderLeftWidth: 4, borderLeftColor: isCorretiva ? THEME.error : THEME.primary }]} 
                                    onPress={() => setModal({ visible: true, itemId: item.id })}
                                >
                                    <View style={styles.listIconBox}>
                                        <FontAwesome name="wrench" size={24} color={isCorretiva ? THEME.error : THEME.primary} />
                                    </View>
                                    <View style={styles.listContent}>
                                        <Text style={styles.listTitle}>{item.equipamentoNome || 'Equipamento'}</Text>
                                        <Text style={styles.listSubtitle}>
                                            {formatDate(item.dataRevisao)} • <Text style={{ color: isCorretiva ? THEME.error : THEME.primary, fontWeight: 'bold' }}>{item.tipoRevisao}</Text>
                                        </Text>
                                        <Text style={styles.listValueText}>
                                            R$ {parseFloat(item.custoTotal || 0).toFixed(2)}
                                        </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={THEME.secondaryText} />
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
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: THEME.secondaryText, fontSize: 15, marginTop: 15, fontWeight: '500' },
    listItem: { flexDirection: 'row', backgroundColor: THEME.secondary, width: '100%', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
    listIconBox: { width: 46, height: 46, backgroundColor: THEME.grayInput, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    listContent: { flex: 1, marginRight: 10 },
    listTitle: { fontSize: 16, fontWeight: 'bold', color: THEME.textBlack, marginBottom: 2 },
    listSubtitle: { fontSize: 13, color: THEME.secondaryText },
    listValueText: { fontSize: 14, fontWeight: 'bold', color: THEME.textBlack, marginTop: 5 },
    
    // FAB
    fabContainer: { position: 'absolute', right: 20, bottom: 30, alignItems: 'center' },
    fabAdd: { backgroundColor: THEME.primary, width: 55, height: 55, borderRadius: 27.5, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 5 },
    
    // Modals & Forms
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: THEME.secondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: THEME.textBlack },
    closeButton: { backgroundColor: THEME.grayInput, padding: 6, borderRadius: 8 },
    inputContainer: { marginBottom: 15 },
    formLabel: { fontSize: 12, color: THEME.secondaryText, marginBottom: 6, fontWeight: '500' },
    input: { backgroundColor: THEME.grayInput, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12, fontSize: 14, color: THEME.textBlack },
    errorText: { color: THEME.error, fontSize: 11, marginTop: 4 },
    
    // Select Custom
    selectBox: { backgroundColor: THEME.grayInput, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    selectText: { fontSize: 14, color: THEME.textBlack, flex: 1 },
    selectModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    selectModalContent: { backgroundColor: THEME.secondary, width: '100%', maxWidth: 400, borderRadius: 15, padding: 20 },
    selectModalTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 15, color: THEME.textBlack, textAlign: 'center' },
    selectModalItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: THEME.grayInput },
    selectModalItemText: { fontSize: 16, color: THEME.textBlack },
    
    // Chips & Dates
    dateBox: { backgroundColor: THEME.grayInput, borderRadius: 8, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
    dateIconWrapper: { backgroundColor: THEME.primary, paddingVertical: 12, paddingHorizontal: 15, justifyContent: 'center', alignItems: 'center' },
    dateText: { fontSize: 14, color: THEME.textBlack, marginLeft: 15 },
    chipButton: { backgroundColor: THEME.grayInput, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginRight: 10 },
    chipButtonActive: { backgroundColor: THEME.primary },
    chipText: { color: THEME.secondaryText, fontWeight: 'bold' },
    chipTextActive: { color: THEME.textWhite },
    
    // Peças Container
    sectionTitle: { fontSize: 14, fontWeight: 'bold', color: THEME.textBlack, marginBottom: 10, marginTop: 10 },
    pecasContainer: { backgroundColor: THEME.grayInput, padding: 10, borderRadius: 8, marginBottom: 15 },
    pecaChip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: THEME.secondary, padding: 10, borderRadius: 6, marginBottom: 8 },
    pecaText: { fontSize: 13, color: THEME.textBlack, fontWeight: '500' },
    addPecaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, borderStyle: 'dashed', borderWidth: 1, borderColor: THEME.primary, borderRadius: 6 },
    addPecaText: { color: THEME.primary, fontWeight: 'bold', fontSize: 13 },
    
    // Summary Box
    summaryBox: { backgroundColor: '#F0F8EC', padding: 15, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#C8E6C9' },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    summaryText: { fontSize: 14, color: THEME.textBlack },
    summaryTotalText: { fontSize: 16, fontWeight: 'bold', color: THEME.primaryDark },

    // Buttons
    saveButton: { backgroundColor: THEME.primary, borderRadius: 8, paddingVertical: 15, alignItems: 'center', marginTop: 10, marginBottom: 10 },
    saveButtonText: { color: THEME.textWhite, fontWeight: 'bold', fontSize: 16 },
    deleteButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: THEME.error, borderRadius: 8, paddingVertical: 15, alignItems: 'center', marginBottom: 20 },
    deleteButtonText: { color: THEME.error, fontWeight: 'bold', fontSize: 16 }
});
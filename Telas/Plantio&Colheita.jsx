// -----------------------------------------------------------------------------
// Plantio&Colheita.jsx
//
// Ecrãs e modais para registo de plantios e colheitas, com lógica de
// atualização de stock, totalmente integrado com o Firestore.
// -----------------------------------------------------------------------------
import React, { useState, useEffect, useCallback } from 'react';
import * as common from './Common'; // Assume que 'common' contém componentes partilhados
import {
  auth,
  db,
  getItems,
  addOrUpdateItem,
  subscribeToCollection,
} from '../firebaseConfig';
import { collection, doc, getDoc, writeBatch } from 'firebase/firestore';

// --- CONSTANTES E CONFIGURAÇÕES ---
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

// --- FUNÇÕES UTILITÁRIAS ---
const validateNumericInput = (value, min = 0, max = Infinity) => {
  if (!value || String(value).trim() === '') {
    return { isValid: true, sanitizedValue: 0, error: null };
  }
  const sanitized = parseFloat(String(value).replace(',', '.'));
  if (isNaN(sanitized)) {
    return { isValid: false, sanitizedValue: 0, error: 'Valor deve ser numérico' };
  }
  if (sanitized < min) {
    return { isValid: false, sanitizedValue: sanitized, error: `Valor deve ser maior que ${min}` };
  }
  if (sanitized > max) {
    return { isValid: false, sanitizedValue: sanitized, error: `Valor deve ser menor que ${max}` };
  }
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

/* ---------------------------------------------------------------------------
// 1 – MODAL: Adicionar / Editar Colheita
// --------------------------------------------------------------------------- */
const AddOrEditColheitaModal = ({ itemId, onClose, onSaveSuccess }) => {
  const [equipamentos, setEquipamentos] = useState([]);
  const [loadingEquip, setLoadingEquip] = useState(true);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!itemId);
  const [errors, setErrors] = useState({});
  const [data, setData] = useState({
    cultura: '',
    talhao: '',
    areaColhida: '',
    pesoBruto: '',
    pesoLiquido: '',
    produtividade: '',
    umidade: '',
    impurezas: '',
    observacoes: '',
    equipamentoId: '',
    dataColheita: new Date(),
    location: null,
  });

  // Busca equipamentos do Firestore
  useEffect(() => {
    let isMounted = true;
    const fetchEquipamentos = async () => {
      setLoadingEquip(true);
      const result = await getItems('inventario');
      if (result.success && isMounted) {
        const colheitadeiras = result.data
          .filter(e => e.tipoEquipamento === 'Colheitadeira')
          .sort((a, b) => a.marca.localeCompare(b.marca));
        setEquipamentos(colheitadeiras);
      }
      if (isMounted) setLoadingEquip(false);
    };
    fetchEquipamentos();
    return () => { isMounted = false; };
  }, []);

  // Busca item para edição
  useEffect(() => {
    let isMounted = true;
    if (itemId) {
      const fetchItem = async () => {
        setLoading(true);
        const userUid = auth.currentUser?.uid;
        if (!userUid) return;
        try {
          const docRef = doc(db, 'users', userUid, 'colheitas', itemId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && isMounted) {
            const item = docSnap.data();
            setData({
              ...item,
              dataColheita: item.dataColheita?.toDate ? item.dataColheita.toDate() : new Date(),
              location: item.latitude && item.longitude ? { latitude: item.latitude, longitude: item.longitude } : null,
              areaColhida: item.areaColhida ? String(item.areaColhida) : '',
              pesoBruto: item.pesoBruto ? String(item.pesoBruto) : '',
              pesoLiquido: item.pesoLiquido ? String(item.pesoLiquido) : '',
              produtividade: item.produtividade ? String(item.produtividade) : '',
              umidade: item.umidade ? String(item.umidade) : '',
              impurezas: item.impurezas ? String(item.impurezas) : '',
            });
          } else if (isMounted) {
            common.Alert.alert('Erro', 'Colheita não encontrada.');
            onClose();
          }
        } catch (error) {
          console.error('Erro ao carregar colheita:', error);
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
      
      // Atualização dinâmica da produtividade
      if (field === 'pesoLiquido' || field === 'areaColhida') {
        const peso = parseFloat(String(field === 'pesoLiquido' ? processedValue : prev.pesoLiquido).replace(',', '.'));
        const area = parseFloat(String(field === 'areaColhida' ? processedValue : prev.areaColhida).replace(',', '.'));
        if (peso > 0 && area > 0) {
          nextData.produtividade = String(calculateProductivity(peso, area));
        }
      }
      return nextData;
    });
    
    if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: null }));
    }
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

  const onSave = useCallback(async () => {
    if (!validateForm()) {
      return common.Alert.alert('Erro de Validação', 'Por favor, corrija os campos destacados.');
    }
    const userUid = auth.currentUser?.uid;
    if (!userUid) {
        common.Alert.alert("Erro", "Utilizador não autenticado.");
        return;
    }

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
      latitude: data.location?.latitude || null,
      longitude: data.location?.longitude || null,
      observacoes: data.observacoes?.trim() || '',
    };

    const result = await addOrUpdateItem('colheitas', dataToSave, !!itemId);
    if (result.success) {
      onSaveSuccess();
    } else {
      common.Alert.alert('Erro', 'Não foi possível salvar a colheita.');
    }
    setSaving(false);
  }, [validateForm, equipamentos, data, itemId, onSaveSuccess]);

  const onDelete = useCallback(() => {
    common.handleFirestoreDelete(db, auth, 'colheitas', itemId, `Colheita de ${data.cultura}`, null, onSaveSuccess);
  }, [itemId, data.cultura, onSaveSuccess]);

  if (loading || loadingEquip) {
    return (
      <common.ModalFormLayout title="Carregando..." onCancel={onClose} saving={true}>
        <common.View style={common.styles.center}>
          <common.ActivityIndicator size="large" />
        </common.View>
      </common.ModalFormLayout>
    );
  }

  return (
    <common.ModalFormLayout 
      title={itemId ? 'Editar Colheita' : 'Nova Colheita'} 
      onSubmit={onSave} 
      onCancel={onClose} 
      saving={saving} 
      onDelete={itemId ? onDelete : null}
    >
      <common.FormPicker 
        label="Cultura *" 
        items={CULTURAS_SUGERIDAS.map(c => ({label: c, value: c}))} 
        selectedValue={data.cultura} 
        onValueChange={v => setField('cultura', v)} 
        placeholder="Selecione a cultura" 
      />
      {errors.cultura && <common.Text style={common.styles.errorText}>{errors.cultura}</common.Text>}
      
      <common.FormInput 
        label="Talhão / Área *" 
        value={data.talhao} 
        onChangeText={v => setField('talhao', v)} 
        placeholder="Ex: Talhão 1" 
      />
      {errors.talhao && <common.Text style={common.styles.errorText}>{errors.talhao}</common.Text>}
      
      <common.FormPicker 
        label="Colheitadeira" 
        items={equipamentos.map(e => ({ value: e.id, label: `${e.marca} ${e.modelo}` }))} 
        selectedValue={data.equipamentoId} 
        onValueChange={v => setField('equipamentoId', v)} 
        placeholder="Selecione o equipamento" 
      />
      
      <common.FormInput 
        label={`Área Colhida (${UNIDADES_MEDIDA.AREA}) *`} 
        value={data.areaColhida} 
        onChangeText={v => setField('areaColhida', v, 'numeric')} 
        keyboardType="numeric" 
      />
      {errors.areaColhida && <common.Text style={common.styles.errorText}>{errors.areaColhida}</common.Text>}
      
      <common.FormInput 
        label={`Peso Líquido (${UNIDADES_MEDIDA.PESO})`} 
        value={data.pesoLiquido} 
        onChangeText={v => setField('pesoLiquido', v, 'numeric')} 
        keyboardType="numeric" 
      />
      
      <common.FormInput 
        label={`Produtividade (${UNIDADES_MEDIDA.PRODUTIVIDADE})`} 
        value={data.produtividade} 
        editable={false} 
      />
      
      <common.FormDateInput 
        label="Data da Colheita" 
        date={data.dataColheita} 
        onDateChange={v => setField('dataColheita', v)} 
      />
      
      <common.FormLocationInput 
        label="Localização" 
        initialLocation={data.location} 
        onLocationChange={loc => setField('location', loc)} 
      />
      
      <common.FormInput 
        label="Observações" 
        value={data.observacoes} 
        onChangeText={v => setField('observacoes', v)} 
        multiline 
      />
    </common.ModalFormLayout>
  );
};

/* ---------------------------------------------------------------------------
// 2 – LISTA: Colheita
// --------------------------------------------------------------------------- */
export const ColheitaListaScreen = ({ navigation }) => {
  const [modal, setModal] = useState({ visible: false, itemId: null });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToCollection('colheitas', (data) => {
      const sorted = data.sort((a, b) => (b.dataColheita?.toDate() || 0) - (a.dataColheita?.toDate() || 0));
      setItems(sorted);
      if (loading) setLoading(false);
    });
    return () => unsubscribe();
  }, [loading]);

  const handleSaveSuccess = () => setModal({ visible: false, itemId: null });
  const handleOpenModal = (itemId = null) => setModal({ visible: true, itemId });

  const renderItem = useCallback(({ item }) => (
    <common.TouchableOpacity style={common.styles.listItemContainer} onPress={() => handleOpenModal(item.id)}>
      <common.View style={common.styles.listItemIconContainer}>
        <common.MaterialCommunityIcons name="silo" size={28} color={common.theme.colors.primary} />
      </common.View>
      <common.View style={common.styles.listItemContent}>
        <common.Text style={common.styles.listItemTitle}>{item.cultura} - {item.talhao}</common.Text>
        <common.Text style={common.styles.listItemSubtitle}>
          {formatDate(item.dataColheita)} • {item.produtividade || 0} sc/ha
        </common.Text>
      </common.View>
      <common.Icon name="chevron-forward" size={24} color={common.theme.colors.alternate} />
    </common.TouchableOpacity>
  ), [handleOpenModal]);

  return (
    <>
      <common.ScreenLayout 
        navigation={navigation} 
        screenTitle="Colheitas" 
        fabAction={() => handleOpenModal()} 
        loading={loading} 
        items={items} 
        renderItem={renderItem} 
        emptyMessage="Nenhuma colheita registada." 
      />
      {modal.visible && (
        <AddOrEditColheitaModal 
          itemId={modal.itemId} 
          onClose={() => setModal({ visible: false, itemId: null })} 
          onSaveSuccess={handleSaveSuccess} 
        />
      )}
    </>
  );
};

/* ---------------------------------------------------------------------------
// 3 – MODAL: Adicionar / Editar Plantio
// --------------------------------------------------------------------------- */
const AddOrEditPlantioModal = ({ itemId, onClose, onSaveSuccess }) => {
  const [sementes, setSementes] = useState([]);
  const [loadingSementes, setLoadingSementes] = useState(true);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!itemId);
  const [originalItem, setOriginalItem] = useState(null);
  const [errors, setErrors] = useState({});
  const [data, setData] = useState({
    cultura: '',
    variedade: '',
    talhao: '',
    areaPlantada: '',
    populacaoSementes: '',
    dataPlantio: new Date(),
    estoqueItemId: '',
    quantidadeUtilizada: '',
    location: null,
  });

  useEffect(() => {
    let isMounted = true;
    const fetchSementes = async () => {
      setLoadingSementes(true);
      const result = await getItems('estoqueGeral');
      if (result.success && isMounted) {
        setSementes(result.data.filter(i => i.tipo === 'Semente'));
      }
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
          const docRef = doc(db, 'users', userUid, 'plantios', itemId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && isMounted) {
            const item = docSnap.data();
            const itemData = {
              ...item,
              dataPlantio: item.dataPlantio?.toDate ? item.dataPlantio.toDate() : new Date(),
              location: item.latitude && item.longitude ? { latitude: item.latitude, longitude: item.longitude } : null,
              areaPlantada: item.areaPlantada ? String(item.areaPlantada) : '',
              populacaoSementes: item.populacaoSementes ? String(item.populacaoSementes) : '',
              quantidadeUtilizada: item.quantidadeUtilizada ? String(item.quantidadeUtilizada) : '',
            };
            setData(itemData);
            setOriginalItem(itemData);
          } else if (isMounted) {
            common.Alert.alert('Erro', 'Plantio não encontrado.');
            onClose();
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
    setData(prev => ({ 
      ...prev, 
      [field]: type === 'numeric' ? value.replace(/[^0-9,.]/g, '') : value 
    }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  }, [errors]);

  const validateForm = useCallback(() => {
    const newErrors = {};
    if (!data.cultura?.trim() || CONTAINS_ONLY_NUMBERS_REGEX.test(data.cultura.trim())) newErrors.cultura = 'Cultura inválida.';
    if (!data.talhao?.trim() || CONTAINS_ONLY_NUMBERS_REGEX.test(data.talhao.trim())) newErrors.talhao = 'Talhão inválido.';
    
    if (data.estoqueItemId) {
      const qtdNum = parseFloat(String(data.quantidadeUtilizada).replace(',', '.'));
      if (isNaN(qtdNum) || qtdNum <= 0) {
        newErrors.quantidadeUtilizada = 'Quantidade inválida.';
      } else {
        const semente = sementes.find(s => s.id === data.estoqueItemId);
        const originalQtd = originalItem ? (parseFloat(String(originalItem.quantidadeUtilizada).replace(',', '.')) || 0) : 0;
        
        // Se estamos editando o MESMO item de estoque, o saldo disponível é (Estoque Atual + O que já tínhamos gasto neste plantio)
        const bonusEstoque = (originalItem?.estoqueItemId === data.estoqueItemId) ? originalQtd : 0;
        const estoqueDisponivel = semente ? (parseFloat(semente.quantidade) || 0) + bonusEstoque : 0;
        
        if (qtdNum > estoqueDisponivel) {
          newErrors.quantidadeUtilizada = `Stock insuficiente. Disponível: ${estoqueDisponivel.toFixed(2)} ${semente?.unidade || ''}`;
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [data, sementes, originalItem]);

  const onSave = useCallback(async () => {
    if (!validateForm()) {
      return common.Alert.alert('Erro de Validação', 'Por favor, corrija os campos destacados.');
    }
    setSaving(true);
    const userUid = auth.currentUser?.uid;
    if (!userUid) {
      setSaving(false);
      return common.Alert.alert("Erro", "Utilizador não autenticado.");
    }

    try {
      const batch = writeBatch(db);
      const qtdAtualNum = parseFloat(String(data.quantidadeUtilizada).replace(',', '.')) || 0;
      const qtdOriginalNum = originalItem ? (parseFloat(String(originalItem.quantidadeUtilizada).replace(',', '.')) || 0) : 0;

      // 1. Reverte o estoque do item antigo SE o item de estoque foi trocado
      if (originalItem?.estoqueItemId && originalItem.estoqueItemId !== data.estoqueItemId && qtdOriginalNum > 0) {
        const oldStockRef = doc(db, 'users', userUid, 'estoqueGeral', originalItem.estoqueItemId);
        const oldStockDoc = await getDoc(oldStockRef);
        if (oldStockDoc.exists()) {
          const newQty = (oldStockDoc.data().quantidade || 0) + qtdOriginalNum;
          batch.update(oldStockRef, { quantidade: newQty });
        }
      }

      // 2. Deduz a quantidade do estoque (novo ou o mesmo item)
      if (data.estoqueItemId && qtdAtualNum > 0) {
        const stockRef = doc(db, 'users', userUid, 'estoqueGeral', data.estoqueItemId);
        const stockDoc = await getDoc(stockRef);
        if (!stockDoc.exists()) throw new Error("Semente não encontrada no estoque.");

        // Calcula a diferença a ser deduzida do estoque atual
        const diff = qtdAtualNum - (originalItem?.estoqueItemId === data.estoqueItemId ? qtdOriginalNum : 0);
        const newStockQty = (stockDoc.data().quantidade || 0) - diff;

        if (newStockQty < 0) throw new Error(`Estoque insuficiente para "${stockDoc.data().nome}".`);
        batch.update(stockRef, { quantidade: newStockQty });
      }

      const sementeSel = sementes.find(s => s.id === data.estoqueItemId);
      const id = itemId || doc(collection(db, 'users', userUid, 'plantios')).id;
      
      const dataToSave = {
        id,
        ...data,
        cultura: data.cultura.trim(),
        variedade: sementeSel ? sementeSel.nome : data.variedade.trim(),
        talhao: data.talhao.trim(),
        areaPlantada: validateNumericInput(data.areaPlantada).sanitizedValue,
        populacaoSementes: validateNumericInput(data.populacaoSementes).sanitizedValue,
        quantidadeUtilizada: qtdAtualNum,
        latitude: data.location?.latitude || null,
        longitude: data.location?.longitude || null,
      };

      // Garante que campos undefined não sejam passados para o Firestore
      Object.keys(dataToSave).forEach(key => dataToSave[key] === undefined && delete dataToSave[key]);

      const plantioRef = doc(db, 'users', userUid, 'plantios', id);
      batch.set(plantioRef, dataToSave, { merge: true });

      await batch.commit();
      onSaveSuccess();
    } catch (error) {
      console.error('Erro ao salvar plantio:', error);
      common.Alert.alert('Erro', `Não foi possível salvar o plantio: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }, [validateForm, sementes, data, originalItem, itemId, onSaveSuccess]);

  const onDelete = useCallback(() => {
    // A função handleFirestoreDelete já lida com a confirmação e a lógica de restauração de estoque.
    common.handleFirestoreDelete(
      db, 
      auth, 
      'plantios', 
      itemId,
      `Plantio de ${data.cultura || 'cultura desconhecida'}`,
      null,
      onSaveSuccess
    );
  }, [itemId, data.cultura, onSaveSuccess]);

  if (loading || loadingSementes) {
    return (
      <common.ModalFormLayout title="Carregando..." onCancel={onClose} saving={true}>
        <common.View style={common.styles.center}>
          <common.ActivityIndicator size="large" />
        </common.View>
      </common.ModalFormLayout>
    );
  }

  const sementeSel = sementes.find(s => s.id === data.estoqueItemId);
  const unidadeSemente = sementeSel ? sementeSel.unidade : '';

  return (
    <common.ModalFormLayout 
      title={itemId ? 'Editar Plantio' : 'Novo Plantio'} 
      onSubmit={onSave} 
      onCancel={onClose} 
      saving={saving} 
      onDelete={itemId ? onDelete : null}
    >
      <common.FormPicker 
        label="Cultura *" 
        items={CULTURAS_SUGERIDAS.map(c => ({label: c, value: c}))} 
        selectedValue={data.cultura} 
        onValueChange={v => setField('cultura', v)} 
        placeholder="Selecione a cultura" 
      />
      {errors.cultura && <common.Text style={common.styles.errorText}>{errors.cultura}</common.Text>}
      
      <common.FormInput 
        label="Talhão / Área *" 
        value={data.talhao} 
        onChangeText={v => setField('talhao', v)} 
        placeholder="Ex: Talhão 1" 
      />
      {errors.talhao && <common.Text style={common.styles.errorText}>{errors.talhao}</common.Text>}
      
      <common.FormPicker 
        label="Semente (do Stock)" 
        items={sementes.map(s => ({ label: `${s.nome} (Stock: ${s.quantidade} ${s.unidade})`, value: s.id }))} 
        selectedValue={data.estoqueItemId} 
        onValueChange={v => setField('estoqueItemId', v)} 
        placeholder="Selecione para dar baixa" 
      />
      
      <common.FormInput 
        label="Variedade" 
        value={sementeSel ? sementeSel.nome : data.variedade} 
        onChangeText={v => setField('variedade', v)} 
        editable={!data.estoqueItemId} 
      />
      
      {data.estoqueItemId && (
        <>
          <common.FormInput 
            label={`Qtd. Utilizada (${unidadeSemente}) *`} 
            value={data.quantidadeUtilizada} 
            onChangeText={v => setField('quantidadeUtilizada', v, 'numeric')} 
            keyboardType="numeric" 
          />
          {errors.quantidadeUtilizada && <common.Text style={common.styles.errorText}>{errors.quantidadeUtilizada}</common.Text>}
        </>
      )}
      
      <common.FormInput 
        label={`Área Plantada (${UNIDADES_MEDIDA.AREA})`} 
        value={data.areaPlantada} 
        onChangeText={v => setField('areaPlantada', v, 'numeric')} 
        keyboardType="numeric" 
      />
      
      <common.FormInput 
        label={`População (${UNIDADES_MEDIDA.POPULACAO})`} 
        value={data.populacaoSementes} 
        onChangeText={v => setField('populacaoSementes', v, 'numeric')} 
        keyboardType="numeric" 
      />
      
      <common.FormDateInput 
        label="Data do Plantio" 
        date={data.dataPlantio} 
        onDateChange={v => setField('dataPlantio', v)} 
      />
      
      <common.FormLocationInput 
        label="Localização" 
        initialLocation={data.location} 
        onLocationChange={loc => setField('location', loc)} 
      />
    </common.ModalFormLayout>
  );
};

/* ---------------------------------------------------------------------------
// 4 – LISTA: Plantio
// --------------------------------------------------------------------------- */
export const PlantioListaScreen = ({ navigation }) => {
  const [modal, setModal] = useState({ visible: false, itemId: null });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToCollection('plantios', (data) => {
      const sorted = data.sort((a, b) => (b.dataPlantio?.toDate() || 0) - (a.dataPlantio?.toDate() || 0));
      setItems(sorted);
      if (loading) setLoading(false);
    });
    return () => unsubscribe();
  }, [loading]);

  const handleSaveSuccess = () => setModal({ visible: false, itemId: null });
  const handleOpenModal = (itemId = null) => setModal({ visible: true, itemId });

  const renderItem = useCallback(({ item }) => (
    <common.TouchableOpacity style={common.styles.listItemContainer} onPress={() => handleOpenModal(item.id)}>
      <common.View style={common.styles.listItemIconContainer}>
        <common.FontAwesome name="leaf" size={28} color={common.theme.colors.primary} />
      </common.View>
      <common.View style={common.styles.listItemContent}>
        <common.Text style={common.styles.listItemTitle}>{item.cultura} - {item.variedade}</common.Text>
        <common.Text style={common.styles.listItemSubtitle}>
            {formatDate(item.dataPlantio)} • {item.talhao}
        </common.Text>
      </common.View>
      <common.Icon name="chevron-forward" size={24} color={common.theme.colors.alternate} />
    </common.TouchableOpacity>
  ), [handleOpenModal]);

  return (
    <>
      <common.ScreenLayout 
        navigation={navigation} 
        screenTitle="Plantios" 
        fabAction={() => handleOpenModal()} 
        loading={loading} 
        items={items} 
        renderItem={renderItem} 
        emptyMessage="Nenhum plantio registado." 
      />
      {modal.visible && (
        <AddOrEditPlantioModal 
          itemId={modal.itemId} 
          onClose={() => setModal({ visible: false, itemId: null })} 
          onSaveSuccess={handleSaveSuccess} 
        />
      )}
    </>
  );
};
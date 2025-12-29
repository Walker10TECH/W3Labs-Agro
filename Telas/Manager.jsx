/* ==========================================================================
  Manager.jsx – (Todos os componentes de ecrã + modais)
  W3Labs Industrial Standard Implementation
  ========================================================================== */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as common from './Common'; // Importação do UI Kit comum da aplicação
import {
    auth,
    db,
    addOrUpdateItem,
    deleteItem as deleteItemFromFirestore,
    subscribeToCollection,
} from '../firebaseConfig';
import { collection, doc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* ------------- UTILITÁRIOS & CONSTANTES ----------------------------- */
const CONTAINS_ONLY_NUMBERS_REGEX = /^\d+$/;

const agriculturalBrands = [
  { label: 'John Deere', value: 'John Deere' }, 
  { label: 'Case IH', value: 'Case IH' }, 
  { label: 'New Holland', value: 'New Holland' }, 
  { label: 'Massey Ferguson', value: 'Massey Ferguson' }, 
  { label: 'Valtra', value: 'Valtra' },  
  { label: 'Stara', value: 'Stara' }, 
  { label: 'Jacto', value: 'Jacto' }, 
  { label: 'Outra', value: 'Outra' },
];

/**
 * Exporta dados de uma coleção do Firestore para um ficheiro JSON e guarda no AsyncStorage.
 * @param {string} collectionName - O nome da coleção a ser exportada.
 * @param {Array} data - Os dados atuais da coleção.
 */
export const exportCollectionAsJSON = async (collectionName, data) => {
    if (!data || data.length === 0) {
        return common.Alert.alert("Info", `A coleção '${collectionName}' está vazia. Nada para exportar.`);
    }
    try {
        const jsonString = JSON.stringify(data, null, 2);
        const backupKey = `backup_${collectionName}_${new Date().toISOString()}.json`;
        await AsyncStorage.setItem(backupKey, jsonString);
        common.Alert.alert("Sucesso", `O backup de '${collectionName}' foi salvo localmente com segurança.`);
    } catch (error) {
        console.error("Erro ao exportar dados:", error);
        common.Alert.alert("Erro de Backup", "Não foi possível criar ou salvar o ficheiro de backup.");
    }
};

/* ------------- MODAIS DE FORMULÁRIO ------------------------------------ */

/* 1 – Propriedade ---------------------------------------------------- */
const AddOrEditPropriedadeModal = ({ itemId, onClose, onSaveSuccess }) => {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!itemId);
  const [data, setData] = useState({
    nome: '', 
    proprietario: '', 
    area: '', 
    areaMecanizada: '', 
    tipo: 'propria',
    valorArrendamento: '', 
    inicioContrato: new Date(), 
    fimContrato: new Date(),
    location: null, 
    observacoes: '', 
    documento: '',
    demarcacao: [], // NOVO: Para armazenar os pontos do polígono
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (itemId) {
      const fetchItem = async () => {
        setLoading(true);
        const userUid = auth.currentUser?.uid;
        if (!userUid) return;
        try {
          const docRef = doc(db, 'users', userUid, 'propriedades', itemId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const item = docSnap.data();
            setData({
              ...item,
              inicioContrato: item.inicioContrato?.toDate ? item.inicioContrato.toDate() : new Date(),
              fimContrato: item.fimContrato?.toDate ? item.fimContrato.toDate() : new Date(),
              location: item.latitude && item.longitude ? { latitude: item.latitude, longitude: item.longitude } : null,
              area: item.area ? String(item.area) : '',
              areaMecanizada: item.areaMecanizada ? String(item.areaMecanizada) : '',
              valorArrendamento: item.valorArrendamento ? String(item.valorArrendamento) : '',
              demarcacao: item.demarcacao || [], // NOVO: Carrega a demarcação
            });
          } else {
            common.Alert.alert("Erro", "Propriedade não encontrada.");
            onClose();
          }
        } catch (error) {
          console.error('Erro ao buscar propriedade:', error);
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
    if (!data.nome?.trim() || CONTAINS_ONLY_NUMBERS_REGEX.test(data.nome.trim())) newErrors.nome = 'Nome inválido.';
    if (!data.proprietario?.trim() || CONTAINS_ONLY_NUMBERS_REGEX.test(data.proprietario.trim())) newErrors.proprietario = 'Proprietário inválido.';
    if (data.tipo === 'arrendada' && data.fimContrato <= data.inicioContrato) newErrors.fimContrato = 'Data de fim deve ser posterior à de início.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [data]);

  const onSave = async () => {
    if (!validateForm()) return common.Alert.alert('Erro de Validação', 'Por favor, corrija os campos destacados.');
    
    const userUid = auth.currentUser?.uid;
    if (!userUid) {
        common.Alert.alert("Erro", "Utilizador não autenticado.");
        return;
    }

    setSaving(true);
    const id = itemId || doc(collection(db, 'users', userUid, 'propriedades')).id;
    const dataToSave = {
        ...data, 
        id,
        nome: data.nome.trim(),
        proprietario: data.proprietario.trim(),
        area: parseFloat(String(data.area).replace(',', '.')) || 0,
        areaMecanizada: parseFloat(String(data.areaMecanizada).replace(',', '.')) || 0,
        valorArrendamento: data.tipo === 'arrendada' ? (parseFloat(String(data.valorArrendamento).replace(',', '.')) || 0) : 0,
        latitude: data.location?.latitude || null,
        longitude: data.location?.longitude || null,
        demarcacao: data.demarcacao || [], // NOVO: Salva a demarcação
    };
    delete dataToSave.location;
    
    const result = await addOrUpdateItem('propriedades', dataToSave, !!itemId);
    if (result.success) onSaveSuccess();
    else common.Alert.alert("Erro", "Não foi possível salvar a propriedade.");
    setSaving(false);
  };

  const onDelete = useCallback(() => {
    if (common.handleFirestoreDelete) {
      common.handleFirestoreDelete(db, auth, 'propriedades', itemId, data.nome || 'Propriedade', null, onSaveSuccess);
    }
  }, [itemId, data.nome, onSaveSuccess]);

  if (loading) {
    return (
      <common.ModalFormLayout title="A carregar..." onCancel={onClose} saving={true}>
        <common.View style={common.styles.center}>
          <common.ActivityIndicator size="large" />
        </common.View>
      </common.ModalFormLayout>
    );
  }

  return (
    <common.ModalFormLayout 
      title={itemId ? 'Editar Propriedade' : 'Nova Propriedade'} 
      onSubmit={onSave} 
      onCancel={onClose} 
      saving={saving} 
      onDelete={itemId ? onDelete : null}
    >
      <common.ChoiceChips 
        options={[
          { label: 'Própria', value: 'propria' }, 
          { label: 'Arrendada', value: 'arrendada' }
        ]} 
        selectedValue={data.tipo} 
        onValueChange={v => setField('tipo', v)} 
      />
      <common.FormInput 
        label="Nome da Propriedade *" 
        value={data.nome} 
        onChangeText={v => setField('nome', v)} 
      />
      {errors.nome && <common.Text style={common.styles.errorText}>{errors.nome}</common.Text>}
      
      <common.FormInput 
        label="Proprietário *" 
        value={data.proprietario} 
        onChangeText={v => setField('proprietario', v)} 
      />
      {errors.proprietario && <common.Text style={common.styles.errorText}>{errors.proprietario}</common.Text>}
      
      <common.FormInput 
        label="Área Total (ha)" 
        value={data.area} 
        onChangeText={v => setField('area', v, 'numeric')} 
        keyboardType="numeric" 
      />
      <common.FormInput 
        label="Área Mecanizada (ha)" 
        value={data.areaMecanizada} 
        onChangeText={v => setField('areaMecanizada', v, 'numeric')} 
        keyboardType="numeric" 
      />
      
      {data.tipo === 'arrendada' && (
        <>
          <common.FormInput 
            label="Valor do Arrendamento (R$)" 
            value={data.valorArrendamento} 
            onChangeText={v => setField('valorArrendamento', v, 'numeric')} 
            keyboardType="numeric" 
          />
          <common.FormDateInput 
            label="Início do Contrato" 
            date={data.inicioContrato} 
            onDateChange={d => setField('inicioContrato', d)} 
          />
          <common.FormDateInput 
            label="Fim do Contrato" 
            date={data.fimContrato} 
            onDateChange={d => setField('fimContrato', d)} 
          />
          {errors.fimContrato && <common.Text style={common.styles.errorText}>{errors.fimContrato}</common.Text>}
        </>
      )}
      
      {common.FormLocationInput && (
        <common.FormLocationInput 
          label="Localização" 
          initialLocation={data.location}
          initialDemarcation={data.demarcacao}
          onLocationChange={loc => setField('location', loc)} 
          onDemarcationChange={poly => setField('demarcacao', poly)}
        />
      )}
      
      <common.FormInput 
        label="Observações" 
        value={data.observacoes} 
        onChangeText={v => setField('observacoes', v)} 
        multiline 
      />
    </common.ModalFormLayout>
  );
};

/* 2 – Unidade ------------------------------------------------------- */
const AddOrEditUnidadeModal = ({ itemId, onClose, onSaveSuccess }) => {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [data, setData] = useState({ 
      nome: '', 
      tipo: 'Cooperativa', 
      contato: '', 
      telefone: '', 
      email: '', 
      endereco: '', 
      cnpj: '', 
      observacoes: '' 
    });
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (itemId) {
            const fetchItem = async () => {
                setLoading(true);
                const userUid = auth.currentUser?.uid;
                if (!userUid) return;
                try {
                    const docRef = doc(db, 'users', userUid, 'unidades', itemId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                      setData(docSnap.data());
                    } else {
                        common.Alert.alert("Erro", "Unidade não encontrada.");
                        onClose();
                    }
                } catch (error) { 
                  console.error('Erro ao buscar unidade:', error); 
                } finally { 
                  setLoading(false); 
                }
            };
            fetchItem();
        }
    }, [itemId, onClose]);

    const setField = useCallback((field, value) => {
        setData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    }, [errors]);

    const validateForm = useCallback(() => {
        const newErrors = {};
        if (!data.nome?.trim() || CONTAINS_ONLY_NUMBERS_REGEX.test(data.nome.trim())) {
          newErrors.nome = 'Nome inválido.';
        }
        if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
          newErrors.email = 'Email inválido.';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [data]);

    const onSave = async () => {
        if (!validateForm()) return;
        const userUid = auth.currentUser?.uid;
        if (!userUid) {
            common.Alert.alert("Erro", "Utilizador não autenticado.");
            return;
        }
        setSaving(true);
        const id = itemId || doc(collection(db, 'users', userUid, 'unidades')).id;
        const result = await addOrUpdateItem('unidades', { ...data, id }, !!itemId);
        if (result.success) onSaveSuccess();
        else common.Alert.alert("Erro", "Não foi possível salvar a unidade.");
        setSaving(false);
    };

    const onDelete = useCallback(() => {
        if (common.handleFirestoreDelete) {
          common.handleFirestoreDelete(db, auth, 'unidades', itemId, data.nome || 'Unidade', null, onSaveSuccess);
        }
    }, [itemId, data.nome, onSaveSuccess]);

    if (loading) {
      return (
        <common.ModalFormLayout title="A carregar..." onCancel={onClose} saving={true}>
          <common.View style={common.styles.center}>
            <common.ActivityIndicator size="large" />
          </common.View>
        </common.ModalFormLayout>
      );
    }
    
    return (
        <common.ModalFormLayout 
          title={itemId ? 'Editar Unidade' : 'Nova Unidade'} 
          onSubmit={onSave} 
          onCancel={onClose} 
          saving={saving} 
          onDelete={itemId ? onDelete : null}
        >
            <common.FormInput 
              label="Nome da Unidade *" 
              value={data.nome} 
              onChangeText={v => setField('nome', v)} 
            />
            {errors.nome && <common.Text style={common.styles.errorText}>{errors.nome}</common.Text>}
            
            <common.ChoiceChips 
              options={[
                { label: 'Cooperativa', value: 'Cooperativa' }, 
                { label: 'Fornecedor', value: 'Fornecedor' }, 
                { label: 'Cliente', value: 'Cliente' }, 
                { label: 'Outro', value: 'Outro'}
              ]} 
              selectedValue={data.tipo} 
              onValueChange={v => setField('tipo', v)} 
            />
            
            <common.FormInput 
              label="Contato" 
              value={data.contato} 
              onChangeText={v => setField('contato', v)} 
            />
            <common.FormInput 
              label="Telefone" 
              value={data.telefone} 
              onChangeText={v => setField('telefone', v)} 
              keyboardType="phone-pad" 
            />
            <common.FormInput 
              label="Email" 
              value={data.email} 
              onChangeText={v => setField('email', v)} 
              keyboardType="email-address" 
              autoCapitalize="none" 
            />
            {errors.email && <common.Text style={common.styles.errorText}>{errors.email}</common.Text>}
        </common.ModalFormLayout>
    );
};

/* 3 – Equipamento --------------------------------------------------- (Adicione Nr Chassi, Nr Serie, Cor, Valor e Data de aquisicao)*/
const AddOrEditEquipamentoModal = ({ itemId, onClose, onSaveSuccess }) => {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [data, setData] = useState({ 
      marca: '', 
      modelo: '', 
      ano: '', 
      tipoEquipamento: 'Trator', 
      dataAquisicao: new Date(), 
      horasUso: '', 
      status: 'Ativo',
      nrChassi: '',
      nrSerie: '',
      cor: '',
      valor: '',
      combustaoAtiva: false,
      tipoCombustivel: 'Diesel S10',
    });
    const [errors, setErrors] = useState({});
    const [selectedBrand, setSelectedBrand] = useState('');

    useEffect(() => {
        if (itemId) {
            const fetchItem = async () => {
                setLoading(true);
                const userUid = auth.currentUser?.uid;
                if (!userUid) return;
                try {
                    const docRef = doc(db, 'users', userUid, 'inventario', itemId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const item = docSnap.data();
                        setData({ 
                          ...item, 
                          dataAquisicao: item.dataAquisicao?.toDate() || new Date(), 
                          horasUso: item.horasUso ? String(item.horasUso) : '',
                          valor: item.valor ? String(item.valor) : '',
                          combustaoAtiva: !!item.combustaoAtiva,
                          tipoCombustivel: item.tipoCombustivel || 'Diesel S10',
                        });
                        if(agriculturalBrands.some(b => b.value === item.marca)) {
                          setSelectedBrand(item.marca);
                        } else if(item.marca) {
                          setSelectedBrand('Outra');
                        }
                    } else {
                        common.Alert.alert("Erro", "Equipamento não encontrado.");
                        onClose();
                    }
                } catch (error) { 
                  console.error('Erro ao buscar equipamento:', error); 
                } finally { 
                  setLoading(false); 
                }
            };
            fetchItem();
        }
    }, [itemId, onClose]);

    const setField = useCallback((field, value) => {
        setData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    }, [errors]);
    
    const handleBrandChange = useCallback((value) => {
        setSelectedBrand(value);
        setField('marca', value === 'Outra' ? '' : value);
    }, [setField]);

    const validateForm = useCallback(() => {
        const newErrors = {};
        if (!data.marca?.trim()) newErrors.marca = 'Marca é obrigatória.';
        if (!data.modelo?.trim()) newErrors.modelo = 'Modelo é obrigatório.';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [data]);

    const onSave = async () => {
        if (!validateForm()) return;
        const userUid = auth.currentUser?.uid;
        if (!userUid) {
            common.Alert.alert("Erro", "Utilizador não autenticado.");
            return;
        }
        setSaving(true);
        const id = itemId || doc(collection(db, 'users', userUid, 'inventario')).id;
        const dataToSave = { 
          ...data, 
          id, 
          horasUso: parseFloat(String(data.horasUso).replace(',', '.')) || 0,
          valor: parseFloat(String(data.valor).replace(',', '.')) || 0,
        };
        const result = await addOrUpdateItem('inventario', dataToSave, !!itemId);
        if (result.success) onSaveSuccess();
        else common.Alert.alert("Erro", "Não foi possível salvar o equipamento.");
        setSaving(false);
    };

    const onDelete = useCallback(() => {
        if (common.handleFirestoreDelete) {
          common.handleFirestoreDelete(db, auth, 'inventario', itemId, `${data.marca} ${data.modelo}`, null, onSaveSuccess);
        }
    }, [itemId, data, onSaveSuccess]);
    
    if (loading) {
      return (
        <common.ModalFormLayout title="A carregar..." onCancel={onClose} saving={true}>
          <common.View style={common.styles.center}>
            <common.ActivityIndicator size="large" />
          </common.View>
        </common.ModalFormLayout>
      );
    }

    return (
        <common.ModalFormLayout 
          title={itemId ? 'Editar Equipamento' : 'Novo Equipamento'} 
          onSubmit={onSave} 
          onCancel={onClose} 
          saving={saving} 
          onDelete={itemId ? onDelete : null}
        >
            {common.FormPicker && (
              <common.FormPicker 
                label="Marca *" 
                items={agriculturalBrands} 
                selectedValue={selectedBrand} 
                onValueChange={handleBrandChange} 
              />
            )}
            
            {selectedBrand === 'Outra' && (
              <common.FormInput 
                label="Especifique a Marca *" 
                value={data.marca} 
                onChangeText={v => setField('marca', v)} 
              />
            )}
            {errors.marca && <common.Text style={common.styles.errorText}>{errors.marca}</common.Text>}
            
            <common.FormInput 
              label="Modelo *" 
              value={data.modelo} 
              onChangeText={v => setField('modelo', v)} 
            />
            {errors.modelo && <common.Text style={common.styles.errorText}>{errors.modelo}</common.Text>}
            
            <common.FormInput 
              label="Ano" 
              value={data.ano} 
              onChangeText={v => setField('ano', v)} 
              keyboardType="numeric" 
              maxLength={4} 
            />

            <common.FormInput 
              label="Numero Chassi" 
              value={data.nrChassi} 
              onChangeText={v => setField('nrChassi', v)} 
            />

            <common.FormInput 
              label="Numero Serie" 
              value={data.nrSerie} 
              onChangeText={v => setField('nrSerie', v)} 
            />

            <common.FormInput 
              label="Cor" 
              value={data.cor} 
              onChangeText={v => setField('cor', v)} 
            />

            <common.FormInput 
              label="Valor" 
              value={data.valor} 
              onChangeText={v => setField('valor', v)}
              keyboardType="numeric"
            />

            <common.FormDateInput 
              label="Data de Aquisição" 
              date={data.dataAquisicao} 
              onDateChange={d => setField('dataAquisicao', d)} 
            />

            <common.View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 10, borderWidth: 1, borderColor: '#ccc', borderRadius: 5, marginBottom: 15 }}>
                <common.Text style={{ fontSize: 16, color: '#333' }}>Status</common.Text>
                <common.View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <common.Text style={{ marginRight: 8, fontWeight: data.status !== 'Ativo' ? 'bold' : 'normal', color: data.status !== 'Ativo' ? '#c00' : '#666' }}>Desativado</common.Text>
                    <common.Switch
                        trackColor={{ false: "#d3d3d3", true: "#a5d6a7" }}
                        thumbColor={data.status === 'Ativo' ? "#4caf50" : "#f4f3f4"}
                        ios_backgroundColor="#3e3e3e"
                        onValueChange={() => setField('status', data.status === 'Ativo' ? 'Desativado' : 'Ativo')}
                        value={data.status === 'Ativo'}
                    />
                    <common.Text style={{ marginLeft: 8, fontWeight: data.status === 'Ativo' ? 'bold' : 'normal', color: data.status === 'Ativo' ? '#006400' : '#666' }}>Ativo</common.Text>
                </common.View>
            </common.View>

            <common.View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 10, borderWidth: 1, borderColor: '#ccc', borderRadius: 5, marginBottom: 15 }}>
                <common.Text style={{ fontSize: 16, color: '#333' }}>Combustão</common.Text>
                <common.View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <common.Text style={{ marginRight: 8, fontWeight: !data.combustaoAtiva ? 'bold' : 'normal', color: !data.combustaoAtiva ? '#c00' : '#666' }}>Desativado</common.Text>
                    <common.Switch
                        trackColor={{ false: "#d3d3d3", true: "#a5d6a7" }}
                        thumbColor={data.combustaoAtiva ? "#4caf50" : "#f4f3f4"}
                        ios_backgroundColor="#3e3e3e"
                        onValueChange={() => setField('combustaoAtiva', !data.combustaoAtiva)}
                        value={data.combustaoAtiva}
                    />
                    <common.Text style={{ marginLeft: 8, fontWeight: data.combustaoAtiva ? 'bold' : 'normal', color: data.combustaoAtiva ? '#006400' : '#666' }}>Ativo</common.Text>
                </common.View>
            </common.View>
            
            {data.combustaoAtiva && (
              <common.ChoiceChips 
                options={[
                  { label: 'Diesel S10', value: 'Diesel S10' }, 
                  { label: 'Diesel S500', value: 'Diesel S500' }, 
                  { label: 'Gasolina', value: 'Gasolina' }, 
                ]} 
                selectedValue={data.tipoCombustivel} 
                onValueChange={v => setField('tipoCombustivel', v)} 
              />
            )}
            
            <common.ChoiceChips 
              options={[
                { label: 'Trator', value: 'Trator' }, 
                { label: 'Colheitadeira', value: 'Colheitadeira' }, 
                { label: 'Pulverizador', value: 'Pulverizador' }, 
                { label: 'Implemento', value: 'Implemento' }, 
                { label: 'Outro', value: 'Outro' }
              ]} 
              selectedValue={data.tipoEquipamento} 
              onValueChange={v => setField('tipoEquipamento', v)} 
            />
        </common.ModalFormLayout>
    );
};

/* 4 – Stock Geral ------------------------------------------------- */
const AddOrEditEstoqueGeralModal = ({ itemId, onClose, onSaveSuccess }) => {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [data, setData] = useState({
        nome: '',
        tipo: 'Semente',
        quantidade: '',
        unidade: 'sc',
        fornecedor: '',
        local: '',
        obs: '',
    });
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (itemId) {
            const fetchItem = async () => {
                setLoading(true);
                const userUid = auth.currentUser?.uid;
                if (!userUid) return;
                try {
                    const docRef = doc(db, 'users', userUid, 'estoqueGeral', itemId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const item = docSnap.data();
                        const baseData = {
                            nome: '',
                            tipo: 'Semente',
                            quantidade: '',
                            unidade: 'sc',
                            fornecedor: '',
                            local: '',
                            obs: '',
                        };
                        setData({
                            ...baseData,
                            ...item,
                            quantidade: item.quantidade ? String(item.quantidade) : '',
                        });
                    } else {
                        common.Alert.alert("Erro", "Item não encontrado.");
                        onClose();
                    }
                } catch (error) {
                    console.error('Erro ao buscar item de stock:', error);
                } finally {
                    setLoading(false);
                }
            };
            fetchItem();
        }
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
        if (!data.nome?.trim()) newErrors.nome = 'Nome é obrigatório.';
        if (!data.quantidade || isNaN(parseFloat(String(data.quantidade).replace(',', '.')))) {
            newErrors.quantidade = 'Quantidade inválida.';
        }
        if (!data.unidade?.trim()) newErrors.unidade = 'Unidade é obrigatória.';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [data]);

    const onSave = async () => {
        if (!validateForm()) return;
        const userUid = auth.currentUser?.uid;
        if (!userUid) {
            common.Alert.alert("Erro", "Utilizador não autenticado.");
            return;
        }
        setSaving(true);
        const id = itemId || doc(collection(db, 'users', userUid, 'estoqueGeral')).id;
        const dataToSave = {
            ...data,
            id,
            quantidade: parseFloat(String(data.quantidade).replace(',', '.')) || 0
        };
        const result = await addOrUpdateItem('estoqueGeral', dataToSave, !!itemId);
        if (result.success) onSaveSuccess();
        else common.Alert.alert("Erro", "Não foi possível salvar o item.");
        setSaving(false);
    };

    const onDelete = useCallback(() => {
        if (common.handleFirestoreDelete) {
            common.handleFirestoreDelete(db, auth, 'estoqueGeral', itemId, data.nome || 'Item', null, onSaveSuccess);
        }
    }, [itemId, data.nome, onSaveSuccess]);

    if (loading) {
        return (
            <common.ModalFormLayout title="A carregar..." onCancel={onClose} saving={true}>
                <common.View style={common.styles.center}>
                    <common.ActivityIndicator size="large" />
                </common.View>
            </common.ModalFormLayout>
        );
    }

    return (
        <common.ModalFormLayout
            title={itemId ? 'Editar Item' : 'Novo Item no Stock'}
            onSubmit={onSave}
            onCancel={onClose}
            saving={saving}
            onDelete={itemId ? onDelete : null}
        >
            <common.FormInput
                label="Nome do Item *"
                value={data.nome}
                onChangeText={v => setField('nome', v)}
            />
            {errors.nome && <common.Text style={common.styles.errorText}>{errors.nome}</common.Text>}

            <common.ChoiceChips
                options={[
                    { label: 'Semente', value: 'Semente' },
                    { label: 'Fertilizante', value: 'Fertilizante' },
                    { label: 'Defensivo', value: 'Defensivo' },
                    { label: 'Peça', value: 'Peça' },
                    { label: 'Outro', value: 'Outro' }
                ]}
                selectedValue={data.tipo}
                onValueChange={v => setField('tipo', v)}
            />

            <common.FormInput
                label="Quantidade *"
                value={data.quantidade}
                onChangeText={v => setField('quantidade', v, 'numeric')}
                keyboardType="numeric"
            />
            {errors.quantidade && <common.Text style={common.styles.errorText}>{errors.quantidade}</common.Text>}

            <common.FormInput
                label="Unidade *"
                value={data.unidade}
                onChangeText={v => setField('unidade', v)}
                placeholder="Ex: sc, kg, L, un"
            />
            {errors.unidade && <common.Text style={common.styles.errorText}>{errors.unidade}</common.Text>}

            <common.FormInput
                label="Fornecedor"
                value={data.fornecedor}
                onChangeText={v => setField('fornecedor', v)}
                placeholder="Ex: Agrofel, 3Tentos, Lojas Renner"
            />

            <common.FormInput
                label="Local de Armazenamento"
                value={data.local}
                onChangeText={v => setField('local', v)}
                placeholder="Ex: Galpão 1, Silo 3"
            />

            <common.FormInput
                label="Observações"
                value={data.obs}
                onChangeText={v => setField('obs', v)}
                multiline
            />
        </common.ModalFormLayout>
    );
};

/* ------------- ECRÃS DE LISTA ---------------------------------------- */

/* 1 – PropriedadesListaScreen -------------------------------------- */
export const PropriedadesListaScreen = ({ navigation }) => {
  const [modal, setModal] = useState({ visible: false, itemId: null });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToCollection('propriedades', (data) => {
        setItems(data.sort((a,b) => a.nome.localeCompare(b.nome)));
        if(loading) setLoading(false);
    });
    return () => unsubscribe();
  }, [loading]);

  const handleSaveSuccess = () => setModal({ visible: false, itemId: null });
  const handleOpenModal = (itemId = null) => setModal({ visible: true, itemId });

  const renderItem = useCallback(({ item }) => (
    <common.TouchableOpacity 
      style={common.styles.listItemContainer} 
      onPress={() => handleOpenModal(item.id)}
    >
      <common.View style={common.styles.listItemIconContainer}>
        <common.MaterialCommunityIcons 
          name="barn" 
          size={28} 
          color={common.theme.colors.primary} 
        />
      </common.View>
      <common.View style={common.styles.listItemContent}>
        <common.Text style={common.styles.listItemTitle}>{item.nome}</common.Text>
        <common.Text style={common.styles.listItemSubtitle}>
          {item.proprietario} • {item.tipo === 'propria' ? 'Própria' : 'Arrendada'}
        </common.Text>
      </common.View>
      <common.Icon 
        name="chevron-forward" 
        size={24} 
        color={common.theme.colors.alternate} 
      />
    </common.TouchableOpacity>
  ), []);

  return (
    <>
      <common.ScreenLayout 
        navigation={navigation} 
        screenTitle="Propriedades" 
        fabAction={() => handleOpenModal()} 
        loading={loading} 
        items={items} 
        renderItem={renderItem} 
        emptyMessage="Nenhuma propriedade registada." 
      />
      {modal.visible && (
        <AddOrEditPropriedadeModal 
          itemId={modal.itemId} 
          onClose={() => setModal({visible: false, itemId: null})} 
          onSaveSuccess={handleSaveSuccess} 
        />
      )}
    </>
  );
};

/* 2 – UnidadesListaScreen ------------------------------------------- */
export const UnidadesListaScreen = ({ navigation }) => {
  const [modal, setModal] = useState({ visible: false, itemId: null });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToCollection('unidades', (data) => {
        setItems(data.sort((a,b) => a.nome.localeCompare(b.nome)));
        if(loading) setLoading(false);
    });
    return () => unsubscribe();
  }, [loading]);

  const handleSaveSuccess = () => setModal({ visible: false, itemId: null });
  const handleOpenModal = (itemId = null) => setModal({ visible: true, itemId });

  const renderItem = useCallback(({ item }) => (
    <common.TouchableOpacity 
      style={common.styles.listItemContainer} 
      onPress={() => handleOpenModal(item.id)}
    >
        <common.View style={common.styles.listItemIconContainer}>
            <common.MaterialCommunityIcons 
              name="office-building" 
              size={28} 
              color={common.theme.colors.primary} 
            />
        </common.View>
        <common.View style={common.styles.listItemContent}>
            <common.Text style={common.styles.listItemTitle}>{item.nome}</common.Text>
            <common.Text style={common.styles.listItemSubtitle}>{item.tipo}</common.Text>
        </common.View>
        <common.Icon 
          name="chevron-forward" 
          size={24} 
          color={common.theme.colors.alternate} 
        />
    </common.TouchableOpacity>
  ), []);

  return (
    <>
      <common.ScreenLayout 
        navigation={navigation} 
        screenTitle="Unidades e Empresas" 
        fabAction={() => handleOpenModal()} 
        loading={loading} 
        items={items} 
        renderItem={renderItem} 
        emptyMessage="Nenhuma unidade registada." 
      />
      {modal.visible && (
        <AddOrEditUnidadeModal 
          itemId={modal.itemId} 
          onClose={() => setModal({visible: false, itemId: null})} 
          onSaveSuccess={handleSaveSuccess} 
        />
      )}
    </>
  );
};

/* 3 – InventarioListaScreen --------------------------------------- */
export const InventarioListaScreen = ({ navigation }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToCollection('inventario', (data) => {
        setItems(data.sort((a,b) => a.marca.localeCompare(b.marca)));
        if(loading) setLoading(false);
    });
    return () => unsubscribe();
  }, [loading]);
  
  const handleOpenModal = (itemId = null) => navigation.navigate('AddOrEditEquipamento', { itemId });

  const renderItem = useCallback(({ item }) => (
    <common.TouchableOpacity 
      style={common.styles.listItemContainer} 
      onPress={() => handleOpenModal(item.id)}
    >
        <common.View style={common.styles.listItemIconContainer}>
            <common.MaterialCommunityIcons 
              name="tractor-variant" 
              size={28} 
              color={common.theme.colors.primary} 
            />
        </common.View>
        <common.View style={common.styles.listItemContent}>
            <common.Text style={common.styles.listItemTitle}>
              {item.marca} {item.modelo}
            </common.Text>
            <common.Text style={common.styles.listItemSubtitle}>
              {item.tipoEquipamento} • {item.ano}
            </common.Text>
        </common.View>
        <common.Icon 
          name="chevron-forward" 
          size={24} 
          color={common.theme.colors.alternate} 
        />
    </common.TouchableOpacity>
  ), []);
  
  return (
    <common.ScreenLayout 
        navigation={navigation} 
        screenTitle="Inventário" 
        fabAction={() => handleOpenModal()} 
        loading={loading} 
        items={items} 
        renderItem={renderItem} 
        emptyMessage="Nenhum equipamento registado." 
    />
  );
};

/* 4 – EstoqueGeralListaScreen ------------------------------------- */
export const EstoqueGeralListaScreen = ({ navigation }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToCollection('estoqueGeral', (data) => {
        setItems(data.sort((a,b) => a.nome.localeCompare(b.nome)));
        if(loading) setLoading(false);
    });
    return () => unsubscribe();
  }, [loading]);

  const handleOpenModal = (itemId = null) => navigation.navigate('AddOrEditEstoqueGeral', { itemId });
  
  const renderItem = useCallback(({ item }) => (
    <common.TouchableOpacity 
      style={common.styles.listItemContainer} 
      onPress={() => handleOpenModal(item.id)}
    >
        <common.View style={common.styles.listItemIconContainer}>
            <common.MaterialCommunityIcons 
              name="archive-outline" 
              size={28} 
              color={common.theme.colors.primary} 
            />
        </common.View>
        <common.View style={common.styles.listItemContent}>
            <common.Text style={common.styles.listItemTitle}>{item.nome}</common.Text>
            <common.Text style={common.styles.listItemSubtitle}>
              {item.quantidade} {item.unidade} • {item.tipo}
            </common.Text>
        </common.View>
        <common.Icon 
          name="chevron-forward" 
          size={24} 
          color={common.theme.colors.alternate} 
        />
    </common.TouchableOpacity>
  ), []);

  return (
    <common.ScreenLayout 
        navigation={navigation} 
        screenTitle="Stock Geral" 
        fabAction={() => handleOpenModal()} 
        loading={loading} 
        items={items} 
        renderItem={renderItem} 
        emptyMessage="Nenhum item em stock." 
    />
  );
};

/* ------------- ECRÃS DE WRAPPER PARA MODAIS ----------------------- */

export const AddOrEditEquipamentoScreen = ({ route, navigation }) => {
  const { itemId } = route.params || {};
  return (
    <AddOrEditEquipamentoModal 
      itemId={itemId} 
      onClose={() => navigation.goBack()} 
      onSaveSuccess={() => navigation.goBack()} 
    />
  );
};

export const AddOrEditEstoqueGeralScreen = ({ route, navigation }) => {
  const { itemId } = route.params || {};
  return (
    <AddOrEditEstoqueGeralModal 
      itemId={itemId} 
      onClose={() => navigation.goBack()} 
      onSaveSuccess={() => navigation.goBack()} 
    />
  );
};

/* ------------- PÁGINA PRINCIPAL DO GERENCIADOR --------------------- */

export const ManagerPage = ({ navigation }) => {
  console.log("ManagerPage rendered");
  const managerOptions = useMemo(() => [
    { 
      title: 'Propriedades', 
      icon: 'barn', 
      route: 'PropriedadesLista', 
      description: 'Gerir propriedades rurais' 
    },
    { 
      title: 'Unidades / Empresas', 
      icon: 'office-building', 
      route: 'UnidadesLista', 
      description: 'Cooperativas, fornecedores e clientes' 
    },
    { 
      title: 'Inventário de Equipamentos', 
      icon: 'tractor-variant', 
      route: 'InventarioLista', 
      description: 'Tratores, implementos e máquinas' 
    },
    { 
      title: 'Stock Geral', 
      icon: 'archive-outline', 
      route: 'EstoqueGeralLista', 
      description: 'Sementes, fertilizantes e defensivos' 
    }
  ], []);

  const renderManagerButton = useCallback((option) => (
    <common.TouchableOpacity 
      key={option.route} 
      style={common.styles.managerButton} 
      onPress={() => navigation.navigate(option.route)}
    >
      <common.MaterialCommunityIcons 
        name={option.icon} 
        size={24} 
        color="white" 
      />
      <common.View style={{ flex: 1, marginLeft: 16 }}>
        <common.Text style={common.styles.managerButtonText}>
          {option.title}
        </common.Text>
        <common.Text style={[common.styles.managerButtonText, { fontSize: 14, opacity: 0.9 }]}>
          {option.description}
        </common.Text>
      </common.View>
      <common.Icon 
        name="chevron-forward" 
        size={20} 
        color="white" 
      />
    </common.TouchableOpacity>
  ), [navigation]);

  return (
    <common.View style={common.styles.containerLight}>
      <common.CustomHeader title="Gerenciador" navigation={navigation} />
      <common.ScrollView contentContainerStyle={common.styles.managerPageContainer}>
        {managerOptions.map(renderManagerButton)}
      </common.ScrollView>
    </common.View>
  );
};
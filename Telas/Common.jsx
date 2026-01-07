import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions
} from 'react-native';

/* Navigation */
import { useFocusEffect } from '@react-navigation/native';

/* Community Components */
import { Picker } from '@react-native-picker/picker';
import { Calendar } from 'react-native-calendars';
import MarkdownDisplay from 'react-native-markdown-display';
import { WebView } from 'react-native-webview';

/* Expo & APIs */
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore';

/* Icons */
import { FontAwesome, Ionicons as Icon, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

/* =====================================================
   THEME AND CONTEXT
   ===================================================== */
export const theme = {
  colors: {
    primary: '#67a421',
    secondary: '#4caf50',
    alternate: '#8bc34a',
    background: '#f5f5f5',
    lightGray: '#eceff1',
    textBlack: '#212121',
    textWhite: '#ffffff',
    secondaryText: '#757575',
    error: '#d32f2f',
    textRed: '#d32f2f',
  },
  fonts: {
    ultraLight: 'NokiaPureHeadline-UltraLight',
    light: 'NokiaPureHeadline-Light',
    regular: 'NokiaPureHeadline-Regular',
    medium: 'NokiaPureHeadline-Regular', // Usando Regular como peso médio
    bold: 'NokiaPureHeadline-Bold',
    extraBold: 'NokiaPureHeadline-ExtraBold',
  },
};

export const AppContext = createContext();
export const useAppContext = () => useContext(AppContext);

/* =====================================================
   RESPONSIVE DESIGN
   ===================================================== */
export const useResponsive = () => {
  const { width, height } = useWindowDimensions();

  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1280;
  const isDesktop = width >= 1280;

  const isPortrait = height >= width;
  const isLandscape = width > height;

  return {
    width,
    height,
    isMobile,
    isTablet,
    isDesktop,
    isPortrait,
    isLandscape,
    isWeb: Platform.OS === 'web',
  };
};

const scale = (size) => size * 0.70;
const verticalScale = (size) => size * 0.70;
const moderateScale = (size) => size * 0.70;

export { scale, verticalScale, moderateScale };

/* =====================================================
   CUSTOM HOOKS (FIRESTORE)
   ===================================================== */

/**
 * Hook para buscar uma coleção do Firestore em tempo real.
 * @param {string} collectionName - O nome da coleção.
 * @param {object} options - Opções de filtro e ordenação.
 * @param {array} options.filters - Array de objetos de filtro, ex: [{ field: 'categoria', operator: '==', value: 'fruta' }]
 * @param {string} options.sortBy - Campo para ordenação.
 * @param {string} options.order - Direção da ordenação ('asc' ou 'desc').
 */
export const useFirestoreCollection = (collectionName, { filters = [], sortBy = 'criadoEm', order = 'desc' } = {}) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, firestore } = useAppContext(); // Assume que 'firestore' está no contexto

  useEffect(() => {
    if (!user || !firestore || !collectionName) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Constrói a referência para a subcoleção do usuário
    const collectionRef = collection(firestore, 'users', user.uid, collectionName);
    
    // Constrói a query com filtros e ordenação
    const queryConstraints = [];
    filters.forEach(f => {
      // O Firestore exige que o primeiro orderBy seja no mesmo campo do filtro de desigualdade, se houver.
      // Para simplicidade, estamos usando apenas '==' aqui.
      queryConstraints.push(where(f.field, f.operator || '==', f.value));
    });
    queryConstraints.push(orderBy(sortBy, order));

    const q = query(collectionRef, ...queryConstraints);

    // 'onSnapshot' ouve as alterações em tempo real
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setItems(data);
      setLoading(false);
    }, (error) => {
      console.error(`Erro ao ouvir a coleção ${collectionName}:`, error);
      Alert.alert("Erro de Conexão", `Não foi possível carregar os dados de '${collectionName}'.`);
      setLoading(false);
    });

    // Função de limpeza: cancela a inscrição quando o componente é desmontado
    return () => unsubscribe();
  }, [user, firestore, collectionName, sortBy, order, JSON.stringify(filters)]); // Re-executa se os filtros mudarem

  return { items, loading };
};

/**
 * Hook para gerenciar a localização do usuário.
 * @param {object} [options] - Opções para o hook.
 * @param {boolean} [options.autoRequest=false] - Se deve solicitar a localização automaticamente na montagem.
 * @returns {object} - { location, address, loading, error, requestLocation, clearLocation }
 */
export const useLocation = ({ autoRequest = false } = {}) => {
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const clearLocation = useCallback(() => {
    setLocation(null);
    setAddress(null);
    setError(null);
  }, []);

  const requestLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('A permissão para acessar a localização foi negada.');
      }

      const locationData = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = locationData.coords;
      setLocation({ latitude, longitude });

      const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (GOOGLE_MAPS_API_KEY) {
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}&language=pt-BR`;
        const response = await fetch(geocodeUrl);
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          const firstResult = data.results[0];
          const newAddress = {
            city: firstResult.address_components.find(c => c.types.includes('administrative_area_level_2'))?.long_name || '',
            street: firstResult.address_components.find(c => c.types.includes('route'))?.long_name || '',
            region: firstResult.address_components.find(c => c.types.includes('administrative_area_level_1'))?.short_name || '',
            country: firstResult.address_components.find(c => c.types.includes('country'))?.long_name || '',
            postalCode: firstResult.address_components.find(c => c.types.includes('postal_code'))?.long_name || '',
            name: firstResult.formatted_address || '',
          };
          setAddress(newAddress); // CORRIGIDO: Usar a variável correta
        } else {
          console.warn('Google Geocoding: Nenhum resultado encontrado.');
          setAddress(null); // Limpa o endereço se não encontrar
        }
      } else {
        console.warn('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY não definida. A geocodificação reversa foi ignorada.');
        setAddress(null);
      }
    } catch (e) {
      console.error("Erro ao obter localização:", e);
      setError(e.message || 'Não foi possível obter a localização.');
      Alert.alert('Erro de Localização', e.message || 'Não foi possível obter a localização atual.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoRequest) {
      requestLocation();
    }
  }, [autoRequest, requestLocation]);

  return { location, address, loading, error, requestLocation, clearLocation };
};


/* =====================================================
   UTILITY FUNCTIONS (FIRESTORE)
   ===================================================== */
export const toBase64 = (uint8Array) => {
  let binary = '';
  const len = uint8Array.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
};

/**
 * Salva (cria ou atualiza) um documento no Firestore.
 * @param {object} firestore - A instância do Firestore.
 * @param {string} collectionName - O nome da coleção.
 * @param {object} data - Os dados a serem salvos. Deve incluir um 'id' para atualização.
 * @param {object} navigation - Objeto de navegação para retornar.
 * @param {object} auth - A instância do Firebase Auth.
 */
export const handleFirestoreSave = async (firestore, collectionName, data, navigation, auth) => {
  const userUid = auth.currentUser?.uid;
  if (!userUid) {
    Alert.alert("Erro de Autenticação", "Usuário não está logado. Por favor, faça login novamente.");
    throw new Error("Usuário não autenticado para salvar.");
  }

  try {
    const dataToSave = { 
      ...data, 
      userUid,
      // Usa o timestamp do servidor para consistência
      atualizadoEm: serverTimestamp() 
    };

    if (data.id) {
      // Atualiza um documento existente
      const docRef = doc(firestore, 'users', userUid, collectionName, data.id);
      await updateDoc(docRef, dataToSave);
    } else {
      // Cria um novo documento
      // Remove o 'id' nulo, pois o Firestore gerará um
      delete dataToSave.id;
      dataToSave.criadoEm = serverTimestamp(); // Adiciona data de criação
      
      const collectionRef = collection(firestore, 'users', userUid, collectionName);
      await addDoc(collectionRef, dataToSave);
    }

    Alert.alert(
      "Sucesso!", 
      "Registro salvo com sucesso.",
      [{ text: 'OK', onPress: () => { if (navigation?.canGoBack()) navigation.goBack(); } }]
    );

    return dataToSave;
  } catch (error) {
    console.error(`Erro detalhado ao salvar no Firestore (coleção ${collectionName}):`, error);
    Alert.alert(
      "Erro ao Salvar",
      `Não foi possível completar a operação. Detalhe: ${error.message}`
    );
    throw error;
  }
};

const onDeleteFirestore = async (firestore, auth, tableName, docId, itemName, navigation, onComplete) => {
    const userUid = auth.currentUser?.uid;
    if (!userUid) {
        Alert.alert("Erro", "Usuário não autenticado.");
        return;
    }

    try {
        await runTransaction(firestore, async (transaction) => {
            const docRef = doc(firestore, 'users', userUid, tableName, docId);
            const itemToDeleteDoc = await transaction.get(docRef);

            if (!itemToDeleteDoc.exists()) {
                throw new Error("O item a ser excluído não foi encontrado.");
            }

            const itemToDelete = itemToDeleteDoc.data();

            // Lógica para restaurar estoque
            if (tableName === 'plantios' || tableName === 'pulverizacoes') {
                if (itemToDelete?.estoqueItemId && itemToDelete?.quantidadeUtilizada > 0) {
                    const stockItemRef = doc(firestore, 'users', userUid, 'estoqueGeral', itemToDelete.estoqueItemId);
                    const stockDoc = await transaction.get(stockItemRef);

                    if (stockDoc.exists()) {
                        const stockItem = stockDoc.data();
                        const currentStock = Number(stockItem.quantidade) || 0;
                        const quantityToRestore = Number(itemToDelete.quantidadeUtilizada) || 0;
                        const newStock = currentStock + quantityToRestore;
                        
                        transaction.update(stockItemRef, { 
                            quantidade: newStock,
                            atualizadoEm: serverTimestamp() 
                        });
                    } else {
                        console.warn(`Item de estoque com ID ${itemToDelete.estoqueItemId} não encontrado para restauração.`);
                    }
                }
            } else if (tableName === 'revisoes') {
                const pecas = itemToDelete.pecasUtilizadas || [];
                for (const peca of pecas) {
                    if (peca?.estoqueItemId && peca?.quantidade > 0) {
                        const stockItemRef = doc(firestore, 'users', userUid, 'estoqueGeral', peca.estoqueItemId);
                        const stockDoc = await transaction.get(stockItemRef);

                        if (stockDoc.exists()) {
                            const stockItem = stockDoc.data();
                            const currentStock = Number(stockItem.quantidade) || 0;
                            const quantityToRestore = Number(peca.quantidade) || 0;
                            const newStock = currentStock + quantityToRestore;
                            
                            transaction.update(stockItemRef, { 
                                quantidade: newStock,
                                atualizadoEm: serverTimestamp() 
                            });
                        } else {
                            console.warn(`Item de estoque com ID ${peca.estoqueItemId} não encontrado para restauração.`);
                        }
                    }
                }
            }
            
            // Deleta o documento principal
            transaction.delete(docRef);
        });

        if (Platform.OS === 'web') {
            window.alert(`"${itemName}" foi excluído com sucesso.`);
        } else {
            Alert.alert("Sucesso", `"${itemName}" foi excluído com sucesso.`);
        }

        if (onComplete) onComplete();
        if (navigation?.canGoBack()) navigation.goBack();

    } catch (e) {
        console.error(`Erro ao deletar item ${docId} de ${tableName}:`, e);
        if (Platform.OS === 'web') {
            window.alert(`Não foi possível excluir "${itemName}". Detalhe: ${e.message}`);
        } else {
            Alert.alert("Erro ao Excluir", `Não foi possível excluir o registro. Detalhe: ${e.message}`);
        }
    }
};

export const handleFirestoreDelete = (firestore, auth, tableName, docId, itemName, navigation, onComplete) => {
  const confirmAction = (onConfirm) => {
    Alert.alert(
      `Confirmar Exclusão`,
      `Você realmente quer excluir "${itemName}"? Esta ação não pode ser desfeita.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Excluir", style: "destructive", onPress: onConfirm },
      ],
      { cancelable: true }
    );
  };

  const performDelete = () => onDeleteFirestore(firestore, auth, tableName, docId, itemName, navigation, onComplete);

  if (Platform.OS === 'web') {
    const confirmDelete = window.confirm(
      `Confirmar Exclusão\nVocê realmente quer excluir "${itemName}"? Esta ação não pode ser desfeita.`
    );
    if (confirmDelete) {
      performDelete();
    }
  } else {
    confirmAction(performDelete);
  }
};

/**
 * Busca a localização (coordenadas) e o endereço correspondente (geocodificação reversa).
 * @returns {Promise<{location: {latitude: number, longitude: number}|null, address: object|null, error: string|null}>}
 */
export const fetchLocationAndAddress = async () => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { location: null, address: null, error: 'Permissão de localização negada.' };
    }

    const locationData = await Location.getLastKnownPositionAsync({}) || await Location.getCurrentPositionAsync({ timeout: 10000 });
    if (!locationData) {
      return { location: null, address: null, error: 'Não foi possível obter a localização.' };
    }

    const { latitude, longitude } = locationData.coords;
    const location = { latitude, longitude };

    const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!GOOGLE_MAPS_API_KEY) {
      console.warn('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY não definida. Geocodificação reversa ignorada.');
      return { location, address: null, error: 'Chave de API do Google Maps não configurada.' };
    }

    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}&language=pt-BR`;
    const response = await fetch(geocodeUrl);
    const data = await response.json();

    if (data.status === 'OK' && data.results?.length > 0) {
      const firstResult = data.results[0];
      const address = {
        city: firstResult.address_components.find(c => c.types.includes('administrative_area_level_2'))?.long_name || '',
        street: firstResult.address_components.find(c => c.types.includes('route'))?.long_name || '',
        region: firstResult.address_components.find(c => c.types.includes('administrative_area_level_1'))?.short_name || '',
        country: firstResult.address_components.find(c => c.types.includes('country'))?.long_name || '',
        postalCode: firstResult.address_components.find(c => c.types.includes('postal_code'))?.long_name || '',
        name: firstResult.formatted_address || '',
      };
      return { location, address, error: null };
    } else {
      console.warn(`Google Geocoding API: Status: ${data.status}. Mensagem: ${data.error_message || 'Nenhuma.'}`);
      return { location, address: null, error: `Erro de geocodificação: ${data.status}` };
    }
  } catch (error) {
    console.error('Erro geral ao buscar localização e endereço:', error);
    return { location: null, address: null, error: 'Falha ao buscar localização.' };
  }
};

/**
 * Busca os dados de clima para uma determinada localização.
 * @param {{latitude: number, longitude: number}} location - As coordenadas.
 * @returns {Promise<{clima: object|null, error: string|null}>}
 */
export const fetchWeather = async (location) => {
  const WEATHER_API_KEY = process.env.EXPO_PUBLIC_WEATHER_API_KEY;
  if (!WEATHER_API_KEY) {
    return { clima: null, error: 'Chave de API do clima ausente.' };
  }
  if (!location?.latitude || !location?.longitude) {
    return { clima: null, error: 'Coordenadas inválidas para buscar clima.' };
  }

  try {
    const { latitude, longitude } = location;
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${WEATHER_API_KEY}&units=metric&lang=pt_br`;
    const response = await fetch(weatherUrl);

    if (!response.ok) {
      throw new Error(`Erro na API de clima: ${response.status}`);
    }

    const data = await response.json();
    const clima = {
      temperatura: Math.round(data.main?.temp || 0).toString(),
      umidade: (data.main?.humidity || 0).toString(),
      velvento: Math.round((data.wind?.speed || 0) * 3.6).toString(),
      desctemperatura: data.weather?.[0]?.description || 'Dados indisponíveis',
      precipitacao: (data.rain?.['1h'] || 0).toString(),
    };
    return { clima, error: null };

  } catch (error) {
    console.error('Erro ao buscar clima:', error);
    return { clima: null, error: 'Falha ao buscar dados de clima.' };
  }
};

/**
 * Atualiza o estoque de um item usando uma transação do Firestore.
 * @param {object} firestore - A instância do Firestore.
 * @param {string} userUid - O UID do usuário.
 * @param {string} itemId - O ID do item de estoque.
 * @param {number} quantity - A quantidade para adicionar ou subtrair.
 * @param {string} operation - 'add' ou 'deduct'.
 */
export const handleStockUpdate = async (firestore, userUid, itemId, quantity, operation) => {
  if (!itemId || !quantity || quantity <= 0 || !userUid) return;

  const stockItemRef = doc(firestore, 'users', userUid, 'estoqueGeral', itemId);

  try {
    await runTransaction(firestore, async (transaction) => {
      const stockDoc = await transaction.get(stockItemRef);

      if (!stockDoc.exists()) {
        throw new Error(`Item de estoque com ID ${itemId} não encontrado.`);
      }

      const stockItem = stockDoc.data();
      const currentStock = Number(stockItem.quantidade) || 0;
      let newStock;

      if (operation === 'add') {
        newStock = currentStock + quantity;
      } else { // deduct
        newStock = currentStock - quantity;
        if (newStock < 0) {
          Alert.alert(
            "Estoque Negativo",
            `Atenção: o estoque de "${stockItem.nome}" ficará negativo (${newStock} ${stockItem.unidade}).`,
            [{ text: "OK" }]
          );
        }
      }

      transaction.update(stockItemRef, { 
        quantidade: newStock, 
        atualizadoEm: serverTimestamp() 
      });
    });

    console.log(`Estoque do item ${itemId} (${operation}) atualizado.`);
  } catch (error) {
    console.error("Erro ao atualizar estoque:", error);
    Alert.alert(
      "Erro de Estoque",
      `Não foi possível atualizar o estoque do item. Detalhe: ${error.message}`
    );
    throw error;
  }
};

/* =====================================================
   UI COMPONENTS
   ===================================================== */
export const Header = ({ title, navigation }) => (
  <SafeAreaView style={styles.headerSafeArea}>
    <View style={styles.headerContainer}>
      {navigation?.canGoBack() ? (
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIcon}>
          <Icon name="arrow-back" size={28} color={theme.colors.textWhite} />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerIcon} />
      )}
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={styles.headerIcon} />
    </View>
  </SafeAreaView>
);

export const ModalFormLayout = ({
  title,
  children,
  onSubmit,
  onCancel,
  submitText = "Salvar",
  onDelete,
  saving
}) => {
  const { isMobile } = useResponsive();

  return (
    <Modal transparent={true} animationType="fade" visible={true} onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.modalFormPage}>
          <ScrollView
            contentContainerStyle={styles.modalFormScroll}
            showsVerticalScrollIndicator={true}
            persistentScrollbar={true}
          >
            <View style={[styles.modalFormCard, { width: isMobile ? '95%' : '80%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{title}</Text>
                <TouchableOpacity onPress={onCancel} style={styles.modalCloseButton}>
                  <Icon name="close" size={24} color={theme.colors.secondaryText} />
                </TouchableOpacity>
              </View>

              {children}

              <View
                style={[
                  styles.formButtonContainer,
                  isMobile && styles.formButtonContainerMobile
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.formButton,
                    styles.submitButton,
                    { flex: onDelete ? 2 : 1 },
                    saving && { opacity: 0.7 }
                  ]}
                  onPress={onSubmit}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={theme.colors.textWhite} />
                  ) : (
                    <Text style={styles.buttonText}>{submitText}</Text>
                  )}
                </TouchableOpacity>

                {onDelete && (
                  <TouchableOpacity
                    style={[
                      styles.deleteIconButton,
                      { marginLeft: isMobile ? 0 : 10 },
                      saving && { opacity: 0.7 }
                    ]}
                    onPress={onDelete}
                    disabled={saving}
                  >
                    <MaterialIcons name="delete" size={28} color={theme.colors.textRed} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export const FormInput = ({ label, containerStyle, ...props }) => (
  <View style={containerStyle}>
    {label && <Text style={styles.formLabel}>{label}</Text>}
    <TextInput
      style={[
        styles.formInput,
        props.editable === false && styles.disabledInput
      ]}
      placeholderTextColor={theme.colors.secondaryText}
      {...props}
    />
  </View>
);

export const FormPicker = ({ label, items, selectedValue, onValueChange, placeholder }) => (
  <View>
    {label && <Text style={styles.formLabel}>{label}</Text>}
    <View style={styles.pickerContainer}>
      <Picker
        selectedValue={selectedValue}
        onValueChange={onValueChange}
        prompt={placeholder}
        style={{ color: theme.colors.textBlack }}
        itemStyle={{ color: theme.colors.textBlack, fontSize: 16 }}
      >
        <Picker.Item 
          label={placeholder || "Selecione..."} 
          value="" 
          color={theme.colors.secondaryText} 
        />
        {items.map(item => (
          <Picker.Item 
            key={item.value} 
            label={item.label} 
            value={item.value} 
          />
        ))}
      </Picker>
    </View>
  </View>
);

export const FormDateInput = ({ label, date, onDateChange, containerStyle }) => {
  const [showPicker, setShowPicker] = useState(false);

  // Tratamento para datas do Firestore (objetos Timestamp) ou strings ISO
  const formatDateForPicker = (dateInput) => {
    let d;
    if (dateInput?.toDate) { // Se for um Timestamp do Firestore
      d = dateInput.toDate();
    } else if (dateInput) { // Se for string ou Date
      d = new Date(dateInput);
    } else { // Se for nulo/undefined
      d = new Date();
    }
  
    if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const markedDate = useMemo(() => formatDateForPicker(date), [date]);

  const handleDayPress = day => {
    onDateChange(new Date(day.timestamp + (new Date().getTimezoneOffset() * 60000)));
    setShowPicker(false);
  };
  
  const displayDate = useMemo(() => {
    if (!date) return 'Selecione a data';
    let d = date?.toDate ? date.toDate() : new Date(date);
    return isNaN(d.getTime()) ? 'Data inválida' : d.toLocaleDateString('pt-BR');
  }, [date]);

  return (
    <View style={containerStyle}>
      {label && <Text style={styles.formLabel}>{label}</Text>}
      <View style={styles.dateInputRow}>
        <TouchableOpacity onPress={() => setShowPicker(true)} style={styles.dateIconButton}>
          <FontAwesome name="calendar" size={24} color={theme.colors.textWhite} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowPicker(true)} style={styles.dateDisplayBox}>
          <Text style={styles.dateDisplayText}>{displayDate}</Text>
        </TouchableOpacity>
      </View>

      <Modal
        transparent={true}
        animationType="fade"
        visible={showPicker}
        onRequestClose={() => setShowPicker(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowPicker(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.calendarModalContainer}>
              <Calendar
                current={markedDate}
                onDayPress={handleDayPress}
                markedDates={{
                  [markedDate]: {
                    selected: true,
                    selectedColor: theme.colors.primary,
                    disableTouchEvent: true
                  }
                }}
                theme={{
                  arrowColor: theme.colors.primary,
                  todayTextColor: theme.colors.primary,
                  dotColor: theme.colors.primary,
                }}
                monthFormat={'MMMM yyyy'}
                firstDay={1}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

export const FormLocationInput = ({
  label,
  onLocationChange,
  initialLocation,
  containerStyle
}) => {  
  // AGORA USA O CONTEXTO GLOBAL
  const { location: contextLocation, loading: locationLoading, requestLocation, clearLocation } = useAppContext();
  const MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    // Se houver uma localização inicial, usa ela.
    // O hook `useLocation` não lida com `initialLocation` diretamente, então controlamos aqui.
    // Usa a localização do contexto se disponível
    const displayLocation = contextLocation || initialLocation;
    // Comunica a mudança para o formulário pai
    if (onLocationChange) {
      onLocationChange(displayLocation);
    }
  }, [contextLocation, initialLocation, onLocationChange]);

  // A localização a ser exibida é a do contexto ou a inicial passada como prop
  const displayLocation = contextLocation || initialLocation;

  return (
    <View style={containerStyle}>
      {label && <Text style={styles.formLabel}>{label}</Text>}
      {displayLocation && (
        <View style={styles.locationPreviewContainer}>
          {Platform.OS === 'web' ? (
            <iframe
              style={{ width: '100%', height: 250, border: 0, borderRadius: 10 }}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.google.com/maps/embed/v1/place?key=${MAPS_API_KEY}&q=${displayLocation.latitude},${displayLocation.longitude}&zoom=15`}
            />
          ) : (
            <View style={styles.mapPreview}>
              <WebView
                source={{
                  uri: `https://www.google.com/maps/embed/v1/place?key=${MAPS_API_KEY}&q=${displayLocation.latitude},${displayLocation.longitude}&zoom=15`
                }}
                style={{ flex: 1 }}
              />
            </View>
          )}
          <Text style={styles.locationCoordsText}>
            Lat: {displayLocation.latitude.toFixed(5)}, Lon: {displayLocation.longitude.toFixed(5)}
          </Text>
        </View>
      )}

      <View style={styles.locationButtonsContainer}>
        <TouchableOpacity
          style={[styles.locationButton, { flex: 1 }]}
          onPress={requestLocation} // Função do contexto
          disabled={locationLoading}
        >
          {locationLoading ? (
            <ActivityIndicator color={theme.colors.textWhite} />
          ) : (
            <Icon name="location-outline" size={20} color={theme.colors.textWhite} />
          )}
          <Text style={styles.locationButtonText}>
            {displayLocation ? "Atualizar Localização" : "Obter Localização Atual"}
          </Text>
        </TouchableOpacity>
        {displayLocation && (
          <TouchableOpacity
            style={[
              styles.locationButton,
              { backgroundColor: theme.colors.error, marginLeft: 10 }
            ]}
            onPress={clearLocation}
          >
            <Icon name="trash-outline" size={20} color={theme.colors.textWhite} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export const ChoiceChips = ({ options, selectedValue, onValueChange, containerStyle }) => (
  <View style={[styles.chipContainer, containerStyle]}>
    {options.map(option => (
      <TouchableOpacity
        key={option.value}
        style={[
          styles.chip,
          selectedValue === option.value && styles.chipActive
        ]}
        onPress={() => onValueChange(option.value)}
      >
        <Text style={[
          styles.chipText,
          selectedValue === option.value && styles.chipTextActive
        ]}>
          {option.label}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
);

export const ScreenLayout = ({
  navigation,
  screenTitle,
  fabAction,
  loading,
  items,
  renderItem,
  emptyMessage,
  ListHeaderComponent = null
}) => {
  return (
    <View style={styles.container}>
      <Header title={screenTitle} navigation={navigation} />
      <View style={[styles.contentWrapper, { maxWidth: 800 }]}>
        {loading ? (
          <ActivityIndicator
            style={{ marginTop: 50 }}
            size="large"
            color={theme.colors.primary}
          />
        ) : (
          <FlatList
            data={items}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            ListHeaderComponent={ListHeaderComponent}
            contentContainerStyle={
              Platform.OS === 'web'
                ? { flexGrow: 1, paddingBottom: 120, paddingRight: 8 }
                : { flexGrow: 1, paddingBottom: 120 }
            }
            showsVerticalScrollIndicator={Platform.OS === 'web' ? true : false}
            style={
              Platform.OS === 'web' && {
                scrollbarColor: `${theme.colors.secondaryText} ${theme.colors.lightGray}`,
                scrollbarWidth: 'thin'
              }
            }
            ListEmptyComponent={() => (
              <Text style={styles.emptyListText}>
                {emptyMessage || 'Nenhum item encontrado.'}
              </Text>
            )}
          />
        )}
      </View>

      {fabAction && (
        <TouchableOpacity style={styles.fab} onPress={fabAction}>
          <Icon name="add" size={32} color="white" />
        </TouchableOpacity>
      )}
    </View>
  );
};

export const FAB = ({ onPress }) => (
  <TouchableOpacity style={styles.fab} onPress={onPress}>
    <Icon name="add" size={32} color="white" />
  </TouchableOpacity>
);

export const StatBox = ({ label, value, color }) => (
  <View style={styles.statBox}>
    <Text style={[styles.statBoxLabel, { color: color || theme.colors.secondaryText }]}>
      {label}
    </Text>
    <Text style={[styles.statBoxValue, { color: color || theme.colors.textBlack }]}>
      {value}
    </Text>
  </View>
);

export const DataChart = ({ data, title, xAxisKey, yAxisKey }) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Lida com datas que podem ser Timestamps do Firestore
    const sortedData = [...data].sort((a, b) => {
        const dateA = a[xAxisKey]?.toDate ? a[xAxisKey].toDate() : new Date(a[xAxisKey]);
        const dateB = b[xAxisKey]?.toDate ? b[xAxisKey].toDate() : new Date(b[xAxisKey]);
        return dateA - dateB;
    });

    const rows = sortedData.map(item => {
      const date = item[xAxisKey]?.toDate ? item[xAxisKey].toDate() : new Date(item[xAxisKey]);
      const formattedDate = `${date.getDate()}/${date.getMonth() + 1}`;
      return [formattedDate, item[yAxisKey] || 0];
    });
    return [['Data', title], ...rows];
  }, [data, title, xAxisKey, yAxisKey]);

  const chartHTML = `
  <html>
      <head>
          <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
          <script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
          <script type="text/javascript">
              google.charts.load('current', {'packages':['corechart']});
              google.charts.setOnLoadCallback(drawChart);
              function drawChart() {
                  var data = google.visualization.arrayToDataTable(${JSON.stringify(chartData)});
                  var options = {
                      title: '${title}',
                      curveType: 'function',
                      legend: { position: 'none' },
                      backgroundColor: 'transparent',
                      chartArea: { width: '85%', height: '70%' },
                      hAxis: { textStyle: { color: '#757575', fontSize: 10 } },
                      vAxis: { textStyle: { color: '#757575' }, gridlines: { color: '#f5f5f5' } },
                      colors: ['${theme.colors.primary}'],
                  };
                  var chart = new google.visualization.LineChart(document.getElementById('curve_chart'));
                  chart.draw(data, options);
              }
          </script>
          <style>
              body, html { margin: 0; padding: 0; background-color: transparent; }
              #curve_chart { width: 100%; height: 100%; }
          </style>
      </head>
      <body>
          <div id="curve_chart"></div>
      </body>
  </html>
  `;

  if (!data || data.length < 2) {
    return null;
  }

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.formSectionTitle}>{title}</Text>
      <View style={{ height: 200, width: '100%' }}>
        <WebView
          originWhitelist={['*']}
          source={{ html: chartHTML }}
          style={{ backgroundColor: 'transparent' }}
          scrollEnabled={false}
        />
      </View>
    </View>
  );
};

// Alias para Header
export const CustomHeader = Header;


/* =====================================================
   STYLES
   ===================================================== */

const isWeb = Platform.OS === 'web';

export const styles = StyleSheet.create({
  // Containers and General Layout
  container: {
    flex: 1,
    backgroundColor: '#f7fbf4', // softer background
    paddingHorizontal: 0,
  },
  containerLight: {
    flex: 1,
    backgroundColor: theme.colors.textWhite,
  },
  contentWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
    paddingHorizontal: scale(26),
    paddingTop: verticalScale(20),
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7fbf4',
  },

  // Floating Action Button
  fab: {
    position: 'absolute',
    right: scale(22),
    bottom: verticalScale(120),
    backgroundColor: theme.colors.primary,
    width: moderateScale(64),
    height: moderateScale(64),
    borderRadius: moderateScale(32), 
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(103,164,33,0.22)',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 1,
        shadowRadius: 24,
      },
      android: { elevation: 14 },
      web: { boxShadow: '0px 10px 24px rgba(103,164,33,0.22)' }
    }),
    zIndex: 910,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.22)',
  },

  // State Texts (Empty, Error)
  emptyListText: {
    textAlign: 'center',
    marginTop: verticalScale(56),
    fontSize: moderateScale(18),
    color: theme.colors.secondaryText,
    fontFamily: theme.fonts.medium,
    opacity: 0.9,
    lineHeight: moderateScale(26),
    letterSpacing: 0.3,
  },
  errorText: {
    color: theme.colors.error,
    textAlign: 'center',
    padding: moderateScale(24),
    fontSize: moderateScale(16),
    fontFamily: theme.fonts.medium,
    lineHeight: moderateScale(24),
    letterSpacing: 0.2,
  },

  // Header
  headerSafeArea: {
    backgroundColor: theme.colors.primary,
    borderBottomLeftRadius: moderateScale(32),
    borderBottomRightRadius: moderateScale(32),
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(103,164,33,0.28)',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 1,
        shadowRadius: 32,
      },
      android: { elevation: 20 },
      web: { boxShadow: '0px 12px 32px rgba(103,164,33,0.28)' }
    }),
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: Platform.OS === 'ios' ? verticalScale(64) : verticalScale(72),
    paddingHorizontal: scale(20),
    paddingTop: Platform.OS === 'ios' ? verticalScale(8) : 0,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: moderateScale(22),
    color: theme.colors.textWhite,
    fontFamily: theme.fonts.bold,
    letterSpacing: 0.4,
    textShadowColor: 'rgba(0,0,0,0.08)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  headerIcon: {
    width: moderateScale(48),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: moderateScale(24),
  },

  // Authentication
  backgroundImage: {
    flex: 1,
    width: 'auto',
    height: 'auto',
    opacity: 0.7, // Ajusta a opacidade da imagem de fundo
  },
  authContent: {
    flex: 1,
    width: '100%',
    maxWidth: 420,
    paddingHorizontal: scale(28),
    alignSelf: 'center',
    justifyContent: 'center',
  },
  logo: {
    height: moderateScale(96),
    width: moderateScale(96),
    alignSelf: 'center',
    marginBottom: verticalScale(20),
    borderRadius: moderateScale(22),
    backgroundColor: theme.colors.lightGray,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0,0,0,0.08)',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 1,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
      web: { boxShadow: '0px 6px 12px rgba(0,0,0,0.08)' }
    }),
  },
  appName: {
    fontSize: moderateScale(34),
    color: theme.colors.textWhite,
    textAlign: 'center',
    marginVertical: verticalScale(18),
    fontFamily: theme.fonts.bold,
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
  },
  authTitle: {
    fontSize: moderateScale(24),
    fontFamily: theme.fonts.bold,
    color: theme.colors.textWhite,
    marginBottom: verticalScale(20),
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  authInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(240, 240, 240, 1)',
    borderRadius: moderateScale(14),
    marginBottom: verticalScale(18),
    paddingHorizontal: scale(18),
    gap: scale(12),
    borderWidth: 1,
    borderColor: 'rgba(20, 170, 0, 1)',
  },
  authInput: {
    flex: 1,
    height: verticalScale(56),
    color: theme.colors.textBlack,
    fontSize: moderateScale(16),
    fontFamily: theme.fonts.regular,    letterSpacing: 0.2,
  },
  authButton: {
    backgroundColor: theme.colors.secondary,
    paddingVertical: verticalScale(16),
    borderRadius: moderateScale(14),
    alignItems: 'center',
    marginVertical: verticalScale(12),
    ...Platform.select({
      ios: {
        shadowColor: `${theme.colors.secondary}2E`,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 1,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
      web: { boxShadow: `0px 6px 16px ${theme.colors.secondary}2E` }
    }),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  buttonText: {
    color: theme.colors.textWhite,
    fontSize: moderateScale(17),
    fontFamily: theme.fonts.bold,
    letterSpacing: 0.5,
  },
  authFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: verticalScale(18),
    gap: scale(12),
  },
  authFooterButton: {
    padding: moderateScale(12),
    borderBottomWidth: 2,
    borderColor: 'transparent',
    borderRadius: moderateScale(8),
  },
  authFooterButtonActive: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  authFooterText: {
    color: theme.colors.textWhite,
    fontSize: moderateScale(15),
    fontFamily: theme.fonts.medium,
  },
  authFooterTextActive: {
    color: theme.colors.textWhite,
    fontFamily: theme.fonts.bold,
  },

  // Home Screen
  homeHeaderGradient: {
    width: '100%',
    borderBottomLeftRadius: moderateScale(36),
    borderBottomRightRadius: moderateScale(36),
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(103, 164, 33, 0.25)',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 1,
        shadowRadius: 36,
      },
      android: { elevation: 20 },
      web: { boxShadow: '0px 14px 36px rgba(103, 164, 33, 0.25)' }
    }),
    alignItems: 'center',
  },
  homeHeaderContent: {
    paddingTop: Platform.OS === 'ios' ? verticalScale(64) : verticalScale(36),
    paddingBottom: verticalScale(30),
    paddingHorizontal: scale(28),
    alignItems: 'center',
    width: '100%',
    maxWidth: 1000,
  },
  homeTopActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
    marginBottom: verticalScale(20),
    alignItems: 'center',
    gap: scale(12),
  },
  welcomeText: {
    fontSize: moderateScale(22),
    fontFamily: theme.fonts.bold,
    color: theme.colors.textWhite,
    flex: 1,
    letterSpacing: 0.4,
  },
  headerWeatherContainer: {
    alignItems: 'center',
    width: '100%',
  },
  headerWeatherTemp: {
    fontSize: moderateScale(56),
    fontFamily: theme.fonts.bold,
    color: theme.colors.textWhite,
    letterSpacing: -1.2,
  },
  headerWeatherDesc: {
    fontSize: moderateScale(20),
    fontFamily: theme.fonts.medium,
    color: theme.colors.textWhite,
    textTransform: 'capitalize',
    marginBottom: verticalScale(16),
  },
  headerWeatherDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '90%',
    maxWidth: 420,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: moderateScale(18),
    paddingVertical: verticalScale(12),
  },
  headerWeatherDetailItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: scale(8),
  },
  headerWeatherDetailText: {
    color: theme.colors.textWhite,
    fontFamily: theme.fonts.medium,
    fontSize: moderateScale(14),
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: verticalScale(120),
  },

  // Scrollbar styles for web
  webScrollbar: {
    width: scale(10),
    backgroundColor: theme.colors.lightGray,
    borderRadius: moderateScale(5),
  },
  webScrollbarThumb: {
    backgroundColor: theme.colors.secondaryText,
    borderRadius: moderateScale(5),
  },
  gridContainer: {
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(20),
  },
  homeGridItem: {
    flex: 1,
    margin: moderateScale(12),
    height: verticalScale(130),
    backgroundColor: theme.colors.alternate,
    borderRadius: moderateScale(24),
    justifyContent: 'center',
    alignItems: 'center',
    padding: moderateScale(14),
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(103,164,33,0.12)',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 1,
        shadowRadius: 20,
      },
      android: { elevation: 10 },
      web: { boxShadow: '0px 8px 20px rgba(103,164,33,0.12)' }
    }),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  homeGridIcon: {
    marginBottom: verticalScale(12),
  },
  homeGridText: {
    color: theme.colors.textWhite,
    fontFamily: theme.fonts.bold,
    fontSize: moderateScale(14),
    textAlign: 'center',
    letterSpacing: 0.2,
  },

  // List Items
  listItemContainer: {
    backgroundColor: theme.colors.textWhite,
    borderRadius: moderateScale(18),
    padding: moderateScale(18),
    marginVertical: verticalScale(10),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(103, 164, 33, 0.09)',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 1,
        shadowRadius: 16,
      },
      android: { elevation: 7 },
      web: { boxShadow: '0px 6px 16px rgba(103, 164, 33, 0.09)' }
    }),
    borderWidth: 1,
    borderColor: 'rgba(236, 239, 241, 0.85)',
    gap: scale(16),
  },
  listItemIconContainer: {
    width: moderateScale(50),
    height: moderateScale(50),
    borderRadius: moderateScale(12),
    backgroundColor: 'rgba(103,164,33,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(103, 164, 33, 0.12)',
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: moderateScale(17),
    fontFamily: theme.fonts.bold,
    color: theme.colors.textBlack,
    letterSpacing: 0.25,
    lineHeight: moderateScale(22),
  },
  listItemSubtitle: {
    fontSize: moderateScale(14),
    color: theme.colors.secondaryText,
    marginTop: verticalScale(6),
    fontFamily: theme.fonts.regular,
    opacity: 0.9,
  },

  // Manager Page
  managerPageContainer: {
    padding: moderateScale(26),
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
  },
  managerButton: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: theme.colors.primary,
    paddingVertical: verticalScale(18),
    paddingHorizontal: scale(28),
    borderRadius: moderateScale(18),
    marginBottom: verticalScale(20), 
    alignItems: 'center',
    flexDirection: 'row',
    gap: scale(14),
    ...Platform.select({
      ios: {
        shadowColor: `${theme.colors.primary}2E`,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 1,
        shadowRadius: 18,
      },
      android: { elevation: 6 },
      web: { boxShadow: `0px 8px 18px ${theme.colors.primary}2E` }
    }),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  managerButtonText: {
    color: theme.colors.textWhite,
    fontSize: moderateScale(16),
    fontFamily: theme.fonts.medium,
    letterSpacing: 0.25,
  },

  // Forms and Modals
  formScrollView: {
    flex: 1,
  },
  formContainer: {
    padding: moderateScale(26),
    width: '100%',
    maxWidth: 820,
    alignSelf: 'center',
  },
  formButtonContainer: {
    flexDirection: 'row',
    padding: moderateScale(22),
    backgroundColor: theme.colors.textWhite,
    borderTopWidth: 1,
    borderTopColor: 'rgba(236,239,241,0.9)',
    alignItems: 'center',
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
    gap: scale(12),
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalFormPage: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalFormScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: verticalScale(28),
  },
  modalFormCard: {
    width: '92%',
    maxWidth: 680,
    backgroundColor: '#ffffff',
    borderRadius: moderateScale(22), 
    padding: moderateScale(28),
    ...(Platform.OS === 'web' 
        ? { boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }
        : { 
            elevation: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.15,
            shadowRadius: 24,
          }),
    borderWidth: 1,
    borderColor: 'rgba(236, 239, 241, 0.9)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(20),
  },
  modalTitle: {
    fontSize: moderateScale(22),
    fontFamily: theme.fonts.bold,
    color: theme.colors.textBlack,
    letterSpacing: 0.3,
  },
  modalCloseButton: {
    padding: moderateScale(10),
    borderRadius: moderateScale(14),
    backgroundColor: theme.colors.lightGray,
  },
  formLabel: {
    fontSize: moderateScale(16),
    fontFamily: theme.fonts.medium,
    color: theme.colors.secondaryText,
    marginBottom: verticalScale(10),
    letterSpacing: 0.25,
  },
  formInput: {
    backgroundColor: theme.colors.lightGray,
    borderRadius: moderateScale(14),
    paddingHorizontal: scale(18),
    paddingVertical: verticalScale(14),
    fontSize: moderateScale(16),
    color: theme.colors.textBlack,
    marginBottom: verticalScale(16),
    fontFamily: theme.fonts.regular,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  disabledInput: {
    backgroundColor: 'rgba(240,240,240,0.9)',
    color: theme.colors.secondaryText,
    opacity: 0.9,
  },
  pickerContainer: {
    backgroundColor: theme.colors.lightGray,
    borderRadius: moderateScale(14),
    marginBottom: verticalScale(16),
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 195, 74, 0.14)',
  },
  dateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(16),
    gap: 0,
    borderRadius: moderateScale(14), 
    overflow: 'hidden',
  },
  dateIconButton: {
    backgroundColor: theme.colors.primary,
    padding: moderateScale(14),
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateDisplayBox: {
    flex: 1,
    backgroundColor: theme.colors.lightGray,
    padding: moderateScale(14),
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderLeftWidth: 0,
  },
  dateDisplayText: {
    fontSize: moderateScale(16),
    color: theme.colors.textBlack,
    fontFamily: theme.fonts.medium,
  },
  calendarModalContainer: {
    backgroundColor: theme.colors.textWhite,
    borderRadius: moderateScale(14),
    padding: moderateScale(14),
    width: '90%',
    maxWidth: 420,
    ...Platform.select({
      ios: {
        shadowColor: `${theme.colors.primary}1F`,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 12,
      },
      android: { elevation: 5 },
      web: { boxShadow: `0px 0px 12px ${theme.colors.primary}1F` }
    }),
    borderWidth: 1,
    borderColor: 'rgba(236, 239, 241, 0.9)',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: verticalScale(16),
    gap: moderateScale(12),
  },
  chip: {
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(18),
    borderRadius: moderateScale(18),
    backgroundColor: theme.colors.lightGray,
    marginBottom: verticalScale(8),
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
    ...(Platform.OS === 'android' && { elevation: 4 }),
  },
  chipText: {
    color: theme.colors.secondaryText,
    fontFamily: theme.fonts.medium,
    fontSize: moderateScale(14),
  },
  chipTextActive: {
    color: theme.colors.textWhite,
    fontFamily: theme.fonts.bold,
  },
  formRow: {
    flexDirection: 'row',
    gap: scale(18),
  },
  formRowMobile: {
    flexDirection: 'column',
    gap: 0,
  },
  formRowItem: {
    flex: 1,
  },
  formRowItemFirst: {},
  formRowItemMobile: {
    width: '100%',
    marginBottom: verticalScale(16),
  },
  formButtonContainerMobile: {
    flexDirection: 'column-reverse',
    gap: verticalScale(12),
  },
  formButton: {
    paddingVertical: verticalScale(14),
    borderRadius: moderateScale(14),
    alignItems: 'center', 
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  deleteIconButton: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: moderateScale(12),
    borderRadius: moderateScale(12),
    backgroundColor: theme.colors.lightGray,
    borderWidth: 1,
    borderColor: 'rgba(211,47,47,0.12)',
  },
  formSectionTitle: {
    fontSize: moderateScale(20),
    fontFamily: theme.fonts.bold,
    color: theme.colors.primary,
    marginTop: verticalScale(22),
    marginBottom: verticalScale(12),
    paddingBottom: verticalScale(8),
    letterSpacing: 0.3,
  },
  selectFileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.secondary,
    padding: moderateScale(14),
    borderRadius: moderateScale(12),
    marginBottom: verticalScale(12),
    gap: scale(12),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },

  // Specific Lists (Manuals, Diesel)
  manualsListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.textWhite,
    padding: moderateScale(18),
    borderRadius: moderateScale(16),
    marginBottom: verticalScale(14),
    gap: scale(14),
    borderWidth: 1,
    borderColor: 'rgba(236,239,241,0.9)',
  },
  manualsListImage: {
    width: moderateScale(52),
    height: moderateScale(52),
    resizeMode: 'contain',
    borderRadius: moderateScale(12),
    backgroundColor: 'rgba(236,239,241,0.9)',
  },
  manualsListText: {
    flex: 1,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textBlack,
    fontSize: moderateScale(16),
    textAlign: 'left',
  },
  dieselSummaryCard: {
    backgroundColor: theme.colors.textWhite,
    borderRadius: moderateScale(18),
    padding: moderateScale(22),
    marginVertical: verticalScale(16),
    borderWidth: 1,
    borderColor: 'rgba(236,239,241,0.9)',
  },
  dieselSummaryTitle: {
    fontFamily: theme.fonts.medium,
    color: theme.colors.secondaryText,
    fontSize: moderateScale(15),
    textAlign: 'center',
    marginBottom: verticalScale(10),
  },
  dieselSummaryValueContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: verticalScale(10),
  },
  dieselSummaryValue: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.primary,
    fontSize: moderateScale(42),
  },
  dieselListHeader: {
    flexDirection: 'row',
    paddingBottom: verticalScale(12),
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(236,239,241,0.9)',
    marginBottom: verticalScale(10),
  },
  dieselListHeaderText: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.secondaryText,
    fontSize: moderateScale(14),
  },
  dieselListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(14),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(236,239,241,0.85)',
  },
  dieselListItemText: {
    fontFamily: theme.fonts.regular,
    color: theme.colors.textBlack,
    fontSize: moderateScale(14),
  },

  // Chatbot
  chatbotFab: {
    position: 'absolute', // Mantém a posição flutuante
    bottom: verticalScale(40), // Distância inferior
    right: scale(24), // Distância direita
    width: moderateScale(64), // Largura
    height: moderateScale(64), // Altura
    borderRadius: moderateScale(32), // Totalmente redondo
    backgroundColor: theme.colors.primary,
    justifyContent: 'center', // Centraliza o ícone verticalmente
    alignItems: 'center', // Centraliza o ícone horizontalmente
    ...(Platform.OS === 'android' && { elevation: 12 }), // Sombra para Android
    zIndex: 1000, // Garante que fique acima de outros elementos
    ...Platform.select({
      ios: {
        shadowColor: `${theme.colors.primary}40`,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 1,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
      web: { boxShadow: `0px 8px 16px ${theme.colors.primary}40` }
    }),
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },

  chatbotHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatbotBackdrop: {
    position: 'absolute',
    ...StyleSheet.absoluteFillObject, // Ocupa toda a tela
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Fundo escurecido
    zIndex: 998, // Fica abaixo do popup do chatbot
  },

  chatbotPopupContainer: {
    position: 'absolute',
    bottom: Platform.select({ web: verticalScale(110), default: verticalScale(110) }), // Posição acima do FAB,
    right: Platform.select({ web: scale(28), default: '3%' }), // Posição à direita,
    width: Platform.select({ web: scale(450), default: '94%' }), // Largura,
    maxWidth: 450, // Largura máxima
    height: '75%', // Altura
    maxHeight: 650, // Altura máxima
    backgroundColor: theme.colors.textWhite, // Fundo branco opaco
    borderRadius: moderateScale(24),
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0, 0, 0, 0.15)',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 1,
        shadowRadius: 20,
      },
      android: {
        elevation: 16
      },
      web: { boxShadow: '0px 10px 20px rgba(0, 0, 0, 0.15)' }
    }),
    zIndex: 999, // Acima do backdrop
    overflow: 'hidden',
  },

  chatbotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: moderateScale(16),
    borderBottomWidth: 1,
    borderColor: theme.colors.lightGray,
    backgroundColor: theme.colors.primary,
  },

  headerButton: {
    padding: moderateScale(10),
    borderRadius: moderateScale(14),
    backgroundColor: theme.colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },

  chatbotTitle: {
    fontSize: moderateScale(20),
    fontFamily: theme.fonts.bold,
    color: theme.colors.textWhite,
  },

  chatContainer: {
    flex: 1, // O padding será aplicado no contentContainer da FlatList
    backgroundColor: theme.colors.background,
  },

  messageBubble: {
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(16),
    borderRadius: moderateScale(18),
    marginBottom: verticalScale(12),
    maxWidth: '85%',
  },

  userMessage: {
    backgroundColor: theme.colors.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: moderateScale(6), // Canto pontiagudo
  },

  botMessage: {
    backgroundColor: theme.colors.textWhite,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: moderateScale(6),
    borderWidth: 1,
    borderColor: theme.colors.lightGray,
  },

  userMessageText: {
    color: theme.colors.textWhite,
    fontFamily: theme.fonts.regular,
    fontSize: moderateScale(16),
    lineHeight: moderateScale(22),
  },

  botMessageText: {
    color: theme.colors.primary, // Texto verde para o bot
    fontFamily: theme.fonts.regular,
    fontSize: moderateScale(16),
    lineHeight: moderateScale(22),
  },

  systemMessage: {
    alignSelf: 'center',
    backgroundColor: theme.colors.lightGray,
    borderWidth: 0,
    borderRadius: moderateScale(10),
  },
  systemMessageText: {
    fontFamily: theme.fonts.medium,
    fontSize: moderateScale(13),
    color: theme.colors.secondaryText,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  typingBubble: { // NEW
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.lightGray,
    borderRadius: moderateScale(18),
    borderBottomLeftRadius: moderateScale(6),
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(16),
    marginBottom: verticalScale(12),
    maxWidth: '25%',
    flexDirection: 'row',
  },

  copyButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: moderateScale(6),
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: moderateScale(10),
  },

  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(8),
    borderTopWidth: 1,
    borderColor: theme.colors.lightGray,
    backgroundColor: theme.colors.textWhite,
    gap: scale(10),
    flexWrap: 'wrap', // Permite que a preview quebre a linha
  },

  chatInput: {
    flex: 1,
    backgroundColor: theme.colors.lightGray,
    borderRadius: moderateScale(28),
    paddingHorizontal: scale(18),
    paddingVertical: Platform.OS === 'ios' ? verticalScale(14) : verticalScale(10),
    borderWidth: 0,
    fontFamily: theme.fonts.regular,
    fontSize: moderateScale(16),
    color: theme.colors.textBlack,
  },

  chatIconButton: {
    padding: moderateScale(8),
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  chatbotSendButton: {
    backgroundColor: theme.colors.primary,
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(24),
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 0.1,
  },

  attachmentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.lightGray,
    borderRadius: moderateScale(12),
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(12),
    marginHorizontal: scale(8),
    marginBottom: verticalScale(4),
    gap: scale(8),
    width: '95%', // Ocupa quase toda a largura
  },

  attachmentPreviewText: {
    flex: 1,
    fontFamily: theme.fonts.regular,
    fontSize: moderateScale(14),
    color: theme.colors.textBlack,
  },

  attachedFileBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(12),
    borderRadius: moderateScale(12),
    marginBottom: verticalScale(8),
    gap: scale(8),
  },

  attachedFileText: {
    flex: 1,
    fontFamily: theme.fonts.medium,
    fontSize: moderateScale(14),
    color: theme.colors.secondaryText,
  },

  chatbotWelcomeContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: moderateScale(28),
    backgroundColor: theme.colors.textWhite,
  },

  chatbotWelcomeTitle: {
    fontSize: moderateScale(28),
    fontFamily: theme.fonts.bold,
    color: theme.colors.textBlack,
    textAlign: 'center',
    marginBottom: verticalScale(8),
  },

  chatbotWelcomeSubtitle: {
    fontSize: moderateScale(16),
    fontFamily: theme.fonts.regular,
    color: theme.colors.secondaryText,
    textAlign: 'center',
    marginBottom: verticalScale(32), // ADDED
  },

  chatbotPromptCard: {
    backgroundColor: theme.colors.lightGray,
    borderRadius: moderateScale(16),
    padding: moderateScale(18),
    width: '100%',
    marginBottom: verticalScale(14),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },

  chatbotPromptCardText: {
    fontFamily: theme.fonts.medium,
    fontSize: moderateScale(16),
    color: theme.colors.textBlack,
    flex: 1,
    lineHeight: moderateScale(22),
  },

  quickOptionsGrid: { // NEW
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: -5,
  },

  chatbotQuickOption: {
    flex: 1,
    width: '48%', // MODIFIED for 2 columns
    padding: moderateScale(16), // MODIFIED
    backgroundColor: theme.colors.textWhite,
    borderRadius: moderateScale(16), // MODIFIED
    alignItems: 'center',
    justifyContent: 'center',
    margin: '1%', // MODIFIED
    borderWidth: 1, // MODIFIED
    borderColor: theme.colors.lightGray, // MODIFIED
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0,0,0,0.05)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
      web: { boxShadow: '0px 4px 8px rgba(0,0,0,0.05)' }
    }),
    minHeight: verticalScale(100), // ADDED
  },

  chatbotQuickOptionText: {
    fontFamily: theme.fonts.medium,
    color: theme.colors.textBlack,
    textAlign: 'center',
    fontSize: moderateScale(14),
    lineHeight: moderateScale(20),
    marginTop: verticalScale(8), // ADDED
    lineHeight: moderateScale(18), // MODIFIED
  },
  
  settingsContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    zIndex: 100,
  },

  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: moderateScale(16),
    borderBottomWidth: 1,
    borderColor: theme.colors.lightGray,
    backgroundColor: theme.colors.textWhite,
  },

  settingsTitle: {
    fontSize: moderateScale(22),
    fontFamily: theme.fonts.bold,
    color: theme.colors.textBlack,
  },

  settingsSection: {
    marginBottom: verticalScale(24),
    padding: moderateScale(16),
    backgroundColor: theme.colors.textWhite,
    borderRadius: moderateScale(12),
    borderWidth: 1,
    borderColor: theme.colors.lightGray,
  },

  locationPickerContainer: {
    padding: moderateScale(16),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.lightGray,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(10),
  },

  locationText: {
    fontFamily: theme.fonts.regular,
    fontSize: moderateScale(14),
    color: theme.colors.secondaryText,
    marginBottom: verticalScale(10),
  },

  dangerText: {
    color: theme.colors.error,
    textAlign: 'center',
    fontFamily: theme.fonts.medium,
    fontSize: moderateScale(14),
    paddingVertical: verticalScale(4),
  },

  // Estilos para o Modal de Configurações da IA
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 500,
    height: '80%',
    backgroundColor: theme.colors.background,
    borderRadius: 20,
    overflow: 'hidden'
  },
  sectionTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: moderateScale(14),
    color: theme.colors.secondaryText,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: verticalScale(8),
  },
  sectionSubtitle: {
    fontFamily: theme.fonts.regular,
    fontSize: moderateScale(14),
    color: theme.colors.secondaryText,
    marginBottom: verticalScale(20),
  },
  modelOptionCard: {
    backgroundColor: theme.colors.textWhite,
    padding: moderateScale(16),
    borderRadius: 12,
    marginBottom: verticalScale(12),
    borderWidth: 2,
    borderColor: theme.colors.lightGray,
  },
  modelOptionCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: '#f1f8e9',
  },
  modelName: {
    fontFamily: theme.fonts.bold,
    fontSize: moderateScale(16),
    color: theme.colors.textBlack,
  },
  modelDesc: {
    fontFamily: theme.fonts.regular,
    fontSize: moderateScale(13),
    color: theme.colors.secondaryText,
    marginTop: 4,
  },
  radioButtonOuter: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#ccc', justifyContent: 'center', alignItems: 'center', marginLeft: 16,
  },
  radioButtonInner: {
    width: 12, height: 12, borderRadius: 6, backgroundColor: theme.colors.primary,
  },

  // Location
  locationPreviewContainer: {
    alignItems: 'center',
    marginBottom: verticalScale(14),
    borderWidth: 1, borderColor: 'rgba(236,239,241,0.9)',    borderRadius: moderateScale(14), 
    padding: moderateScale(12),    backgroundColor: theme.colors.lightGray,
  },
  mapPreview: {
    width: '100%',
    height: verticalScale(240),
    borderRadius: moderateScale(12),    marginBottom: verticalScale(10), 
    backgroundColor: '#e0e0e0',    overflow: 'hidden', 
  },
  locationCoordsText: {
    fontSize: moderateScale(13),
    color: theme.colors.secondaryText,
    fontFamily: theme.fonts.medium,
    opacity: 0.85,
  },
  locationButtonsContainer: {
    flexDirection: 'row',
    marginBottom: verticalScale(16),
    gap: scale(12),
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.secondary,
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(16),    borderRadius: moderateScale(12),
    gap: scale(10),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  locationButtonText: {
    color: theme.colors.textWhite,
    fontFamily: theme.fonts.medium,
    fontSize: moderateScale(14),
    letterSpacing: 0.2,
  },

  statBox: {
    alignItems: 'center',
    margin: 12,
    padding: moderateScale(14),
    backgroundColor: theme.colors.textWhite,
    borderRadius: moderateScale(12),    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0,0,0,0.05)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
      web: { boxShadow: '0px 4px 8px rgba(0,0,0,0.05)' }
    }),
  },
  statBoxLabel: {
    fontSize: moderateScale(14),
    fontFamily: theme.fonts.medium,
  },
  statBoxValue: {
    fontSize: moderateScale(18),
    fontFamily: theme.fonts.bold,
    marginTop: verticalScale(6),
  },

  chartImage: { // NEW
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 12,
    backgroundColor: theme.colors.lightGray,
    resizeMode: 'contain',
  },
  sourcesContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  sourceLink: {
    color: theme.colors.primary,
    textDecorationLine: 'underline',
    fontSize: 12,
  },
});

  // Markdown styles moderno e refinado
  export const markdownStyles = StyleSheet.create({
    body: {
      color: theme.colors.textBlack, // Corrigido para usar a cor do tema
      fontFamily: theme.fonts.regular, // Corrigido para usar a fonte do tema
      fontSize: moderateScale(16),
      lineHeight: moderateScale(28), // Aumenta o espaçamento entre linhas para melhor legibilidade
    },
    heading1: {
      flexDirection: 'row',
      fontSize: moderateScale(32),
      fontFamily: theme.fonts.bold, // Mantém o negrito
      color: theme.colors.textBlack, // Alterado para preto
      marginBottom: verticalScale(16),
      marginTop: verticalScale(28),
    },
    heading2: {
      flexDirection: 'row',
      fontSize: moderateScale(24),
      fontFamily: theme.fonts.bold, // Mantém o negrito
      color: theme.colors.textBlack, // Alterado para preto
      marginBottom: verticalScale(14),
      marginTop: verticalScale(22),
    },
    heading3: {
      flexDirection: 'row',
      fontSize: moderateScale(20), // Levemente maior
      fontFamily: theme.fonts.bold,
      color: theme.colors.textBlack, // Cor mais sóbria
      marginBottom: verticalScale(10),
      marginTop: verticalScale(18),
    },
    heading4: {
      flexDirection: 'row',
      fontSize: moderateScale(18),
      fontFamily: theme.fonts.medium, // Peso de fonte intermediário
      color: theme.colors.textBlack,
      marginTop: verticalScale(16),
    },
    heading5: {
      flexDirection: 'row',
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.medium,
      color: theme.colors.secondaryText,
      marginTop: verticalScale(14),
    },
    heading6: {
      flexDirection: 'row',
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.medium,
      color: theme.colors.secondaryText,
      textTransform: 'uppercase', // Estilo para cabeçalhos menores
      letterSpacing: 0.5,
      marginTop: verticalScale(12),
    },
    hr: {
      backgroundColor: 'rgba(0,0,0,0.1)', // Linha mais sutil
      height: 1,
      marginVertical: verticalScale(16),
    },
    strong: {
      fontFamily: theme.fonts.bold,
      color: theme.colors.textBlack,
    },
    em: {
      fontStyle: 'italic',
      color: theme.colors.secondaryText,
    },
    s: {
      textDecorationLine: 'line-through',
      color: theme.colors.secondaryText,
    },
    blockquote: {
      backgroundColor: 'rgba(103, 164, 33, 0.05)', // Fundo sutil com a cor primária
      borderColor: theme.colors.primary,
      borderLeftWidth: 3, // Borda mais fina
      marginVertical: verticalScale(12),
      paddingVertical: verticalScale(12),
      paddingHorizontal: scale(16),
      borderRadius: 8,
    },
    bullet_list: {},
    ordered_list: {},
    list_item: {
      flexDirection: 'row',
      alignItems: 'flex-start', // Alinha o ícone com o início do texto
      marginBottom: verticalScale(12), // Mais espaço entre itens
    },
    bullet_list_icon: {
      marginRight: scale(12),
      color: theme.colors.primary,
      marginTop: verticalScale(6), // Ajuste fino vertical
    },
    bullet_list_content: {
      flex: 1,
      color: theme.colors.textBlack,
    },
    ordered_list_icon: {
      marginRight: scale(12),
      color: theme.colors.primary,
      fontFamily: theme.fonts.bold,
      marginTop: verticalScale(2), // Ajuste fino vertical
    },
    ordered_list_content: {
      flex: 1,
      color: theme.colors.textBlack,
    },
    code_inline: {
      backgroundColor: 'rgba(0,0,0,0.05)',
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      paddingHorizontal: scale(6),
      paddingVertical: verticalScale(2),
      borderRadius: 6,
      color: theme.colors.textBlack,
    },
    code_block: {
      backgroundColor: '#2d2d2d', // Fundo escuro para contraste
      color: '#f8f8f2', // Texto claro
      padding: moderateScale(16),
      borderRadius: 12,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      marginVertical: verticalScale(12),
    },
    fence: {
      backgroundColor: '#2d2d2d',
      color: '#f8f8f2',
      padding: moderateScale(16),
      borderRadius: 12,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      marginVertical: verticalScale(12),
    },
    table: {
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.1)',
      borderRadius: 8,
      overflow: 'hidden',
      marginVertical: verticalScale(16),
    },
    thead: {},
    tbody: {},
    th: {
      flex: 1,
      padding: moderateScale(12),
      backgroundColor: 'rgba(0,0,0,0.03)',
      fontFamily: theme.fonts.bold,
      color: theme.colors.textBlack,
    },
    link: {
      color: theme.colors.primary,
      textDecorationLine: 'underline',
    },
    tr: {
      borderBottomWidth: 1,
      borderColor: 'rgba(0,0,0,0.1)',
      flexDirection: 'row',
      // Estilo de zebra para melhor leitura
    },
    td: {
      flex: 1,
      padding: moderateScale(12),
    },
    blocklink: {
      flex: 1,
      borderColor: theme.colors.primary,
      borderBottomWidth: 1,
    },
    image: {
      flex: 1,
      width: '100%',
      height: 200,
      resizeMode: 'cover', // 'cover' pode ser mais agradável visualmente
      borderRadius: 8,
      marginVertical: 10,
    },
    text: {},
    textgroup: {},
    paragraph: {
      marginTop: 10,
      marginBottom: 12,
      flexWrap: 'wrap', // Mantido
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      width: '100%',
    },
    hardbreak: {
      width: '100%',
      height: 1,
    },
    softbreak: {},
    pre: {},
    inline: {},
    span: {},
  });

// Re-export used modules (keeps original intent)
export {
  ActivityIndicator,
  Alert,
  Calendar,
  Clipboard,
  DocumentPicker,
  FlatList,
  FontAwesome,
  Icon,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  LinearGradient,
  Linking,
  Location,
  MarkdownDisplay,
  MaterialCommunityIcons,
  MaterialIcons,
  Modal,
  Picker,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  WebView,
  useFocusEffect,
  useWindowDimensions,
}
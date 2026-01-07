/*===================================================================*/
/* W3LabsAgro – App principal                                    */
/*===================================================================*/

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Platform, Pressable, SafeAreaView,
  StyleSheet, Text, TouchableOpacity,
  View
} from 'react-native';

// Navigation
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Expo & APIs
import { useFonts } from 'expo-font';
import * as Network from 'expo-network';

// Firebase - Importando do novo serviço centralizado
import {
  auth, // Importando a instância do Firestore
  onAuthStateChanged,
  seedInitialFirestoreData, // Nova função para popular dados iniciais no Firestore
  signOut
} from './firebaseConfig';

// Common Components & Styles
import * as common from './Telas/Common';

// Verificação de componentes disponíveis
const { 
  AppContext, 
  useAppContext, 
  theme, 
  LinearGradient, 
  Icon, 
  MaterialCommunityIcons, 
  FontAwesome 
} = common;

// NOVO: Importando as novas funções de mapa e clima
const { fetchLocationAndAddress, fetchWeather } = common;

// IMPORTAÇÃO DAS TELAS
// ========================================================================
import { AgronomiaChatbot, ChatbotFAB } from './Telas/AgronomIA';
import { DieselScreen } from './Telas/Diesel';
import { AuthPage, EsqueciSenhaPage } from './Telas/LoginCadastro';
import {
  AddOrEditEquipamentoScreen,
  AddOrEditEstoqueGeralScreen,
  EstoqueGeralListaScreen,
  InventarioListaScreen,
  ManagerPage,
  PropriedadesListaScreen,
  UnidadesListaScreen
} from './Telas/Manager';
import {
  AddOrEditManualItemScreen,
  ManuaisListaScreen,
  ManualItemsListaScreen,
  VisualizarPDFScreen
} from './Telas/Manuais';
import { ColheitaListaScreen, PlantioListaScreen } from './Telas/Plantio&Colheita';
import { PluviometroListaScreen, PorcentagemListaScreen } from './Telas/Porcentagem';
import { PulverizacaoListaScreen } from './Telas/Pulverizacao';
import { RevisoesListaScreen } from './Telas/Revisoes';

// ========================================================================
// CONFIGURAÇÕES E CONSTANTES
// ========================================================================
const INITIAL_WEATHER_STATE = {
  temperatura: '',
  umidade: '',
  velvento: '',
  precipitacao: '',
  desctemperatura: 'Buscando clima…',
};

const INITIAL_LOCATION_STATE = {
  latitude: 0,
  longitude: 0,
};

/*===================================================================*/
/* Contexto global do App                                           */
/*===================================================================*/
const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [location, setLocation] = useState(INITIAL_LOCATION_STATE);
  const [address, setAddress] = useState(null);
  const [clima, setClima] = useState(INITIAL_WEATHER_STATE);
  const [networkStatus, setNetworkStatus] = useState({ isConnected: true, type: 'unknown' });
  // O estado `syncStatus` foi removido, pois o Firestore gerencia a sincronização automaticamente.

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (initializing) setInitializing(false);
    });
    return unsubscribe;
  }, [initializing]);

  useEffect(() => {
    const subscription = Network.addNetworkStateListener(state => {
      setNetworkStatus({
        isConnected: state.isConnected ?? false,
        type: state.type ?? 'unknown'
      });
    });
    return () => {
      subscription.remove();
    };
  }, []);

  const value = useMemo(() => ({
    user, 
    initializing, 
    isAuthenticated: !!user, 
    clima, 
    setClima, 
    location, 
    setLocation, 
    address, 
    setAddress, 
    networkStatus,
  }), [user, initializing, clima, location, address, networkStatus]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

/*===================================================================*/
/* Tela inicial do App                                              */
/*===================================================================*/
const HomePage = ({ navigation }) => {
  const { user, clima, networkStatus } = useAppContext();
  const numColumns = 3; // Layout 3x3x3x1

  const menuItems = useMemo(() => [
    // Operações
    { 
      name: 'PULVERIZAÇÃO', 
      icon: 'spray', 
      screen: 'PulverizacaoLista', 
      iconLib: MaterialCommunityIcons, 
      color: '#67a421' 
    },
    { 
      name: 'PLANTIO', 
      icon: 'sprout-outline', 
      screen: 'PlantioLista', 
      iconLib: MaterialCommunityIcons, 
      color: '#67a421' 
    },
    { 
      name: 'COLHEITA', 
      icon: 'tractor', 
      screen: 'ColheitaLista', 
      iconLib: MaterialCommunityIcons, 
      color: '#67a421' 
    },
    { 
      name: 'REVISÕES', 
      icon: 'wrench', 
      screen: 'RevisoesLista', 
      iconLib: FontAwesome, 
      color: '#67a421' 
    },
    // Suprimentos e Dados
    { 
      name: 'DIESEL', 
      icon: 'gas-station', 
      screen: 'Diesel', 
      iconLib: MaterialCommunityIcons, 
      color: '#67a421' 
    },
    { 
      name: 'ESTOQUE', 
      icon: 'warehouse', 
      screen: 'EstoqueGeralLista', 
      iconLib: MaterialCommunityIcons, 
      color: '#67a421' 
    },
    { 
      name: 'PLUVIÔMETRO', 
      icon: 'weather-rainy', 
      screen: 'PluviometroLista', 
      iconLib: MaterialCommunityIcons, 
      color: '#67a421' 
    },
    { 
      name: 'ANDAMENTO', 
      icon: 'percent', 
      screen: 'PorcentagemLista', 
      iconLib: FontAwesome, 
      color: '#67a421' 
    },
    // Admin e Informações
    { 
      name: 'GERENCIADOR', 
      icon: 'cogs', 
      screen: 'Manager', 
      iconLib: FontAwesome, 
      color: '#67a421' 
    },
    { 
      name: 'MANUAIS', 
      icon: 'book-outline', 
      screen: 'ManuaisLista', 
      iconLib: Icon, 
      color: '#67a421' 
    },
  ], []);

  const formatGridData = (data, columns) => {
    const formattedData = [...data];
    const numberOfFullRows = Math.floor(formattedData.length / columns);
    let numberOfElementsLastRow = formattedData.length - (numberOfFullRows * columns);

    // Specific logic for 10 items and 4 columns to center the last 2 items
    if (data.length === 10 && columns === 4) {
        const lastTwoItems = formattedData.splice(8, 2); // remove last two items
        return [
            ...formattedData,
            { name: 'blank-start', empty: true },
            ...lastTwoItems,
            { name: 'blank-end', empty: true }
        ];
    }
    
    // Specific logic for 10 items and 3 columns to center the last item
    if (data.length === 10 && columns === 3) {
        const lastItem = formattedData.pop(); // remove real last item
        return [
            ...formattedData,
            { name: 'blank-start', empty: true },
            lastItem,
            { name: 'blank-end', empty: true }
        ];
    }

    while (numberOfElementsLastRow !== columns && numberOfElementsLastRow !== 0) {
      formattedData.push({ name: `blank-${numberOfElementsLastRow}`, empty: true });
      numberOfElementsLastRow++;
    }

    return formattedData;
  };

  const renderGridItem = useCallback(({ item }) => {
    if (item.empty) {
      return (
        <View 
          style={[
            common.styles.homeGridItem, 
            { 
              backgroundColor: 'transparent', 
              elevation: 0, 
              boxShadow: 'none' 
            }
          ]} 
        />
      );
    }

    // Verificação de segurança para iconLib
    const IconComponent = item.iconLib || Icon;
    
    return (
      <TouchableOpacity
        style={[
          common.styles.homeGridItem, 
          { backgroundColor: item.color || theme.colors.alternate } // Fundo verde limão
        ]}
        onPress={() => item.screen && navigation.navigate(item.screen)}
        activeOpacity={0.8}
      >
        <IconComponent 
          name={item.icon}
          size={common.moderateScale(38)}
          color={theme.colors.textWhite} // Ícone branco
          style={common.styles.homeGridIcon} 
        />
        <Text style={[common.styles.homeGridText, { color: theme.colors.textWhite }]}>{item.name}</Text>
      </TouchableOpacity>
    );
  }, [navigation, theme]);

  const handleLogout = useCallback(() => {
    const performLogout = async () => {
      try {
        await signOut(auth);
      } catch (error) {
        console.error('Logout error:', error);
        Alert.alert('Erro', 'Não foi possível fazer logout. Tente novamente.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Tem certeza que deseja sair?')) {
        performLogout();
      }
    } else {
      Alert.alert('Sair', 'Tem certeza que deseja sair da sua conta?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: performLogout },
      ]);
    }
  }, []);


  const userName = useMemo(() => user?.displayName?.split(' ')[0] || 'Usuário', [user]);
  
  const formattedMenuItems = useMemo(() => formatGridData(menuItems, numColumns), [menuItems, numColumns]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <LinearGradient 
        colors={[theme.colors.primary, theme.colors.secondary]} 
        style={common.styles.homeHeaderGradient}
      >
        <View style={common.styles.homeHeaderContent}>
          <View style={common.styles.homeTopActions}>
            <Text style={common.styles.welcomeText}>Olá, {userName}</Text>
            <View 
              style={{ 
                width: 8, 
                height: 8, 
                borderRadius: 4, 
                backgroundColor: networkStatus.isConnected ? '#67a421' : '#F44336', 
                marginLeft: 10 
              }} 
            />
            <TouchableOpacity 
              onPress={() => console.log('Download')} 
              style={{ marginLeft: 'auto' }} 
              disabled={!networkStatus.isConnected}
            >
              <Icon 
                name="download-outline" 
                size={30} 
                color={networkStatus.isConnected ? theme.colors.textWhite : theme.colors.secondaryText} 
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={{ marginLeft: 15 }}>
              <Icon name="log-out-outline" size={30} color={theme.colors.textWhite} />
            </TouchableOpacity>
          </View>
          <View style={common.styles.headerWeatherContainer}>
            <Text style={common.styles.headerWeatherTemp}>
              {clima.temperatura ? `${clima.temperatura}°C` : '--°'}
            </Text>
            <Text style={common.styles.headerWeatherDesc}>
              {clima.desctemperatura || 'Carregando...'}
            </Text>
            <View style={common.styles.headerWeatherDetails}>
              <View style={common.styles.headerWeatherDetailItem}>
                <MaterialCommunityIcons 
                  name="water-percent" 
                  size={20} 
                  color={theme.colors.textWhite} 
                />
                <Text style={common.styles.headerWeatherDetailText}>
                  {clima.umidade || '--'}%
                </Text>
              </View>
              <View style={common.styles.headerWeatherDetailItem}>
                <MaterialCommunityIcons 
                  name="weather-windy" 
                  size={18} 
                  color={theme.colors.textWhite} 
                />
                <Text style={common.styles.headerWeatherDetailText}>
                  {clima.velvento || '--'} km/h
                </Text>
              </View>
              <View style={common.styles.headerWeatherDetailItem}>
                <MaterialCommunityIcons 
                  name="weather-pouring" 
                  size={20} 
                  color={theme.colors.textWhite} 
                />
                <Text style={common.styles.headerWeatherDetailText}>
                  {clima.precipitacao || '--'}mm
                </Text>
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 700 }}>
          <FlatList
            key={numColumns}
            data={formattedMenuItems}
            renderItem={renderGridItem}
            keyExtractor={(item, index) => item.name + index}
            numColumns={numColumns}
            style={[common.styles.gridContainer, Platform.OS === 'web' && {
              scrollbarColor: `${common.theme.colors.secondaryText} ${common.theme.colors.lightGray}`,
              scrollbarWidth: 'thin',
            }]}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={{ paddingBottom: 100 }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

/*===================================================================*/
/* Navegador principal do App                                       */
/*===================================================================*/
const Stack = createStackNavigator();

const AppNavigator = () => {
  const { isAuthenticated, initializing, setClima, setLocation, setAddress } = useAppContext();
  const [isChatbotVisible, setChatbotVisible] = useState(false);
  const toggleChatbot = useCallback(() => setChatbotVisible(prev => !prev), []);

  // Roda APENAS UMA VEZ quando o usuário é autenticado.
  useEffect(() => {
    if (!isAuthenticated) return;
    const userUid = auth.currentUser?.uid;
    if (!userUid) return;
  
    const initializeAppOnce = async () => {
      console.log("Inicializando dados do app (uma única vez)...");
      try {
        // Popula as categorias iniciais no Firestore se for um novo usuário
        if (seedInitialFirestoreData) {
          await seedInitialFirestoreData(userUid);
        }
        
        // 1. Busca localização e endereço
        const locResult = await fetchLocationAndAddress();
        if (locResult.location) setLocation(locResult.location);
        if (locResult.address) setAddress(locResult.address);
        if (locResult.error) setClima(prev => ({ ...prev, desctemperatura: locResult.error }));

        // 2. Se a localização foi obtida, busca o clima
        if (locResult.location) {
          const weatherResult = await fetchWeather(locResult.location);
          if (weatherResult.clima) setClima(weatherResult.clima);
        }
      } catch (error) {
        console.error('App one-time initialization error:', error);
      }
    };
    initializeAppOnce();
  }, [isAuthenticated, setClima, setLocation, setAddress]);

  // A lógica de sincronização ao reconectar foi removida,
  // pois o Firestore gerencia a persistência offline e a
  // sincronização automaticamente.

  if (initializing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ marginTop: 16, color: theme.colors.secondaryText }}>
          Carregando aplicativo...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {isAuthenticated ? (
            <>
              {/* --- Telas Principais e de Listagem --- */}
              <Stack.Screen name="Home" component={HomePage} />
              <Stack.Screen name="PulverizacaoLista" component={PulverizacaoListaScreen} />
              <Stack.Screen name="PlantioLista" component={PlantioListaScreen} />
              <Stack.Screen name="ColheitaLista" component={ColheitaListaScreen} />
              <Stack.Screen name="RevisoesLista" component={RevisoesListaScreen} />
              <Stack.Screen name="Diesel" component={DieselScreen} />
              <Stack.Screen name="Manager" component={ManagerPage} />
              <Stack.Screen name="EstoqueGeralLista" component={EstoqueGeralListaScreen} />
              <Stack.Screen name="AddOrEditEstoqueGeral" component={AddOrEditEstoqueGeralScreen} />
              <Stack.Screen name="InventarioLista" component={InventarioListaScreen} />
              <Stack.Screen name="PropriedadesLista" component={PropriedadesListaScreen} />
              <Stack.Screen name="UnidadesLista" component={UnidadesListaScreen} />
              <Stack.Screen name="AddOrEditEquipamento" component={AddOrEditEquipamentoScreen} />
              <Stack.Screen name="PluviometroLista" component={PluviometroListaScreen} />
              <Stack.Screen name="PorcentagemLista" component={PorcentagemListaScreen} />
              <Stack.Screen name="ManuaisLista" component={ManuaisListaScreen} />
              <Stack.Screen name="ManualItemsLista" component={ManualItemsListaScreen} />
              <Stack.Screen name="AddOrEditManualItem" component={AddOrEditManualItemScreen} />
              <Stack.Screen name="VisualizarPDF" component={VisualizarPDFScreen} />
            </>
          ) : (
            <>
              {/* --- Telas de Autenticação --- */}
              <Stack.Screen name="Auth" component={AuthPage} />
              <Stack.Screen name="EsqueciSenha" component={EsqueciSenhaPage} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>

      {isAuthenticated && (
        <>
          <ChatbotFAB onPress={toggleChatbot} />
          <common.Modal
            animationType="fade"
            transparent={true}
            visible={isChatbotVisible}
            onRequestClose={toggleChatbot}
          >
            <common.Pressable style={common.styles.chatbotBackdrop} onPress={toggleChatbot} />
            <AgronomiaChatbot onClose={toggleChatbot} />
          </common.Modal>
        </>
      )}
    </View>
  );
};

/*===================================================================*/
/* Componente Principal do App                                      */
/*===================================================================*/
export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    'NokiaPureHeadline-UltraLight': require('./assets/fonts/NokiaPureHeadline-UltraLight.ttf'),
    'NokiaPureHeadline-Light': require('./assets/fonts/NokiaPureHeadline-Light.ttf'),
    'NokiaPureHeadline-Regular': require('./assets/fonts/NokiaPureHeadline-Regular.ttf'),
    'NokiaPureHeadline-Bold': require('./assets/fonts/NokiaPureHeadline-Bold.ttf'),
    'NokiaPureHeadline-ExtraBold': require('./assets/fonts/NokiaPureHeadline-ExtraBold.ttf'),
  });

  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ marginTop: 16, color: theme.colors.secondaryText }}>
          Carregando fontes...
        </Text>
      </View>
    );
  }

  if (fontError) {
    console.error('Font loading error:', fontError);
    return (
      <View style={styles.center}>
        <Text style={{ color: theme.colors.error, textAlign: 'center', padding: 20 }}>
          Erro ao carregar fontes.{'\n'}Reinicie o aplicativo.
        </Text>
      </View>
    );
  }

  return (
    <AppProvider>
      <AppNavigator />
    </AppProvider>
  );
}

/*===================================================================*/
/* Estilos                                                          */
/*===================================================================*/
const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: 20
  },
});
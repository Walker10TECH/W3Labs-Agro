import React, { useState, useEffect } from 'react';
import './global.css';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebaseConfig';
import { useAppFonts } from './services/fontLoader';

// Importação das Telas Unificadas da pasta Screens
import LoginScreen from './Screens/LoginScreen';
import Dashboard from './Screens/HomeScreen';
import { PlantiosScreen, ColheitasScreen } from './Screens/PlantioColheitaScreen';
import ManagerScreen from './Screens/ManagerScreen';
import PulverizacaoListaScreen from './Screens/PulverizacaoScreen';
import DieselScreen from './Screens/DieselScreen';
import Manuais from './Screens/ManuaisScreen';
import { PorcentagemListaScreen, PluviometroListaScreen } from './Screens/PorcentagemPluviometroScreen';
import RevisoesScreen from './Screens/RevisoesScreen';

const Stack = createNativeStackNavigator();

export default function W3LabsAgro() {
  const { fontsLoaded } = useAppFonts();
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);

  // Monitora o estado da autenticação do Firebase
  useEffect(() => {
    const subscriber = onAuthStateChanged(auth, (userState) => {
      setUser(userState);
      if (initializing) setInitializing(false);
    });
    return subscriber; // cancela o listener ao desmontar
  }, [initializing]);

  if (initializing || !fontsLoaded) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            {/* Telas para usuários autenticados */}
            <Stack.Screen name="Dashboard" component={Dashboard} />
            <Stack.Screen name="Plantios" component={PlantiosScreen} />
            <Stack.Screen name="Colheitas" component={ColheitasScreen} />
            <Stack.Screen name="Manager" component={ManagerScreen} />
            <Stack.Screen name="Pulverizacao" component={PulverizacaoListaScreen} />
            <Stack.Screen name="Diesel" component={DieselScreen} />
            <Stack.Screen name="Manuais" component={Manuais} />
            <Stack.Screen name="Andamento" component={PorcentagemListaScreen} />
            <Stack.Screen name="Pluviometro" component={PluviometroListaScreen} />
            <Stack.Screen name="Revisoes" component={RevisoesScreen} />
          </>
        ) : (
          // Telas para usuários não autenticados
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

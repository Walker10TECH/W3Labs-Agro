import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebaseConfig';

// Importação das Telas
import Login from './Telas/Login';
import Dashboard from './Telas/Dashboard';
import { PlantiosScreen, ColheitasScreen } from './Telas/Plantio&Colheita';
import Manager from './Telas/Manager';
import PulverizacaoScreen from './Telas/Pulverizacao';
import DieselScreen from './Telas/Diesel';
import Manuais from './Telas/Manuais';
import { PorcentagemListaScreen, PluviometroListaScreen } from './Telas/Porcentage&Pluviometro';
import RevisoesListaScreen from './Telas/Revisoes';

const Stack = createNativeStackNavigator();

export default function W3LabsAgro() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);

  // Monitora o estado da autenticação do Firebase
  useEffect(() => {
    const subscriber = onAuthStateChanged(auth, (userState) => {
      setUser(userState);
      if (initializing) setInitializing(false);
    });
    return subscriber; // cancela o listener ao desmontar
  }, []);

  if (initializing) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            {/* Telas para usuários autenticados */}
            <Stack.Screen name="Dashboard" component={Dashboard} />
            <Stack.Screen name="Plantios" component={PlantiosScreen} />
            <Stack.Screen name="Colheitas" component={ColheitasScreen} />
            <Stack.Screen name="Manager" component={Manager} />
            <Stack.Screen name="Pulverizacao" component={PulverizacaoScreen} />
            <Stack.Screen name="Diesel" component={DieselScreen} />
            <Stack.Screen name="Manuais" component={Manuais} />
            <Stack.Screen name="Andamento" component={PorcentagemListaScreen} />
            <Stack.Screen name="Pluviometro" component={PluviometroListaScreen} />
            <Stack.Screen name="Revisoes" component={RevisoesListaScreen} />
          </>
        ) : (
          // Telas para usuários não autenticados
          <Stack.Screen name="Login" component={Login} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

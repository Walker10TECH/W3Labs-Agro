import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebaseConfig';

// Importação das Telas
import Login from './Telas/Login';
import Dashboard from './Telas/Dashboard';

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
          // Telas para usuários autenticados
          <Stack.Screen name="Dashboard" component={Dashboard} />
        ) : (
          // Telas para usuários não autenticados
          <Stack.Screen name="Login" component={Login} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

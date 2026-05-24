import React, { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebaseConfig';

// Importação das Telas Mobile
import LoginMobile from './TelasMobile/LoginMobile';
import DashboardMobile from './TelasMobile/DashboardMobile';
import { PlantiosScreen as PlantiosMobile, ColheitasScreen as ColheitasMobile } from './TelasMobile/Plantio&ColheitaMobile';
import ManagerMobile from './TelasMobile/ManagerMobile';
import PulverizacaoMobile from './TelasMobile/PulverizacaoMobile';
import DieselMobile from './TelasMobile/DieselMobile';
import ManuaisMobile from './TelasMobile/ManuaisMobile';
import { PorcentagemListaScreen as PorcentagemMobile, PluviometroListaScreen as PluviometroMobile } from './TelasMobile/Porcentagem&PluviometroMobile';
import RevisoesMobile from './TelasMobile/RevisoesMobile';

// Importação das Telas Web
import LoginWeb from './TelasWeb/LoginWeb';
import DashboardWeb from './TelasWeb/DashboardWeb';
import { PlantiosScreen as PlantiosWeb, ColheitasScreen as ColheitasWeb } from './TelasWeb/Plantio&ColheitaWeb';
import ManagerWeb from './TelasWeb/ManagerWeb';
import PulverizacaoWeb from './TelasWeb/PulverizacaoWeb';
import DieselWeb from './TelasWeb/DieselWeb';
import ManuaisWeb from './TelasWeb/ManuaisWeb';
import { PorcentagemListaScreen as PorcentagemWeb, PluviometroListaScreen as PluviometroWeb } from './TelasWeb/Porcentagem&PluviometroWeb';
import RevisoesWeb from './TelasWeb/RevisoesWeb';

// Função auxiliar robusta para resolver a tela correta dependendo da plataforma
const getScreen = (WebScreen, MobileScreen) => {
  return Platform.select({
    web: WebScreen,        // Quando executado em qualquer navegador (Desktop ou Safari/Chrome no celular)
    android: MobileScreen, // Quando executado no App Nativo Instalado no Android
    ios: MobileScreen,     // Quando executado no App Nativo Instalado no iOS
    default: MobileScreen, // Fallback seguro (ex: React Native para Windows/MacOS)
  });
};

// Definição das telas mapeadas de forma explícita e segura
const LoginScreen = getScreen(LoginWeb, LoginMobile);
const Dashboard = getScreen(DashboardWeb, DashboardMobile);
const PlantiosScreen = getScreen(PlantiosWeb, PlantiosMobile);
const ColheitasScreen = getScreen(ColheitasWeb, ColheitasMobile);
const Manager = getScreen(ManagerWeb, ManagerMobile);
const PulverizacaoListaScreen = getScreen(PulverizacaoWeb, PulverizacaoMobile);
const DieselScreen = getScreen(DieselWeb, DieselMobile);
const Manuais = getScreen(ManuaisWeb, ManuaisMobile);
const PorcentagemListaScreen = getScreen(PorcentagemWeb, PorcentagemMobile);
const PluviometroListaScreen = getScreen(PluviometroWeb, PluviometroMobile);
const RevisoesListaScreen = getScreen(RevisoesWeb, RevisoesMobile);

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
            {/* TelasMobile para usuários autenticados */}
            <Stack.Screen name="Dashboard" component={Dashboard} />
            <Stack.Screen name="Plantios" component={PlantiosScreen} />
            <Stack.Screen name="Colheitas" component={ColheitasScreen} />
            <Stack.Screen name="Manager" component={Manager} />
            <Stack.Screen name="Pulverizacao" component={PulverizacaoListaScreen} />
            <Stack.Screen name="Diesel" component={DieselScreen} />
            <Stack.Screen name="Manuais" component={Manuais} />
            <Stack.Screen name="Andamento" component={PorcentagemListaScreen} />
            <Stack.Screen name="Pluviometro" component={PluviometroListaScreen} />
            <Stack.Screen name="Revisoes" component={RevisoesListaScreen} />
          </>
        ) : (
          // TelasMobile para usuários não autenticados
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

import React,{useEffect,useState} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {onAuthStateChanged} from 'firebase/auth';
import {auth} from './firebaseConfig';
import {PropertyProvider} from './context/PropertyContext';
import {useAppFonts} from './services/fontLoader';
import {startConnectivitySync} from './services/offlineQueue';
import LoginScreen from './Screens/LoginScreen';
import Dashboard from './Screens/HomeScreen';
import {PlantiosScreen,ColheitasScreen} from './Screens/PlantioColheitaScreen';
import ManagerScreen from './Screens/ManagerScreen';
import PulverizacaoListaScreen from './Screens/PulverizacaoScreen';
import DieselScreen from './Screens/DieselScreen';
import Manuais from './Screens/ManuaisScreen';
import {PorcentagemListaScreen,PluviometroListaScreen} from './Screens/PorcentagemPluviometroScreen';
import RevisoesScreen from './Screens/RevisoesScreen';
import AgroModuleScreen from './screens/AgroModuleScreen';

const Stack=createNativeStackNavigator();

export default function W3LabsAgro(){
 const{fontsLoaded}=useAppFonts();const[initializing,setInitializing]=useState(true);const[user,setUser]=useState(null);const[connection,setConnection]=useState('OFFLINE');
 useEffect(()=>onAuthStateChanged(auth,u=>{setUser(u);setInitializing(false)}),[]);
 useEffect(()=>startConnectivitySync(async operation=>{console.log('[W3Labs Sync]',operation.entity,operation.operation);},setConnection),[]);
 if(initializing||!fontsLoaded)return null;
 return <PropertyProvider><NavigationContainer>
  <Stack.Navigator screenOptions={{headerShown:false}}>
   {!user?<Stack.Screen name="Login" component={LoginScreen}/>:<>
    <Stack.Screen name="Dashboard" component={Dashboard}/>
    <Stack.Screen name="Plantios" component={PlantiosScreen}/>
    <Stack.Screen name="Colheitas" component={ColheitasScreen}/>
    <Stack.Screen name="Manager" component={ManagerScreen}/>
    <Stack.Screen name="Pulverizacao" component={PulverizacaoListaScreen}/>
    <Stack.Screen name="Diesel" component={DieselScreen}/>
    <Stack.Screen name="Manuais" component={Manuais}/>
    <Stack.Screen name="Andamento" component={PorcentagemListaScreen}/>
    <Stack.Screen name="Pluviometro" component={PluviometroListaScreen}/>
    <Stack.Screen name="Revisoes" component={RevisoesScreen}/>
    <Stack.Screen name="Properties"><AgroModuleScreen route={{params:{type:'properties'}}}/></Stack.Screen>
    <Stack.Screen name="Fields"><AgroModuleScreen route={{params:{type:'fields'}}}/></Stack.Screen>
    <Stack.Screen name="Crops"><AgroModuleScreen route={{params:{type:'crops'}}}/></Stack.Screen>
    <Stack.Screen name="Seasons"><AgroModuleScreen route={{params:{type:'seasons'}}}/></Stack.Screen>
    <Stack.Screen name="Activities"><AgroModuleScreen route={{params:{type:'activities'}}}/></Stack.Screen>
    <Stack.Screen name="Documents"><AgroModuleScreen route={{params:{type:'documents'}}}/></Stack.Screen>
    <Stack.Screen name="Reports"><AgroModuleScreen route={{params:{type:'reports'}}}/></Stack.Screen>
   </>}
  </Stack.Navigator>
 </NavigationContainer></PropertyProvider>
}

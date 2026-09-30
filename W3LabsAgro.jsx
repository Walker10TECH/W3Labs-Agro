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
const Module=type=>({navigation})=><AgroModuleScreen navigation={navigation} route={{params:{type}}}/>;

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
    <Stack.Screen name="Properties" component={Module('properties')}/>
    <Stack.Screen name="Fields" component={Module('fields')}/>
    <Stack.Screen name="Crops" component={Module('crops')}/>
    <Stack.Screen name="Seasons" component={Module('seasons')}/>
    <Stack.Screen name="Activities" component={Module('activities')}/>
    <Stack.Screen name="Documents" component={Module('documents')}/>
    <Stack.Screen name="Reports" component={Module('reports')}/>
   </>}
  </Stack.Navigator>
 </NavigationContainer></PropertyProvider>
}

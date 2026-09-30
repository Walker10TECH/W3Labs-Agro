import React,{useEffect,useState} from 'react';
import {Dimensions,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import {signOut} from 'firebase/auth';
import {auth} from '../firebaseConfig';
import {agroTheme as theme} from '../services/designTokens';

const modules=[
['Properties','Propriedades','business-outline'],['Fields','Talhões','map-outline'],['Crops','Culturas','leaf-outline'],['Seasons','Safras','calendar-outline'],['Plantios','Plantio','color-filter-outline'],['Colheitas','Colheita','basket-outline'],['Pulverizacao','Pulverização','flask-outline'],['Pluviometro','Chuva','rainy-outline'],['Revisoes','Manutenção','construct-outline'],['Activities','Atividades','checkmark-circle-outline'],['Documents','Documentos','document-text-outline'],['Reports','Relatórios','bar-chart-outline']
];

export default function HomeScreen({navigation}){
 const[online,setOnline]=useState(true);
 useEffect(()=>NetInfo.addEventListener(s=>setOnline(Boolean(s.isConnected))),[]);
 const go=name=>navigation.navigate(name);
 return <View style={s.root}>
  <ScrollView contentContainerStyle={s.scroll}>
   <View style={s.top}><View><Text style={s.brand}>W3Labs Agro</Text><Text style={s.greeting}>Gestão agrícola no campo e no escritório.</Text></View><Pressable onPress={()=>signOut(auth)} style={s.logout}><Ionicons name="log-out-outline" size={20} color={theme.colors.danger}/></Pressable></View>
   <View style={s.status}><View style={[s.statusDot,{backgroundColor:online?theme.colors.success:theme.colors.warning}]}/><Text style={s.statusText}>{online?'ONLINE':'OFFLINE'} • dados locais protegidos</Text></View>
   <View style={s.hero}><View style={{flex:1}}><Text style={s.heroKicker}>PAINEL OPERACIONAL</Text><Text style={s.heroTitle}>Tudo que importa para a operação agrícola.</Text><Text style={s.heroText}>Registre operações rapidamente. O modo campo mantém os dados disponíveis mesmo com conexão instável.</Text></View><Ionicons name="leaf" size={58} color={theme.colors.primary}/></View>
   <Text style={s.section}>Acesso rápido</Text>
   <View style={s.grid}>{modules.map(([route,label,icon])=><Pressable key={route} onPress={()=>go(route)} style={s.card}><View style={s.cardIcon}><Ionicons name={icon} size={22} color={theme.colors.primary}/></View><Text style={s.cardTitle}>{label}</Text><Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary}/></Pressable>)}</View>
   <Text style={s.section}>Operações existentes</Text>
   <View style={s.operations}><Pressable onPress={()=>go('Manager')} style={s.operation}><Ionicons name="analytics-outline" size={22} color={theme.colors.primary}/><View style={{flex:1}}><Text style={s.opTitle}>Painel do gestor</Text><Text style={s.opText}>Visão consolidada da propriedade</Text></View><Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary}/></Pressable><Pressable onPress={()=>go('Diesel')} style={s.operation}><Ionicons name="speedometer-outline" size={22} color={theme.colors.primary}/><View style={{flex:1}}><Text style={s.opTitle}>Combustível</Text><Text style={s.opText}>Controle de abastecimento e consumo</Text></View><Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary}/></Pressable><Pressable onPress={()=>go('Manuais')} style={s.operation}><Ionicons name="library-outline" size={22} color={theme.colors.primary}/><View style={{flex:1}}><Text style={s.opTitle}>Manuais</Text><Text style={s.opText}>Biblioteca técnica e documentos</Text></View><Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary}/></Pressable></View>
  </ScrollView>
 </View>
}
const w=Dimensions.get('window').width;const cols=w>=1000?4:w>=650?3:2;
const s=StyleSheet.create({root:{flex:1,backgroundColor:theme.colors.background},scroll:{padding:Math.min(24,Math.max(16,w*0.035)),paddingBottom:40,maxWidth:1500,width:'100%',alignSelf:'center'},top:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},brand:{fontSize:28,fontWeight:'900',color:theme.colors.text},greeting:{fontSize:13,color:theme.colors.textSecondary,marginTop:4},logout:{width:42,height:42,borderRadius:21,backgroundColor:'#fff',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:theme.colors.border},status:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:7,marginTop:14,backgroundColor:'#fff',borderWidth:1,borderColor:theme.colors.border,borderRadius:20,paddingHorizontal:11,paddingVertical:7},statusDot:{width:8,height:8,borderRadius:4},statusText:{fontSize:11,fontWeight:'800',color:theme.colors.textSecondary},hero:{marginTop:16,borderRadius:20,padding:22,backgroundColor:theme.colors.primaryLight,flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:'#D6E5D0'},heroKicker:{fontSize:10,fontWeight:'900',letterSpacing:1,color:theme.colors.primary},heroTitle:{fontSize:w<500?23:30,fontWeight:'900',color:theme.colors.text,marginTop:6,maxWidth:800},heroText:{fontSize:13,lineHeight:20,color:theme.colors.textSecondary,marginTop:8,maxWidth:720},section:{fontSize:17,fontWeight:'900',color:theme.colors.text,marginTop:24,marginBottom:10},grid:{flexDirection:'row',flexWrap:'wrap',gap:10},card:{width:((Math.min(1500,w)-32-(cols-1)*10)/cols),minHeight:112,borderRadius:16,backgroundColor:'#fff',borderWidth:1,borderColor:theme.colors.border,padding:14,justifyContent:'space-between'},cardIcon:{width:42,height:42,borderRadius:12,backgroundColor:theme.colors.primaryLight,alignItems:'center',justifyContent:'center'},cardTitle:{fontSize:14,fontWeight:'800',color:theme.colors.text,marginTop:10},operations:{gap:8},operation:{minHeight:68,flexDirection:'row',alignItems:'center',gap:12,padding:13,borderRadius:14,backgroundColor:'#fff',borderWidth:1,borderColor:theme.colors.border},opTitle:{fontSize:14,fontWeight:'800',color:theme.colors.text},opText:{fontSize:12,color:theme.colors.textSecondary,marginTop:3}});

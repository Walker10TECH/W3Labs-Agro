# W3Labs Agro — Arquitetura

## Estado atual
O projeto original é um aplicativo Expo/React Native com suporte Web, Firebase Authentication, Firestore e Storage. A reconstrução preserva esses serviços para evitar uma migração destrutiva dos dados existentes.

## Camadas
- UI: React Native + React Native Web
- Navegação: React Navigation
- Identidade: Firebase Authentication
- Dados existentes: Firestore
- Arquivos: Firebase Storage
- Dados offline: AsyncStorage
- Conectividade: NetInfo
- Design: tokens em services/designTokens.js
- Operações locais: services/localAgroService.js
- Fila: services/offlineQueue.js

## Direção de evolução
A separação por serviços permite migrar progressivamente a persistência para uma API REST/PostgreSQL sem reescrever a UI. A regra é preservar dados e comportamento comprovadamente utilizados antes de trocar infraestrutura.

## Mapa
EXISTENTE → MODERNIZAR: telas, navegação, visual, responsividade, serviços.
EXISTENTE → PRESERVAR: Firebase Auth, Firestore/Storage e regras úteis.
NOVO: módulos offline-first, fila de sincronização, design tokens e módulos operacionais reutilizáveis.
REESCREVER PROGRESSIVAMENTE: telas monolíticas e serviços excessivamente acoplados.

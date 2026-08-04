# Walker10TECH W3Labs Agro

Bem-vindo ao repositório do **Walker10TECH W3Labs Agro**! Este projeto é um aplicativo focado no gerenciamento agrícola, oferecendo ferramentas para acompanhamento de plantio, colheita, pulverização e manutenções, com o intuito de facilitar a vida do produtor rural.

---

## 📋 Índice
1. [Sobre o Projeto](#sobre-o-projeto)
2. [Funcionalidades Principais](#funcionalidades-principais)
3. [Estrutura do Projeto](#estrutura-do-projeto)
4. [Pré-requisitos](#pré-requisitos)
5. [Como Executar o Projeto](#como-executar-o-projeto)
6. [Guia de Telas (Manual do Usuário)](#guia-de-telas-manual-do-usuário)
7. [Tecnologias Utilizadas](#tecnologias-utilizadas)
8. [Configuração de Variáveis de Ambiente](#configuração-de-variáveis-de-ambiente)

---

## 🎯 Sobre o Projeto

O **Walker10TECH W3Labs Agro** foi desenvolvido para ajudar no monitoramento e gestão de atividades agrícolas. Com ele, o usuário pode controlar diversas etapas do processo produtivo, desde o registro do plantio e colheita até o monitoramento do índice pluviométrico e revisões de maquinário.

## ✨ Funcionalidades Principais

- **Autenticação de Usuário:** Tela de login segura para acesso ao sistema.
- **Painel Inicial (Home):** Visão geral e navegação rápida para as principais ferramentas.
- **Gestão de Plantio e Colheita:** Registro e acompanhamento de safras.
- **Monitoramento de Pulverização:** Controle de aplicações de defensivos.
- **Índice Pluviométrico:** Acompanhamento das chuvas e umidade.
- **Revisões e Manutenções:** Controle de manutenções preventivas e corretivas.
- **Manuais e Documentação:** Acesso rápido a guias e manuais de uso.
- **Painel do Gestor:** Visão consolidada para tomada de decisões.

---

## 📁 Estrutura do Projeto

O código-fonte está organizado da seguinte forma:

```text
Walker10TECH-W3Labs-Agro/
│
├── .env                    # Variáveis de ambiente (não versionado)
├── .gitignore              # Arquivos ignorados pelo Git
├── README.md               # Este arquivo
├── app.json                # Configurações do aplicativo (Expo/React Native)
├── W3LabsAgro.jsx          # Componente principal / Arquivo de entrada
│
├── Screens/                # Telas do Aplicativo
│   ├── DieselScreen.jsx           # Tela de controle de combustível
│   ├── HomeScreen.jsx             # Tela inicial (Dashboard)
│   ├── LoginScreen.jsx            # Tela de Autenticação
│   ├── ManagerScreen.jsx          # Painel de gestão
│   ├── ManuaisScreen.jsx          # Tela de acesso a manuais
│   ├── PlantioColheitaScreen.jsx  # Tela de registro de Plantio/Colheita
│   ├── PorcentagemPluviometroScreen.jsx # Tela de índice pluviométrico
│   ├── PulverizacaoScreen.jsx     # Tela de controle de pulverização
│   └── RevisoesScreen.jsx         # Tela de controle de manutenções
│
└── assets/                 # Imagens, fontes e recursos estáticos
    └── Back.gif            # Exemplo de asset (Background animado)
```

---

## ⚙️ Pré-requisitos

Para rodar este projeto na sua máquina, você precisará ter instalado:

1. **Node.js** (versão LTS recomendada)
2. **NPM** ou **Yarn** ou **Bun** (Gerenciadores de pacotes)
3. **Expo CLI** (se aplicável ao ambiente React Native)
4. Um emulador (Android Studio/Xcode) ou o aplicativo **Expo Go** no seu dispositivo móvel.

---

## 🚀 Como Executar o Projeto

1. **Clone o repositório:**
   ```bash
   git clone <url-do-repositorio>
   cd Walker10TECH-W3Labs-Agro-7a745ce8bca3bd0001bb668b32f272e9f0ce80ab
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   # ou
   yarn install
   ```

3. **Configure as variáveis de ambiente:**
   - Crie um arquivo `.env` na raiz do projeto, usando o `.env.example` (se houver) como base.

4. **Inicie o servidor de desenvolvimento:**
   ```bash
   npx expo start
   # ou
   npm start
   ```

5. **Acesse o App:**
   - Escaneie o QR Code gerado no terminal com o aplicativo **Expo Go** (Android/iOS) ou pressione `a` para abrir no emulador Android, ou `i` para o simulador iOS.

---

## 📱 Guia de Telas (Manual do Usuário)

Abaixo, detalhamos o propósito de cada tela para orientar o usuário final:

### 1. `LoginScreen.jsx` (Tela de Login)
- **Objetivo:** Garantir o acesso seguro ao aplicativo.
- **Uso:** Insira suas credenciais (e-mail/usuário e senha) fornecidas pelo administrador para entrar no sistema.

### 2. `HomeScreen.jsx` (Tela Inicial)
- **Objetivo:** Servir como o hub central do aplicativo.
- **Uso:** Após o login, você verá atalhos para todas as outras funções do aplicativo. Toque nos ícones ou botões para navegar para as áreas específicas.

### 3. `PlantioColheitaScreen.jsx` (Plantio e Colheita)
- **Objetivo:** Registrar e acompanhar as fases de cultivo.
- **Uso:** Utilize esta tela para inserir dados sobre datas de plantio, tipos de cultura, estimativas e registros reais de colheita.

### 4. `PulverizacaoScreen.jsx` (Pulverização)
- **Objetivo:** Controlar a aplicação de produtos químicos ou orgânicos.
- **Uso:** Registre o tipo de produto, dosagem, área aplicada e data da pulverização para manter o histórico da lavoura.

### 5. `PorcentagemPluviometroScreen.jsx` (Índice Pluviométrico)
- **Objetivo:** Monitorar o volume de chuvas.
- **Uso:** Insira as leituras diárias ou semanais do pluviômetro para acompanhar a umidade do solo e planejar a irrigação.

### 6. `RevisoesScreen.jsx` (Revisões e Manutenções)
- **Objetivo:** Gerenciar a frota e equipamentos.
- **Uso:** Registre quando máquinas (tratores, colheitadeiras) passaram por revisão, trocas de óleo, peças e agende manutenções futuras.

### 7. `DieselScreen.jsx` (Controle de Diesel)
- **Objetivo:** Monitorar o consumo de combustível.
- **Uso:** Registre o abastecimento de veículos e máquinas para calcular os custos operacionais da fazenda.

### 8. `ManagerScreen.jsx` (Painel do Gestor)
- **Objetivo:** Visão analítica para administradores.
- **Uso:** Tela restrita a usuários com perfil de gestão. Exibe relatórios, resumos de custos e produtividade.

### 9. `ManuaisScreen.jsx` (Manuais)
- **Objetivo:** Suporte e treinamento.
- **Uso:** Acesse documentações, dicas de uso do aplicativo e procedimentos operacionais padrão da fazenda.

---

## 🛠 Tecnologias Utilizadas

- **React / React Native** (Baseado na extensão `.jsx`)
- **Expo** (Possível uso, inferido pelo arquivo `app.json`)
- **JavaScript / ECMAScript**

---

## 🔒 Configuração de Variáveis de Ambiente

O projeto utiliza um arquivo `.env` para gerenciar chaves de API e configurações sensíveis.
Certifique-se de preencher as variáveis necessárias antes de executar o projeto em produção. O arquivo `.env` está incluído no `.gitignore` para garantir a segurança das suas credenciais.

---
*Documentação gerada automaticamente com base na estrutura do código.*
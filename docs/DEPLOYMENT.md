# Deploy

## Web
npm install
npm run build:web

O resultado pode ser publicado em Vercel ou outro host estático compatível com Expo Web.

## Mobile
npx expo start
npx eas build

## Variáveis
Copie .env.example para .env localmente e preencha somente as variáveis necessárias. Nunca faça commit do .env.

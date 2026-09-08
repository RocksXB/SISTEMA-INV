# SISTEMA // Inventário

HUD web original para gerenciamento de personagens, inventário, equipamento e carga em RPG. A aplicação usa somente **Firebase Authentication (e-mail/senha)** e **Cloud Firestore**; não existe cadastro público, backend próprio ou Realtime Database.

## Stack e arquitetura

- React 19, TypeScript, Vite, React Router e Lucide;
- Firebase SDK modular (`getAuth` e `getFirestore`);
- CSS responsivo próprio, com tokens visuais e suporte a `prefers-reduced-motion`;
- serviços em `src/services`, regras puras em `src/utils`, configurações em `src/config`, páginas em `src/pages`;
- listeners Firestore somente para personagem, catálogo e inventário ativos, sempre cancelados pelo React.

## Instalação e execução

```bash
npm install
cp .env.example .env.local
npm run dev
```

Preencha as seis variáveis do Web App **SISTEMA-INV** no `.env.local`:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Obtenha-as em Firebase Console → Configurações do projeto → Seus apps → SISTEMA-INV. Não adicione `databaseURL`. Reinicie o Vite depois de alterá-las. Para validar: `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.

## Autenticação e primeiro administrador

Crie as duas contas manualmente em Firebase Console → Authentication → Users. Não há cadastro público. Em seguida, no Firestore Console, crie manualmente `users/{UID}` para cada conta:

```js
{ displayName: "GM", email: "gm@exemplo.com", role: "admin", createdAt: <timestamp>, updatedAt: <timestamp> }
```

Para jogadores use `role: "player"`. Esse bootstrap deve ser feito pelo Console (acesso privilegiado do proprietário) porque as regras deliberadamente impedem clientes de criar perfis ou promover a própria role. Nunca adicione Admin SDK/service account ao frontend.

## Modelo Firestore

- `users/{uid}`: `displayName`, `email`, `role`, timestamps;
- `characters/{characterId}`: `ownerId` (UID), `name`, campos opcionais, `carryingCapacity`, timestamps;
- `items/{itemId}`: definição global com categoria, raridade, peso, empilhamento, slots e tags;
- `characters/{characterId}/inventory/{inventoryItemId}`: referência `itemId`, quantidade, estado/slot de equipamento e timestamps.

Peso total, percentual e status são derivados no navegador, nunca persistidos. Itens equipados continuam no peso. O catálogo não é duplicado no inventário. Itens empilháveis usam um documento determinístico com ID igual ao `itemId`; entregas concorrentes usam transação e quantidade zero remove o documento. Ao excluir um personagem, o serviço apaga seu inventário em batches de até 450 operações antes do documento principal. Uma definição global só pode ser excluída quando uma consulta `collectionGroup` confirma que nenhum inventário ainda a referencia.

## Permissões e regras

`firestore.rules` permite catálogo para autenticados e escrita somente para admin. Player lê apenas seu perfil, personagens cujo `ownerId` é seu UID e respectivos inventários. Em inventário, player só altera `equipped`, `equipmentSlot` e `updatedAt`; as regras verificam `equippable` e compatibilidade no item global. Criação, quantidade, exclusão, personagens, catálogo e roles são administrativas.

Publique regras e índices usando Firebase CLI autenticada no projeto existente:

```bash
npx firebase-tools deploy --project telaprincipal-23a86 --only firestore:rules,firestore:indexes
```

Alternativamente, cole `firestore.rules` na aba Rules do Firestore. A unicidade de slot é validada pela transação/UI, mas o Firestore Rules não consegue consultar atomicamente “qualquer documento em uma subcoleção”; para segurança absoluta contra clientes modificados numa futura escala, migre ocupação para documentos determinísticos `equipment/{slot}` ou uma Cloud Function. Compatibilidade e limites administrativos permanecem protegidos.

## Operação

O Project ID Firebase usado para publicação é `telaprincipal-23a86`. Após login, `/characters` consulta somente identidades autorizadas (admin vê todas). `/system/:id` apresenta busca, filtros, ordenações, detalhe, equipamento e carga em tempo real. `/admin` fornece CRUD de catálogo/personagens e entrega transacional de itens. Contas player não acessam a rota nem as operações pelas Rules.

Categorias ficam em `src/config/itemCategories.ts`, raridades em `itemRarities.ts`, slots em `equipmentSlots.ts` e faixas de carga em `encumbrance.ts`. Para ampliar, adicione o valor ao tipo correspondente em `src/types/index.ts`, à configuração e à lista equivalente de `firestore.rules` quando aplicável.

## Cloudflare Pages

1. Conecte este repositório em Workers & Pages → Create → Pages;
2. use build command `npm run build`, diretório `dist` e uma versão atual do Node;
3. cadastre as seis variáveis `VITE_FIREBASE_*` em Settings → Variables (produção e preview);
4. inclua o domínio Pages em Firebase Authentication → Authorized domains;
5. publique. `public/_redirects` produz o fallback SPA para URLs diretas como `/admin`.

Nenhum dado demo é inserido automaticamente. As únicas ações externas obrigatórias são preencher variáveis, criar usuários/perfis, publicar Rules e autorizar/conectar o domínio Cloudflare.

# SISTEMA-INV // HUD de RPG

Aplicação web para gerenciamento de personagens de RPG, inventário, equipamento, carga e habilidades/técnicas. O projeto foi pensado para uso privado de uma mesa de RPG, com uma interface escura/futurista e um fluxo simples entre **Player** e **GM/Admin**.

Este README é também o **documento de contexto do projeto**. Se este repositório for aberto em outro chat, no ChatGPT Work ou por outro agente de desenvolvimento, leia este arquivo antes de modificar qualquer coisa.

---

## 1. Objetivo do projeto

O sistema serve como uma ficha operacional do personagem durante o RPG.

Hoje ele cobre:

- autenticação de GM e players;
- personagens vinculados ao UID do jogador;
- catálogo global de itens;
- inventário por personagem;
- peso carregado e capacidade;
- itens que podem ficar "fora da carga" sem serem apagados;
- slots de equipamento;
- solicitação de itens pelo player com aprovação do GM;
- habilidades/técnicas oficiais por personagem;
- solicitação de habilidades pelo player com aprovação do GM;
- edição administrativa pelo site;
- edição manual de dados pelo Firebase Console em caso de emergência.

Não existe sistema de Level, XP ou Class.

---

## 2. Stack

- React 19;
- TypeScript;
- Vite;
- React Router;
- Lucide React;
- Firebase Authentication;
- Cloud Firestore;
- Firebase Emulator para testes das Rules;
- Cloudflare Pages para deploy.

O frontend usa apenas Firebase SDK modular.

### Firebase

Projeto atual:

- Project ID: `telaprincipal-23a86`;
- Web App: `SISTEMA-INV`;
- Authentication: Email/Password;
- Banco: Cloud Firestore.

**Não usar Realtime Database.**

Não adicionar:

- `databaseURL`;
- `firebase/database`;
- `getDatabase`;
- `VITE_FIREBASE_DATABASE_URL`;
- Admin SDK ou service account no frontend.

---

## 3. Variáveis de ambiente

O frontend usa somente:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

`.env` e `.env.local` não devem ser commitados.

Para desenvolvimento:

```bash
npm install
cp .env.example .env.local
npm run dev
```

---

## 4. Estrutura principal

```text
src/
  components/     componentes de interface
  config/         categorias, raridades, slots, tipos de skill etc.
  features/       contexto de autenticação
  hooks/          listeners React para Firestore
  lib/            configuração Firebase
  pages/          páginas principais
  services/       leitura/escrita Firestore
  types/          tipos TypeScript
  utils/          regras e validações puras

tests/
  firestore.rules.test.ts

firestore.rules
firestore.indexes.json
```

### Princípio importante

Lógica de banco deve ficar em `src/services`.

Validação reutilizável deve ficar em `src/utils`.

Listas centrais como slots, categorias e tipos devem ficar em `src/config`.

Evite espalhar strings equivalentes pelo projeto.

---

## 5. Autenticação e roles

Não existe cadastro público.

As contas são criadas manualmente no Firebase Authentication.

Cada usuário precisa também de:

```text
users/{uid}
```

Exemplo:

```js
{
  displayName: "GM",
  email: "gm@exemplo.com",
  role: "admin",
  createdAt: <timestamp>,
  updatedAt: <timestamp>
}
```

Roles válidas:

```text
admin
player
```

Players não podem alterar a própria role pelas Rules.

---

## 6. Modelo Firestore

### Usuários

```text
users/{uid}
```

Campos principais:

- `displayName`;
- `email`;
- `role`;
- timestamps.

---

### Personagens

```text
characters/{characterId}
```

Campos:

- `ownerId` — UID do jogador;
- `name`;
- `nickname`;
- `avatarUrl`;
- `description`;
- `carryingCapacity`;
- timestamps.

Um admin pode ver todos. Player vê apenas personagens cujo `ownerId` é o próprio UID.

---

### Catálogo global de itens

```text
items/{itemId}
```

Contém a definição do item:

- nome;
- descrição;
- categoria;
- peso;
- imagem;
- raridade;
- empilhamento;
- slots permitidos;
- tags.

A definição global não é duplicada dentro do inventário.

---

### Inventário

```text
characters/{characterId}/inventory/{inventoryItemId}
```

Campos principais:

- `itemId`;
- `quantity`;
- `carried`;
- `equipped`;
- `equipmentSlot`;
- timestamps.

`carried: false` significa que o personagem possui o item, mas ele não conta no peso carregado.

Um item fora da carga não pode permanecer equipado.

O peso total é calculado no frontend e não é persistido.

---

### Solicitações de itens

```text
itemRequests/{requestId}
```

Fluxo:

```text
Player envia
    ↓
pending
    ↓
GM revisa/edita
    ↓
approved ou rejected
```

A aprovação pode:

- criar um novo item global; ou
- vincular um item já existente.

A entrega e a revisão são protegidas por transação.

---

## 7. Habilidades e técnicas

As habilidades ficam **separadas do inventário** para facilitar manutenção e edição manual.

### Habilidades oficiais

```text
skills/{skillId}
```

Campos:

- `characterId`;
- `ownerId`;
- `name`;
- `type`;
- `description`;
- `jetCost`;
- `cooldown`;
- `duration`;
- `damage`;
- `effect`;
- `conditions`;
- `imageUrl`;
- `tags`;
- `createdBy`;
- `approvedBy`;
- `approvedAt`;
- timestamps.

### Tipos de habilidade

Definidos em:

```text
src/config/skillTypes.ts
```

Valores atuais:

- Habilidade;
- Técnica;
- Passiva;
- Ultimate;
- Transformação;
- Domínio;
- Outra.

### JET

`jetCost` é um número e representa o custo de energia JET da habilidade.

`cooldown`, `duration`, `damage`, `effect` e `conditions` são textos deliberadamente flexíveis. O sistema não tenta impor todas as regras de combate do RPG.

Exemplos válidos:

```text
cooldown: "2 turnos"
cooldown: "1 vez por combate"
duration: "Enquanto mantiver concentração"
damage: "3d20 + PRE"
```

---

### Solicitações de habilidades

```text
skillRequests/{requestId}
```

Fluxo:

```text
Player preenche habilidade
        ↓
skillRequests / pending
        ↓
GM pode corrigir qualquer campo
        ↓
APROVAR
        ↓
cria skills/{skillId}
        ↓
request vira approved
```

Ou o GM pode rejeitar e deixar uma observação.

O player pode excluir apenas uma solicitação própria enquanto ela ainda estiver `pending`.

O player **não grava diretamente em `skills`**.

---

## 8. Recuperação manual pelo Firebase

Esta parte é intencional.

Se a interface apresentar algum problema, o proprietário do projeto pode abrir:

Firebase Console → Firestore Database → Data

e editar manualmente:

```text
characters
items
itemRequests
skills
skillRequests
```

Por exemplo, para corrigir rapidamente uma habilidade:

```text
skills
  └── <skillId>
       ├── name
       ├── jetCost
       ├── damage
       ├── effect
       └── conditions
```

O Firebase Console administrativo não depende da interface React.

Por segurança, o frontend continua limitado pelas Firestore Rules.

---

## 9. Slots de equipamento

Fonte central:

```text
src/config/equipmentSlots.ts
```

Slots atuais:

- Cabeça;
- Corpo;
- Mãos;
- Pernas;
- Pés;
- Mão principal;
- Mão secundária;
- Acessório 1;
- Acessório 2;
- Acessório 3;
- Extra 1;
- Extra 2.

IDs internos:

```text
head
chest
hands
legs
feet
mainHand
offHand
accessory1
accessory2
accessory3
extra1
extra2
```

Ao criar um novo slot é necessário atualizar:

1. `src/types/index.ts`;
2. `src/config/equipmentSlots.ts`;
3. as listas correspondentes em `firestore.rules`;
4. testes das Rules quando aplicável.

---

## 10. Categorias e raridades de itens

Categorias:

```text
src/config/itemCategories.ts
```

Raridades:

```text
src/config/itemRarities.ts
```

Nunca adicionar apenas uma opção visual sem atualizar o tipo TypeScript e, quando necessário, as Firestore Rules.

---

## 11. HUD do player

Rota:

```text
/system/:characterId
```

Mostra:

- identidade;
- capacidade de carga;
- equipamento;
- inventário;
- busca/filtros;
- modal de detalhes do item;
- itens levados ou fora da carga;
- habilidades/técnicas;
- modal detalhado da habilidade;
- solicitações de habilidades;
- solicitações de itens.

A interface de habilidades é somente uma ficha organizada. O sistema não tenta automatizar todo o combate.

---

## 12. Área administrativa

Rota:

```text
/admin
```

O GM possui:

### Catálogo

CRUD de itens globais.

### Personagens

CRUD de personagens e gerenciamento do inventário.

### Habilidades

CRUD das habilidades oficiais em `skills`.

### Solicitações

Duas áreas:

- solicitações de itens;
- solicitações de habilidades.

O contador de pendências soma os dois fluxos.

---

## 13. Segurança Firestore

Arquivo fonte:

```text
firestore.rules
```

Regras principais:

- somente autenticados acessam dados do app;
- player lê somente seus personagens;
- player lê apenas skills cujo `ownerId` é seu UID;
- player não grava diretamente em `skills`;
- player cria apenas `skillRequests` para personagem próprio;
- player não pode se autoaprovar;
- apenas admin revisa solicitações;
- apenas admin altera catálogo, personagens, quantidades e skills oficiais;
- player pode alterar estado de equipamento/carga apenas dentro das restrições;
- qualquer acesso não explicitamente permitido termina no deny global.

### Atenção

Sempre que `firestore.rules` for alterado no GitHub, o merge **não publica automaticamente as Rules no Firebase**.

É necessário publicar manualmente ou via CLI.

---

## 14. Publicar Rules

Via Firebase Console:

```text
Firebase Console
→ Firestore Database
→ Rules
→ copiar firestore.rules
→ Publish
```

Ou pela CLI:

```bash
npx firebase-tools deploy   --project telaprincipal-23a86   --only firestore:rules,firestore:indexes
```

---

## 15. Testes e validação

Antes de mergear uma feature:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

`npm test` executa:

- testes unitários com Vitest;
- testes reais das Firestore Rules usando Firebase Emulator.

Java precisa estar disponível para o emulador Firestore.

O CI do GitHub executa typecheck, lint, testes e build nos Pull Requests para `main`.

---

## 16. Deploy Cloudflare Pages

Configuração:

```text
Build command: npm run build
Output directory: dist
Node: 22
Production branch: main
```

Configure as seis variáveis `VITE_FIREBASE_*`.

`public/_redirects` mantém o fallback SPA para rotas diretas.

Após merge na `main`, o Cloudflare Pages normalmente cria novo deploy automaticamente.

Alterações apenas de frontend não exigem republicar Firestore Rules.

Alterações em `firestore.rules` exigem.

---

## 17. Regras de manutenção para futuros agentes / ChatGPT Work

Antes de modificar o projeto:

1. ler este README;
2. buscar a versão atual da `main`;
3. criar branch nova baseada na `main`;
4. não trabalhar em branch antiga de outro PR;
5. manter mudanças restritas à feature solicitada;
6. abrir PR para `main`;
7. aguardar CI;
8. não fazer merge sem autorização do usuário;
9. informar explicitamente quando novas Firestore Rules precisam ser publicadas.

### Não quebrar estes fundamentos

- Firestore continua sendo o único banco;
- não usar Realtime Database;
- não remover segurança das Rules para "fazer funcionar";
- não permitir player escrever catálogo ou skill oficial;
- não permitir auto-promoção para admin;
- não armazenar peso total derivado;
- não colocar segredos no repositório;
- não substituir a estética atual por componentes genéricos sem necessidade.

---

## 18. Fluxo recomendado para novas features

```text
main atual
   ↓
branch de feature
   ↓
alterações pequenas e focadas
   ↓
PR
   ↓
CI verde
   ↓
merge autorizado pelo usuário
   ↓
Cloudflare deploy
   ↓
se Rules mudaram → publicar Firebase Rules
```

---

## 19. Arquivos mais importantes para diagnóstico

Se algo quebrar:

### Inventário

```text
src/pages/SystemPage.tsx
src/services/inventoryService.ts
src/hooks/useInventory.ts
src/utils/inventory.ts
firestore.rules
```

### Itens

```text
src/services/itemService.ts
src/services/itemRequestService.ts
src/components/ItemRequestForm.tsx
src/components/AdminItemRequests.tsx
```

### Habilidades

```text
src/components/CharacterSkills.tsx
src/components/SkillForm.tsx
src/components/PlayerSkillRequests.tsx
src/components/AdminSkillRequests.tsx
src/services/skillService.ts
src/services/skillRequestService.ts
src/hooks/useSkills.ts
src/hooks/useSkillRequests.ts
src/utils/skillRequest.ts
src/config/skillTypes.ts
```

### Admin

```text
src/pages/AdminPage.tsx
```

### Firebase

```text
src/lib/firebase.ts
firestore.rules
firestore.indexes.json
tests/firestore.rules.test.ts
```

---

## 20. Resumo rápido para retomada futura

Se você abriu este repositório sem contexto:

> SISTEMA-INV é uma HUD React/TypeScript para RPG, hospedada no Cloudflare Pages e conectada ao Firebase Auth + Firestore. Players possuem personagens, inventário e habilidades. Catálogo e skills oficiais são controlados pelo GM. Players solicitam itens e habilidades por coleções intermediárias, e o GM aprova. O sistema evita Realtime Database. Firestore Rules são parte crítica da arquitetura e precisam ser publicadas manualmente após alterações. Sempre trabalhe a partir da `main` atual em uma branch nova e valide tudo pelo CI antes do merge.

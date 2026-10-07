🌿 NutryStudy

«Estude. Revise. Evolua.»

O NutryStudy é uma plataforma web de organização acadêmica desenvolvida para tornar o processo de estudo mais simples, visual e consistente.

A aplicação foi pensada especialmente para estudantes da área de Nutrição, combinando organização de estudos, revisão espaçada e acompanhamento da rotina acadêmica em uma interface leve e intuitiva.

🔗 Aplicação: "lvnutrystudy.vercel.app" (https://lvnutrystudy.vercel.app/)

---

✨ Sobre o projeto

O NutryStudy nasceu da ideia de transformar uma rotina de estudos baseada em anotações e lembretes dispersos em um fluxo mais organizado.

A plataforma permite cadastrar conteúdos estudados e acompanhar automaticamente suas próximas revisões, seguindo três momentos principais:

- 🕐 24 horas
- 📅 7 dias
- 🗓️ 30 dias

Conforme as revisões são concluídas, o estudo avança até ser considerado concluído e passa para o histórico.

O projeto também mantém os dados localmente no navegador, permitindo continuar utilizando a aplicação mesmo sem uma infraestrutura de backend.

---

🎯 Objetivo

O principal objetivo do NutryStudy é ajudar estudantes a:

- Organizar conteúdos estudados
- Criar uma rotina de revisão
- Identificar revisões pendentes
- Visualizar conteúdos atrasados
- Acompanhar o cronograma futuro
- Registrar anotações e exercícios relacionados ao estudo
- Manter um histórico dos conteúdos concluídos
- Fazer backup dos dados da aplicação

A proposta é transformar o estudo em um processo mais visual, organizado e sustentável.

---

🚀 Funcionalidades

📚 Gerenciamento de estudos

É possível cadastrar novos estudos informando:

- Matéria
- Conteúdo
- Data do estudo
- Existência de anotações
- Existência de exercícios

Os estudos são automaticamente adicionados à rotina de acompanhamento.

---

🧠 Revisão espaçada

Cada estudo possui três etapas de revisão:

Revisão| Objetivo
🕐 24 horas| Primeiro reforço do conteúdo
📅 7 dias| Segunda revisão
🗓️ 30 dias| Revisão de consolidação

O sistema calcula automaticamente as datas de revisão a partir da data original do estudo.

---

⏰ Revisões prioritárias

A página inicial apresenta os estudos que precisam de atenção.

O sistema identifica:

- Revisões para hoje
- Revisões atrasadas
- Estudos ainda pendentes
- Estudos completamente concluídos

Isso permite que o usuário saiba rapidamente o que precisa estudar primeiro.

---

🔎 Busca e filtros

A área de estudos possui:

- Busca por conteúdo
- Busca por matéria
- Filtros por disciplina
- Visualização apenas dos estudos ativos

Isso facilita encontrar rapidamente conteúdos dentro da rotina acadêmica.

---

📅 Cronograma

A seção de calendário apresenta o cronograma de revisão de cada estudo.

Para cada conteúdo são exibidas as três etapas:

- 24 horas
- 7 dias
- 30 dias

Cada etapa informa se está:

- ✅ Concluída
- ⏳ Pendente
- ⚠️ Atrasada

---

🏆 Histórico

Quando as três revisões são concluídas, o estudo é marcado como concluído e passa para o histórico.

O usuário pode visualizar os conteúdos já finalizados e restaurá-los caso queira retomar o acompanhamento.

---

💾 Persistência local

Os dados dos estudos são armazenados utilizando o LocalStorage do navegador.

Isso permite que as informações permaneçam disponíveis mesmo depois de fechar ou atualizar a aplicação.

«Atualmente, os dados são armazenados localmente no dispositivo/navegador utilizado.»

---

📤 Backup e restauração

O NutryStudy permite:

Exportar

Os estudos podem ser exportados para um arquivo ".json".

Importar

Um backup previamente exportado pode ser carregado novamente na aplicação.

Essa funcionalidade facilita a preservação e transferência dos dados.

---

🎨 Design & Experiência

A interface foi construída com uma abordagem editorial, minimalista e acolhedora, combinando elementos relacionados à Nutrição com uma experiência de organização acadêmica.

Direção visual

- 🌿 Paleta inspirada em tons naturais
- 🤍 Superfícies claras
- ✨ Microinterações
- 📖 Tipografia editorial
- 📱 Design responsivo
- 🧩 Componentes com hierarquia visual
- 🎯 Foco em produtividade e legibilidade

A aplicação utiliza uma combinação de:

Playfair Display

para títulos e elementos editoriais.

Plus Jakarta Sans

para textos, controles e informações da interface.

---

🛠️ Tecnologias

O projeto foi desenvolvido utilizando:

Tecnologia| Utilização
⚛️ React| Construção da interface
📘 TypeScript| Tipagem e desenvolvimento
⚡ Vite| Desenvolvimento e build
🎨 Tailwind CSS| Estilização
🧩 Lucide React| Ícones
💾 LocalStorage| Persistência dos estudos
🌐 Vercel| Deploy da aplicação

O "package.json" atual utiliza React 19, TypeScript 7, Vite 7, Tailwind CSS 4 e Lucide React.

---

📁 Estrutura do projeto

NutryStudy-v1/
│
├── public/
│   ├── favicon.svg
│   ├── nutrystudy-logo.svg
│   └── ...
│
├── src/
│   ├── main.tsx
│   └── ...
│
├── dist/
│
├── nourish_study_web_app.tsx
│
├── index.html
├── package.json
├── package-lock.json
│
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
│
├── vite.config.ts
├── .oxlintrc.json
├── .gitignore
├── LICENSE
└── README.md

A estrutura atual do repositório contém, entre outros arquivos, "src", "public", "dist", "package.json", configurações do TypeScript/Vite e o arquivo principal da aplicação.

---

💻 Como executar localmente

1. Clone o repositório

git clone https://github.com/LucasReisD/NutryStudy-v1.git

2. Entre na pasta

cd NutryStudy-v1

3. Instale as dependências

npm install

4. Execute em modo de desenvolvimento

npm run dev

A aplicação ficará disponível no endereço informado pelo Vite no terminal.

---

📦 Build para produção

Para gerar a versão de produção:

npm run build

Para visualizar o build localmente:

npm run preview

Os scripts "dev", "build" e "preview" estão definidos no "package.json" do projeto.

---

☁️ Deploy

A aplicação está hospedada na Vercel.

🔗 Produção:
https://lvnutrystudy.vercel.app/

O repositório também está configurado com a aplicação publicada como recurso principal do projeto.

---

🧭 Fluxo da aplicação

                    ┌──────────────────┐
                    │   Novo estudo    │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   Estudo ativo   │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
         ┌─────────┐    ┌─────────┐    ┌─────────┐
         │  24h    │    │  7 dias │    │ 30 dias │
         └────┬────┘    └────┬────┘    └────┬────┘
              │              │              │
              └──────────────┼──────────────┘
                             ▼
                    ┌──────────────────┐
                    │     Concluído    │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │     Histórico    │
                    └──────────────────┘

---

🧠 Conceito de revisão

O NutryStudy utiliza uma abordagem simples de revisão espaçada, permitindo que o estudante retome o conteúdo em diferentes intervalos após o estudo inicial.

A lógica atual calcula automaticamente as datas com base na data original:

Estudo
  ↓
+ 1 dia
  ↓
Revisão 24h
  ↓
+ 7 dias
  ↓
Revisão 7 dias
  ↓
+ 30 dias
  ↓
Revisão 30 dias
  ↓
Concluído

---

🔐 Privacidade

O NutryStudy atualmente não exige criação de conta ou autenticação.

Os estudos são armazenados localmente utilizando o armazenamento do próprio navegador.

Isso significa que os dados não são enviados para um servidor próprio da aplicação na implementação atual.

---

🚧 Próximos passos

O projeto continua em evolução.

Algumas possibilidades para futuras versões incluem:

- [ ] Dashboard acadêmico mais completo
- [ ] Estatísticas de desempenho
- [ ] Gráficos de evolução
- [ ] Sistema de metas
- [ ] Notificações de revisão
- [ ] PWA / instalação como aplicativo
- [ ] Sincronização em nuvem
- [ ] Sistema de autenticação
- [ ] Banco de dados
- [ ] Anotações diretamente dentro da plataforma
- [ ] Sistema de tarefas
- [ ] Melhorias no calendário
- [ ] Personalização do perfil
- [ ] Tema escuro
- [ ] Experiência mobile ainda mais refinada

---

📌 Status

🟢 Em desenvolvimento

O NutryStudy é um projeto em evolução, utilizado também como laboratório para explorar:

- Desenvolvimento Front-end
- React
- TypeScript
- UI/UX
- Design Systems
- Persistência de dados
- Responsividade
- Deploy contínuo
- Organização de produtos digitais

---

👨‍💻 Desenvolvedor

Desenvolvido por Lucas Reis.

🔗 Links

- 💻 GitHub: "@LucasReisD" (https://github.com/LucasReisD)
- 🌿 NutryStudy: "lvnutrystudy.vercel.app" (https://lvnutrystudy.vercel.app/)
- 📦 Repositório: "LucasReisD/NutryStudy-v1" (https://github.com/LucasReisD/NutryStudy-v1)

---

📄 Licença

Este projeto está disponível sob a licença MIT.

Consulte o arquivo ""LICENSE"" (./LICENSE) para mais informações.

---

<div align="center">🌿 NutryStudy

Um estudo de cada vez. Uma revisão de cada vez.

</div>

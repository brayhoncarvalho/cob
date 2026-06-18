---
applyTo: "**"
---

# Dock — Instruções para o Copilot

## Contexto do Projeto
Este é um projeto Vue 3 + Vite + Tailwind CSS da Dock (instituição de pagamentos).
O Design System Dock publicado (`shared-design-system-vue-lib`) é o **padrão obrigatório**.
O modo Figma é ativado apenas quando o usuário fornece referência visual explícita.

---

## 🧠 Skills e Agentes Disponíveis

### Skills de Front-end

| Skill | Quando ativar |
|-------|---------------|
| `frontend-master` | **Ativar SEMPRE** que criar tela, criar componente, refatorar UI, tomar decisão de layout ou padrão de interação |
| `dock-ds` | Quando precisar de referência de componentes do DS Dock |
| `figma-use` | Quando o usuário fornecer URL ou nó Figma explícito |
| `figma-generate-design` | Quando construir tela completa a partir de referência Figma |
| `figma-code-connect` | Quando mapear componentes Figma ↔ Vue |

### Agentes Especializados

| Agente | Quando invocar |
|--------|----------------|
| `UX Guardian` | Antes de qualquer entrega de UI — valida leis de UX, hierarquia, estados e acessibilidade |
| `Design Reviewer` | Para comparação pixel-perfect implementação vs referência visual |
| `A11y Auditor` | Para auditoria completa de acessibilidade WCAG 2.2 AA |
| `DS Gatekeeper` | Para validação de conformidade com o Design System Dock |

### Prompts Disponíveis

| Prompt | Uso |
|--------|-----|
| `/nova-tela` | Criar nova tela com scaffold completo |
| `/novo-componente` | Criar componente verificando DS primeiro |
| `/audit-ux` | **Auditoria UX completa** (leis, hierarquia, estados, acessibilidade) |
| `/refatorar-ux` | **Refatorar UI existente** para ficar limpa e fluída |
| `/review-visual` | Comparar implementação vs referência visual |
| `/fix-a11y` | Auditar e corrigir acessibilidade |
| `/add-form-field` | Adicionar campo com máscara + validação + teste |
| `/connect-screen` | Conectar tela no fluxo de navegação |

### Regra de Ativação do Frontend Master

**O skill `frontend-master` é o ponto de partida para TODA criação ou modificação de UI.**
Ao receber qualquer tarefa de front-end, o agente DEVE consultar `copilot-config/base/skills/frontend-master/SKILL.md` antes de escrever código, especialmente:
- O PRÉ-VOO (4 perguntas antes de codar)
- As Leis de UX (verificar violações antes de propor solução)
- O Checklist Pós-Implementação (gate de qualidade antes de declarar pronto)

---

## ⚠️ GATE DE DESIGN SYSTEM — Detecção Inteligente

O agente DEVE determinar qual Design System seguir **antes de qualquer alteração visual** (criar componente, ajustar estilo, adicionar tela, modificar layout).

### Lógica de detecção (em ordem de prioridade)

1. **Referência visual explícita** — Se o usuário mencionou "Figma", "print", "screenshot", "referência visual", "nó", "frame" ou anexou uma imagem de referência:
  → **Ativar modo de referência visual automaticamente.** Usar `DESIGN_SYSTEM.md` + referência enviada como verdade visual.

2. **DS Storybook (default)** — Se o projeto tem `shared-design-system-vue-lib` instalado E o usuário NÃO mencionou Figma:
   → **Usar DS Storybook automaticamente. NÃO perguntar.**

3. **Ambíguo** — Se não ficou claro se há referência visual (ex: "crie uma tela de login" sem mais contexto):
   → **Perguntar UMA vez:**
   > "Esse trabalho parte de uma referência no Figma, ou devo seguir o DS Storybook publicado (`shared-design-system-vue-lib`)?"

4. **Conflito** — Se durante a implementação o Storybook define X mas o Figma mostra Y:
   → **Parar e perguntar** qual deve prevalecer naquele ponto específico.

5. **DS não instalado** — Se o projeto NÃO tem `shared-design-system-vue-lib`:
   → **Alertar** que o DS não está instalado e perguntar como proceder.

### Regras do gate
- Após determinar o modo, aplicar de forma consistente até o fim da tarefa.
- Se o usuário trocar o modo no meio de uma tarefa, ajustar imediatamente.
- **Nunca perguntar desnecessariamente** — se a detecção é clara (condições 1 ou 2), agir direto.
- **Nunca escolher silenciosamente quando ambíguo** — se condição 3, perguntar obrigatoriamente.
- **Print, screenshot ou referência visual externa NÃO exigem `figma:check` nem `figma:sync`** — nesses casos a referência visual basta para implementação/revisão.
- **`figma:check` e `figma:sync` são obrigatórios apenas quando a tarefa depende do arquivo Figma real** (file id, node id, frame, tokens via API, sync oficial).
- **Condição especial — DS instalado + Figma URL:** se o usuário forneceu uma URL/node Figma E o projeto tem `shared-design-system-vue-lib` instalado (mesmo que quebrado ou stub), confirmar explicitamente antes de começar:
  > "Usarei o Figma como verdade visual e ignorarei o DS Storybook para este componente. Confirma?"
  Não assumir silenciosamente — essa ambiguidade já causou desvios visuais (ex: `cornerRadius`, `strokeWeight` ignorados).

### Modo "Design System Dock (Storybook)" — DEFAULT
- Importar e usar componentes de `shared-design-system-vue-lib` (Button, Input, Select, Stepper, etc.).
- Usar tokens públicos do pacote (color, font, space, border, shadow).
- Importar `shared-design-system-vue-lib/style.css` no bootstrap.
- **Não recriar** componentes que já existem no pacote.
- Se um componente necessário não existir no pacote, perguntar se deve criar local ou aguardar inclusão no DS.

### Modo "Referência Visual / Figma" — OVERRIDE
- Seguir `DESIGN_SYSTEM.md` como fonte de verdade.
- Respeitar cores hex exatas, tipografia, dimensões e espaçamentos documentados.
- Todas as regras abaixo (fidelidade, prints, slider, backgrounds, etc.) se aplicam integralmente.
- Se a referência for apenas print/screenshot externo, trabalhar direto com a imagem.
- Se a referência depender do arquivo Figma real, rodar `npm run figma:check` antes de `figma:sync`.

---

## Revisão do Design Atual — Regra Obrigatória

Antes de editar uma tela ou componente existente, o agente DEVE:
1. **Inspecionar visualmente** a implementação atual.
2. **Identificar** se há estrutura simplificada, desalinhamento, ausência de estados visuais, hierarquia fraca, falta de completude ou desvio do DS selecionado.
3. **Se identificar oportunidades de melhoria**, listar as sugestões e **perguntar ao usuário** se pode elevar a qualidade visual, respeitando o DS escolhido e os padrões de UI/UX.
4. **NUNCA aplicar melhorias silenciosamente** — toda alteração de composição deve ser proposta e aprovada.
5. Se a UI estiver conforme o DS selecionado e visualmente completa, prosseguir sem perguntar.

---

## Baseline Obrigatória de Acessibilidade e Usabilidade

Toda criação visual nova e toda melhoria em interface existente DEVE seguir, no mínimo:

- **WCAG 2.2 nível AA** como baseline obrigatória de acessibilidade.
- **Heurísticas de Nielsen** como framework obrigatório de revisão de UX e usabilidade.

### Como aplicar WCAG 2.2 AA neste projeto
- Garantir contraste adequado entre texto, fundo, bordas e estados.
- Garantir foco visível, navegação por teclado e ordem lógica de tabulação.
- Garantir labels, nomes acessíveis, `aria-*` quando necessário e semântica correta dos elementos.
- Garantir mensagens de erro claras, associação com campos e instruções compreensíveis.
- Não depender apenas de cor para comunicar estado, erro, seleção ou prioridade.
- Garantir alvos interativos adequados, estados consistentes e feedback perceptível.

### Como aplicar heurísticas de Nielsen neste projeto
- Visibilidade do estado do sistema: feedback claro em ações, seleção, erro e carregamento.
- Correspondência com o mundo real: rótulos, textos e fluxos compreensíveis para o usuário.
- Controle e liberdade do usuário: permitir correção, retorno, cancelamento e edição sem fricção desnecessária.
- Consistência e padrões: manter comportamento e aparência coerentes com o DS escolhido.
- Prevenção de erros: preferir validação, máscara e orientação antes do erro acontecer.
- Reconhecimento em vez de memorização: tornar opções, contexto e próximos passos evidentes.
- Estética e design minimalista: remover ruído visual e simplificação pobre; buscar clareza e completude.

### Regra operacional
- Essas duas referências NÃO são opcionais.
- Se a solução visual proposta violar WCAG 2.2 AA ou heurísticas de Nielsen, o agente deve corrigir a proposta ou apontar o desvio antes de implementar.

---

## Referência obrigatória (modo Figma)
Antes de qualquer alteração visual no modo Figma, leia `DESIGN_SYSTEM.md` na raiz do projeto.
Esse arquivo contém todas as cores, fontes, tamanhos, componentes e regras visuais.

## Regras de Implementação

### Fidelidade ao Design
- **NUNCA invente estilos, cores, tamanhos ou espaçamentos.**
- Use EXATAMENTE os valores definidos no `DESIGN_SYSTEM.md`.
- Se o design mostra texto em 2 linhas, implemente em 2 linhas.
- Negrito apenas onde o Figma indica negrito (`font-weight: 700` ou `bold`).
- Não arredonde tamanhos de fonte — use o valor exato em px.

### Extração de Tokens do Figma — Checklist Obrigatório

Ao analisar um nó Figma (via API, JSON ou print), extrair **todos** os atributos abaixo para cada elemento relevante antes de escrever qualquer CSS:

| Propriedade Figma | Equivalente CSS | Erro comum se ignorado |
|---|---|---|
| `fills[].color` | `background`, `color` | Cor errada |
| `strokes[].color` + `strokeWeight` + `strokeAlign` | `border` (espessura + cor) | Borda com 1px quando deveria ser 4px |
| `cornerRadius` / `rectangleCornerRadii` | `border-radius` | **Elemento quadrado quando deveria ser arredondado** |
| `effects` (DROP_SHADOW, INNER_SHADOW) | `box-shadow` | Sombra ausente |
| `absoluteBoundingBox` (width, height) | Dimensões fixas | Tamanho errado |
| `paddingLeft/Right/Top/Bottom` (auto layout) | `padding` | Espaçamento incorreto |
| `fontFamily`, `fontWeight`, `fontSize`, `lineHeight` | Tipografia | Fonte ou peso errado |
| `opacity` | `opacity` | Elemento opaco quando deveria ser semi-transparente |

**Regra absoluta sobre `cornerRadius`:** é o atributo mais frequentemente omitido. Se o JSON tiver `"cornerRadius": 0` → elemento quadrado. Se tiver qualquer valor > 0, aplicar `border-radius` com o valor exato em px. Verificar sempre — nunca assumir que é 0.

### Análise de Prints e Referências Visuais
- Quando o usuário enviar um **print/screenshot de referência**, analise cada detalhe da imagem:
  - Posição dos elementos (alinhamento, espaçamento entre eles)
  - Quantidade de linhas do texto (se está em 1, 2 ou 3 linhas — reproduzir exatamente)
  - Peso do texto (regular, medium, bold) — comparar visualmente
  - Cores exatas (se o print mostrar um tom, conferir contra o `DESIGN_SYSTEM.md`)
  - Tamanho relativo dos elementos (botões, cards, circles)
  - Presença ou ausência de bordas, sombras, separadores
  - Ícones e imagens (posição, tamanho, se existem ou não)
- **Compare pixel a pixel** o print com a implementação atual.
- Se algo no print **diverge** da implementação, ajuste o código para refletir o print.
- Se o print mostra algo que **não está no `DESIGN_SYSTEM.md`**, pare e pergunte ao usuário antes de implementar.
- Após implementar, **tire um screenshot** da página (via browser tools) e compare com o print de referência.
- Corrija qualquer divergência encontrada na comparação.

### Dúvidas e Elementos Não Claros no Print
- **NUNCA implemente algo que não entendeu ou não conseguiu identificar no print.**
- Se houver elementos ambíguos, ilegíveis, ou que não conseguiu reproduzir com certeza:
  1. **Crie uma lista numerada** com todos os pontos de dúvida.
  2. **Descreva o que viu** no print e o que não ficou claro (ex: "Vi um ícone no canto superior direito, mas não consigo identificar o que é").
  3. **Pergunte ao usuário** antes de implementar qualquer coisa duvidosa.
  4. **Aguarde a resposta** — não invente, não assuma, não crie elementos por conta própria.
- Isso se aplica a: ícones, imagens, textos parcialmente visíveis, elementos sobrepostos, cores ambíguas, espaçamentos incertos, e qualquer detalhe que gere dúvida.
- **Regra absoluta:** é melhor perguntar do que criar algo errado.
- Se uma tela do fluxo tiver partes mapeadas no Figma, mas **não puder ser reproduzida com fidelidade completa** por falta de asset, frame incompleto, imagem não exportada ou padrão visual não identificado, **NÃO implemente uma versão simplificada, mínima ou "só funcional"**.
- Nesses casos, pare e informe exatamente o que está faltando para reproduzir a tela fielmente.

### Tipografia
- **Roboto**: fonte principal para títulos, corpo, labels, descrições.
- **Red Hat Display**: exclusivamente para botões CTA e textos do footer corpo.
- Nunca use Poppins ou outra fonte não listada no design system.
- Pesos: 300 (light), 400 (regular), 500 (medium), 600 (semibold), 700 (bold).

### Cores — Hex exatos
- Principal: `#00d8d8`
- Terciária: `#1cc0c0`
- Amarelo destaque: `#eeff88`
- Botão escuro: `#444746`
- Texto escuro: `#242424`
- Texto cinza: `#5c5c5c`
- Texto muted: `#777777`
- Fundo claro: `#e6e6e6`
- Preto footer: `#000000`
- Branco: `#ffffff`

### Funcionalidade Interativa
- **Todo componente interativo DEVE funcionar**, não apenas parecer visual.
- Sliders/ranges devem usar `<input type="range">` nativo estilizado — o usuário deve conseguir arrastar para mudar o valor.
- Botões de +/- devem alterar o state reativo.
- Seleção de parcelas deve alterar o state e refletir visualmente (estado selecionado vs normal).
- Valores calculados (parcela mensal, taxa) devem atualizar em tempo real conforme o state muda.
- Nunca crie componentes que parecem interativos mas são estáticos.
- Formulários devem ter `v-model` nos inputs e validação básica.

### Slider — Regras Críticas
- **Posição dos botões:** botão `-` (decrementar) à ESQUERDA, botão `+` (incrementar) à DIREITA.
  - Isso segue a direção natural do `<input type="range">`: esquerda=min, direita=max.
  - Arrastar para a esquerda diminui o valor (direção do `-`), arrastar para a direita aumenta (direção do `+`).
  - **NUNCA inverter** a posição dos botões +/-.
- **Thumb do slider:** DEVE ser branco puro (`#ffffff`), quadrado (24x24px), sem border-radius.
  - Sem amarelo (`#eeff88`), sem accent color, sem decoração interna.
  - Usar `appearance: none`, `border: none`, `box-shadow: none` para remover estilos padrão do browser.
- **Centralização vertical do thumb:** o thumb (24px) deve ficar centralizado na track (10px).
  - No WebKit: `margin-top: -7px` no `::-webkit-slider-thumb` (cálculo: `-(thumbHeight - trackHeight) / 2`).
- **Track:** cor única `#b9b9b9`, height 10px, sem border-radius.
- Estilizar via `<style scoped>` com classes CSS — ver `DESIGN_SYSTEM.md` §3.7 para o CSS completo.

#### Exemplo — Slider (Correto vs Incorreto)

❌ **ERRADO — NÃO FAÇA ISSO:**
```vue
<!-- Botões invertidos, thumb amarelo, track com cores diferentes -->
<button @click="value++">+</button>
<input type="range" v-model="value" />
<button @click="value--">-</button>

<style>
input[type="range"]::-webkit-slider-thumb {
  background: #eeff88;        /* ERRADO: thumb deve ser branco */
  border-radius: 50%;         /* ERRADO: deve ser quadrado */
  width: 16px; height: 16px;  /* ERRADO: deve ser 24x24 */
}
</style>
```

✅ **CORRETO — FAÇA ASSIM:**
```vue
<!-- Botão - à ESQUERDA, + à DIREITA, thumb branco quadrado -->
<button @click="value > min ? value-- : null">−</button>
<input type="range" v-model="value" :min="min" :max="max" class="slider-track" />
<button @click="value < max ? value++ : null">+</button>

<style scoped>
.slider-track { appearance: none; width: 100%; height: 10px; background: #b9b9b9; }
.slider-track::-webkit-slider-thumb {
  appearance: none;
  width: 24px; height: 24px;
  background: #ffffff;       /* Branco puro */
  border: none;
  border-radius: 0;         /* Quadrado */
  margin-top: -7px;         /* Centraliza na track */
  cursor: pointer;
}
</style>
```

#### Exemplo — Background Full-Width (Correto vs Incorreto)

❌ **ERRADO:**
```vue
<!-- Margin lateral quebra o background -->
<section class="bg-[#1cc0c0] mx-4 px-6 py-8">...</section>
```

✅ **CORRETO:**
```vue
<!-- Background vai até as bordas, padding interno para conteúdo -->
<section class="bg-[#1cc0c0] w-full px-6 py-8">...</section>
```

#### Exemplo — Campo com Máscara (Correto vs Incorreto)

❌ **ERRADO:**
```vue
<!-- Input "solto", sem máscara, sem validação, sem feedback -->
<input v-model="cpf" placeholder="CPF" />
```

✅ **CORRETO:**
```vue
<label for="cpf-input">CPF</label>
<input
  id="cpf-input"
  :value="cpfFormatado"
  @input="onCpfInput"
  @blur="validateCpf"
  :class="{ 'border-[#dc3545]': cpfError }"
  :aria-invalid="!!cpfError"
  :aria-describedby="cpfError ? 'cpf-error' : undefined"
  placeholder="000.000.000-00"
/>
<span v-if="cpfError" id="cpf-error" class="text-[#dc3545] text-[12px]" role="alert">
  {{ cpfError }}
</span>
```

### Backgrounds e Margens
- Seções com fundo colorido (teal `#1cc0c0`, cinza `#e6e6e6`, preto `#000000`) DEVEM ter o background estendendo até as bordas do container — **sem margens laterais** visíveis.
- O CSS global DEVE ter: `html, body { margin: 0; padding: 0; width: 100%; overflow-x: hidden; }`
- O container raiz usa `w-full max-w-[414px] mx-auto` — as seções dentro dele devem ter width 100% implícito.
- **NUNCA** adicionar `mx-*` (margin horizontal) em wrappers de seção que quebrem o background full-width.

### Ícones e Assets Visuais
- Quando o design exigir ícones (cards, seções), **pergunte ao usuário**:
  - "Você quer fornecer os ícones (exportar do Figma e salvar em `public/`)?"
  - "Ou prefere que eu crie SVGs inline baseados no design?"
- Se o usuário escolher fornecer: pare e aguarde ele salvar em `public/`, depois peça confirmação.
- Se o usuário escolher que você crie: crie SVGs inline fiéis ao estilo visual do Figma (traço fino, cor `#00d8d8`, sem fill pesado).
- **Nunca crie ícones silenciosamente sem perguntar.**

### Imagens
- Todas as imagens devem ficar em `public/`.
- Quando precisar de uma imagem nova, **pare e peça ao usuário** para salvar na pasta `public/` com o nome correto.
- Depois peça confirmação antes de referenciar no código.
- Nunca gere URLs de imagens externas inventadas.
- Se uma tela depender de imagens/arte do Figma que ainda não existem em `public/`, **não monte um placeholder visual temporário**. Pergunte ao usuário e aguarde os arquivos.

### Padrão de Navegação — Identificação Obrigatória

Antes de codificar **qualquer** componente com sidebar, menu lateral ou abas, identificar o padrão de navegação **olhando a estrutura do frame no Figma**:

| Evidência no Figma | Padrão correto | Implementação |
|---|---|---|
| Todas as seções empilhadas verticalmente **no mesmo frame** | **Scroll-anchor** | `<a href="#id-da-secao">` + `scroll-behavior: smooth`. Sidebar destaca a seção ativa pelo scroll. |
| Seções em **frames separados** / telas distintas | **SPA routing** | Troca de componente em `App.vue` via query param ou emit |
| Seções sobrepostas com estados visível/oculto | **Tab panels** | `v-show` ou `v-if` no mesmo container |

**Regras obrigatórias:**
- **Nunca assumir** o padrão de navegação — verificar a estrutura do Figma primeiro.
- Frame com `height > 2000px` contendo todas as seções empilhadas = **quase sempre scroll-anchor**, não SPA.
- Sidebar com nav items apontando para conteúdo do mesmo frame = **scroll-anchor com IntersectionObserver** para highlight ativo.
- Se a estrutura do Figma não estiver clara, **perguntar ao usuário** antes de implementar.
- **NUNCA** criar tab-switching (v-if por aba) quando o design é scroll-anchor — isso esconde seções que deveriam estar visíveis.

#### Implementação de Scroll-Anchor com Sidebar Reativa

```vue
<!-- Cada seção recebe um id único -->
<section id="dados-gerais">...</section>
<section id="dados-pessoais">...</section>

<!-- Nav item usa âncora -->
<a href="#dados-gerais" class="nav-item" :class="{ active: activeSection === 'dados-gerais' }">
  Dados Gerais
</a>

<script setup>
// IntersectionObserver para destacar seção ativa no scroll
const activeSection = ref('dados-gerais')
onMounted(() => {
  const observer = new IntersectionObserver(
    entries => entries.forEach(e => { if (e.isIntersecting) activeSection.value = e.target.id }),
    { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
  )
  document.querySelectorAll('section[id]').forEach(s => observer.observe(s))
})
</script>
```

---

### Campos de Formulário Responsivos — Proibição de Width Fixo

**Nunca** usar `width: Npx` fixo em campos de formulário ou seus containers. Isso quebra layouts em viewports menores que o Figma (ex: design 1920px visualizado em 1280px).

| ❌ PROIBIDO | ✅ CORRETO |
|---|---|
| `width: 600px` | `flex: 1; min-width: 0` |
| `flex: 0 0 396px` | `flex: 1; min-width: 200px` |
| `width: 1236px` | `width: 100%` |
| `flex: 0 0 221px` (botão) | `flex: 1; min-width: 120px; max-width: 260px` |

**Regras obrigatórias:**
- Campos em linha (mesmo row) → usar `display: flex; gap: Npx` com `flex: 1` em cada campo.
- Se o Figma especifica proporção (ex: dois campos de 600px de 1236px total) → usar `flex: 1` em ambos (50%/50%) ou `flex: 2` / `flex: 1` para proporções diferentes.
- Botões de ação → `flex: 1; min-width: 120px; max-width: 260px` — nunca fixo.
- Containers de seção → `width: 100%`, não largura fixa em px.
- Sidebar → pode ter `width: 342px; min-width: 342px; flex-shrink: 0` pois é elemento fixo de layout, não campo de dado.

---

### Mapeamento 100% Antes de Implementar — Regra de Planejamento

Para qualquer tela com **múltiplas seções** (>2), **múltiplas abas** ou **formulários extensos**, a sequência obrigatória é:

1. **Extrair do Figma** o inventário completo: todas as seções, todos os campos, todos os tipos de dado.
2. **Listar em formato de tabela** antes de escrever qualquer linha de código:
   ```
   Seção 1 — Dados Gerais
     - Nome completo (texto)
     - CPF (texto, máscara)
     - Data nascimento (data)
     ...
   Seção 2 — Dados Pessoais
     - Estado civil (select)
     - Sexo (select)
     ...
   ```
3. **Confirmar com o usuário** se o inventário está completo e correto.
4. Só então começar a implementar.

**Regra absoluta:** Se uma seção não estiver no inventário, ela **não pode ser implementada** como placeholder. Deve ser pesquisada no Figma ou perguntada ao usuário.

---

### Estrutura de Componentes
- Cada seção da landing page é um componente Vue em `src/components/`.
- Use `<script setup lang="ts">` (Composition API).
- Tailwind CSS para estilização (tokens no `tailwind.config.js`).
- Componentes existentes:
  - `HeroSection.vue` — Header + Hero
  - `SimuladorSection.vue` — Simulador de empréstimo
  - `ComoFuncionaSection.vue` — Seção "Como funciona?"
  - `BeneficiosSection.vue` — Seção "Atendendo suas necessidades"
  - `PropostaScreen.vue` — Tela de proposta/formulário

### Quando tiver dúvida
- **Pergunte ao usuário** em vez de inventar.
- Consulte o `DESIGN_SYSTEM.md` para validar qualquer decisão visual.
- Se um elemento não está descrito no design system, peça esclarecimento.

### Pacote DS Ausente ou Quebrado — Procedimento Obrigatório

Se `shared-design-system-vue-lib` não estiver instalado corretamente (symlink quebrado, pasta vazia, `node_modules` corrompido):

1. **Inventariar todos os imports antes de qualquer outra ação:**
   ```bash
   # PowerShell
   Select-String -Path 'src/**/*.vue','src/**/*.ts' -Pattern "from 'shared-design-system-vue-lib'" -Recurse
   ```
2. **Criar stub completo de uma vez** com todos os named exports encontrados — nunca criar stub mínimo e completar depois (isso causa múltiplos ciclos de erro → fix → restart).
3. **Componentes Vue stub:** `{ template: '<slot />' }` para componentes de layout; `{ template: '<span />' }` para ícones.
4. **Após criar ou modificar qualquer arquivo em `node_modules/`:** deletar o cache do Vite imediatamente:
   ```bash
   Remove-Item -Recurse -Force node_modules/.vite
   ```
5. Reiniciar o servidor Vite para aplicar as mudanças.

> **Por quê:** Vite pré-bundla dependências em `.vite/deps/`. Modificar arquivos físicos em `node_modules/` sem limpar esse cache faz o Vite continuar usando a versão antiga (inclusive versões com exports faltando), gerando erros de runtime invisíveis no terminal do servidor.

### Fluxo de validação visual
1. Recebeu print de referência → analisar cada detalhe antes de codificar.
2. Implementar o código baseado no print + `DESIGN_SYSTEM.md`.
3. Tirar screenshot da página implementada (browser tools).
4. **Comparar screenshot vs. print de referência — esta etapa NÃO é opcional.** Verificar explicitamente:
   - Arredondamento de cantos (`cornerRadius`) — o erro mais comum de omissão
   - Espessura e cor da borda (`strokeWeight`, `strokeAlign`)
   - Sombras (`box-shadow` / `effects`)
   - Espaçamentos e dimensões (padding, largura, altura)
   - Pesos e tamanhos de fonte
5. Corrigir divergências até ficar fiel.
6. Se houver ambiguidade entre o print e o `DESIGN_SYSTEM.md`, **perguntar ao usuário**.
7. **Nunca conectar a navegação de uma nova tela ao fluxo principal antes de essa tela estar visualmente fiel ao Figma.**

### O que NÃO fazer
- Não adicionar animações que não existem no Figma.
- Não mudar border-radius de componentes existentes.
- Não adicionar sombras não especificadas.
- Não trocar a ordem das seções.
- Não usar cores "parecidas" — usar o hex exato.
- Não usar fontes alternativas.
- Não criar imagens placeholder com URLs externas.
- Não ignorar prints de referência — eles são a verdade visual.
- Não "interpretar" o print — reproduzir exatamente o que está visível.
- Não assumir que um texto é bold se no print parece regular (e vice-versa).
- Não criar componentes interativos que não funcionam (ex: slider visual sem `<input type="range">`).
- Não criar ícones sem perguntar ao usuário se quer fornecer ou se quer que sejam criados.
- Não inverter posição dos botões +/- do slider (- ESQUERDA, + DIREITA, sempre).
- Não usar amarelo (#eeff88) no thumb do slider — thumb é branco puro (#ffffff).
- Não deixar o thumb do slider desalinhado verticalmente da track.
- Não criar margens laterais em seções com background colorido — background deve ir até as bordas do container.
- Não criar campos de formulário sem máscara e validação quando o tipo de dado exigir (CPF, data, moeda, telefone, etc.).
- Não criar tela parcial, versão resumida, placeholder visual, wireframe temporário ou "stub funcional" quando o Figma mostrar uma composição mais rica.
- Não pular header, footer, stepper, blocos visuais, imagens ou textos do Figma só para fazer o fluxo funcionar.
- Não ligar uma tela nova na navegação se ela ainda estiver incompleta visualmente.
- Não ignorar `cornerRadius` ao extrair tokens do Figma — é o detalhe mais frequentemente omitido e causa desvio visual óbvio.
- Não criar stub do DS sem antes inventariar todos os imports com grep — stub incompleto gera múltiplos ciclos de erro → fix → restart.
- Não modificar arquivos em `node_modules/` sem deletar `node_modules/.vite/` em seguida — o cache do Vite perpetua a versão antiga.
- Não usar `width` ou `flex: 0 0 Npx` fixo em campos de formulário — usar `flex: 1` com `min-width` e `max-width` proporcionais.
- Não assumir que navegação com sidebar é SPA routing — verificar se é scroll-anchor (seções no mesmo frame) antes de implementar.
- Não começar a codificar tela com múltiplas seções sem ter o inventário 100% completo de todos os campos e seções — implementar com dados incompletos gera placeholders proibidos.
- Não trocar `<input readonly>` por `<div role="textbox">` — usar sempre elementos HTML semânticos nativos.
- Não entregar componente sem validar que TODAS as seções mapeadas foram implementadas (não apenas a primeira).

### Máscaras, Validações e Formulários — Regras Obrigatórias

Todo campo de formulário DEVE ter máscara e validação adequadas ao tipo de dado. **Nenhum campo pode ser "só texto"** quando o dado possui formato conhecido.

#### Máscaras obrigatórias por tipo de campo

| Tipo de dado          | Máscara / Formato                  | Exemplo                    |
| --------------------- | ---------------------------------- | -------------------------- |
| CPF                   | `000.000.000-00`                   | `412.456.508-90`           |
| CNPJ                  | `00.000.000/0000-00`               | `13.370.835/0001-85`       |
| CPF/CNPJ (auto)       | Detectar pelo comprimento e alternar | Até 11 dígitos=CPF, 12+=CNPJ |
| Data                  | `DD/MM/AAAA` + `<input type="date">` nativo como alternativa | `29/05/2000` |
| Valor monetário BRL   | `R$ 0.000,00` (pontos para milhar, vírgula para decimal) | `R$ 69.000,00` |
| Valor monetário USD   | `$ 0,000.00` (vírgulas para milhar, ponto para decimal) | `$ 69,000.00` |
| Telefone              | `(00) 00000-0000` ou `(00) 0000-0000` | `(63) 95448-9531` |
| CEP                   | `00000-000`                        | `06460-000`                |

#### Regras de implementação de máscaras

1. **Usar funções puras** — criar composables/utils (`src/utils/masks.ts` e `src/utils/validators.ts`) reutilizáveis.
2. **Máscara aplicada em tempo real** — ao digitar, o valor já deve ser formatado. Usar evento `@input` no campo.
3. **Separar valor formatado de valor limpo** — armazenar internamente o valor sem máscara (só dígitos) para envio ao backend.
4. **Não bloquear o campo** — o usuário deve poder apagar e redigitar sem travamentos.
5. **CPF/CNPJ:** aplicar máscara progressiva e, ao submeter, validar dígitos verificadores (algoritmo módulo 11).
6. **Data:** campos de data DEVEM usar `<input type="date">` nativo como seletor. Exibir o valor formatado em `DD/MM/AAAA` para o usuário.
7. **Valor monetário BRL:** prefixo `R$`, pontos como separador de milhar, vírgula para centavos. Permitir apenas números. Formatar a cada keystroke.
8. **Valor monetário USD:** prefixo `$`, vírgulas como separador de milhar, ponto para centavos.
9. **Telefone:** detectar se celular (9 dígitos) ou fixo (8 dígitos) e ajustar máscara automaticamente.

#### Validações obrigatórias antes de submit

1. **Campos obrigatórios** — exibir mensagem de erro inline abaixo do campo (sem `alert()`). Usar texto vermelho `#dc3545`, font-size 12px.
2. **CPF inválido** — verificar dígitos verificadores (módulo 11). Rejeitar CPFs com todos os dígitos iguais (ex: 111.111.111-11).
3. **CNPJ inválido** — verificar dígitos verificadores.
4. **Data inválida** — verificar se a data existe (ex: 30/02 é inválido). Para nascimento, verificar idade mínima 18 anos.
5. **Valor monetário** — verificar se é maior que zero. Para empréstimo, respeitar min/max configurados (ex: R$ 1.000 a R$ 200.000).
6. **Nome** — mínimo 3 caracteres, não permitir apenas espaços.
7. **Feedback visual** — campo com erro deve ter borda vermelha (`border-color: #dc3545`). Campo válido volta à borda normal.
8. **Mensagens de erro** — exibidas inline, abaixo do campo, apenas após o campo perder foco (blur) ou ao tentar submeter.
9. **Botão de submit** — não desabilitar, mas impedir envio se houver erros (marcar campos com erro e scrollar até o primeiro).

#### Testes obrigatórios

- **Todo composable de máscara DEVE ter testes unitários** em `src/utils/__tests__/`.
- Testar: aplicação da máscara, remoção de máscara (valor limpo), casos limite (campo vazio, dígitos extras, colar valor), validação de CPF/CNPJ com dígitos verificadores.
- Usar Vitest (já configurável no Vite).
- Rodar testes antes de considerar a feature completa: `npx vitest run`.

#### Estrutura de arquivos

```
src/
  utils/
    masks.ts          — funções puras de máscara (maskCPF, maskCNPJ, maskDate, maskCurrency, etc.)
    validators.ts     — funções de validação (validateCPF, validateCNPJ, validateDate, etc.)
    __tests__/
      masks.spec.ts   — testes unitários das máscaras
      validators.spec.ts — testes unitários das validações
```

---

## Instruções Complementares (Scoped)

As seguintes instruções são aplicadas automaticamente por escopo (`applyTo`) e complementam este documento:

| Instrução | Escopo | Responsabilidade |
|-----------|--------|-----------------|
| `security.instructions.md` | `src/**/*.{ts,vue}` | Env vars, XSS, CSP, anti-bot, server-side validation |
| `ui-states.instructions.md` | `src/**/*.vue` | Loading, error, empty states, toasts, offline |
| `ux-principles.instructions.md` | `src/**/*.vue` | **Leis de UX (Fitts, Hick, Doherty, Jakob, etc.), hierarquia visual, carga cognitiva, progressive disclosure, affordance** |
| `component-anatomy.instructions.md` | `src/**/*.vue` | **Anatomia obrigatória de componentes: todos os estados, tamanhos mínimos, microcopy, anti-patterns por tipo** |
| `design-tokens.instructions.md` | `src/**/*.{ts,vue,css,js}` | **Arquitetura de tokens em 3 camadas (primitive→semantic→component), naming, ponte com Tailwind, proibição de hardcode** |
| `theming.instructions.md` | `src/**/*.{ts,vue,css}` | **Theming e dark mode via remapeamento semantic, FOUC prevention, prefers-color-scheme/contrast, contraste por tema** |
| `observability.instructions.md` | `src/**/*.{ts,vue}` | **Error tracking, RUM (Web Vitals em produção), analytics de funil, error boundaries, privacidade LGPD/PII** |
| `visual-regression.instructions.md` | `src/**/*.vue`, `tests/**`, `*.spec.*` | **Design QA automatizado: snapshot por estado/viewport/tema, baseline, anti-flaky, gate de CI, fidelidade vs Figma** |
| `navigation-ia.instructions.md` | `src/**/*.{vue,ts}` | **Arquitetura de informação, modelos de navegação, rotas/URL, breadcrumbs, estado ativo, deep linking, navegação mobile** |
| `data-viz.instructions.md` | `src/**/*.{vue,ts}` | **Escolha de gráfico por dado, integridade (eixo zero), cor por token, a11y de gráficos, formatação BRL, estados** |
| `focus-management.instructions.md` | `src/**/*.{vue,ts}` | **Focus trap, restoration em navegação/conteúdo dinâmico, roving tabindex, aria-activedescendant, skip links** |
| `form-resilience.instructions.md` | `src/**/*.{vue,ts}` | **Autosave com debounce, draft recovery, persistência multi-step, aviso de saída, privacidade de rascunho (PII)** |
| `command-palette.instructions.md` | `src/**/*.{vue,ts}` | **Command palette (Mod+K, ARIA combobox), atalhos de teclado, registry de ações, descoberta, sem disparo em inputs** |
| `pwa-offline.instructions.md` | `src/**/*`, `vite.config.*`, `manifest.*` | **Service worker, cache por recurso, fluxo de update, fila offline — proibição de mutação financeira offline** |
| `state-api-patterns.instructions.md` | `src/**/*.{ts,vue}` | Pinia, composables, services HTTP, retry, error mapping |
| `testing.instructions.md` | `**/*.{spec,test}.{ts,js}` | Unitários, componente, E2E, coverage thresholds |
| `responsiveness.instructions.md` | `src/**/*.{vue,css,ts}` | Breakpoints, mobile-first, fluid typography, touch targets |
| `performance.instructions.md` | `src/**/*.{ts,vue}` | Bundle budget, lazy loading, tree-shaking, Core Web Vitals |
| `ci-cd.instructions.md` | `**/{dock.yaml,.github/workflows/*}` | Pipeline, PR checks, deploy preview, rollback |
| `i18n.instructions.md` | `src/**/*.{ts,vue}` | Strings centralizadas, Intl formatters, preparação i18n |
| `motion.instructions.md` | `src/**/*.vue` | Transições, tokens de duração/easing, prefers-reduced-motion |
| `governance.instructions.md` | `**/*.{md,yaml,json}` | Versionamento, ownership, exceções, métricas, processo de mudança |
| `accessibility.instructions.md` | `src/**/*.vue` | WCAG 2.2 AA, Nielsen heuristics (detalhado) |
| `code-quality.instructions.md` | `src/**/*.{ts,vue}` | Composition API, TypeScript, Tailwind, estrutura |
| `form-patterns.instructions.md` | `src/**/*.vue` | Máscaras, validações, feedback inline |
| `interactivity.instructions.md` | `src/**/*.vue` | Sliders, botões, seleção, cálculos em tempo real |
| `figma-governance.instructions.md` | `**/{dock-ds.config.json,figma-node-data.json,.env*}` | Acesso Figma, credenciais, service account, ownership |
| `figma-bidirectional.instructions.md` | `**/{dock-ds.config.json,scripts/*,tokens/*}` | Estratégia Figma ↔ Frontend: sync, screenshots, DTCG export |

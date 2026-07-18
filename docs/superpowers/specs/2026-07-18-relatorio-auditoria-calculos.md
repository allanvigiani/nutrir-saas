# Relatório de Auditoria — Fórmulas Nutricionais (Antes/Depois)

**Data:** 2026-07-18
**Escopo:** Auditoria de todas as fórmulas de cálculo nutricional do sistema (TMB, GET, macronutrientes, IMC, fator de atividade, fator clínico) contra literatura primária/secundária confiável, seguida de extração de cada cálculo de `src/server/services/nutrition.service.ts` (arquivo único de ~380 linhas) para módulos isolados e testados em `src/lib/nutrition-calculations/`.

**Como ler este relatório:** a Seção 1 é a visão geral rápida. As Seções 2-4 explicam, cálculo por cálculo, o que foi corrigido, o que foi verificado como já correto e o que ficou como estava (com a razão). A Seção 5 documenta a limpeza de código duplicado no frontend. A Seção 6 descreve a nova organização do código.

---

## 1. Tabela-resumo

| Cálculo | Arquivo novo | Status | Fonte |
|---|---|---|---|
| IMC (cálculo + classificação + faixa de peso ideal) | `src/lib/nutrition-calculations/imc.ts` | apenas reorganizado | Fórmula padrão (peso/altura²), classificação OMS de 6 faixas já usada no projeto |
| Peso ajustado por obesidade | `src/lib/nutrition-calculations/pesoAjustado.ts` | confirmado correto, apenas isolado | Padrão ASPEN (IBW + 25% do excesso) |
| Faixa etária (Criança/Adulto/Idoso) | `src/lib/nutrition-calculations/faixaEtaria.ts` | apenas reorganizado | Convenção interna do projeto |
| Seleção automática de fórmula sugerida | `src/lib/nutrition-calculations/selecaoFormula.ts` | apenas reorganizado | Convenção interna do projeto |
| Tabelas de fator de atividade (adulto/pediátrico) | `src/lib/nutrition-calculations/nivelAtividade.ts` | apenas reorganizado | PAL padrão de mercado (adulto); valor fornecido pelo usuário, sem fonte publicada (pediátrico) |
| Fator de estresse clínico | `src/lib/nutrition-calculations/fatorClinico.ts` | documentado sem alteração | Julgamento clínico — fora do escopo de correção |
| TMB — Mifflin-St Jeor | `src/lib/nutrition-calculations/tmbMifflin.ts` | confirmado correto, apenas isolado | Mifflin-St Jeor (1990); verificado contra Wikipedia e calculatorshub.net |
| TMB — Harris-Benedict | `src/lib/nutrition-calculations/tmbHarrisBenedict.ts` | confirmado correto, apenas isolado | Harris-Benedict revisada (Roza & Shizgal, 1984); verificado contra Wikipedia e calculatorshub.net |
| TMB — OMS/Schofield (peso-only) | `src/lib/nutrition-calculations/tmbOms.ts` | **corrigido** | FAO, *Human energy requirements* (2004), Tabela 5.2 ("Source: Schofield, 1985") |
| TMB — Schofield (peso+altura), ramo pediátrico (≤18 anos) | `src/lib/nutrition-calculations/tmbSchofield.ts` | **corrigido** | Mesma fonte acima (passa a delegar para a fórmula peso-only corrigida) |
| TMB — Schofield (peso+altura), ramo adulto (>18 anos) | `src/lib/nutrition-calculations/tmbSchofield.ts` | documentado sem alteração | Fonte secundária divergente de outra fonte secundária; publicação original inacessível |
| TMB/GET — EER/DRI (lactente, criança/adolescente, adulto) | `src/lib/nutrition-calculations/eerDri.ts` | confirmado correto, apenas isolado | IOM 2005 (NCBI Bookshelf), FAO/WHO/UNU |
| TMB/GET — kcal/kg | `src/lib/nutrition-calculations/tmbKcalKg.ts` | confirmado correto, apenas isolado | PENG Pocket Guide to Clinical Nutrition, 5ª ed. (20-25 kcal/kg BW/dia) |
| Ajuste calórico por objetivo + bônus de gestação | `src/lib/nutrition-calculations/ajusteObjetivoCalorico.ts` | documentado sem alteração (magnitudes) / confirmado correto (bônus gestação) | Magnitudes: julgamento clínico. Bônus gestação: IOM/DRI |
| Macronutrientes (proteína/carboidrato/lipídio) | `src/lib/nutrition-calculations/macronutrientes.ts` | documentado sem alteração | Defaults de g/kg e % são julgamento clínico |

**Legenda de status:**
- **corrigido** — coeficiente/equação estava errado e foi substituído por um valor verificado contra fonte confiável.
- **confirmado correto, apenas isolado** — a fórmula foi checada contra uma fonte e está certa; só mudou de arquivo.
- **apenas reorganizado** — lógica auxiliar (não é uma "fórmula" clínica em si) movida para módulo próprio, sem mudança de comportamento.
- **documentado sem alteração** — não há erro objetivo comprovável (é julgamento clínico, ou há fontes conflitantes sem forma de desempatar); mantido como estava, mas com a incerteza documentada explicitamente no código e neste relatório.

---

## 2. Corrigido

Estas são as duas únicas mudanças de comportamento numérico desta auditoria. Todas as demais fórmulas foram movidas de lugar sem alterar o resultado que produzem.

### 2.1 FIX #1 — Tabela peso-only "OMS"/Schofield (`tmbOms.ts`)

**O problema:** a tabela de coeficientes usada pelo sistema (rotulada `'oms'` no formulário, uma fórmula que estima a TMB a partir apenas do peso e da faixa etária) foi comparada diretamente com a publicação de referência da FAO e divergia dela em praticamente todas as 12 combinações de sexo/faixa etária. Um spec anterior (30/06/2026) havia declarado essa fórmula "confirmada em 4 fontes", mas nenhuma dessas fontes era a publicação/relatório primário — eram todas fontes secundárias que, por sua vez, copiaram o erro umas das outras.

**Fonte primária usada para corrigir:** FAO, *Human energy requirements* (2004), Tabela 5.2, coluna "BMR: kcal/day" — <https://www.fao.org/4/y5686e/y5686e07.htm> — que cita explicitamente "Source: Schofield, 1985".

**Antes** (`nutrition.service.ts`, código anterior à correção, obtido de `git show 09b370a`):

```ts
} else if (formulaUtilizada === 'oms') {
  if (sexo === 'masculino') {
    if (idade <= 3) tmb = (60.9 * pesoUtilizado) - 54;
    else if (idade <= 10) tmb = (22.7 * pesoUtilizado) + 495;
    else if (idade <= 18) tmb = (17.5 * pesoUtilizado) + 651;
    else if (idade <= 30) tmb = (15.3 * pesoUtilizado) + 679;
    else if (idade <= 60) tmb = (11.6 * pesoUtilizado) + 879;
    else tmb = (13.5 * pesoUtilizado) + 487;
  } else {
    if (idade <= 3) tmb = (61.0 * pesoUtilizado) - 51;
    else if (idade <= 10) tmb = (22.5 * pesoUtilizado) + 499;
    else if (idade <= 18) tmb = (12.2 * pesoUtilizado) + 746;
    else if (idade <= 30) tmb = (14.7 * pesoUtilizado) + 496;
    else if (idade <= 60) tmb = (8.7 * pesoUtilizado) + 829;
    else tmb = (10.5 * pesoUtilizado) + 596;
  }
}
```

**Depois** (`src/lib/nutrition-calculations/tmbOms.ts`, atual):

```ts
// FAO/WHO/UNU (1985), equações peso-only (Schofield, 1985). Coeficientes extraídos
// da fonte primária: FAO, Human energy requirements (2004), Table 5.2, coluna
// "BMR: kcal/day" — https://www.fao.org/4/y5686e/y5686e07.htm ("Source: Schofield,
// 1985"). CORRIGIDO em 2026-07-18: os coeficientes anteriores divergiam desta fonte
// primária em praticamente todas as faixas (ex.: homens >60 anos, constante 487 em
// vez de 587.7) — ver docs/superpowers/specs/2026-07-18-relatorio-auditoria-calculos.md.
export function calcularOms(pesoKg: number, idade: number, sexo: Sexo): number {
  if (sexo === 'masculino') {
    if (idade <= 3) return (59.512 * pesoKg) - 30.4;
    if (idade <= 10) return (22.706 * pesoKg) + 504.3;
    if (idade <= 18) return (17.686 * pesoKg) + 658.2;
    if (idade <= 30) return (15.057 * pesoKg) + 692.2;
    if (idade <= 60) return (11.472 * pesoKg) + 873.1;
    return (11.711 * pesoKg) + 587.7;
  }
  if (idade <= 3) return (58.317 * pesoKg) - 31.1;
  if (idade <= 10) return (20.315 * pesoKg) + 485.9;
  if (idade <= 18) return (13.384 * pesoKg) + 692.6;
  if (idade <= 30) return (14.818 * pesoKg) + 486.6;
  if (idade <= 60) return (8.126 * pesoKg) + 845.6;
  return (9.082 * pesoKg) + 658.5;
}
```

**Impacto numérico (exemplo real):** homem, 65 anos, 70kg — faixa ">60 anos":
- **Antes:** `13.5 × 70 + 487 = 1432 kcal`
- **Depois:** `11.711 × 70 + 587.7 = 1407,47 → 1407 kcal`
- **Diferença:** 25 kcal (~1,7%) só nesse caso; em outras faixas a diferença é maior — ex. mulheres 10-18 anos, coeficiente de peso muda de `12.2` para `13.384` e a constante de `746` para `692.6`.

Esse valor de TMB alimenta diretamente o GET (Gasto Energético Total) e, por consequência, a prescrição calórica do paciente — é a correção de maior impacto prático desta auditoria, pois `'oms'` é a fórmula sugerida automaticamente para todo paciente menor de 18 ou maior/igual a 60 anos (ver `selecaoFormula.ts`).

### 2.2 FIX #2 — Schofield pediátrico peso+altura (`tmbSchofield.ts`)

**O problema:** a variante "Schofield peso+altura" para pacientes de 0 a 18 anos continha um bug objetivo e verificável. Os coeficientes de peso (`59.512`, `22.706`, `17.686` etc.) eram cópias exatas da mesma tabela peso-only da FAO citada acima. Porém, as **constantes** dessa mesma tabela peso-only (`504.3`, `658.2` etc.) foram reaproveitadas por engano como se fossem **coeficientes de altura** — multiplicando a altura em metros — com uma constante extra somada por cima. Ou seja, não era uma fórmula peso+altura real: era a fórmula peso-only corrompida, produzindo uma TMB muito acima do esperado, com erro crescente quanto maior a altura da criança.

**Fonte:** não existe fonte confiável disponível para uma variante peso+altura pediátrica real do Schofield (a única fonte teria sido fornecida verbalmente pelo usuário em sessão anterior, sem citação rastreável). Diante disso, o fix faz o ramo pediátrico do `'schofield'` delegar para a mesma fórmula peso-only já corrigida no FIX #1 (idêntica a `'oms'` nessa faixa etária), com alerta explícito ao usuário explicando o motivo.

**Antes** (`nutrition.service.ts`, código anterior à correção, obtido de `git show 09b370a`):

```ts
} else if (formulaUtilizada === 'schofield') {
  if (idade <= 18) {
    // Schofield 1985 (peso + altura), pediátrico 0-18 anos — ver
    // docs/superpowers/specs/2026-07-03-formulas-pediatricas-design.md
    if (sexo === 'masculino') {
      if (idade <= 3) tmb = (59.512 * pesoUtilizado) + (13.04 * altura) - 30.8;
      else if (idade <= 10) tmb = (22.706 * pesoUtilizado) + (504.3 * altura) + 89.5;
      else tmb = (17.686 * pesoUtilizado) + (658.2 * altura) + 48.3;
    } else {
      if (idade <= 3) tmb = (58.317 * pesoUtilizado) + (3.11 * altura) - 59.0;
      else if (idade <= 10) tmb = (20.315 * pesoUtilizado) + (485.9 * altura) + 98.5;
      else tmb = (13.384 * pesoUtilizado) + (692.6 * altura) + 35.4;
    }
    alertas.push('Schofield para menores de 18 anos utiliza a equação pediátrica (peso + altura); os coeficientes diferem da variante adulta.');
  }
  ...
```

Repare: `504.3` e `658.2` são exatamente as constantes da tabela peso-only da FAO (ver FIX #1) — reaproveitadas aqui como coeficiente de altura, o que não faz sentido dimensional nem tem base em nenhuma publicação.

**Depois** (`src/lib/nutrition-calculations/tmbSchofield.ts`, atual):

```ts
export function calcularSchofield(pesoKg: number, alturaM: number, idade: number, sexo: Sexo): SchofieldResult {
  if (idade <= 18) {
    // CORRIGIDO em 2026-07-18: a variante peso+altura pediátrica anterior reaproveitava
    // por engano a constante da tabela peso-only (FAO/WHO/UNU Table 5.2) como se fosse
    // um coeficiente de altura, produzindo TMB muito acima do esperado (erro crescente
    // com a altura). Nenhuma fonte confiável de uma equação peso+altura pediátrica real
    // foi encontrada nesta auditoria — até que uma seja localizada, este ramo usa a
    // equação peso-only corrigida (idêntica a "oms" nesta faixa etária). Ver
    // docs/superpowers/specs/2026-07-18-relatorio-auditoria-calculos.md.
    return {
      tmb: calcularOms(pesoKg, idade, sexo),
      alertas: [
        'Schofield para menores de 18 anos: a variante peso+altura não pôde ser verificada contra fonte confiável; usando a equação peso-only (FAO/WHO/UNU 1985), idêntica a "oms" nesta faixa etária.',
      ],
    };
  }
  // ramo adulto — ver Seção 3
  ...
```

**Impacto numérico (exemplo real):** menino, 5 anos, 18kg, 1,10m (faixa "≤10 anos"):
- **Antes:** `22.706 × 18 + 504.3 × 1.10 + 89.5 = 408,708 + 554,73 + 89,5 = 1052,94 → ~1053 kcal`
- **Depois:** `22.706 × 18 + 504.3 = 408,708 + 504.3 = 913,01 → ~913 kcal`
- **Diferença:** ~140 kcal, ou seja, ~15% de erro — e esse erro **cresce com a altura da criança**, porque a "altura" estava sendo multiplicada por uma constante que não deveria depender dela.

Esse era o cálculo mais grave encontrado na auditoria: qualquer nutricionista que tivesse usado "Schofield" para um paciente pediátrico recebia uma TMB superestimada, o que poderia levar a uma prescrição calórica acima do necessário.

---

## 3. Não corrigido, documentado

Estes pontos foram investigados na auditoria, mas **não** foram alterados — porque não há erro objetivo comprovável contra uma fonte confiável, apenas incerteza ou julgamento clínico. Em todos os casos a incerteza foi documentada explicitamente no código-fonte (comentário) e, quando aplicável, em alerta visível ao usuário na tela de cálculo.

### 3.1 Schofield adulto, peso+altura (`tmbSchofield.ts`, ramo `idade > 18`)

Os coeficientes atuais vêm de uma fonte secundária já usada desde o spec de 30/06/2026. Durante esta auditoria, uma **segunda** fonte secundária (nafwa.org) foi encontrada com um coeficiente de altura substancialmente diferente para a mesma faixa etária — por exemplo, para homens de 18-30 anos, a fonte atual usa `-27.008/m` e a nova fonte encontrada sugere algo próximo de `-10/m`. Não foi possível acessar a publicação original (Schofield WN, 1985, *Human Nutrition: Clinical Nutrition* 39 Suppl 1) — está paywalled — para desempatar entre as duas fontes secundárias.

**Decisão:** manter os coeficientes atuais sem alteração numérica, já que nenhuma das duas fontes secundárias é confiável o suficiente para substituir a outra. O alerta ao usuário foi reforçado para deixar isso explícito também para quem usa a calculadora (não só para quem lê o código):

> "Schofield adulto (peso+altura): coeficientes não puderam ser verificados contra a publicação original; fontes secundárias divergem entre si. Use com cautela."

### 3.2 Fatores de estresse clínico (`fatorClinico.ts`)

Os multiplicadores (1.1 para inflamação, 1.2 para pós-cirúrgico/infecção/doença crônica, 1.3 para trauma, 1.5 para sepse/UTI) são valores de julgamento clínico. A política aprovada pelo usuário para esta auditoria foi explícita: **não alterar** fatores clínicos, %proteína/g-kg ou magnitudes de ajuste calórico padrão, mesmo que a pesquisa levante dúvidas sobre eles — apenas documentar. O comentário no arquivo reflete isso diretamente.

### 3.3 Protein g/kg e % de macronutrientes por objetivo/idade (`macronutrientes.ts`)

Defaults como 1.4 g/kg (manutenção), 1.8 g/kg (emagrecimento), 2.0 g/kg (hipertrofia), piso de 1.2 g/kg para idosos, e 25% de lipídio por padrão são decisões de prática clínica, não fórmulas com fonte única e objetiva a se verificar. Mantidos sem alteração, mesma política da seção 3.2.

### 3.4 Magnitudes de ajuste calórico por objetivo (`ajusteObjetivoCalorico.ts`)

Os valores padrão de déficit/superávit calórico (-400 kcal para emagrecimento, +400 kcal para hipertrofia, +300 kcal para reabilitação) são, da mesma forma, julgamento clínico — não foram alterados. (O único comportamento *corrigido* nesse arquivo em specs anteriores — tratar o valor informado pelo usuário como magnitude, com o sinal decidido internamente pelo objetivo — já havia sido corrigido antes desta auditoria, em 30/06/2026, e foi preservado ao isolar o código.)

---

## 4. Confirmado correto, apenas isolado

Estas fórmulas foram verificadas contra uma fonte durante a auditoria e confirmaram-se corretas — só mudaram de arquivo, sem qualquer alteração de coeficiente ou comportamento.

| Fórmula | Fonte de verificação |
|---|---|
| **Mifflin-St Jeor** (`tmbMifflin.ts`) | Mifflin-St Jeor (1990); coeficientes conferidos contra Wikipedia e calculatorshub.net — idênticos |
| **Harris-Benedict** revisada (`tmbHarrisBenedict.ts`) | Roza & Shizgal (1984); coeficientes conferidos contra Wikipedia e calculatorshub.net — idênticos |
| **EER/DRI** — lactente, criança/adolescente e adulto (`eerDri.ts`) | IOM 2005 (NCBI Bookshelf) e FAO/WHO/UNU — já verificado em specs anteriores (30/06 e 03/07/2026), confirmado nesta auditoria |
| **Peso ajustado por obesidade** (`pesoAjustado.ts`) | Padrão ASPEN: peso ideal (IMC de referência 22) + 25% do excesso sobre o peso atual |
| **kcal/kg** (`tmbKcalKg.ts`) | PENG Pocket Guide to Clinical Nutrition, 5ª ed. (2018), que recomenda 20-25 kcal/kg de peso corporal/dia para REE — o default de 25 kcal/kg do sistema está dentro dessa faixa |
| **Bônus calórico de gestação** (`ajusteObjetivoCalorico.ts`, `calcularBonusGestacao`) | IOM/DRI: +340 kcal no 2º trimestre, +450 kcal no 3º trimestre, sem incremento no 1º trimestre |

---

## 5. Duplicações eliminadas

Além das duas correções de fórmula, a auditoria consolidou código duplicado no frontend que reimplementava lógica já existente no backend — risco silencioso de os dois lados divergirem ao longo do tempo.

### 5.1 IMC em `PatientProfile.tsx` — 3 implementações → 1

O arquivo `PatientProfile.tsx` (o arquivo mais sensível do sistema, ~2900 linhas) tinha **três** implementações diferentes e divergentes entre si:

1. **Cálculo bruto do IMC** (linha 731, no salvamento da consulta):
   ```ts
   // Antes
   const imc = data.height > 0 ? data.weight / ((data.height / 100) * (data.height / 100)) : 0;
   // Depois
   const imc = data.height > 0 ? calculateImc(data.weight, data.height / 100) : 0;
   ```

2. **Classificação usada nos cards de KPI** (~linha 2858) — só tinha **4** faixas (Abaixo do peso / Normal / Sobrepeso / Obesidade — juntando graus I, II e III em um só rótulo "Obesidade"):
   ```ts
   // Antes
   const imcInfo = (imc: number) => {
     if (imc < 18.5) return { label: 'Abaixo do peso', cls: 'text-muted-foreground bg-muted' };
     if (imc < 25) return { label: 'Normal', cls: 'text-primary bg-primary/10' };
     if (imc < 30) return { label: 'Sobrepeso', cls: 'text-accent-foreground bg-accent/30' };
     return { label: 'Obesidade', cls: 'text-destructive bg-destructive/10' };
   };
   ```

3. **Classificação usada na tabela histórica completa** (~linha 3088) — já tinha **6** faixas (separando Obesidade I/II/III), igual ao backend, mas reimplementada de forma independente:
   ```ts
   // Antes
   const imcLabel = (imc: number) => {
     if (imc < 18.5) return { text: 'Abaixo', cls: 'text-muted-foreground' };
     if (imc < 25) return { text: 'Normal', cls: 'text-primary' };
     if (imc < 30) return { text: 'Sobrepeso', cls: 'text-accent-foreground' };
     if (imc < 35) return { text: 'Obesidade I', cls: 'text-destructive' };
     if (imc < 40) return { text: 'Obesidade II', cls: 'text-destructive' };
     return { text: 'Obesidade III', cls: 'text-destructive' };
   };
   ```

O cálculo bruto (1) usava a mesma fórmula matemática que o backend, mas duplicada por escrito. As duas classificações (2 e 3) tinham granularidades diferentes entre si e reimplementavam — cada uma à sua maneira — a mesma lógica de classificação que já existia em `nutrition.service.ts`. Qualquer alteração futura na classificação de IMC exigiria lembrar de mudar em três lugares.

**Depois:** as três agora importam de uma única fonte, `src/lib/nutrition-calculations/imc.ts` (`calculateImc`, `classifyImc`, `idealWeightRangeByBmi`). As duas classificações continuam produzindo os mesmos rótulos visuais de antes (a versão de 4 faixas usa uma tabela de mapeamento `IMC_BADGE_CLASSES` que agrupa os 3 graus de obesidade do módulo único sob a mesma classe visual; a versão de 6 faixas usa `IMC_TABLE_LABELS`/`IMC_TABLE_CLASSES` mapeando 1 a 1) — nenhuma mudança visível ao usuário, só uma única fonte de verdade por trás.

O mesmo commit também substituiu o cálculo manual da faixa de peso ideal (`18.5 * h * h` / `24.9 * h * h`, inline) por `idealWeightRangeByBmi(h)`.

### 5.2 Tabelas de fator de atividade em `NutritionalCalculator.tsx`

O componente `NutritionalCalculator.tsx` tinha dois arrays de strings hardcoded, dentro de um `useEffect`, sem nenhuma relação declarada com equivalentes no backend:

```ts
// Antes (linhas 158-159)
const valoresPediatricos = ['1.20', '1.40', '1.55', '1.75', '2.00'];
const valoresAdultos = ['1.2', '1.375', '1.55', '1.725'];
```

```ts
// Depois
import { NIVEL_ATIVIDADE_ADULTO, NIVEL_ATIVIDADE_PEDIATRICO } from '../lib/nutrition-calculations/nivelAtividade';
...
const valoresPediatricos: readonly string[] = NIVEL_ATIVIDADE_PEDIATRICO;
const valoresAdultos: readonly string[] = NIVEL_ATIVIDADE_ADULTO;
```

Os valores em si não mudaram (os 4 multiplicadores adultos são o padrão de PAL usado com Mifflin-St Jeor/Harris-Benedict/OMS; os 5 valores pediátricos foram fornecidos pelo usuário no spec de 03/07/2026 e não têm fonte publicada — isso está documentado no comentário de `nivelAtividade.ts` e não foi alterado, mesma política da Seção 3). A mudança é puramente estrutural: um único array por perfil (adulto/pediátrico), compartilhado entre frontend e backend.

---

## 6. Nova arquitetura

### Antes

Um único arquivo, `src/server/services/nutrition.service.ts`, com **377 linhas**, misturando: validação de entrada, orquestração e as ~13 fórmulas de cálculo (IMC, peso ajustado, seleção de fórmula, fator de atividade, fator clínico, TMB por 6 métodos diferentes, ajuste calórico, macronutrientes) todas dentro de uma única função `calculateNutrition`. Nenhuma fórmula tinha teste unitário isolado — toda a cobertura de teste passava, obrigatoriamente, pelo fluxo completo do serviço.

### Depois

`nutrition.service.ts` agora tem **196 linhas** e é um orquestrador fino: recebe `NutritionCalculationInput`, chama as funções puras dos 13 módulos abaixo na ordem certa, e monta `NutritionCalculationOutput` — o contrato HTTP usado pelo controller não mudou em nada. Cada fórmula agora é uma função pura, sem I/O, testável isoladamente, em `src/lib/nutrition-calculations/`:

| Arquivo | Responsabilidade |
|---|---|
| `types.ts` | Tipo `Sexo`, compartilhado por todos os outros módulos |
| `imc.ts` | Cálculo e classificação de IMC (6 faixas) + faixa de peso ideal |
| `pesoAjustado.ts` | Peso ajustado para pacientes obesos (padrão ASPEN) |
| `faixaEtaria.ts` | Classificação Criança/Adolescente, Adulto, Idoso |
| `selecaoFormula.ts` | Sugestão automática de qual fórmula de TMB usar, dado idade/condições clínicas |
| `nivelAtividade.ts` | Tabelas de multiplicador de atividade física (adulto e pediátrico), compartilhadas com o frontend |
| `fatorClinico.ts` | Multiplicador de fator de estresse clínico (sepse, trauma, pós-cirúrgico, etc.) |
| `tmbMifflin.ts` | TMB — Mifflin-St Jeor |
| `tmbHarrisBenedict.ts` | TMB — Harris-Benedict revisada |
| `tmbOms.ts` | TMB — OMS/Schofield peso-only (**corrigida** nesta auditoria) |
| `tmbSchofield.ts` | TMB — Schofield peso+altura (ramo pediátrico **corrigido**; ramo adulto documentado como incerto) |
| `eerDri.ts` | TMB/GET — EER/DRI (IOM 2005), para lactente, criança/adolescente e adulto |
| `tmbKcalKg.ts` | TMB/GET — fórmula simples kcal/kg para pacientes hospitalizados/críticos |
| `ajusteObjetivoCalorico.ts` | Ajuste calórico por objetivo (déficit/superávit) + bônus calórico de gestação |
| `macronutrientes.ts` | Distribuição de proteína/carboidrato/lipídio |

Cada um desses 13 arquivos (fora `types.ts`) tem um arquivo de teste correspondente em `src/tests/lib/nutrition-calculations/`, com casos de referência citando a fonte usada para conferir o valor esperado — isso é o que torna possível, daqui para frente, verificar rapidamente se uma fórmula continua batendo com a literatura sem precisar rodar o fluxo completo do sistema.

`PatientProfile.tsx` e `NutritionalCalculator.tsx` (frontend) passaram a importar `imc.ts` e `nivelAtividade.ts` diretamente, em vez de reimplementar essa lógica — ver Seção 5.

---

## Referências consultadas nesta auditoria

- FAO, *Human energy requirements* (2004), Tabela 5.2 — <https://www.fao.org/4/y5686e/y5686e07.htm> (fonte primária citada: "Schofield, 1985")
- Mifflin MD, St Jeor ST et al. (1990) — coeficientes conferidos contra Wikipedia e calculatorshub.net
- Roza AM, Shizgal HM (1984), Harris-Benedict revisada — coeficientes conferidos contra Wikipedia e calculatorshub.net
- Institute of Medicine (IOM), *Dietary Reference Intakes for Energy* (2005) — via NCBI Bookshelf
- FAO/WHO/UNU, *Human energy requirements* (2004)
- ASPEN — peso ajustado para obesidade ("adjusted body weight")
- PENG (British Dietetic Association), *Pocket Guide to Clinical Nutrition*, 5ª ed. (2018)
- nafwa.org — fonte secundária alternativa para Schofield adulto peso+altura, usada para identificar (não resolver) a divergência descrita na Seção 3.1
- Schofield WN (1985), *Human Nutrition: Clinical Nutrition* 39 Suppl 1 — publicação original, não acessada (paywalled); é a fonte que resolveria a divergência descrita na Seção 3.1, caso fique disponível no futuro

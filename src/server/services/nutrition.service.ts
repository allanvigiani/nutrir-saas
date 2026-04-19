export interface NutritionCalculationInput {
  peso: number;
  altura: number; // in meters
  sexo: 'masculino' | 'feminino';
  idade: number;
  nivelAtividade: number; // 1.2 | 1.375 | 1.55 | 1.725
  objetivo: 'emagrecimento' | 'manutencao' | 'hipertrofia' | 'reabilitacao';
  ajusteObjetivoValor?: number; // specific value chosen within range
  condicoesClinicas: string[];
  fatorClinicoValor?: number; // specific value chosen within range
  kcalKgValor?: number; // for kcal/kg formula (e.g. 25-30)
  formulaOverride?: 'mifflin' | 'harris' | 'oms' | 'kcal_kg';
  percentualLip?: number; // default 25
  percentualPtn?: number; // percentual override
  percentualCho?: number; // percentual override
  gKgPtn?: number; // kept for compatibility if needed
  trimestreGestacao?: 1 | 2 | 3;
}

export interface NutritionCalculationOutput {
  imc: number;
  classificacaoImc: string;
  faixaEtaria: string;
  pesoUtilizado: number;
  justificativaPeso: string;
  formulaSugerida: string;
  formulaUtilizada: string;
  tmb: number;
  get: number; // before objective adjustment
  getAjustado: number; // after objective adjustment and special conditions
  macronutrientes: {
    ptnKcal: number;
    ptnG: number;
    ptnGKg: number;
    ptnPercentual: number;
    choKcal: number;
    choG: number;
    choGKg: number;
    choPercentual: number;
    lipKcal: number;
    lipG: number;
    lipPercentual: number;
  };
  alertas: string[];
}

export function createNutritionService() {
  function calculateNutrition(input: NutritionCalculationInput): NutritionCalculationOutput {
    const {
      peso,
      altura,
      sexo,
      idade,
      nivelAtividade,
      objetivo,
      condicoesClinicas = [],
      formulaOverride,
      trimestreGestacao
    } = input;

    const alertas: string[] = [];

    // PASSO 1
    const imc = peso / (altura * altura);
    let classificacaoImc = '';
    if (idade >= 18) { // Assuming classification for adults
      if (imc < 18.5) classificacaoImc = 'Baixo peso';
      else if (imc < 25) classificacaoImc = 'Eutrófico';
      else if (imc < 30) classificacaoImc = 'Sobrepeso';
      else if (imc < 35) classificacaoImc = 'Obesidade grau I';
      else if (imc < 40) classificacaoImc = 'Obesidade grau II';
      else classificacaoImc = 'Obesidade grau III (mórbida)';
    } else {
      classificacaoImc = 'Avaliação por curva de crescimento recomendada';
    }

    let faixaEtaria = '';
    if (idade < 18) faixaEtaria = 'Criança/Adolescente';
    else if (idade <= 59) faixaEtaria = 'Adulto';
    else faixaEtaria = 'Idoso';

    // PASSO 2
    let pesoUtilizado = peso;
    let justificativaPeso = 'Peso atual (IMC < 30)';
    if (imc >= 30 && idade >= 18) {
      const pesoIdeal = 22 * (altura * altura);
      pesoUtilizado = pesoIdeal + 0.25 * (peso - pesoIdeal);
      justificativaPeso = `Peso ajustado (IMC >= 30): Ideal (${Math.round(pesoIdeal)}kg) + 25% do excesso`;
    }

    // PASSO 3
    let formulaSugerida = 'mifflin';
    const hasHospitalar = condicoesClinicas.some(c => ['internado', 'critico', 'pos_cirurgico'].includes(c));
    
    if (hasHospitalar) {
      formulaSugerida = 'kcal_kg';
    } else if (idade < 18 || idade >= 60) {
      formulaSugerida = 'oms';
    }

    const formulaUtilizada = formulaOverride || formulaSugerida;

    // PASSO 4 & 5
    let tmb = 0;
    let get = 0;
    const alturaCm = altura * 100;

    // Fator Clínico (FC)
    let fatorClinicoBase = 1.0;
    const isInflamado = condicoesClinicas.includes('inflamacao');
    const isDoencaCronica = condicoesClinicas.includes('doenca_cronica');
    const isInfeccao = condicoesClinicas.includes('infeccao');
    const isPosCirurgico = condicoesClinicas.includes('pos_cirurgico');
    const isTrauma = condicoesClinicas.includes('trauma');
    const isSepseUti = condicoesClinicas.some(c => ['sepse', 'critico'].includes(c));

    if (input.fatorClinicoValor) {
      fatorClinicoBase = input.fatorClinicoValor;
    } else {
      if (isSepseUti) fatorClinicoBase = 1.5;
      else if (isTrauma) fatorClinicoBase = 1.3;
      else if (isPosCirurgico) fatorClinicoBase = 1.2;
      else if (isInfeccao) fatorClinicoBase = 1.2;
      else if (isDoencaCronica) fatorClinicoBase = 1.2;
      else if (isInflamado) fatorClinicoBase = 1.1;
    }

    if (formulaUtilizada === 'mifflin') {
      if (sexo === 'masculino') {
        tmb = (10 * pesoUtilizado) + (6.25 * alturaCm) - (5 * idade) + 5;
      } else {
        tmb = (10 * pesoUtilizado) + (6.25 * alturaCm) - (5 * idade) - 161;
      }
      get = tmb * nivelAtividade * fatorClinicoBase;
    } else if (formulaUtilizada === 'harris') {
      if (sexo === 'masculino') {
        tmb = 88.36 + (13.4 * pesoUtilizado) + (4.8 * alturaCm) - (5.68 * idade);
      } else {
        tmb = 447.6 + (9.25 * pesoUtilizado) + (3.1 * alturaCm) - (4.33 * idade);
      }
      get = tmb * nivelAtividade * fatorClinicoBase;
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
      get = tmb * nivelAtividade * fatorClinicoBase;
    } else if (formulaUtilizada === 'kcal_kg') {
      const kcalKg = input.kcalKgValor || 25; // default 25 if not provided
      tmb = kcalKg * pesoUtilizado; // Para registro de onde veio a base
      get = tmb * fatorClinicoBase; // Sem fator de atividade nesta fórmula
    }

    // PASSO 7 & 8: Ajuste Calórico
    let ajusteCalorico = 0;
    if (input.ajusteObjetivoValor !== undefined) {
      ajusteCalorico = input.ajusteObjetivoValor;
    } else {
      if (objetivo === 'emagrecimento') ajusteCalorico = -400;
      else if (objetivo === 'hipertrofia') ajusteCalorico = 400;
      else if (objetivo === 'reabilitacao') ajusteCalorico = 300;
    }

    if (isInflamado && fatorClinicoBase >= 1.2 && objetivo === 'hipertrofia' && ajusteCalorico > 300) {
      alertas.push("Evitar superávit calórico elevado em pacientes com inflamação ativa. Ajuste limitado a +300 kcal.");
      ajusteCalorico = 300;
    } else if (isInflamado) {
      alertas.push("Evitar superávit calórico elevado em pacientes com inflamação ativa.");
    }

    let getAjustado = get + ajusteCalorico;

    if (condicoesClinicas.includes('gestante')) {
      if (trimestreGestacao === 2) {
        getAjustado += 340;
        alertas.push("Gestante (2º Tri) — calorias adicionais aplicadas (+340 kcal)");
      } else if (trimestreGestacao === 3) {
        getAjustado += 450;
        alertas.push("Gestante (3º Tri) — calorias adicionais aplicadas (+450 kcal)");
      }
    }

    if (isDoencaCronica || isInfeccao || isPosCirurgico) {
      alertas.push("Ajustar calorias e macronutrientes conforme demanda clínica.");
    }

    if (idade >= 60) {
      alertas.push("Idoso - Recomendação automática de proteína mínima de 1.2 g/kg aplicada.");
    }

    // PASSO 9: Macronutrientes
    let percentualPtn = input.percentualPtn;
    let percentualLip = input.percentualLip;
    let percentualCho = input.percentualCho;

    if (percentualPtn === undefined) {
      let gKgPtnBase = input.gKgPtn;
      if (gKgPtnBase === undefined) {
        if (objetivo === 'emagrecimento') gKgPtnBase = 1.8;
        else if (objetivo === 'hipertrofia') gKgPtnBase = 2.0;
        else if (idade >= 60) gKgPtnBase = 1.2; // minimo
        else if (isDoencaCronica || isPosCirurgico) gKgPtnBase = 1.5;
        else gKgPtnBase = 1.4; // manutenção/padrão
      }

      // Garantir mínimo para idoso se não override manual pra menos
      if (idade >= 60 && gKgPtnBase < 1.2) {
        gKgPtnBase = 1.2;
      }
      
      const ptnKcalBase = (gKgPtnBase * pesoUtilizado) * 4;
      percentualPtn = (ptnKcalBase / getAjustado) * 100;
    }

    if (percentualLip === undefined) {
      percentualLip = 25;
    }

    if (percentualCho === undefined) {
      percentualCho = 100 - percentualPtn - percentualLip;
    }

    // Normalize to ensure sum is exactly 100 if they don't match (due to float precision or manual bad input)
    // The frontend should prevent bad inputs, but we fallback gracefully
    const totalPercent = percentualPtn + percentualLip + percentualCho;
    if (Math.abs(totalPercent - 100) > 0.1 && input.percentualCho !== undefined) {
      alertas.push("Atenção: A soma dos macronutrientes é diferente de 100%.");
    }

    const ptnKcal = getAjustado * (percentualPtn / 100);
    const ptnG = ptnKcal / 4;
    const gKgPtn = ptnG / pesoUtilizado;

    const lipKcal = getAjustado * (percentualLip / 100);
    const lipG = lipKcal / 9;

    const choKcal = getAjustado * (percentualCho / 100);
    const choG = choKcal / 4;

    if (choG < 100) {
      alertas.push("Atenção: Carboidratos abaixo de 100g/dia.");
    }

    return {
      imc: Math.round(imc * 10) / 10,
      classificacaoImc,
      faixaEtaria,
      pesoUtilizado: Math.round(pesoUtilizado * 10) / 10,
      justificativaPeso,
      formulaSugerida,
      formulaUtilizada,
      tmb: Math.round(tmb),
      get: Math.round(get),
      getAjustado: Math.round(getAjustado),
      macronutrientes: {
        ptnKcal: Math.round(ptnKcal),
        ptnG: Math.round(ptnG * 10) / 10,
        ptnGKg: Math.round(gKgPtn * 100) / 100,
        ptnPercentual: Math.round(percentualPtn * 10) / 10,
        choKcal: Math.round(choKcal),
        choG: Math.round(choG * 10) / 10,
        choGKg: Math.round((choG / pesoUtilizado) * 100) / 100,
        choPercentual: Math.round(percentualCho * 10) / 10,
        lipKcal: Math.round(lipKcal),
        lipG: Math.round(lipG * 10) / 10,
        lipPercentual: Math.round(percentualLip * 10) / 10
      },
      alertas
    };
  }

  return {
    calculateNutrition
  };
}

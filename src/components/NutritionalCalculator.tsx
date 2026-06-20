import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { Patient, Consultation } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Activity, Beaker, Calculator, AlertCircle, RefreshCw, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { cn } from '../lib/utils';
import { NutritionCalculationInput, NutritionCalculationOutput } from '../server/services/nutrition.service'; // We will import the interface

// Define the interface here to avoid importing from backend directly into frontend if paths are strictly separated,
// but since it's a monorepo structure without strict boundary, we can redefine or import.
interface CalculatorProps {
  patient: Patient;
  latestConsultation?: Consultation;
  existingCalculation?: { id: string; input: any; result: any } | null;
  onSaveCalculation?: (input: NutritionCalculationInput, result: NutritionCalculationOutput, name: string) => Promise<void>;
  onCreateMealPlan?: (input: NutritionCalculationInput, result: NutritionCalculationOutput) => void;
}

export const NutritionalCalculator = ({ patient, latestConsultation, existingCalculation, onSaveCalculation, onCreateMealPlan }: CalculatorProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NutritionCalculationOutput | null>(existingCalculation?.result ?? null);
  const calculationName = latestConsultation
    ? `Cálculo - ${new Date(latestConsultation.date).toLocaleDateString('pt-BR')}`
    : 'Cálculo Padrão';
  const [isSaving, setIsSaving] = useState(false);

  const ex = existingCalculation?.input;

  // Form State — pré-populado com cálculo existente quando disponível
  const [peso, setPeso] = useState<string>(ex?.peso?.toString() || latestConsultation?.weight?.toString() || '');
  const [altura, setAltura] = useState<string>(ex?.altura?.toString() || latestConsultation?.height?.toString() || '');
  const [idade, setIdade] = useState<string>(
    ex?.idade?.toString() ||
    (patient.birthDate ? Math.floor((new Date().getTime() - new Date(patient.birthDate).getTime()) / 31557600000).toString() : '')
  );
  const [sexo, setSexo] = useState<'masculino' | 'feminino'>(
    ex?.sexo || (patient.gender === 'female' ? 'feminino' : 'masculino')
  );
  const [nivelAtividade, setNivelAtividade] = useState<string>(ex?.nivelAtividade?.toString() || '1.2');
  const [objetivo, setObjetivo] = useState<string>(ex?.objetivo || 'manutencao');
  const [condicoesClinicas, setCondicoesClinicas] = useState<string[]>(ex?.condicoesClinicas || []);
  const [formulaOverride, setFormulaOverride] = useState<string>(ex?.formulaOverride || '');

  // Advanced options
  const [ajusteObjetivoValor, setAjusteObjetivoValor] = useState<string>(ex?.ajusteObjetivoValor?.toString() || '');
  const [percentualLip, setPercentualLip] = useState<string>(ex?.percentualLip?.toString() || '');
  const [percentualPtn, setPercentualPtn] = useState<string>(ex?.percentualPtn?.toString() || '');
  const [percentualCho, setPercentualCho] = useState<string>(ex?.percentualCho?.toString() || '');
  const [trimestreGestacao, setTrimestreGestacao] = useState<string>(ex?.trimestreGestacao?.toString() || '');

  const condicoesOpcoes = [
    { id: 'saudavel', label: 'Saudável' },
    { id: 'gestante', label: 'Gestante' },
    { id: 'lactante', label: 'Lactante' },
    { id: 'internado', label: 'Internado' },
    { id: 'critico', label: 'Crítico/UTI' },
    { id: 'inflamacao', label: 'Inflamação' },
    { id: 'doenca_cronica', label: 'Doença Crônica' },
    { id: 'infeccao', label: 'Infecção' },
    { id: 'pos_cirurgico', label: 'Pós-Cirúrgico' }
  ];

  const sumPercent = (percentualPtn ? parseFloat(percentualPtn) : 0) + 
                     (percentualLip ? parseFloat(percentualLip) : 0) + 
                     (percentualCho ? parseFloat(percentualCho) : 0);
  const isPercentError = sumPercent > 100;

  const handleCalculate = async () => {
    if (!peso || !altura || !idade || isPercentError) return;

    setLoading(true);
    try {
      const token = await user?.getIdToken();
      const response = await fetch('/api/nutrition/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          peso: parseFloat(peso),
          altura: parseFloat(altura) > 3 ? parseFloat(altura) / 100 : parseFloat(altura), // handle cm vs m
          idade: parseInt(idade),
          sexo,
          nivelAtividade: parseFloat(nivelAtividade),
          objetivo,
          condicoesClinicas,
          formulaOverride: formulaOverride || undefined,
          ajusteObjetivoValor: ajusteObjetivoValor ? parseFloat(ajusteObjetivoValor) : undefined,
          percentualLip: percentualLip ? parseFloat(percentualLip) : undefined,
          percentualPtn: percentualPtn ? parseFloat(percentualPtn) : undefined,
          percentualCho: percentualCho ? parseFloat(percentualCho) : undefined,
          trimestreGestacao: trimestreGestacao ? parseInt(trimestreGestacao) : undefined
        })
      });

      if (!response.ok) {
        throw new Error('Falha ao calcular');
      }

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao calcular. Verifique os dados inseridos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto calculate on mount if we have minimum data
    if (peso && altura && idade) {
      const timeoutId = setTimeout(() => handleCalculate(), 500);
      return () => clearTimeout(timeoutId);
    }
  }, [peso, altura, idade, sexo, nivelAtividade, objetivo, condicoesClinicas, formulaOverride, ajusteObjetivoValor, percentualLip, percentualPtn, percentualCho, trimestreGestacao]);

  const handleSave = async () => {
    if (!onSaveCalculation || !result || !latestConsultation) {
      if (!latestConsultation) toast.error('É necessária uma consulta para salvar o cálculo.');
      return;
    }
    
    if (!calculationName.trim()) {
      toast.error('Dê um nome para este cálculo.');
      return;
    }

    setIsSaving(true);
    try {
      const input: NutritionCalculationInput = {
        peso: parseFloat(peso),
        altura: parseFloat(altura) > 3 ? parseFloat(altura) / 100 : parseFloat(altura),
        idade: parseInt(idade),
        sexo,
        nivelAtividade: parseFloat(nivelAtividade),
        objetivo: objetivo as any,
        condicoesClinicas,
        formulaOverride: formulaOverride as any || null,
        ajusteObjetivoValor: ajusteObjetivoValor ? parseFloat(ajusteObjetivoValor) : null,
        percentualLip: percentualLip ? parseFloat(percentualLip) : null,
        percentualPtn: percentualPtn ? parseFloat(percentualPtn) : null,
        percentualCho: percentualCho ? parseFloat(percentualCho) : null,
        trimestreGestacao: trimestreGestacao ? parseInt(trimestreGestacao) as any : null
      };
      await onSaveCalculation(input, result, calculationName);
      toast.success('Cálculo salvo com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar o cálculo.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCondicao = (id: string) => {
    if (id === 'saudavel') {
      setCondicoesClinicas([]);
      return;
    }
    setCondicoesClinicas(prev => {
      const newCondicoes = prev.filter(c => c !== 'saudavel');
      if (newCondicoes.includes(id)) {
        return newCondicoes.filter(c => c !== id);
      }
      return [...newCondicoes, id];
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Formulário de Entrada */}
      <div className="lg:col-span-1 space-y-4">
        <Card className="bg-muted/40">
          <CardHeader className="pb-3 border-b border-border">
            <div className="text-sm font-medium text-foreground flex items-center gap-2">
              <Calculator className="w-4 h-4 text-primary" />
              Parâmetros do Paciente
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Peso</Label>
                <div className="relative">
                  <Input type="number" step="0.1" value={peso} onChange={e => setPeso(e.target.value)} className="pr-10" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground pointer-events-none select-none">kg</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <Label>Altura</Label>
                  <Tooltip>
                    <TooltipTrigger className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Sobre o campo altura">
                      <Info className="w-3.5 h-3.5" />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Aceita metros (ex: 1,70) ou centímetros (ex: 170) — a conversão é automática.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="relative">
                  <Input type="number" step="0.01" value={altura} onChange={e => setAltura(e.target.value)} className="pr-8" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground pointer-events-none select-none">m</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Idade</Label>
                <div className="relative">
                  <Input type="number" value={idade} onChange={e => setIdade(e.target.value)} className="pr-12" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground pointer-events-none select-none">anos</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Sexo Biológico</Label>
                <Select value={sexo} onValueChange={(val: any) => setSexo(val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione">
                      {sexo === 'masculino' ? 'Masculino' : 
                       sexo === 'feminino' ? 'Feminino' : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="feminino">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nível de Atividade Física</Label>
              <Select value={nivelAtividade} onValueChange={setNivelAtividade}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione">
                    {nivelAtividade === '1.2' ? 'Sedentário (1.2)' :
                     nivelAtividade === '1.375' ? 'Leve (1.375)' :
                     nivelAtividade === '1.55' ? 'Moderado (1.55)' :
                     nivelAtividade === '1.725' ? 'Intenso (1.725)' : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1.2">Sedentário (1.2)</SelectItem>
                  <SelectItem value="1.375">Leve (1.375)</SelectItem>
                  <SelectItem value="1.55">Moderado (1.55)</SelectItem>
                  <SelectItem value="1.725">Intenso (1.725)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Objetivo</Label>
              <Select value={objetivo} onValueChange={setObjetivo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione">
                    {objetivo === 'emagrecimento' ? 'Emagrecimento' :
                     objetivo === 'manutencao' ? 'Manutenção' :
                     objetivo === 'hipertrofia' ? 'Hipertrofia' :
                     objetivo === 'reabilitacao' ? 'Reabilitação Clínica' : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="emagrecimento">Emagrecimento</SelectItem>
                  <SelectItem value="manutencao">Manutenção</SelectItem>
                  <SelectItem value="hipertrofia">Hipertrofia</SelectItem>
                  <SelectItem value="reabilitacao">Reabilitação Clínica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {(objetivo === 'emagrecimento' || objetivo === 'hipertrofia') && (
              <div className="space-y-1.5">
                <Label>Ajuste Calórico Específico (opcional)</Label>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder={objetivo === 'emagrecimento' ? "-400" : "+400"}
                    value={ajusteObjetivoValor}
                    onChange={e => setAjusteObjetivoValor(e.target.value)}
                    className="pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground pointer-events-none select-none">kcal</span>
                </div>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-1">
                <Label>Condições Clínicas</Label>
                <Tooltip>
                  <TooltipTrigger className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Sobre condições clínicas">
                    <Info className="w-3.5 h-3.5" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[260px]">
                    Influenciam a fórmula sugerida e o fator de estresse metabólico aplicado ao cálculo.
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="space-y-2">
                <div className="space-y-1.5">
                  <p className="text-[11px] text-muted-foreground">Estado fisiológico</p>
                  <div className="flex flex-wrap justify-start gap-2">
                    {condicoesOpcoes.slice(0, 3).map(cond => {
                      const isActive = condicoesClinicas.includes(cond.id) || (condicoesClinicas.length === 0 && cond.id === 'saudavel');
                      return (
                        <button
                          key={cond.id}
                          onClick={() => toggleCondicao(cond.id)}
                          aria-pressed={isActive}
                          className={cn(
                            "px-3 py-1.5 text-xs font-medium rounded-full border transition-colors",
                            isActive
                              ? "bg-primary/15 text-secondary-foreground border-primary/30"
                              : "bg-card text-muted-foreground border-border hover:bg-muted/30"
                          )}
                        >
                          {cond.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-1.5 pt-1.5 border-t border-dashed border-border">
                  <p className="text-[11px] text-muted-foreground">Quadro clínico / hospitalar</p>
                  <div className="flex flex-wrap justify-start gap-2">
                    {condicoesOpcoes.slice(3).map(cond => {
                      const isActive = condicoesClinicas.includes(cond.id);
                      return (
                        <button
                          key={cond.id}
                          onClick={() => toggleCondicao(cond.id)}
                          aria-pressed={isActive}
                          className={cn(
                            "px-3 py-1.5 text-xs font-medium rounded-full border transition-colors",
                            isActive
                              ? "bg-primary/15 text-secondary-foreground border-primary/30"
                              : "bg-card text-muted-foreground border-border hover:bg-muted/30"
                          )}
                        >
                          {cond.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {condicoesClinicas.includes('gestante') && (
              <div className="space-y-2">
                <Label>Trimestre de Gestação</Label>
                <Select value={trimestreGestacao} onValueChange={setTrimestreGestacao}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione">
                      {trimestreGestacao === '1' ? '1º Trimestre' :
                       trimestreGestacao === '2' ? '2º Trimestre' :
                       trimestreGestacao === '3' ? '3º Trimestre' : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1º Trimestre</SelectItem>
                    <SelectItem value="2">2º Trimestre</SelectItem>
                    <SelectItem value="3">3º Trimestre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2 pt-4 border-t">
              <Label className="text-primary">Ajustes Avançados</Label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="space-y-2 col-span-2">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs">Fórmula Base</Label>
                    <Tooltip>
                      <TooltipTrigger className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Sobre a fórmula base">
                        <Info className="w-3.5 h-3.5" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[260px]">
                        Automática escolhe Mifflin-St Jeor por padrão, OMS/FAO para pacientes com menos de 18 ou 60+ anos, e Kcal/kg para internados, críticos ou pós-cirúrgicos.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select value={formulaOverride} onValueChange={setFormulaOverride}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Automática">
                        {formulaOverride === '' ? 'Automática' :
                         formulaOverride === 'mifflin' ? 'Mifflin-St Jeor' :
                         formulaOverride === 'harris' ? 'Harris-Benedict' :
                         formulaOverride === 'oms' ? 'OMS/FAO' :
                         formulaOverride === 'kcal_kg' ? 'Kcal/kg' : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Automática</SelectItem>
                      <SelectItem value="mifflin">Mifflin-St Jeor</SelectItem>
                      <SelectItem value="harris">Harris-Benedict</SelectItem>
                      <SelectItem value="oms">OMS/FAO</SelectItem>
                      <SelectItem value="kcal_kg">Kcal/kg</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="col-span-2 pt-2 border-t mt-2">
                  <div className="flex justify-between items-center mb-3">
                    <Label className="text-xs text-muted-foreground font-bold">Macronutrientes (%)</Label>
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-md", isPercentError ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
                      Soma: {sumPercent}%
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Proteína', value: percentualPtn, set: setPercentualPtn },
                      { label: 'Carboidrato', value: percentualCho, set: setPercentualCho },
                      { label: 'Gorduras', value: percentualLip, set: setPercentualLip },
                    ].map(({ label, value, set }) => (
                      <div key={label} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{label}</Label>
                        <div className="relative">
                          <Input
                            className={cn("h-8 text-xs pr-6", isPercentError && "border-destructive focus-visible:ring-destructive/20")}
                            type="number"
                            placeholder="%"
                            value={value}
                            onChange={e => set(e.target.value)}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground pointer-events-none select-none">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {isPercentError && <p className="text-[10px] text-destructive mt-1">A soma não pode ultrapassar 100%.</p>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Painel de Resultados */}
      <div className="lg:col-span-2 relative">
        {loading && (
          <div className="absolute inset-0 bg-card/70 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
            <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-4 py-2">
              <RefreshCw className="w-4 h-4 text-primary animate-spin" />
              <span className="text-sm text-muted-foreground">Calculando...</span>
            </div>
          </div>
        )}

        {result ? (
          <div className="space-y-4">

            {/* Linha 1: IMC + GET + Ações */}
            <div className="grid grid-cols-3 gap-4">
              {/* IMC */}
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">IMC</p>
                  <p className="text-2xl font-bold text-foreground tabular-nums">{result.imc}</p>
                  <span className={cn(
                    "inline-block text-xs font-medium mt-2 px-2 py-0.5 rounded-md",
                    result.classificacaoImc.toLowerCase().includes('obesi') || result.classificacaoImc.toLowerCase().includes('baixo')
                      ? "bg-destructive/10 text-destructive"
                      : result.classificacaoImc.toLowerCase().includes('sobrepeso')
                      ? "bg-accent/30 text-accent-foreground"
                      : "bg-primary/10 text-primary"
                  )}>
                    {result.classificacaoImc}
                  </span>
                </CardContent>
              </Card>

              {/* Gasto Energético */}
              <Card className="col-span-2">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Gasto Energético Alvo</p>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-bold text-primary tabular-nums">{result.getAjustado}</span>
                        <span className="text-sm font-medium text-muted-foreground">kcal/dia</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Base: {result.get} kcal · TMB: {result.tmb} kcal
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Linha 2: Macronutrientes */}
            <Card>
              <CardHeader className="pb-3 border-b border-border">
                <div className="text-sm font-medium text-foreground">Distribuição de Macronutrientes</div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-3 gap-3">
                  {/* Proteínas */}
                  <div className="rounded-xl border border-border bg-card p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <span className="text-xs font-medium text-foreground">Proteínas</span>
                      </div>
                      <span className="text-[11px] font-medium bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded-md">
                        {Math.round((result.macronutrientes.ptnKcal / result.getAjustado) * 100)}%
                      </span>
                    </div>
                    <p className="text-xl font-bold text-emerald-600 tabular-nums">
                      {result.macronutrientes.ptnG}<span className="text-sm font-normal text-muted-foreground ml-1">g</span>
                    </p>
                    <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                      <span>{result.macronutrientes.ptnGKg} g/kg</span>
                      <span>{result.macronutrientes.ptnKcal} kcal</span>
                    </div>
                  </div>

                  {/* Carboidratos */}
                  <div className="rounded-xl border border-border bg-card p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                        <span className="text-xs font-medium text-foreground">Carboidratos</span>
                      </div>
                      <span className="text-[11px] font-medium bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded-md">
                        {Math.round((result.macronutrientes.choKcal / result.getAjustado) * 100)}%
                      </span>
                    </div>
                    <p className="text-lg font-bold text-blue-600 tabular-nums">
                      {result.macronutrientes.choG}<span className="text-xs font-normal text-muted-foreground ml-1">g</span>
                    </p>
                    <div className="flex justify-between mt-1.5 text-[11px] text-muted-foreground">
                      <span>{result.macronutrientes.choGKg} g/kg</span>
                      <span>{result.macronutrientes.choKcal} kcal</span>
                    </div>
                  </div>

                  {/* Gorduras */}
                  <div className="rounded-xl border border-border bg-card p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                        <span className="text-xs font-medium text-foreground">Gorduras</span>
                      </div>
                      <span className="text-[11px] font-medium bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded-md">
                        {result.macronutrientes.lipPercentual}%
                      </span>
                    </div>
                    <p className="text-lg font-bold text-red-500 tabular-nums">
                      {result.macronutrientes.lipG}<span className="text-xs font-normal text-muted-foreground ml-1">g</span>
                    </p>
                    <div className="flex justify-between mt-1.5 text-[11px] text-muted-foreground">
                      <span>{Math.round((result.macronutrientes.lipG / result.pesoUtilizado) * 100) / 100} g/kg</span>
                      <span>{result.macronutrientes.lipKcal} kcal</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Linha 3: Informações + Alertas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3 border-b border-border">
                  <div className="text-sm font-medium text-muted-foreground">Informações do Cálculo</div>
                </CardHeader>
                <CardContent className="p-4 space-y-2.5">
                  {[
                    { label: 'Faixa Etária', value: result.faixaEtaria },
                    { label: 'Fórmula Utilizada', value: result.formulaUtilizada.replace('_', '/') },
                    { label: 'Peso Utilizado', value: `${result.pesoUtilizado} kg`, highlight: true },
                  ].map(({ label, value, highlight }) => (
                    <div key={label} className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0">
                      <span className="text-muted-foreground">{label}</span>
                      <span className={cn("font-medium", highlight && "text-primary")}>{value}</span>
                    </div>
                  ))}
                  {result.justificativaPeso && (
                    <p className="text-xs text-muted-foreground pt-1">{result.justificativaPeso}</p>
                  )}
                </CardContent>
              </Card>

              {result.alertas.length > 0 ? (
                <Card className="border-accent-foreground/20 bg-accent/10">
                  <CardHeader className="pb-3 border-b border-accent-foreground/10">
                    <div className="text-sm font-medium text-accent-foreground flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Alertas Clínicos
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <ul className="space-y-2">
                      {result.alertas.map((alerta, i) => (
                        <li key={i} className="text-xs text-accent-foreground flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-accent-foreground/50 mt-1.5 shrink-0" />
                          <span>{alerta}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ) : (
                <div className="rounded-xl border border-border bg-muted/20 flex items-center justify-center p-6">
                  <p className="text-xs text-muted-foreground text-center">Nenhum alerta clínico para os parâmetros informados.</p>
                </div>
              )}
            </div>

            {/* Linha 4: Ações */}
            {onSaveCalculation && (
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                {!latestConsultation && (
                  <span className="text-xs text-muted-foreground mr-auto">Requer consulta base</span>
                )}
                {onCreateMealPlan && (
                  <Button
                    variant="outline"
                    onClick={() => onCreateMealPlan(result as any, result as any)}
                    className="h-9 text-sm px-4"
                  >
                    Criar Plano com este Cálculo
                  </Button>
                )}
                <Button
                  onClick={handleSave}
                  disabled={isSaving || !latestConsultation}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground h-9 px-5 text-sm font-semibold transition-all active:scale-95 gap-1.5"
                >
                  {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {existingCalculation ? 'Atualizar Cálculo' : 'Salvar Cálculo'}
                </Button>
              </div>
            )}

          </div>
        ) : (
          <div className="h-full min-h-[360px] border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center text-muted-foreground p-8 text-center bg-muted/20">
            <Calculator className="w-10 h-10 mb-3 opacity-30" />
            <p className="font-medium text-sm mb-1">Resultado aparece aqui</p>
            <p className="text-xs max-w-xs">Preencha peso, altura e idade para calcular automaticamente o gasto energético e a distribuição de macros.</p>
          </div>
        )}
      </div>
    </div>
  );
};

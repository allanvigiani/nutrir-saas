import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { Patient, Consultation } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Activity, Beaker, Zap, Calculator, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { NutritionCalculationInput, NutritionCalculationOutput } from '../server/services/nutrition.service'; // We will import the interface

// Define the interface here to avoid importing from backend directly into frontend if paths are strictly separated,
// but since it's a monorepo structure without strict boundary, we can redefine or import.
interface CalculatorProps {
  patient: Patient;
  latestConsultation?: Consultation;
  onSaveCalculation?: (input: NutritionCalculationInput, result: NutritionCalculationOutput, name: string) => Promise<void>;
  onCreateMealPlan?: (input: NutritionCalculationInput, result: NutritionCalculationOutput) => void;
}

export const NutritionalCalculator = ({ patient, latestConsultation, onSaveCalculation, onCreateMealPlan }: CalculatorProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NutritionCalculationOutput | null>(null);
  const [calculationName, setCalculationName] = useState('Cálculo Padrão');
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [peso, setPeso] = useState<string>(latestConsultation?.weight?.toString() || '');
  const [altura, setAltura] = useState<string>(latestConsultation?.height?.toString() || '');
  const [idade, setIdade] = useState<string>(
    patient.birthDate ? Math.floor((new Date().getTime() - new Date(patient.birthDate).getTime()) / 31557600000).toString() : ''
  );
  const [sexo, setSexo] = useState<'masculino' | 'feminino'>(
    patient.gender === 'female' ? 'feminino' : 'masculino'
  );
  const [nivelAtividade, setNivelAtividade] = useState<string>('1.2'); // default sedentário
  const [objetivo, setObjetivo] = useState<string>('manutencao');
  const [condicoesClinicas, setCondicoesClinicas] = useState<string[]>([]);
  const [formulaOverride, setFormulaOverride] = useState<string>('');
  
  // Advanced options
  const [ajusteObjetivoValor, setAjusteObjetivoValor] = useState<string>('');
  const [percentualLip, setPercentualLip] = useState<string>('');
  const [percentualPtn, setPercentualPtn] = useState<string>('');
  const [percentualCho, setPercentualCho] = useState<string>('');
  const [trimestreGestacao, setTrimestreGestacao] = useState<string>('');

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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Formulário de Entrada */}
      <div className="lg:col-span-1 space-y-6">
        <Card className="border-primary/20 shadow-sm">
          <CardHeader className="bg-primary/8 pb-4 border-b border-primary/20">
            <CardTitle className="text-secondary-foreground flex items-center gap-2 text-lg">
              <Calculator className="w-5 h-5" />
              Parâmetros do Paciente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Peso (kg)</Label>
                <Input type="number" step="0.1" value={peso} onChange={e => setPeso(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Altura (m)</Label>
                <Input type="number" step="0.01" value={altura} onChange={e => setAltura(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Idade</Label>
                <Input type="number" value={idade} onChange={e => setIdade(e.target.value)} />
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
              <div className="space-y-2">
                <Label>Ajuste Calórico Específico (opcional, kcal)</Label>
                <Input 
                  type="number" 
                  placeholder={objetivo === 'emagrecimento' ? "-400" : "+400"} 
                  value={ajusteObjetivoValor} 
                  onChange={e => setAjusteObjetivoValor(e.target.value)} 
                />
              </div>
            )}

            <div className="space-y-2 pt-2">
              <Label>Condições Clínicas</Label>
              <div className="flex flex-wrap gap-2">
                {condicoesOpcoes.map(cond => (
                  <button
                    key={cond.id}
                    onClick={() => toggleCondicao(cond.id)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-full border transition-colors",
                      (condicoesClinicas.includes(cond.id) || (condicoesClinicas.length === 0 && cond.id === 'saudavel'))
                        ? "bg-primary/15 text-secondary-foreground border-primary/30"
                        : "bg-card text-muted-foreground border-border hover:bg-muted/30"
                    )}
                  >
                    {cond.label}
                  </button>
                ))}
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
                  <Label className="text-xs">Fórmula Base</Label>
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
                    <span className={cn("text-xs font-bold px-2 py-0.5 rounded-md", isPercentError ? "bg-red-100 text-red-600" : "bg-primary/10 text-primary")}>
                      Soma: {sumPercent}%
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground uppercase">Proteína</Label>
                      <Input className={cn("h-8 text-xs", isPercentError && "border-red-300 focus-visible:ring-red-200")} type="number" placeholder="Auto" value={percentualPtn} onChange={e => setPercentualPtn(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground uppercase">Carboidrato</Label>
                      <Input className={cn("h-8 text-xs", isPercentError && "border-red-300 focus-visible:ring-red-200")} type="number" placeholder="Auto" value={percentualCho} onChange={e => setPercentualCho(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground uppercase">Gorduras</Label>
                      <Input className={cn("h-8 text-xs", isPercentError && "border-red-300 focus-visible:ring-red-200")} type="number" placeholder="Auto" value={percentualLip} onChange={e => setPercentualLip(e.target.value)} />
                    </div>
                  </div>
                  {isPercentError && <p className="text-[10px] text-red-500 mt-1">A soma não pode ultrapassar 100%.</p>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Painel de Resultados */}
      <div className="lg:col-span-2 relative">
        {loading && (
          <div className="absolute inset-0 bg-card/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}
        
        {result ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-card border-none shadow-sm">
                <CardContent className="p-4 flex flex-col justify-center">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">IMC</p>
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-black text-foreground">{result.imc}</span>
                  </div>
                  <span className={cn(
                    "text-xs font-bold mt-2 px-2 py-1 rounded-md inline-block w-fit",
                    result.classificacaoImc.includes('obesidade') || result.classificacaoImc.includes('Baixo') ? "bg-red-100 text-red-700" :
                    result.classificacaoImc.includes('Sobrepeso') ? "bg-amber-100 text-amber-700" :
                    "bg-primary/15 text-primary"
                  )}>
                    {result.classificacaoImc}
                  </span>
                </CardContent>
              </Card>

              <Card className="bg-primary text-white border-none shadow-sm md:col-span-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-20">
                  <Zap className="w-24 h-24" />
                </div>
                <CardContent className="p-6 relative z-10">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div>
                      <p className="text-sm font-medium text-primary-foreground/80 uppercase tracking-wider mb-1">Gasto Energético Alvo</p>
                      <div className="flex items-end gap-2">
                        <span className="text-4xl font-black">{result.getAjustado}</span>
                        <span className="text-lg font-medium text-primary-foreground/60 mb-1">kcal/dia</span>
                      </div>
                      <p className="text-sm text-primary-foreground/80 mt-2">
                        Base: {result.get} kcal (TMB: {result.tmb} kcal)
                      </p>
                    </div>
                    {onSaveCalculation && (
                      <div className="flex flex-col items-end gap-2">
                        <Input 
                          value={calculationName}
                          onChange={(e) => setCalculationName(e.target.value)}
                          placeholder="Nome do Cálculo"
                          className="h-8 bg-primary/40 border-primary/50 text-white placeholder:text-primary/70 text-sm text-right max-w-[200px]"
                        />
                        <Button 
                          onClick={handleSave} 
                          disabled={isSaving || !latestConsultation}
                          className="bg-card text-primary hover:bg-primary/10 font-bold h-10 px-6 rounded-xl shadow-lg border-0 shrink-0 transition-transform active:scale-95"
                        >
                          {isSaving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                          Salvar Cálculo
                        </Button>
                        {onCreateMealPlan && (
                          <Button 
                            variant="ghost"
                            onClick={() => onCreateMealPlan(result as any, result as any)} // Passing result as both for simplicity since we just need result in MP
                            className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary/90/50 text-xs h-8 px-4 border border-primary/30 rounded-lg mt-1"
                          >
                            Criar Plano com este Cálculo
                          </Button>
                        )}
                        {!latestConsultation && <span className="text-[10px] text-amber-200">Requer consulta base</span>}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border shadow-sm">
              <CardHeader className="border-b bg-muted/30/50 pb-4">
                <CardTitle className="text-foreground text-lg">Distribuição de Macronutrientes</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Proteínas */}
                  <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-blue-800">Proteínas</span>
                      <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{Math.round((result.macronutrientes.ptnKcal / result.getAjustado) * 100)}%</span>
                    </div>
                    <p className="text-2xl font-black text-blue-900">{result.macronutrientes.ptnG} <span className="text-sm font-normal text-blue-600">g</span></p>
                    <div className="flex justify-between items-center mt-2 text-xs text-blue-700">
                      <span>{result.macronutrientes.ptnGKg} g/kg</span>
                      <span>{result.macronutrientes.ptnKcal} kcal</span>
                    </div>
                  </div>

                  {/* Carboidratos */}
                  <div className="bg-primary/8 p-4 rounded-xl border border-primary/20">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-secondary-foreground">Carboidratos</span>
                      <span className="text-xs font-bold bg-primary/15 text-primary px-2 py-0.5 rounded-full">{Math.round((result.macronutrientes.choKcal / result.getAjustado) * 100)}%</span>
                    </div>
                    <p className="text-2xl font-black text-foreground">{result.macronutrientes.choG} <span className="text-sm font-normal text-primary">g</span></p>
                    <div className="flex justify-between items-center mt-2 text-xs text-primary">
                      <span>{result.macronutrientes.choGKg} g/kg</span>
                      <span>{result.macronutrientes.choKcal} kcal</span>
                    </div>
                  </div>

                  {/* Lipídios */}
                  <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-amber-800">Gorduras</span>
                      <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{result.macronutrientes.lipPercentual}%</span>
                    </div>
                    <p className="text-2xl font-black text-amber-900">{result.macronutrientes.lipG} <span className="text-sm font-normal text-amber-600">g</span></p>
                    <div className="flex justify-between items-center mt-2 text-xs text-amber-700">
                      <span>{Math.round((result.macronutrientes.lipG / result.pesoUtilizado) * 100) / 100} g/kg</span>
                      <span>{result.macronutrientes.lipKcal} kcal</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-border shadow-sm h-full">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-sm font-bold text-muted-foreground">Informações do Cálculo</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3 text-sm">
                  <div className="flex justify-between border-b pb-2 border-dashed">
                    <span className="text-muted-foreground">Faixa Etária</span>
                    <span className="font-medium">{result.faixaEtaria}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2 border-dashed">
                    <span className="text-muted-foreground">Fórmula Utilizada</span>
                    <span className="font-medium uppercase">{result.formulaUtilizada.replace('_', '/')}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2 border-dashed">
                    <span className="text-muted-foreground">Peso Utilizado</span>
                    <span className="font-medium text-primary">{result.pesoUtilizado} kg</span>
                  </div>
                  <p className="text-xs text-muted-foreground italic text-right mt-1">{result.justificativaPeso}</p>
                </CardContent>
              </Card>

              {result.alertas.length > 0 && (
                <Card className="border-amber-200 shadow-sm bg-amber-50 h-full">
                  <CardHeader className="pb-3 border-b border-amber-200/50">
                    <CardTitle className="text-sm font-bold text-amber-800 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Alertas Clínicos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <ul className="space-y-2">
                      {result.alertas.map((alerta, i) => (
                        <li key={i} className="text-xs text-amber-900 flex items-start gap-2 bg-amber-100/50 p-2 rounded-lg">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1 shrink-0" />
                          <span>{alerta}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>

          </div>
        ) : (
          <div className="h-full min-h-[400px] border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center text-muted-foreground p-8 text-center bg-muted/30/50">
            <Calculator className="w-12 h-12 mb-4 text-muted-foreground" />
            <h3 className="font-bold text-muted-foreground mb-2">Motor de Cálculo Nutricional</h3>
            <p className="max-w-md text-sm">Insira o peso, altura e idade do paciente para visualizar o gasto energético e distribuição de macronutrientes recomendados.</p>
          </div>
        )}
      </div>
    </div>
  );
};

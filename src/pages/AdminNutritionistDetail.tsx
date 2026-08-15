import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useParams, useLocation, Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Save, Users, Mail, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest } from '../hooks/useApi';
import { Nutritionist } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(200, 'Máximo de 200 caracteres'),
  crn: z.string().trim().max(20, 'Máximo de 20 caracteres').optional(),
  phone: z.string().trim().max(30, 'Máximo de 30 caracteres').optional(),
  plan: z.enum(['free', 'premium']),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export const AdminNutritionistDetail = () => {
  const { nutritionist: currentAdmin, loading: authLoading } = useAuth();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const stateNutritionist = (location.state as { nutritionist?: Nutritionist } | null)?.nutritionist;

  const [target, setTarget] = useState<Nutritionist | null>(stateNutritionist ?? null);
  const [loading, setLoading] = useState(!stateNutritionist);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', crn: '', phone: '', plan: 'free' },
  });

  useEffect(() => {
    // A navegação normal (lista → clique na linha) já traz o registro via router
    // state, evitando um round-trip. Esse fallback cobre acesso direto por URL ou
    // refresh, buscando o registro isolado em GET /api/admin/nutritionists/:id
    // (endpoint dedicado — antes disso paginávamos a lista inteira e filtrávamos no
    // cliente, o que quebrava silenciosamente acima de 100 nutricionistas).
    if (stateNutritionist || !id) return;
    let cancelled = false;
    (async () => {
      try {
        const found = await apiRequest<Nutritionist>(`/api/admin/nutritionists/${id}`, 'GET');
        if (cancelled) return;
        setTarget(found);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, stateNutritionist]);

  useEffect(() => {
    if (target) {
      form.reset({
        name: target.name ?? '',
        crn: target.crn ?? '',
        phone: target.phone ?? '',
        plan: (target.plan as 'free' | 'premium') ?? 'free',
      });
    }
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  if (authLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (currentAdmin?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  if (!id) {
    return <Navigate to="/admin" replace />;
  }

  const onSubmit = async (data: ProfileFormData) => {
    setSaving(true);
    try {
      const updated = await apiRequest<Nutritionist>(`/api/admin/nutritionists/${id}`, 'PATCH', {
        name: data.name,
        crn: data.crn || null,
        phone: data.phone || null,
        plan: data.plan,
      });
      setTarget(updated);
      form.reset({
        name: updated.name ?? '',
        crn: updated.crn ?? '',
        phone: updated.phone ?? '',
        plan: (updated.plan as 'free' | 'premium') ?? 'free',
      });
      toast.success('Cadastro atualizado com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1.5" render={<Link to="/admin" />}>
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
      </div>

      {loading ? (
        <Card className="border-none shadow-sm bg-card">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : notFound || !target ? (
        <Card className="border-none shadow-sm bg-card">
          <CardContent className="p-12 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Nutricionista não encontrado. Volte à lista e acesse pelo link da tabela.
            </p>
            <Button variant="outline" render={<Link to="/admin" />}>Voltar à lista</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold text-xl">
                {target.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">{target.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={target.plan === 'premium' ? 'default' : 'secondary'}>
                    {target.plan === 'premium' ? 'Premium' : 'Gratuito'}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    {target.role === 'admin' ? 'Admin' : 'Nutricionista'}
                  </Badge>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" render={<Link to={`/admin/nutritionists/${id}/patients`} state={{ nutritionist: target }} />}>
              <Users className="w-4 h-4" /> Ver pacientes
            </Button>
          </div>

          <Card className="border-none shadow-sm bg-card">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-lg font-bold">Editar cadastro</CardTitle>
              <p className="text-sm text-muted-foreground">
                Nome, CRN, telefone e plano podem ser alterados aqui. E-mail e cargo não são editáveis nesta tela.
              </p>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail (somente leitura)</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="email" value={target.email} disabled className="pl-10 bg-muted/50" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome</Label>
                  <Input id="name" {...form.register('name')} className="rounded-lg" />
                  {form.formState.errors.name && (
                    <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="crn">CRN</Label>
                    <Input id="crn" {...form.register('crn')} className="rounded-lg" />
                    {form.formState.errors.crn && (
                      <p className="text-xs text-destructive">{form.formState.errors.crn.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input id="phone" {...form.register('phone')} className="rounded-lg" />
                    {form.formState.errors.phone && (
                      <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="plan">Plano</Label>
                  <Select
                    value={form.watch('plan')}
                    onValueChange={(v) => form.setValue('plan', v as 'free' | 'premium', { shouldDirty: true })}
                  >
                    <SelectTrigger id="plan" className="rounded-lg w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Gratuito</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={saving || !form.formState.isDirty} className="gap-2">
                    <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar alterações'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

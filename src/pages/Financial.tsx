import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  DollarSign, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  XCircle,
  CreditCard,
  Banknote,
  Smartphone,
  ArrowRightLeft,
  FileText,
  Calendar,
  Activity,
  Edit2,
  Check,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '../components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import { useAuth } from '../contexts/AuthContext';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Patient, Payment } from '../types';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '../lib/utils';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const maskCurrency = (value: string) => {
  if (!value) return "";
  const onlyDigits = value.replace(/\D/g, "");
  if (!onlyDigits) return "";
  const formatted = (Number(onlyDigits) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
  });
  return formatted;
};

const paymentSchema = z.object({
  patient_id: z.string().min(1, 'Selecione o paciente'),
  amount: z.string().min(1, 'Informe o valor'),
  date: z.string().min(10, 'Data é obrigatória'),
  method: z.enum(['pix', 'credit_card', 'debit_card', 'cash', 'bank_transfer']),
  status: z.enum(['paid', 'pending', 'cancelled']),
  description: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

export const Financial = () => {
  const { user, nutritionist } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [newStatus, setNewStatus] = useState<Payment['status']>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      patient_id: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      method: 'pix',
      status: 'paid',
      description: '',
    }
  });

  const methodValue = watch('method');
  const statusValue = watch('status');
  const patientIdValue = watch('patient_id');

  useEffect(() => {
    if (!user) return;

    // Fetch Patients for the select
    const fetchPatients = async () => {
      try {
        const q = query(
          collection(db, 'patients'),
          where('nutritionist_id', '==', user.uid),
          orderBy('name', 'asc')
        );
        const querySnapshot = await getDocs(q);
        const patientsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
        setPatients(patientsData);
      } catch (error) {
        console.error("Error fetching patients:", error);
      }
    };

    fetchPatients();

    // Listen to Payments
    const q = query(
      collection(db, 'payments'),
      where('nutritionist_id', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const paymentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
      setPayments(paymentsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'payments');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleCreatePayment = async (data: PaymentFormValues) => {
    if (!user) return;

    try {
      const paymentData = {
        patient_id: data.patient_id,
        nutritionist_id: user.uid,
        amount: parseFloat(data.amount.replace(/\./g, '').replace(',', '.')),
        date: new Date(data.date).toISOString(),
        method: data.method,
        status: data.status,
        description: data.description || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'payments'), paymentData);
      
      toast.success('Pagamento registrado com sucesso!');
      setIsModalOpen(false);
      reset();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'payments');
    }
  };

  const handleDeletePayment = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este registro?')) return;

    try {
      await deleteDoc(doc(db, 'payments', id));
      toast.success('Pagamento excluído com sucesso');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `payments/${id}`);
    }
  };

  const handleUpdatePaymentStatus = async () => {
    if (!selectedPayment || !user) return;

    try {
      await updateDoc(doc(db, 'payments', selectedPayment.id), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      
      toast.success('Status do pagamento atualizado com sucesso!');
      setIsStatusModalOpen(false);
      setSelectedPayment(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `payments/${selectedPayment.id}`);
    }
  };

  const generateReceipt = (payment: Payment) => {
    const patient = patients.find(p => p.id === payment.patient_id);
    if (!patient) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFillColor(5, 150, 105); // emerald-600
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('RECIBO DE PAGAMENTO', pageWidth / 2, 25, { align: 'center' });
    
    // Content
    doc.setTextColor(30, 41, 59); // slate-800
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    
    let y = 60;
    doc.text(`Número do Recibo: #${payment.id.substring(0, 8).toUpperCase()}`, 20, y);
    y += 10;
    doc.text(`Data: ${format(parseISO(payment.date.split('T')[0] + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`, 20, y);
    
    y += 20;
    doc.setFont('helvetica', 'bold');
    doc.text('DADOS DO EMISSOR', 20, y);
    doc.line(20, y + 2, 190, y + 2);
    
    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.text(`Nome: ${nutritionist?.name || 'Não informado'}`, 25, y);
    y += 7;
    doc.text(`CRN: ${nutritionist?.crn || 'Não informado'}`, 25, y);
    y += 7;
    doc.text(`E-mail: ${nutritionist?.email || 'Não informado'}`, 25, y);
    
    y += 20;
    doc.setFont('helvetica', 'bold');
    doc.text('DADOS DO PAGADOR', 20, y);
    doc.line(20, y + 2, 190, y + 2);
    
    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.text(`Nome: ${patient.name}`, 25, y);
    y += 7;
    doc.text(`CPF: ${patient.cpf}`, 25, y);
    
    y += 25;
    doc.setFillColor(248, 250, 252); // slate-50
    doc.rect(20, y, 170, 40, 'F');
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.rect(20, y, 170, 40, 'S');
    
    y += 15;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('VALOR PAGO:', 30, y);
    doc.setTextColor(5, 150, 105);
    doc.text(`R$ ${payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 100, y);
    
    y += 12;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Forma de Pagamento: ${getMethodLabel(payment.method)}`, 30, y);
    
    if (payment.description) {
      y += 25;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('OBSERVAÇÕES:', 20, y);
      y += 7;
      doc.setFont('helvetica', 'normal');
      const splitDesc = doc.splitTextToSize(payment.description, 160);
      doc.text(splitDesc, 20, y);
    }
    
    // Signature
    y = 240;
    doc.line(60, y, 150, y);
    y += 7;
    doc.setFontSize(10);
    doc.text(nutritionist?.name || '', pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.text('Assinatura do Profissional', pageWidth / 2, y, { align: 'center' });
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Documento gerado pelo sistema Nutrir', pageWidth / 2, 285, { align: 'center' });

    doc.save(`recibo_${patient.name.toLowerCase().replace(/\s+/g, '_')}_${format(parseISO(payment.date.split('T')[0] + 'T12:00:00'), 'yyyyMMdd')}.pdf`);
  };

  const getMethodLabel = (m: Payment['method']) => {
    const labels = {
      pix: 'PIX',
      credit_card: 'Cartão de Crédito',
      debit_card: 'Cartão de Débito',
      cash: 'Dinheiro',
      bank_transfer: 'Transferência Bancária'
    };
    return labels[m];
  };

  const getMethodIcon = (m: Payment['method']) => {
    switch (m) {
      case 'pix': return Smartphone;
      case 'credit_card': return CreditCard;
      case 'debit_card': return CreditCard;
      case 'cash': return Banknote;
      case 'bank_transfer': return ArrowRightLeft;
      default: return DollarSign;
    }
  };

  const filteredPayments = payments.filter(p => {
    const patient = patients.find(pat => pat.id === p.patient_id);
    const matchesSearch = patient?.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    
    let matchesDate = true;
    if (startDate || endDate) {
      const paymentDate = parseISO(p.date);
      const start = startDate ? startOfDay(parseISO(startDate)) : new Date(0);
      const end = endDate ? endOfDay(parseISO(endDate)) : new Date(8640000000000000);
      matchesDate = isWithinInterval(paymentDate, { start, end });
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
  const paginatedPayments = filteredPayments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalReceived = filteredPayments
    .filter(p => p.status === 'paid')
    .reduce((acc, p) => acc + p.amount, 0);

  const totalPending = filteredPayments
    .filter(p => p.status === 'pending')
    .reduce((acc, p) => acc + p.amount, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Financeiro</h1>
          <p className="text-muted-foreground">Gerencie pagamentos e emita recibos para seus pacientes.</p>
        </div>
        <Button 
          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-8 px-4 gap-2 font-bold text-sm transition-all shadow-sm active:scale-95"
          onClick={() => {
            reset();
            setIsModalOpen(true);
          }}
        >
          <Plus className="w-4 h-4" /> Novo Pagamento
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm">
          <CardContent className="py-4 px-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Recebido</p>
                <p className="text-xl font-bold text-foreground">
                  R$ {totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="py-4 px-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Pendente</p>
                <p className="text-xl font-bold text-foreground">
                  R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="py-4 px-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-muted/30 flex items-center justify-center text-muted-foreground border border-border">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Lançamentos</p>
                <p className="text-xl font-bold text-foreground">{filteredPayments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="border-b border-border pb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-xl font-bold text-foreground">Histórico de Transações</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por paciente..." 
                  className="pl-10 w-full sm:w-64 rounded-xl border-border focus:ring-emerald-500"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="space-y-1 w-full">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Início</Label>
                  <Input 
                    type="date" 
                    className="rounded-xl border-border h-9 text-xs"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
                <div className="space-y-1 w-full">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Fim</Label>
                  <Input 
                    type="date" 
                    className="rounded-xl border-border h-9 text-xs"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={(v) => {
                setStatusFilter(v);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-full sm:w-40 rounded-xl border-border">
                  <SelectValue placeholder="Status">
                    {statusFilter === 'all' ? 'Todos' : 
                     statusFilter === 'paid' ? 'Pago' : 
                     statusFilter === 'pending' ? 'Pendente' : 
                     statusFilter === 'cancelled' ? 'Cancelado' : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/30/50">
                  <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Data</th>
                  <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Paciente</th>
                  <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Método</th>
                  <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Valor</th>
                  <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-emerald-600/20 border-t-emerald-600 rounded-full animate-spin" />
                        <p className="text-muted-foreground font-medium">Carregando transações...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <DollarSign className="w-12 h-12 opacity-20" />
                        <p className="font-medium">Nenhuma transação encontrada.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedPayments.map((payment) => {
                    const patient = patients.find(p => p.id === payment.patient_id);
                    const MethodIcon = getMethodIcon(payment.method);
                    
                    return (
                      <tr key={payment.id} className="hover:bg-muted/30/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium text-muted-foreground">
                              {format(parseISO(payment.date.split('T')[0] + 'T12:00:00'), 'dd/MM/yyyy')}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-foreground">{patient?.name || 'Paciente Excluído'}</p>
                          <p className="text-xs text-muted-foreground">{payment.description || 'Sem descrição'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MethodIcon className="w-4 h-4" />
                            <span className="text-xs font-medium">{getMethodLabel(payment.method)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-foreground">
                            R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5",
                            payment.status === 'paid' ? "bg-emerald-100 text-emerald-700" :
                            payment.status === 'pending' ? "bg-amber-100 text-amber-700" :
                            "bg-red-100 text-red-700"
                          )}>
                            {payment.status === 'paid' ? (
                              <><CheckCircle2 className="w-3 h-3" /> Pago</>
                            ) : payment.status === 'pending' ? (
                              <><Clock className="w-3 h-3" /> Pendente</>
                            ) : (
                              <><XCircle className="w-3 h-3" /> Cancelado</>
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {payment.status === 'pending' && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                                title="Editar Status"
                                onClick={() => {
                                  setSelectedPayment(payment);
                                  setNewStatus(payment.status);
                                  setIsStatusModalOpen(true);
                                }}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"
                              title="Emitir Recibo"
                              onClick={() => generateReceipt(payment)}
                              disabled={payment.status !== 'paid'}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg"
                              title="Excluir"
                              onClick={() => handleDeletePayment(payment.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <p className="text-sm text-muted-foreground font-medium">
                Mostrando <span className="text-foreground">{paginatedPayments.length}</span> de <span className="text-foreground">{filteredPayments.length}</span> transações
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-lg border-border"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'outline'}
                      className={cn(
                        "h-8 w-8 rounded-lg text-xs font-bold",
                        currentPage === page ? "bg-emerald-600 hover:bg-emerald-700" : "border-border text-muted-foreground"
                      )}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-lg border-border"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Update Modal */}
      <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border-none shadow-2xl p-4">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold">Atualizar Status</DialogTitle>
            <DialogDescription className="text-sm">
              Altere o status do pagamento do paciente <strong>{patients.find(p => p.id === selectedPayment?.patient_id)?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="status-update">Novo Status</Label>
              <Select value={newStatus} onValueChange={(v: any) => setNewStatus(v)}>
                <SelectTrigger id="status-update" className="rounded-xl border-border">
                  <SelectValue placeholder="Selecione o status">
                    {newStatus === 'paid' ? 'Pago' : 
                     newStatus === 'pending' ? 'Pendente' : 
                     newStatus === 'cancelled' ? 'Cancelado' : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-border mt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsStatusModalOpen(false)}
              className="rounded-xl h-8 px-4 border-border text-muted-foreground text-sm hover:bg-muted/30 transition-all active:scale-95"
            >
              Cancelar
            </Button>
            <Button 
              type="button" 
              onClick={handleUpdatePaymentStatus}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-8 px-5 font-bold text-sm transition-all shadow-sm active:scale-95"
            >
              Atualizar Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-4 bg-muted/30 border-b border-border">
            <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              Novo Pagamento
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">Registre uma nova entrada financeira no sistema.</DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit(handleCreatePayment)} className="p-4 space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="patient_id" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Paciente</Label>
                <Select value={patientIdValue} onValueChange={(v) => setValue('patient_id', v)}>
                  <SelectTrigger className="h-10 rounded-xl border-border focus:ring-emerald-500">
                    <SelectValue placeholder="Selecione o paciente">
                      {patients.find(p => p.id === patientIdValue)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.patient_id && <p className="text-xs text-red-500">{errors.patient_id.message}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Valor (R$)</Label>
                  <Input 
                    id="amount"
                    placeholder="0,00" 
                    className="h-10 rounded-xl border-border focus:ring-emerald-500"
                    {...register('amount')}
                    onChange={(e) => {
                      const value = e.target.value;
                      e.target.value = maskCurrency(value);
                      register('amount').onChange(e);
                    }}
                  />
                  {errors.amount && <p className="text-xs text-red-500">{errors.amount.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Data</Label>
                  <Input 
                    id="date"
                    type="date" 
                    className="h-10 rounded-xl border-border focus:ring-emerald-500"
                    {...register('date')}
                  />
                  {errors.date && <p className="text-xs text-red-500">{errors.date.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="method" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Método</Label>
                  <Select value={methodValue} onValueChange={(v: any) => setValue('method', v)}>
                    <SelectTrigger className="h-10 rounded-xl border-border focus:ring-emerald-500">
                      <SelectValue>
                        {methodValue === 'pix' ? 'PIX' : 
                         methodValue === 'credit_card' ? 'Cartão de Crédito' : 
                         methodValue === 'debit_card' ? 'Cartão de Débito' : 
                         methodValue === 'cash' ? 'Dinheiro' : 
                         methodValue === 'bank_transfer' ? 'Transferência' : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                      <SelectItem value="debit_card">Cartão de Débito</SelectItem>
                      <SelectItem value="cash">Dinheiro</SelectItem>
                      <SelectItem value="bank_transfer">Transferência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</Label>
                  <Select value={statusValue} onValueChange={(v: any) => setValue('status', v)}>
                    <SelectTrigger className="h-10 rounded-xl border-border focus:ring-emerald-500">
                      <SelectValue>
                        {statusValue === 'paid' ? 'Pago' : 
                         statusValue === 'pending' ? 'Pendente' : 
                         statusValue === 'cancelled' ? 'Cancelado' : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">Pago</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Descrição (Opcional)</Label>
                <Input 
                  id="description"
                  placeholder="Ex: Consulta de rotina, Pacote 5 sessões..." 
                  className="h-10 rounded-xl border-border focus:ring-emerald-500"
                  {...register('description')}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-border">
              <Button 
                type="button" 
                variant="outline" 
                className="rounded-xl h-8 px-4 border-border text-muted-foreground text-sm hover:bg-muted/30 transition-all active:scale-95"
                onClick={() => setIsModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-8 px-5 font-bold text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50" 
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Salvando...' : 'Registrar Pagamento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

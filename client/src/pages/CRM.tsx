import { useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Users, Plus, Phone, Mail, MessageSquare, Upload, FileText, ArrowRight, User, Calendar } from "lucide-react";
import { toast, Toaster } from "sonner";
import { getLoginUrl } from "@/const";

/**
 * Página de CRM
 * 
 * Sistema de gestão de leads com pipeline para corretores e administrativos.
 * 
 * EDIÇÃO:
 * - Para modificar os status do pipeline: edite PIPELINE_STATUS
 * - Para alterar cores dos status: edite getStatusColor
 */

// ========== ÁREA DE EDIÇÃO - PIPELINE ==========
const PIPELINE_STATUS = [
  { value: "novo", label: "Novos Leads", color: "bg-blue-100 text-blue-700" },
  { value: "atendimento", label: "Em Atendimento", color: "bg-purple-100 text-purple-700" },
  { value: "proposta", label: "Proposta", color: "bg-yellow-100 text-yellow-700" },
  { value: "negociacao", label: "Negociação", color: "bg-orange-100 text-orange-700" },
  { value: "fechado", label: "Fechado", color: "bg-green-100 text-green-700" },
  { value: "perdidos", label: "Perdidos", color: "bg-red-100 text-red-700" },
];
// ========== FIM DA ÁREA DE EDIÇÃO ==========

function formatDateTime(date: Date | string | null) {
  if (!date) return 'Data não disponível';
  
  try {
    const parsedDate = new Date(date);
    return isNaN(parsedDate.getTime()) 
      ? 'Data inválida' 
      : parsedDate.toLocaleDateString("pt-BR", { 
          timeZone: "America/Sao_Paulo" 
        }) + ' às ' + 
        parsedDate.toLocaleTimeString("pt-BR", { 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: "America/Sao_Paulo"
        });
  } catch {
    return 'Data inválida';
  }
}

function getStatusColor(status: string) {
  const statusConfig = PIPELINE_STATUS.find((s) => s.value === status);
  return statusConfig?.color || "bg-gray-100 text-gray-700";
}

export default function CRM() {
  const { user, loading, isAuthenticated } = useAuth();
  const [statusSelected, setStatusSelected] = useState<string>("new");
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [leadDetailsOpen, setLeadDetailsOpen] = useState(false);
  const [newNote, setNewNote] = useState("");

  const [newLeadData, setNewLeadData] = useState({
    nome: "",
    email: "",
    telefone: "",
    origem: "",
    interesse: "",
    observacao: "",
  });

  const { data: leads, isLoading, refetch } = trpc.leads.list.useQuery(
    undefined,
    { enabled: isAuthenticated && (user?.role === "corretor" || user?.role === "administrativo") }
  );

  // Filtrar leads pelo status selecionado
  const leadsFiltrados = leads?.filter(lead => lead.status === statusSelected) || [];


  const { data: notes, refetch: refetchNotes } = trpc.leads.getNotes.useQuery(
    { idLead: selectedLead?.id },
    { enabled: !!selectedLead }
  );

  const { data: files } = trpc.leads.getFiles.useQuery(
    { idLead: selectedLead?.id },
    { enabled: !!selectedLead }
  );

  const createLead = trpc.leads.create.useMutation({
    onSuccess: () => {
      toast.success("Lead criado com sucesso!");
      refetch();
      setNewLeadOpen(false);
      setNewLeadData({ nome: "", email: "", telefone: "", origem: "", interesse: "", observacao: "" });
    },
    onError: () => {
      toast.error("Erro ao criar lead");
    },
  });

  //Regra que formata telefone conforme usuário digita
  const formatPhone = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .slice(0, 15);
  };

  const updateLead = trpc.leads.update.useMutation({
    onSuccess: () => {
      toast.success("Lead atualizado!");
      refetch();
    },
    onError: () => {
      toast.error("Erro ao atualizar lead");
    },
  });

  const addNote = trpc.leads.addNote.useMutation({
    onSuccess: () => {
      toast.success("Anotação adicionada!");
      refetchNotes();
      setNewNote("");
    },
    onError: () => {
      toast.error("Erro ao adicionar anotação");
    },
  });

//Regra que valida o email digitado antes de cadastrar o lead
  const isValidEmail = (v: string) => 
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

//Mensagem informando que os campos estão vazios ao tentar cadastrar um lead
  const handleCreateLead = () => {
    if (!newLeadData.nome || !newLeadData.email) {
      toast.error("Preencha nome e email");
      return;
    }

    if (!isValidEmail(newLeadData.email)) {
      toast.error("E-mail inválido");
      return;
    }

    //Formata nome digitado
    const formattedData = {
      ...newLeadData,
      nome: newLeadData.nome
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    };

    // CORREÇÃO: Passe os dados corretamente
    createLead.mutate(formattedData); // ← Passe newLeadData, não {}
  };

  const handleStatusChange = (leadId: number, newStatus: string) => {
    updateLead.mutate(
      { id: leadId, status: newStatus },
      {
        onSuccess: () => {
          refetch();
          
          // delay ao fechar o dialog para melhor sensação de usabilidade
          setTimeout(() => {
            setLeadDetailsOpen(false);
            setSelectedLead(null); // ← Limpa o lead selecionado também
          }, 350);
        },
        onError: () => {
          toast.error("Erro ao atualizar status");
        },
      }
    );
  };

  //Mensagem Informando que não possível adicionar anotação vazia nos detalhes do lead
  const handleAddNote = () => {
    if (!newNote.trim()) {
      toast.warning("Digite algo antes de adicionar.");
      return;
    }

    addNote.mutate({ idLead: selectedLead.id, anotacao: newNote });
  };

  if (loading) {
    return (
      <Layout>
        <div className="container py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Acesso Restrito</h1>
          <p className="text-muted-foreground mb-6">
            Você precisa estar autenticado para acessar o CRM.
          </p>
          <Button asChild>
            <a href={getLoginUrl()}>Fazer Login</a>
          </Button>
        </div>
      </Layout>
    );
  }

  if (user?.role !== "corretor" && user?.role !== "administrativo") {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Acesso Negado</h1>
          <p className="text-muted-foreground mb-6">
            Esta área é exclusiva para corretores e administradores.
          </p>
          <Button asChild>
            <a href="/">Voltar para Home</a>
          </Button>
        </div>
      </Layout>
    );
  }

  const leadsByStatus = PIPELINE_STATUS.map((status) => ({
    ...status,      
    leads: leads?.filter((lead) => lead.status === status.value) || [],
  }));

  return (
    <Layout>
      <div className="container py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Gestão de Leads</h1>
            <p className="text-muted-foreground mt-2">
              Gerencie seus leads e acompanhe o funil de vendas
            </p>
          </div>
          <Dialog open={newLeadOpen} onOpenChange={setNewLeadOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Lead
              </Button>
            </DialogTrigger>

            <DialogContent className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Lead</DialogTitle>
                <DialogDescription>
                  Preencha as informações do lead
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    value={newLeadData.nome}
                    maxLength={40}
                    onChange={(e) => setNewLeadData({ ...newLeadData, nome: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    type="email"
                    value={newLeadData.email}
                    maxLength={35}
                    onChange={(e) =>
                      setNewLeadData({ ...newLeadData, email: e.target.value,})
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={newLeadData.telefone}
                    onChange={(e) => setNewLeadData({ ...newLeadData, telefone: formatPhone(e.target.value)})}
                  />
                </div>
                <div className="flex">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="origem">Origem</Label>
                    <Select
                      value={newLeadData.origem}
                      onValueChange={(value) => setNewLeadData({ ...newLeadData, origem: value })}
                    >
                      <SelectTrigger id="origem">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="site">Site</SelectItem>
                        <SelectItem value="trafego_pago">Tráfego Pago</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="indicacao">Indicação</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex-1 space-y-2">
                    <Label htmlFor="interesse">Interesse</Label>
                    <Select
                      value={newLeadData.interesse}
                      onValueChange={(value) => setNewLeadData({ ...newLeadData, interesse: value })}
                    >
                      <SelectTrigger id="interesse">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Locação">Locação</SelectItem>
                        <SelectItem value="Aquisição Imóvel na Planta">Aquisição Imóvel na Planta</SelectItem>
                        <SelectItem value="Aquisição de Imóvel">Aquisição de Imóvel</SelectItem>
                        <SelectItem value="Avaliação de Imóvel">Avaliação de Imóvel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="observacao">Observação</Label>
                  <Textarea
                    id="observacao"
                    maxLength={400}
                    className="break-words resize-none break-all"
                    value={newLeadData.observacao}
                    onChange={(e) => setNewLeadData({ ...newLeadData, observacao: e.target.value })}
                    rows={3}
                  />
                </div>
                <Button onClick={handleCreateLead} className="w-full" disabled={createLead.isPending}>
                  {createLead.isPending ? "Criando..." : "Criar Lead"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {PIPELINE_STATUS.map((status) => {
            const qtdLeads = leads?.filter(l => l.status === status.value).length || 0;
            const isSelected = statusSelected === status.value;

            return (
              <Card
                key={status.value}
                className={`cursor-pointer transition-all hover:shadow-lg ${isSelected ? 'ring-2 ring-primary shadow-lg' : ''
                  }`}
                onClick={() => setStatusSelected(status.value)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${status.color}`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {status.label}
                      </p>
                      <p className="text-2xl font-bold text-foreground mt-1">
                        {qtdLeads}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Pipeline */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-64 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : (
            <Card>
                <CardHeader>
                  <CardTitle>
                    {PIPELINE_STATUS.find(s => s.value === statusSelected)?.label}
                  </CardTitle>
                  <CardDescription>
                    {leadsFiltrados.length} lead(s) encontrado(s) 
                  </CardDescription>
                </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Carregando leads...</p>
                  </div>
                ) : leadsFiltrados.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Nenhum lead neste status</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {leadsFiltrados.map((lead) => (
                      <div
                        key={lead.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedLead(lead);
                          setLeadDetailsOpen(true);
                        }}
                      >
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground">{lead.nome}</h3>
                          <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {lead.telefone}
                            </span>

                            {lead.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {lead.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
        )}

        {/* DIALOG DETALHES DO LEAD */}
        <Dialog open={leadDetailsOpen} onOpenChange={setLeadDetailsOpen}>
          <DialogContent className="w-full max-w-[calc(100%-2rem)] max-h-[95vh] overflow-y-auto sm:max-w-lg lg:max-w-5xl">
            {selectedLead && (
              <>
                <DialogHeader className="max-w-3xl">
                  <DialogTitle className="text-2xl">{selectedLead.nome}</DialogTitle>
                  <DialogDescription>
                    Lead #{selectedLead.id} • Criado em {
                      selectedLead.createdAt
                        ? formatDateTime(selectedLead.createdAt)
                        : 'Data não disponível'
                    }
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6">
                  {/* Informações */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Informações</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedLead.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{selectedLead.email}</span>
                        </div>
                      )}
                      {selectedLead.telefone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{selectedLead.telefone}</span>
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select
                          value={selectedLead.status}
                          onValueChange={(value) => handleStatusChange(selectedLead.id, value) }
                        >
                          <SelectTrigger className="-ml-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PIPELINE_STATUS.map((status) => (
                              <SelectItem key={status.value} value={status.value}>
                                {status.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {selectedLead.interesse && (
                        <div>
                          <Label>Interesse</Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            {selectedLead.interesse}
                          </p>
                        </div>
                      )}
                      {selectedLead.observacao && (
                        <div>
                          <Label>Observação</Label>
                          <p>
                            {selectedLead.observacao}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Anotações */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        Anotações
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Textarea
                          className="break-all"
                          placeholder="Adicionar nova anotação..."
                          maxLength={500}
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          rows={3}
                        />
                        <Button className="mt-2" onClick={handleAddNote} size="sm" disabled={addNote.isPending}>
                          Adicionar Anotação
                        </Button>
                      </div>

                      {notes && notes.length > 0 ? (
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {notes.map((note) => (
                            <Card key={note.id} className="border-l-4 border-l-primary break-all">
                              <CardContent className="p-3">
                                <p className="text-sm whitespace-pre-line">{note.anotacao}</p>
                                <p className="text-xs text-muted-foreground mt-4">
                                  {formatDateTime(note.createdAt)}
                                </p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhuma anotação ainda
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Arquivos */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Arquivos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {files && files.length > 0 ? (
                        <div className="space-y-2">
                          {files.map((file) => (
                            <Card key={file.id}>
                              <CardContent className="p-3 flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium">{file.nomeArquivo}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDateTime(file.createdAt)}
                                  </p>
                                </div>
                                <Button variant="outline" size="sm" asChild>
                                  <a href={file.urlArquivo} target="_blank" rel="noopener noreferrer">
                                    Ver
                                  </a>
                                </Button>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhum arquivo anexado
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, MessageSquareText, Search, Send, UserRound, Inbox } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";

const Pedidos = () => {
  const { session, loading, isAdmin } = useAuth();
  const [search, setSearch] = useState("");

  if (loading) return <div className="grid min-h-[70vh] place-items-center"><div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!session) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/perfil" replace />;

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-5xl flex-col px-3 pb-24 pt-3 sm:px-5">
      <header className="mb-4 flex items-center gap-3">
        <Link to="/perfil" aria-label="Voltar ao perfil" className="grid size-10 shrink-0 place-items-center rounded-full border border-border hover:bg-muted"><ArrowLeft size={19} /></Link>
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><MessageSquareText size={23} /></div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold">Pedidos</h1>
          <p className="text-sm text-muted-foreground">Mensagens e respostas dos clientes</p>
        </div>
      </header>

      <section className="flex min-h-[62vh] flex-1 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <aside className="flex w-full max-w-sm flex-col border-r border-border sm:w-[36%]">
          <div className="border-b border-border p-3">
            <h2 className="mb-3 font-semibold">Conversas</h2>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar utilizador..." className="pl-9" />
            </div>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center p-5 text-center">
            <div className="mb-3 grid size-14 place-items-center rounded-full bg-muted text-muted-foreground"><Inbox size={26} /></div>
            <p className="text-sm font-medium">Nenhum pedido ainda</p>
            <p className="mt-1 max-w-[230px] text-xs leading-relaxed text-muted-foreground">As respostas às perguntas obrigatórias aparecerão aqui quando a integração for configurada no Lovable.</p>
          </div>
        </aside>

        <div className="hidden min-w-0 flex-1 flex-col sm:flex">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <div className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground"><UserRound size={20} /></div>
            <div>
              <p className="font-semibold">Mensageiro de Pedidos</p>
              <p className="text-xs text-muted-foreground">Caixa privada do administrador</p>
            </div>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 grid size-20 place-items-center rounded-full bg-primary/10 text-primary"><MessageSquareText size={34} /></div>
            <h2 className="text-lg font-semibold">Selecione uma conversa</h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">Quando um cliente responder à pergunta obrigatória de um produto, a conversa ficará disponível nesta área com o nome e a foto de perfil do cliente.</p>
          </div>
          <div className="border-t border-border p-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground"><Send size={16} /> Respostas e envio de mensagens serão ligados no Lovable.</div>
          </div>
        </div>
      </section>
      <p className="mt-3 text-center text-xs text-muted-foreground">Interface preparada · As mensagens ainda precisam de integração com a base de dados.</p>
    </main>
  );
};

export default Pedidos;

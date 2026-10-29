import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Star, CandlestickChart, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type MarketState = { price: number; change_percent: number; updated_at: string };
type TrendOrder = { id: string; side: "buy" | "sell"; quantity: number; reference_price: number; status: string; created_at: string };
const candles = [[18,72,65,80,58],[28,66,60,74,55],[38,60,68,72,52],[48,68,57,73,50],[58,57,45,63,40],[68,45,48,55,35],[78,48,36,52,30],[88,36,40,47,27],[98,40,32,45,24],[108,32,38,44,28],[118,38,30,43,24],[128,30,42,48,26],[138,42,51,56,36],[148,51,46,58,40],[158,46,28,53,22],[168,28,34,40,18],[178,34,49,55,29],[188,49,44,58,39],[198,44,62,67,40],[208,62,70,78,56],[218,70,64,80,58],[228,64,75,84,60],[238,75,68,82,62],[248,68,73,80,64],[258,73,56,77,50],[268,56,48,62,43],[278,48,52,59,40],[288,52,45,58,39],[298,45,60,66,38],[308,60,72,80,55],[318,72,69,79,62],[328,69,75,84,64]];
const fmt = (n:number) => n.toLocaleString("pt-MZ",{minimumFractionDigits:2,maximumFractionDigits:2});

export default function Trend() {
 const { session } = useAuth();
 const [interval,setInterval] = useState("1h");
 const [favorite,setFavorite] = useState(false);
 const [refreshing,setRefreshing] = useState(false);
 const [market,setMarket] = useState<MarketState>({price:80004,change_percent:0,updated_at:""});
 const [orders,setOrders] = useState<TrendOrder[]>([]);
 const [quantity,setQuantity] = useState("1");
 const [offerPrice,setOfferPrice] = useState("80004");
 const [stopLoss,setStopLoss] = useState("");
 const [siteBalance,setSiteBalance] = useState(0);
 const [trendBalance,setTrendBalance] = useState(0);
 const [convertAmount,setConvertAmount] = useState("");
 const [converting,setConverting] = useState(false);
 const [sendingOrder,setSendingOrder] = useState(false);

 const loadMarket = useCallback(async () => {
  const {data,error} = await (supabase as any).from("trend_market_state").select("price,change_percent,updated_at").eq("id",1).maybeSingle();
  if(error){toast.error("Não foi possível carregar o preço Trend. Confirme se a migração Trend foi aplicada.");return;}
  if(data){setMarket(data);}
 },[]);
 const loadBalances = useCallback(async () => {
  if(!session){setSiteBalance(0);setTrendBalance(0);return;}
  const [{data:site,error:siteError},{data:trend,error:trendError}]=await Promise.all([
   (supabase as any).from("wallets").select("balance").eq("user_id",session.user.id).maybeSingle(),
   (supabase as any).from("trend_wallets").select("balance").eq("user_id",session.user.id).maybeSingle()
  ]);
  if(siteError||trendError){toast.error("Não foi possível carregar os saldos. Confirme se a migração Trend foi aplicada.");return;}
  setSiteBalance(Number(site?.balance||0));setTrendBalance(Number(trend?.balance||0));
 },[session?.user.id]);
 const convertToTrend = async () => {
  if(!session){toast.error("Entre na sua conta.");return;}
  const amount=Number(convertAmount);
  if(!Number.isFinite(amount)||amount<=0){toast.error("Introduza um valor válido para converter.");return;}
  if(amount>siteBalance){toast.error("Não tem vb$ suficiente na carteira do site.");return;}
  setConverting(true);
  const {error}=await (supabase as any).rpc("convert_vb_to_trend",{_amount:amount});
  setConverting(false);
  if(error){toast.error(error.message||"Não foi possível converter.");return;}
  setConvertAmount("");await loadBalances();toast.success("vb$ convertidos para a carteira de negociação Trend.");
 };
 const loadOrders = useCallback(async () => {
  if(!session)return;
  const {data,error} = await (supabase as any).from("trend_orders").select("id,side,quantity,reference_price,status,created_at").eq("user_id",session.user.id).order("created_at",{ascending:false}).limit(10);
  if(error){toast.error("Não foi possível carregar os seus pedidos Trend.");return;}
  setOrders((data||[]) as TrendOrder[]);
 },[session?.user.id]);
 useEffect(()=>{void loadMarket();void loadOrders();void loadBalances();},[loadMarket,loadOrders,loadBalances]);

 const createOrder = async (side:"buy"|"sell") => {
  if(!session){toast.error("Entre para enviar um pedido.");return;}
  const qty=Number(quantity), price=Number(offerPrice);
  if(!Number.isFinite(qty)||qty<=0||qty>1000000){toast.error("Introduza uma quantidade válida.");return;}
  if(!Number.isFinite(price)||price<=0){toast.error("Introduza um preço de negócio válido.");return;}
  const sl=stopLoss.trim()===""?null:Number(stopLoss);
  if(sl!==null&&(!Number.isFinite(sl)||sl<=0)){toast.error("Introduza um Stop Loss válido.");return;}
  if(sl!==null&&side==="buy"&&sl>=price){toast.error("Num Longo, o Stop Loss deve ficar abaixo do preço de entrada.");return;}
  if(sl!==null&&side==="sell"&&sl<=price){toast.error("Num Curto, o Stop Loss deve ficar acima do preço de entrada.");return;}
  setSendingOrder(true);
  const {error}=await (supabase as any).rpc("trend_create_order",{_side:side,_quantity:qty,_price:price,_stop_loss:sl});
  setSendingOrder(false);
  if(error){toast.error(error.message||"Não foi possível criar o pedido.");return;}
  toast.success(side==="buy"?"Pedido de compra registado.":"Pedido de venda registado.");
  await loadOrders();
 };

 return <main className="min-h-full bg-black text-white pb-8">
  <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-black/95 px-4 py-4">
   <Link to="/perfil" aria-label="Voltar" className="p-2"><ArrowLeft/></Link>
   <div className="flex items-center gap-2 text-lg font-semibold">MARCHA vb <span className="rounded-md bg-white/15 px-2 py-1 text-xs">Mercado</span></div>
   <button onClick={()=>setFavorite(v=>!v)} aria-label="Favorito"><Star className={favorite?"fill-yellow-400 text-yellow-400":""}/></button>
  </header>
  <section className="grid gap-4 border-b border-white/10 px-4 py-5 sm:grid-cols-2">
   <div><p className="text-sm text-neutral-400">Último preço de referência</p><p className="mt-1 text-4xl font-bold">{fmt(Number(market.price))}</p><p className={"mt-2 text-sm "+(market.change_percent>=0?"text-emerald-400":"text-rose-500")}>{market.change_percent>=0?"↗":"↘"} {market.change_percent>=0?"+":""}{Number(market.change_percent).toFixed(2)}%</p></div>
   </section>
  <section className="border-b border-white/10">
   <div className="flex items-center justify-between gap-2 overflow-x-auto px-3 py-3"><div className="flex gap-1">{["1m","15m","1h","4h","1D","1W"].map(v=><button key={v} onClick={()=>setInterval(v)} className={"rounded-lg px-3 py-2 text-sm "+(interval===v?"bg-white/15 font-semibold":"text-neutral-400")}>{v}</button>)}</div><div className="flex items-center gap-3"><CandlestickChart/><span className="italic">ƒx</span><button onClick={()=>{setRefreshing(true);void loadMarket().finally(()=>setRefreshing(false));}} aria-label="Atualizar"><RefreshCw className={refreshing?"animate-spin":""}/></button></div></div>
   <div className="px-3 pt-3"><div className="mb-2 inline-block rounded bg-neutral-900 px-2 py-2 text-sm text-neutral-300">MARCHA vb · {interval} · Mercado</div><div className="relative h-[320px] overflow-hidden border border-white/10 bg-black sm:h-[390px]"><div className="absolute inset-0 grid grid-cols-4 grid-rows-5">{Array.from({length:20},(_,i)=><div key={i} className="border-b border-r border-white/[0.07]"/>)}</div><svg viewBox="0 0 350 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">{candles.map(([x,o,c,h,l],i)=>{const up=c<o,y=(v:number)=>8+v*.82,top=Math.min(y(o),y(c)),height=Math.max(1.5,Math.abs(y(c)-y(o)));return <g key={i} stroke={up?"#16a34a":"#f43f5e"} fill={up?"#16a34a":"#f43f5e"}><line x1={x} x2={x} y1={y(h)} y2={y(l)} strokeWidth=".8"/><rect x={x-3} y={top} width="6" height={height}/></g>})}<line x1="0" y1="67" x2="350" y2="67" stroke="#16a34a" strokeDasharray="2 2"/></svg><div className="absolute right-0 top-[65%] bg-green-600 px-2 py-1 text-xs">{fmt(Number(market.price))}</div><div className="absolute left-2 top-2 text-xs text-emerald-400">{fmt(Number(market.price))} · preço administrado</div><div className="absolute bottom-2 left-2 bg-black/80 px-2 py-1 text-xs">Volume demonstrativo</div></div><div className="flex justify-between py-3 text-xs text-neutral-400"><span>Histórico</span><span>Preço MARCHA vb</span><span>{interval}</span></div></div>
  </section>
  <section className="mx-4 my-4 rounded-2xl border border-white/10 bg-neutral-950 p-4">
   <h2 className="text-lg font-semibold">Converter vb$</h2>
   <p className="mt-1 text-sm text-neutral-400">Transfere saldo da carteira normal do site para a carteira usada nas negociações do Trend. Conversão 1:1, sem taxa.</p>
   <div className="mt-3 grid grid-cols-2 gap-3">
    <div className="rounded-xl bg-white/5 p-3"><p className="text-xs text-neutral-400">Carteira do site</p><p className="mt-1 font-semibold">{fmt(siteBalance)} vb$</p></div>
    <div className="rounded-xl bg-white/5 p-3"><p className="text-xs text-neutral-400">Carteira Trend</p><p className="mt-1 font-semibold text-emerald-400">{fmt(trendBalance)} vb$</p></div>
   </div>
   <label className="mt-3 block text-sm text-neutral-300">Quantidade a converter<input type="number" min="0.01" step="0.01" max={siteBalance} value={convertAmount} onChange={e=>setConvertAmount(e.target.value)} placeholder="Ex.: 100" className="mt-1 w-full rounded-lg border border-white/15 bg-black p-3 text-white"/></label>
   <Button className="mt-3 w-full" onClick={()=>void convertToTrend()} disabled={converting||!session}>{converting?"A converter...":"Converter para vb$ Trend"}</Button>
  </section>
  <section className="px-4 py-4">
   <label className="mt-4 block text-sm text-neutral-300">Quantidade de ativos<input type="number" min="0.0001" step="0.0001" value={quantity} onChange={e=>setQuantity(e.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-neutral-950 p-3 text-white"/></label>
   <label className="mt-3 block text-sm text-neutral-300">Preço por unidade negociado (vb$)<input type="number" min="0.01" step="0.01" value={offerPrice} onChange={e=>setOfferPrice(e.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-neutral-950 p-3 text-white"/></label><label className="mt-3 block text-sm text-neutral-300">Stop Loss (vb$) — opcional<input type="number" min="0.01" step="0.01" placeholder="Defina o preço para limitar a perda" value={stopLoss} onChange={e=>setStopLoss(e.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-neutral-950 p-3 text-white"/></label><p className="mt-2 text-xs text-neutral-500">Longo: Stop Loss abaixo do preço. Curto: Stop Loss acima do preço.</p><p className="mt-2 text-sm text-neutral-400">Valor proposto do negócio: {fmt(Number(quantity||0)*Number(offerPrice||0))} vb$</p>
   <div className="mt-4 grid grid-cols-2 gap-3"><Button className="h-14 bg-green-600 text-base text-white hover:bg-green-700" disabled={sendingOrder} onClick={()=>void createOrder("buy")}><TrendingUp className="mr-2"/>Comprar / Longo</Button><Button className="h-14 bg-rose-600 text-base text-white hover:bg-rose-700" disabled={sendingOrder} onClick={()=>void createOrder("sell")}><TrendingDown className="mr-2"/>Vender / Curto</Button></div>
  </section>
 </main>;
}

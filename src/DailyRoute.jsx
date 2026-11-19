import {useEffect,useRef,useState} from "react";
import {Route,RefreshCw,ArrowRight,CalendarDays} from "lucide-react";
import {api,errorMessage} from "@zenfield/ui/lib/api";
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const km=n=>(n/1000).toLocaleString("pt-BR",{maximumFractionDigits:1})+" km";
const time=n=>{const m=Math.ceil(n/60);return m>=60?Math.floor(m/60)+"h "+m%60+"min":m+" min"};
const messages={empty:"Nenhum atendimento atribuído e agendado para este técnico nesta data. A central precisa atribuir as OS antes de calcular o roteiro.",limit:"Há mais de cinco atendimentos agendados. A central deve planejar a divisão do roteiro; nenhuma parada foi omitida.",not_configured:"Consulta de rotas não habilitada. A central precisa configurar GOOGLE_ROUTES_API_KEY no Render de homologação.",missing_origin:"Solicite o cadastro do endereço de partida à central.",address_review:"Há endereços incompletos. Solicite a conferência pela central.",route_unavailable:"Não foi possível confirmar todos os trechos por automóvel. Nenhuma estimativa foi inventada."};
export default function DailyRoute({onOpen}){
 const [day,setDay]=useState(today()),[back,setBack]=useState(true),[loading,setLoading]=useState(false),[data,setData]=useState(null),[error,setError]=useState(""),[alternative,setAlternative]=useState(true);
 const request=useRef(null);
 useEffect(()=>{request.current?.abort();setData(null);setError("");setLoading(false);setAlternative(true);return()=>request.current?.abort()},[day,back]);
 async function calculate(){request.current?.abort();const controller=new AbortController();request.current=controller;setLoading(true);setError("");setData(null);setAlternative(true);
 try{const r=await api.post("/technician/daily-route",{day,return_to_base:back},{timeout:90000,signal:controller.signal});if(!controller.signal.aborted){setData(r.data);setAlternative(r.data.state==="ready"&&r.data.changes_order===true);}}
 catch(e){if(!controller.signal.aborted)setError(e.response?.status===404?"A central ainda precisa atualizar a API para habilitar o roteiro.":errorMessage(e));}
 finally{if(!controller.signal.aborted)setLoading(false)}}
 const plan=data?.state==="ready"?(alternative?data.best:data.scheduled):null;
 return <article className="dashboard-panel field-route-card" aria-label="Roteiro do dia">
  <div className="field-route-heading"><div><h2><Route size={19}/> Roteiro do dia</h2><p>Compare a agenda com uma sequência de menor distância.</p></div><button type="button" className="secondary-button" disabled={loading||!day||day<today()} onClick={calculate}><RefreshCw size={15}/>{loading?"Calculando…":data?"Recalcular":"Calcular rota"}</button></div>
  <div className="field-route-controls"><label><CalendarDays size={15}/> Data <input type="date" min={today()} value={day} onChange={e=>setDay(e.target.value)}/></label><label><input type="checkbox" checked={back} onChange={e=>setBack(e.target.checked)}/> Voltar à base</label></div>
  {loading&&<p role="status">Calculando trajetos por automóvel. Consulte somente quando precisar.</p>}
  {error&&<p role="alert" className="field-route-note">{error}</p>}
  {data&&data.state!=="ready"&&<p className="field-route-note" role="status">{messages[data.state]||"Roteiro não disponível."}{data.invalid_ids?.length?" OS: "+data.invalid_ids.join(", "):""}</p>}
  {plan&&<><div className="field-route-metrics"><div><small>Agenda atual</small><strong>{km(data.scheduled.meters)}</strong><small>{time(data.scheduled.seconds)} dirigindo</small></div><div><small>Menor distância</small><strong>{km(data.best.meters)}</strong><small>{time(data.best.seconds)} dirigindo</small></div><div><small>Distância evitável</small><strong>{km(data.saved_meters)}</strong><small>Estimativa</small></div></div>
    {!data.changes_order&&<p className="field-route-note">A ordem agendada já é a de menor distância entre os trajetos consultados.</p>}
    {data.changes_order&&<div className="field-route-tabs"><button type="button" className={!alternative?"primary-button":"secondary-button"} aria-pressed={!alternative} onClick={()=>setAlternative(false)}>Agenda atual</button><button type="button" className={alternative?"primary-button":"secondary-button"} aria-pressed={alternative} onClick={()=>setAlternative(true)}>Sugestão de ordem</button></div>}
    {alternative&&<p className="field-route-note">Esta ordem pode conflitar com horários combinados. Peça autorização à central antes de alterar a sequência. Os agendamentos continuam os mesmos.</p>}
    <ol className="field-route-stops"><li><span className="field-route-stop-number">0</span><div><strong>Base cadastrada</strong><small>Ponto de partida estimado</small></div></li>{plan.sequence.map((index,i)=>{const stop=data.stops.find(s=>s.index===index),leg=plan.legs[i];return <li key={stop.id}><span className="field-route-stop-number">{i+1}</span><button type="button" className="field-route-stop" onClick={()=>onOpen(stop.id)}><div><strong>{stop.vehicle} · {stop.service}</strong><small>{stop.scheduled_at.slice(11,16)} · {stop.id}</small></div><div><strong>{km(leg.distance_meters)}</strong><small>{time(leg.duration_seconds)}</small></div><ArrowRight size={16}/></button></li>})}{data.return_to_base&&<li><span className="field-route-stop-number">↩</span><div><strong>Retorno à base</strong><small>{km(plan.legs.at(-1).distance_meters)} · {time(plan.legs.at(-1).duration_seconds)}</small></div></li>}</ol>
    <small className="field-route-footnote">Estimativa de distâncias por Google Maps, sem trânsito ou duração dos serviços. Menor distância não garante menor consumo real de combustível. Não altera a agenda nem autoriza cobrança.</small></>}
  {!data&&!loading&&!error&&<p className="field-route-note">Selecione a data e clique em Calcular rota. São consideradas somente as OS atribuídas e agendadas para este técnico, até cinco paradas. O cálculo parte da base cadastrada, não do GPS atual.</p>}
 </article>
}

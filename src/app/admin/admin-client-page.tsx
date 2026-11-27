"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";
import {
  IconAnalytics,
  IconBell,
  IconDashboard,
  IconFinance,
  IconImport,
  IconOrders,
  IconQuotes,
  IconRequests,
  IconStaff,
  IconSuppliers,
  IconUser,
} from "@/components/ui/icons";
import { useStaffSession } from "@/components/admin/staff-session-provider";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { RequestRegister } from "@/components/admin/request-register";
import { RequestWorkspace, type BuyerResponseStatus, type CustomerOfferSnapshot, type CustomerOfferVersion, type WorkspaceQuote, type WorkspaceQuoteStatus, type WorkspaceItem } from "@/components/admin/request-workspace";
import { OrderRegister, type OrderQueue } from "@/components/admin/order-register";
import { OrderWorkspace } from "@/components/admin/order-workspace";
import type { OrderDto } from "@/lib/server/order-types";
import { SupplierRegistry, type SupplierFields, type SupplierRecord } from "@/components/admin/supplier-registry";
import { FeedImportWorkspace } from "@/components/admin/feed-import-workspace";
import { StaffRegistry } from "@/components/admin/staff-registry";
import { appendPriceAdjustmentHistory, calculateRetailPositionPrice, describePriceAdjustmentHistoryEntry, FinancialConfig, FINANCIAL_CONFIG_STORAGE_KEY, formatMinorUnits, initialFinancialConfig, normalizeStoredFinancialConfig, normalizeStoredPriceHistory, normalizeStoredPriceOverrides, PRICE_HISTORY_STORAGE_KEY, PRICE_OVERRIDES_STORAGE_KEY, type PriceAdjustmentReason, type PriceAdjustmentHistoryEntry, toMinorUnits, validatePriceOverride } from "@/lib/financial-config";
import { buildCustomerRegistry, CUSTOMERS_STORAGE_KEY, Customer, migrateCustomerLinks, normalizeCustomers, searchCustomerRegistry, updateCustomerProfile, type CustomerProfileFields } from "@/lib/customer-model";

type RequestStatus = "NEW"|"ASSIGNED"|"SEARCHING"|"WAITING_SUPPLIERS"|"OFFERS_READY"|"SENT_TO_CUSTOMER"|"WAITING_CUSTOMER"|"CONFIRMED"|"COMPLETED"|"CANCELLED";
type QuoteStatus = "DRAFT"|"INQUIRY_SENT"|"RECEIVED"|"SELECTED"|"DECLINED"|"EXPIRED";
type Item = { id: string; name: string; oem: string; qty: number; note: string; compatibility?: string; selectionStatus?: "SEARCHING"|"CHECKING"|"FOUND"|"NOT_FOUND" };
type Supplier = SupplierRecord;
type SupplierStatus = Supplier["status"];
type SupplierEvent = Supplier["events"][number];
type Quote = { id: string; itemId: string; supplierId: string; article: string; maker: string; condition: string; cost: string | null; customerPriceRub?: string | null; currency: "RUB"|"USD"|"EUR"|"BYN"|"PLN"; availability: string; deliveryDays: number; shipping: string; shippingBasis?: "ORDER"|"PER_UNIT"; compatible: string; source: string; note: string; status: QuoteStatus };
type Event = { at: string; text: string; who: string };
type CrmRequest = { id: string; customerId?: string; created: string; customer: string; email: string; phone: string; make: string; model: string; year: string; vin: string; comment: string; manager: string; status: RequestStatus; priority: "Высокий"|"Обычный"; items: Item[]; internalNote: string; events: Event[]; customerOfferComment?: string; customerOfferSharedLogisticsRub?: string; customerOfferSnapshot?: CustomerOfferSnapshot; customerOfferVersions?: CustomerOfferVersion[]; customerOfferVersion?: number; customerOfferStatus?: "DRAFT"|"FORMED"|"SENT"|"VIEWED"; customerOfferSentAt?: string; customerResponseStatus?: BuyerResponseStatus };
type WorkTask = { id: string; title: string; description: string; requestId: string; dueAt: string; priority: "Высокий"|"Обычный"; done: boolean };
type QueuePreset = ""|"new"|"work"|"overdue"|"waiting_customer";
type FinancePeriod = "today"|"7d"|"30d";

const statusLabels: Record<RequestStatus,string> = { NEW:"Новая", ASSIGNED:"Назначена", SEARCHING:"Подбор", WAITING_SUPPLIERS:"Ожидает поставщиков", OFFERS_READY:"Предложение сформировано", SENT_TO_CUSTOMER:"Отправлена покупателю", WAITING_CUSTOMER:"Ждём ответ покупателя", CONFIRMED:"Подтверждена", COMPLETED:"Завершена", CANCELLED:"Отменена" };
const statusTone: Record<RequestStatus,string> = {
  NEW: "border-[#ff6428]/60 bg-[#ff6428]/15 text-[#ff865c]",
  ASSIGNED: "border-[#888b8d]/60 bg-[#888b8d]/15 text-[#f1f0eb]",
  SEARCHING: "border-[#ff865c]/60 bg-[#ff865c]/15 text-[#ff865c]",
  WAITING_SUPPLIERS: "border-[#ff986f]/60 bg-[#ff986f]/15 text-[#ff986f]",
  OFFERS_READY: "border-[#ff6428] bg-[#ff6428]/25 text-[#f1f0eb]",
  SENT_TO_CUSTOMER: "border-[#888b8d] bg-[#888b8d]/20 text-[#f1f0eb]",
  WAITING_CUSTOMER: "border-[#ff986f]/70 bg-[#ff986f]/20 text-[#ff986f]",
  CONFIRMED: "border-[#ff6428] bg-[#ff6428] text-[#17191b] font-black",
  COMPLETED: "border-[#888b8d]/40 bg-[#888b8d]/10 text-[#888b8d]",
  CANCELLED: "border-red-900/50 bg-red-950/30 text-red-400",
};
const managers = ["Анна Смирнова", "Илья Волков", "Мария Ким"];
const DEMO_REQUESTS_STORAGE_KEY = "zaptut.crm.demo.requests.v1";
const DEMO_TASKS_STORAGE_KEY = "zaptut.crm.demo.tasks.v1";
const DEMO_QUOTES_STORAGE_KEY = "zaptut.crm.demo.quotes.v1";
const DEMO_SUPPLIERS_STORAGE_KEY = "zaptut.crm.demo.suppliers.v1";
const quoteStatusLabels:Record<QuoteStatus,string>={DRAFT:"Черновик",INQUIRY_SENT:"Запрос отправлен",RECEIVED:"Получен",SELECTED:"Выбран",DECLINED:"Отклонён",EXPIRED:"Истёк"};
const initialSuppliers: Supplier[] = [
  { id:"sup-ru-01", name:"Север Авто Деталь", country:"Россия", contact:"Демо-контакт: Алексей", phone:"+7 000 000-00-01", email:"demo-ru@example.test", specialty:"Тормоза, подвеска", terms:"Оплата по счёту · доставка 2–4 дня", status:"Активен", lastContact:"Сегодня, 11:20", internalNote:"", events:[] },
  { id:"sup-by-02", name:"Минск Моторс", country:"Беларусь", contact:"Демо-контакт: Ирина", phone:"+375 00 000-00-02", email:"demo-by@example.test", specialty:"Разборка · корейские авто", terms:"Предоплата · доставка 3–6 дней", status:"Активен", lastContact:"Вчера, 16:40", internalNote:"", events:[] },
  { id:"sup-pl-03", name:"Baltic Parts Demo", country:"Польша", contact:"Демо-контакт: Tomasz", phone:"+48 000 000 003", email:"demo-pl@example.test", specialty:"Новые аналоги · электрика", terms:"EUR · доставка 4–7 дней", status:"На проверке", lastContact:"04.11.2026", internalNote:"", events:[] },
];
const initialRequests: CrmRequest[] = [
  { id:"ZP-2026-0148",created:"06.11.2026 10:42",customer:"Демо: Алексей Петров",email:"buyer148@example.test",phone:"+7 000 111-14-80",make:"Kia",model:"Sportage",year:"2021",vin:"DEMO-KIA-SPORTAGE-21",comment:"Нужны качественные детали, можно аналог. Сначала уточнить срок.",manager:"Анна Смирнова",status:"WAITING_SUPPLIERS",priority:"Высокий",items:[{id:"it-148-a",name:"Диск тормозной передний",oem:"51712-C1A00",qty:2,note:"Вентилируемый"},{id:"it-148-b",name:"Колодки тормозные передние",oem:"58101-A6A00",qty:1,note:"Комплект на ось"}],internalNote:"Проверить совместимость по VIN перед отправкой итоговой цены.",events:[{at:"06.11.2026 10:42",text:"Заявка создана через демонстрационную форму",who:"Система"},{at:"06.11.2026 10:55",text:"Назначен ответственный менеджер",who:"Анна Смирнова"},{at:"06.11.2026 11:05",text:"Запросы поставщикам подготовлены",who:"Анна Смирнова"}]},
  { id:"ZP-2026-0147",created:"06.11.2026 09:18",customer:"Демо: Мария Иванова",email:"buyer147@example.test",phone:"+375 00 222-14-70",make:"Hyundai",model:"Tucson",year:"2020",vin:"DEMO-HYUNDAI-TUCSON-20",comment:"Можно б/у в хорошем состоянии.",manager:"Илья Волков",status:"OFFERS_READY",priority:"Обычный",items:[{id:"it-147-a",name:"Турбокомпрессор",oem:"28231-2F100",qty:1,note:"Проверенный узел"}],internalNote:"Сравнить варианты с разборки и новый аналог.",events:[{at:"06.11.2026 09:18",text:"Демо-заявка зарегистрирована",who:"Система"},{at:"06.11.2026 10:10",text:"Добавлены ответы двух поставщиков",who:"Илья Волков"}]},
  { id:"ZP-2026-0146",created:"05.11.2026 17:06",customer:"Демо: Сергей Ковалёв",email:"buyer146@example.test",phone:"+48 000 333 14 60",make:"Kia",model:"Sportage",year:"2019",vin:"DEMO-KIA-SPORTAGE-19",comment:"Нужен генератор, срок важен.",manager:"Мария Ким",status:"WAITING_CUSTOMER",priority:"Обычный",items:[{id:"it-146-a",name:"Генератор",oem:"37300-2E300",qty:1,note:"14V"}],internalNote:"Итоговое предложение отправлено в демо-режиме.",events:[{at:"05.11.2026 17:06",text:"Демо-заявка зарегистрирована",who:"Система"},{at:"06.11.2026 09:45",text:"Клиенту показано демонстрационное предложение",who:"Мария Ким"}]},
  { id:"ZP-2026-0145",created:"05.11.2026 14:32",customer:"Демо: Ольга Соколова",email:"buyer145@example.test",phone:"+7 000 444-14-50",make:"Hyundai",model:"Tucson",year:"2022",vin:"DEMO-HYUNDAI-TUCSON-22",comment:"Оригинальный амортизатор.",manager:"Анна Смирнова",status:"NEW",priority:"Высокий",items:[{id:"it-145-a",name:"Амортизатор передний",oem:"54651-D7A00",qty:2,note:"Оригинал или OEM"}],internalNote:"",events:[{at:"05.11.2026 14:32",text:"Демо-заявка создана",who:"Система"}]},
];
const initialQuotes: Quote[] = [
  {id:"qt-148-1",itemId:"it-148-a",supplierId:"sup-ru-01",article:"51712-C1A00-D",maker:"OEM Demo",condition:"Новая",cost:"82.00",currency:"USD",availability:"2 шт.",deliveryDays:3,shipping:"18.00",compatible:"Заявлена, требует проверки",source:"https://supplier.example.test/offer-1",note:"Условная цена для прототипа",status:"RECEIVED"},
  {id:"qt-148-2",itemId:"it-148-a",supplierId:"sup-by-02",article:"51712-C1A00-U",maker:"Разбор Demo",condition:"БУ",cost:"410.00",currency:"BYN",availability:"1 шт.",deliveryDays:5,shipping:"22.00",compatible:"По каталогу поставщика",source:"https://supplier.example.test/offer-2",note:"Запросить фото рабочей поверхности",status:"RECEIVED"},
  {id:"qt-148-3",itemId:"it-148-b",supplierId:"sup-pl-03",article:"BP-58101-AN",maker:"Parts Demo",condition:"Новая",cost:"34.00",currency:"EUR",availability:"Есть",deliveryDays:6,shipping:"12.00",compatible:"OEM-кросс, нужна верификация",source:"https://supplier.example.test/offer-3",note:"Демо-запись",status:"RECEIVED"},
  {id:"qt-147-1",itemId:"it-147-a",supplierId:"sup-by-02",article:"28231-2F100-R",maker:"Turbo Demo",condition:"БУ",cost:"590.00",currency:"USD",availability:"1 шт.",deliveryDays:4,shipping:"30.00",compatible:"Нужна проверка номера",source:"https://supplier.example.test/turbo",note:"Проверить актуальность",status:"RECEIVED"},
  {id:"qt-146-1",itemId:"it-146-a",supplierId:"sup-pl-03",article:"37300-2E300-A",maker:"Alt Demo",condition:"Новая",cost:"155.00",currency:"EUR",availability:"Есть",deliveryDays:5,shipping:"20.00",compatible:"Подтверждена в демо-записи",source:"https://supplier.example.test/alternator",note:"",status:"SELECTED"},
];
const initialTasks: WorkTask[] = [
  {id:"task-148-supplier",title:"Ответить поставщику",description:"Уточнить срок по двум запрашиваемым позициям",requestId:"ZP-2026-0148",dueAt:"2026-11-06T18:00:00+03:00",priority:"Высокий",done:false},
  {id:"task-147-fit",title:"Проверить совместимость",description:"Сверить номер турбокомпрессора по VIN",requestId:"ZP-2026-0147",dueAt:"2026-11-06T14:00:00+03:00",priority:"Высокий",done:false},
  {id:"task-147-offer",title:"Подготовить предложение",description:"Сравнить поставщиков и проверить клиентскую цену",requestId:"ZP-2026-0147",dueAt:"2026-11-06T16:00:00+03:00",priority:"Обычный",done:false},
  {id:"task-146-buyer",title:"Связаться с покупателем",description:"Уточнить решение по предложению",requestId:"ZP-2026-0146",dueAt:"2026-11-06T12:00:00+03:00",priority:"Обычный",done:false},
  {id:"task-145-intake",title:"Разобрать новую заявку",description:"Проверить VIN и назначить подбор",requestId:"ZP-2026-0145",dueAt:"2026-11-07T12:00:00+03:00",priority:"Высокий",done:false},
];
function requestTimestamp(value:string){const match=/(\d{2})\.(\d{2})\.(\d{4}),?\s+(\d{2}):(\d{2})/.exec(value);return match?Date.UTC(Number(match[3]),Number(match[2])-1,Number(match[1]),Number(match[4]),Number(match[5])):0;}
function localDateLabel(date:Date){return new Intl.DateTimeFormat("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(date);}
function russianCountLabel(count:number,forms:[string,string,string]){const lastTwo=count%100;const last=count%10;const form=lastTwo>=11&&lastTwo<=14?forms[2]:last===1?forms[0]:last>=2&&last<=4?forms[1]:forms[2];return `${count} ${form}`;}
function normalizePersistedRequests(value:unknown):CrmRequest[]|null {
  if(!Array.isArray(value))return null;
  const rows=value.filter((entry):entry is CrmRequest=>Boolean(entry&&typeof entry==="object"&&"id" in entry&&"events" in entry&&Array.isArray((entry as CrmRequest).events)));
  return rows.map(request=>{
    const sentVersion=request.customerOfferVersions?.some(version=>version.status==="SENT"||version.status==="VIEWED")??false;
    const hasUnverifiedSend=request.status==="SENT_TO_CUSTOMER"||request.customerOfferStatus==="SENT"||request.customerOfferStatus==="VIEWED"||sentVersion;
    if(!hasUnverifiedSend)return request;
    const version=request.customerOfferSnapshot?.version??request.customerOfferVersion??(request.customerOfferVersions?.length??0)+1;
    const snapshot=request.customerOfferSnapshot?{...request.customerOfferSnapshot,version}:undefined;
    const archived=request.customerOfferVersions?.map(entry=>entry.status==="SENT"||entry.status==="VIEWED"?{...entry,status:"FORMED" as const,responseStatus:"NO_RESPONSE" as const,sentAt:undefined}:entry);
    const alreadyLogged=request.events.some(event=>event.text.startsWith("Состояние DEMO-отправки исправлено"));
    const event:Event={at:localDateLabel(new Date()),text:"Состояние DEMO-отправки исправлено: локальное предложение не считается отправленным",who:"Система"};
    return {...request,status:snapshot?"OFFERS_READY":"SEARCHING",customerOfferSnapshot:snapshot,customerOfferVersions:archived,customerOfferVersion:version,customerOfferStatus:snapshot?"FORMED":"DRAFT",customerOfferSentAt:undefined,customerResponseStatus:"NO_RESPONSE",events:alreadyLogged?request.events:[event,...request.events]};
  });
}
function normalizePersistedTasks(value:unknown):WorkTask[]|null {
  if(!Array.isArray(value))return null;
  const tasks=value.filter((entry):entry is WorkTask=>{
    if(!entry||typeof entry!=="object")return false;
    const task=entry as Partial<WorkTask>;
    return typeof task.id==="string"&&typeof task.title==="string"&&typeof task.description==="string"&&typeof task.requestId==="string"&&typeof task.dueAt==="string"&&!Number.isNaN(new Date(task.dueAt).getTime())&&(task.priority==="Высокий"||task.priority==="Обычный")&&typeof task.done==="boolean";
  });
  return tasks;
}
function normalizePersistedQuotes(value:unknown):Quote[]|null {
  if(!Array.isArray(value))return null;
  const statuses=new Set<QuoteStatus>(["DRAFT","INQUIRY_SENT","RECEIVED","SELECTED","DECLINED","EXPIRED"]);
  const currencies=new Set<Quote["currency"]>(["RUB","USD","EUR","BYN","PLN"]);
  return value.filter((entry):entry is Quote=>{
    if(!entry||typeof entry!=="object")return false;
    const quote=entry as Partial<Quote>;
    return typeof quote.id==="string"&&typeof quote.itemId==="string"&&typeof quote.supplierId==="string"&&typeof quote.article==="string"&&typeof quote.maker==="string"&&typeof quote.condition==="string"&&(typeof quote.cost==="string"||quote.cost===null)&&currencies.has(quote.currency as Quote["currency"])&&typeof quote.availability==="string"&&typeof quote.deliveryDays==="number"&&typeof quote.shipping==="string"&&typeof quote.compatible==="string"&&typeof quote.source==="string"&&typeof quote.note==="string"&&statuses.has(quote.status as QuoteStatus);
  });
}
function normalizePersistedSuppliers(value:unknown):Supplier[]|null {
  if(!Array.isArray(value))return null;
  const validStatuses=new Set<SupplierStatus>(["Активен","На проверке","Приостановлен"]);
  const normalized=value.flatMap((entry):Supplier[]=>{
    if(!entry||typeof entry!=="object")return [];
    const raw=entry as Partial<Supplier>;
    if(typeof raw.id!=="string"||!raw.id||typeof raw.name!=="string"||!raw.name.trim()||typeof raw.country!=="string"||!raw.country.trim())return [];
    const events=Array.isArray(raw.events)?raw.events.filter((event):event is SupplierEvent=>Boolean(event&&typeof event.at==="string"&&typeof event.text==="string"&&typeof event.who==="string")):[];
    return [{id:raw.id,name:raw.name,country:raw.country,contact:typeof raw.contact==="string"?raw.contact:"",phone:typeof raw.phone==="string"?raw.phone:"",email:typeof raw.email==="string"?raw.email:"",specialty:typeof raw.specialty==="string"?raw.specialty:"",terms:typeof raw.terms==="string"?raw.terms:"",status:validStatuses.has(raw.status as SupplierStatus)?raw.status as SupplierStatus:"На проверке",lastContact:typeof raw.lastContact==="string"?raw.lastContact:"—",internalNote:typeof raw.internalNote==="string"?raw.internalNote:"",events}];
  });
  return [...new Map(normalized.map(supplier=>[supplier.id,supplier])).values()];
}
const sections = [
  ["dashboard","Рабочий стол","dashboard"],
  ["requests","Заявки","requests"],
  ["orders","Заказы","orders"],
  ["suppliers","Поставщики","suppliers"],
  ["import","Импорт прайсов","import"],
  ["quotes","Предложения","quotes"],
  ["staff","Сотрудники","staff"],
  ["customers","Клиенты","customers"],
  ["analytics","Аналитика","analytics"],
  ["finance","Финансовые настройки","finance"],
] as const;
type Section = (typeof sections)[number][0];
const sectionIcons: Record<Section, React.ComponentType<{ className?: string }>> = {
  dashboard: IconDashboard,
  requests: IconRequests,
  orders: IconOrders,
  suppliers: IconSuppliers,
  import: IconImport,
  quotes: IconQuotes,
  staff: IconStaff,
  customers: IconUser,
  analytics: IconAnalytics,
  finance: IconFinance,
};
const inputClass="mt-1 w-full border border-[#414749] bg-[#17191b] px-3 py-2.5 text-sm text-[#f1f0eb] outline-none focus:border-[#ff6428]";
const panelClass="border border-[#383e41] bg-[#1e2124]";

function Badge({status}:{status:RequestStatus}) { return <span className={`inline-flex max-w-full break-words border px-2 py-1 text-left text-[10px] font-bold uppercase leading-tight tracking-wide ${statusTone[status]}`}>{statusLabels[status]}</span>; }
function Metric({label,value,sub,valueClassName="text-2xl"}:{label:string;value:string;sub:string;valueClassName?:string}) { return <div className={`${panelClass} p-4`}><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#888b8d]">{label}</p><p className={`mt-2 break-words font-extrabold leading-tight text-[#f1f0eb] ${valueClassName}`}>{value}</p><p className="mt-1 text-xs text-[#888b8d]">{sub}</p></div>; }
function MetricLink({label,value,sub,onClick,alert=false}:{label:string;value:string;sub:string;onClick:()=>void;alert?:boolean}) { return <button onClick={onClick} className={`${panelClass} flex min-w-0 flex-col justify-between p-3 text-left transition hover:border-[#ff6428] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff6428] sm:p-4`}><span className="block break-words text-[10px] font-bold uppercase leading-snug tracking-[.12em] text-[#888b8d]">{label}</span><span className={`mt-1.5 block text-xl font-extrabold tabular-nums sm:text-2xl ${alert?"text-[#ff986f]":"text-[#f1f0eb]"}`}>{value}</span><span className="mt-1 block text-[10px] leading-4 text-[#888b8d] sm:text-xs">{sub}</span></button>; }
function FinanceMetric({label,value,sub}:{label:string;value:string;sub:string}) { return <div className="min-w-0 border-t border-[#383e41] px-1 py-2.5 [&:nth-child(-n+2)]:border-t-0 sm:px-3 xl:border-l xl:border-t-0 xl:py-1 xl:first:border-l-0"><p className="break-words text-[10px] font-bold uppercase leading-snug tracking-[.1em] text-[#888b8d]">{label}</p><p className="mt-1 break-words text-sm font-extrabold tabular-nums text-[#f1f0eb] sm:text-base">{value}</p><p className="mt-0.5 text-[10px] leading-4 text-[#888b8d]">{sub}</p></div>; }
function formatTaskDue(value?: string | null) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
  } catch {
    return "—";
  }
}
function DashboardQueue({rows,overdueIds,queuePreset,setQueuePreset,search,setSearch,statusFilter,setStatusFilter,priorityFilter,setPriorityFilter,managerFilter,setManagerFilter,sortMode,setSortMode,onOpen,nextTaskFor}:{rows:CrmRequest[];overdueIds:Set<string>;queuePreset:QueuePreset;setQueuePreset:(value:QueuePreset)=>void;search:string;setSearch:(value:string)=>void;statusFilter:RequestStatus|"";setStatusFilter:(value:RequestStatus|"")=>void;priorityFilter:""|"Высокий"|"Обычный";setPriorityFilter:(value:""|"Высокий"|"Обычный")=>void;managerFilter:string;setManagerFilter:(value:string)=>void;sortMode:"newest"|"oldest"|"due";setSortMode:(value:"newest"|"oldest"|"due")=>void;onOpen:(id:string)=>void;nextTaskFor:(requestId:string)=>WorkTask|undefined}) {
  const selectClass="w-full min-w-0 border border-[#414749] bg-[#17191b] px-2 py-2 text-xs text-[#f1f0eb] outline-none focus:border-[#ff6428]";
  const resetPreset=()=>setQueuePreset("");
  return <section className={`${panelClass} min-w-0`}><div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#383e41] px-3 py-2.5 sm:px-4"><div><h2 className="text-xs font-extrabold uppercase tracking-wide">Очередь заявок</h2><p className="mt-0.5 text-[10px] text-[#899194]">Следующее действие и его срок определяют просрочку.</p></div><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] text-[#ff986f]">В выборке: {rows.length}</span>{queuePreset&&<button onClick={resetPreset} className="border border-[#5a463e] px-2 py-1 text-[9px] text-[#ffb08c]">Срез KPI · сбросить ×</button>}</div></div>
    <div className="border-b border-[#383e41] bg-[#1c1f21] p-3 sm:px-4"><div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(180px,1.5fr)_repeat(4,minmax(125px,1fr))]"><label className="min-w-0 text-[10px] font-bold uppercase tracking-wide text-[#aeb5b6]">Поиск<input value={search} onChange={e=>{resetPreset();setSearch(e.target.value);}} placeholder="Номер, покупатель, OEM…" className={`${selectClass} mt-1 min-h-9 text-[13px]`}/></label><label className="min-w-0 text-[10px] font-bold uppercase tracking-wide text-[#aeb5b6]">Статус<select value={statusFilter} onChange={e=>{resetPreset();setStatusFilter(e.target.value as RequestStatus|"");}} className={`${selectClass} mt-1 min-h-9`}><option value="">Все статусы</option>{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="min-w-0 text-[10px] font-bold uppercase tracking-wide text-[#aeb5b6]">Приоритет<select value={priorityFilter} onChange={e=>{resetPreset();setPriorityFilter(e.target.value as ""|"Высокий"|"Обычный");}} className={`${selectClass} mt-1 min-h-9`}><option value="">Любой</option><option>Высокий</option><option>Обычный</option></select></label><label className="min-w-0 text-[10px] font-bold uppercase tracking-wide text-[#aeb5b6]">Менеджер<select value={managerFilter} onChange={e=>{resetPreset();setManagerFilter(e.target.value);}} className={`${selectClass} mt-1 min-h-9`}><option value="">Все менеджеры</option>{managers.map(manager=><option key={manager}>{manager}</option>)}</select></label><label className="min-w-0 text-[10px] font-bold uppercase tracking-wide text-[#aeb5b6]">Сортировка<select value={sortMode} onChange={e=>setSortMode(e.target.value as "newest"|"oldest"|"due")} className={`${selectClass} mt-1 min-h-9`}><option value="newest">Сначала новые</option><option value="oldest">Сначала старые</option><option value="due">Ближайший срок</option></select></label></div></div>
    <div className="hidden overflow-hidden border-t border-[#383e41] xl:block"><table className="w-full table-fixed text-left text-[13px]"><colgroup><col className="w-[14%]"/><col className="w-[17%]"/><col className="w-[21%]"/><col className="w-[12%]"/><col className="w-[18%]"/><col className="w-[18%]"/></colgroup><thead className="bg-[#292e30] text-[11px] uppercase tracking-wide text-[#c2c8c9]"><tr>{["Номер / дата","Покупатель / авто","Запрашиваемые детали","Ответственный","Статус / приоритет","Следующее действие / срок"].map(title=><th key={title} className="p-2.5">{title}</th>)}</tr></thead><tbody>{rows.map(r=>{const task=nextTaskFor(r.id);const late=overdueIds.has(r.id);return <tr key={r.id} className="border-t border-[#383e41] align-top hover:bg-[#252a2c]"><td className="min-w-0 p-2.5"><button onClick={()=>onOpen(r.id)} className="font-bold tabular-nums text-[#ff865c] hover:text-[#f1f0eb]">{r.id}</button><small className="mt-1 block tabular-nums text-[12px] text-[#aeb5b6]">{r.created}</small></td><td className="min-w-0 break-words p-2.5 text-[13px]">{r.customer}<small className="mt-1 block text-[12px] text-[#aeb5b6]">{r.make} {r.model} · {r.year}</small></td><td className="min-w-0 break-words p-2.5">{r.items.map(item=><span key={item.id} className="mb-1.5 block leading-5">{item.name}<small className="mt-0.5 block truncate tabular-nums text-[12px] font-medium text-[#d0d5d6]">OEM · {item.oem}</small></span>)}</td><td className="min-w-0 break-words p-2.5">{r.manager}</td><td className="min-w-0 overflow-hidden p-2.5"><Badge status={r.status}/><small className="mt-1.5 block text-[12px] text-[#d0d5d6]">{r.priority}</small></td><td className="min-w-0 p-2.5">{task?<><span className="block break-words leading-5">{task.title}</span><small className={`mt-1 block tabular-nums text-[12px] font-medium ${late?"text-[#ff986f]":"text-[#c2c8c9]"}`}>{formatTaskDue(task.dueAt)} {late&&<b className="ml-1 inline-block border border-[#784635] px-1 uppercase">Просрочено</b>}</small></>:<span className="text-[#aeb5b6]">Нет активного действия</span>}</td></tr>})}</tbody></table>{!rows.length&&<p className="p-6 text-center text-xs text-[#969ea1]">По выбранным условиям заявок нет.</p>}</div>
    <div className="grid gap-2 border-t border-[#383e41] p-3 sm:grid-cols-2 xl:hidden">{rows.map(r=>{const task=nextTaskFor(r.id);const late=overdueIds.has(r.id);return <article key={r.id} className="min-w-0 border border-[#383e41] bg-[#1a1d1f] p-3"><div className="flex items-start justify-between gap-2"><button onClick={()=>onOpen(r.id)} className="text-left text-xs font-bold tabular-nums text-[#ff865c]">{r.id}<small className="mt-0.5 block text-[10px] font-normal text-[#899194]">{r.created}</small></button><span className="shrink-0 text-[11px] text-[#c5cacc]">{r.priority}</span></div><p className="mt-2 break-words text-[13px]">{r.customer}<small className="mt-0.5 block text-[11px] text-[#899194]">{r.make} {r.model} · {r.year}</small></p><p className="mt-2 break-words text-[12px] leading-5 text-[#d3d7d8]">{r.items.map(item=><span key={item.id} className="block">{item.name} · <span className="tabular-nums text-[#aeb5b6]">{item.oem}</span></span>)}</p><div className="mt-2 flex flex-wrap items-center gap-2"><Badge status={r.status}/><span className="text-[11px] text-[#929a9c]">{r.manager}</span></div><div className={`mt-2 border-t border-[#383e41] pt-2 text-[11px] ${late?"text-[#ff986f]":"text-[#c1c7c8]"}`}>{task?<>{task.title} · {formatTaskDue(task.dueAt)} {late&&<b className="ml-1 border border-[#784635] px-1 uppercase">Просрочено</b>}</>:"Нет активного действия"}</div></article>})}{!rows.length&&<p className="p-5 text-center text-xs text-[#969ea1]">По выбранным условиям заявок нет.</p>}</div>
    <p className="border-t border-[#383e41] px-3 py-2 text-[10px] text-[#888b8d]">Нажмите на номер заявки, чтобы открыть карточку подбора и расчёта</p>
  </section>;
}
function ManagerTasks({tasks,onOpen,onToggle}:{tasks:WorkTask[];onOpen:(id:string)=>void;onToggle:(id:string)=>void}) { const sorted=[...tasks].sort((a,b)=>Number(a.done)-Number(b.done)||new Date(a.dueAt).getTime()-new Date(b.dueAt).getTime());const completed=tasks.filter(t=>t.done).length;return <section className={`${panelClass} min-w-0`}><div className="flex items-center justify-between gap-2 border-b border-[#383e41] px-3 py-2.5 sm:px-4"><div><h2 className="text-xs font-extrabold uppercase tracking-wide">Задачи менеджера</h2><p className="mt-0.5 text-[10px] text-[#899194]">Ответы, совместимость, предложения и контакты</p></div><span className="text-[10px] tabular-nums text-[#ff986f]">{completed}/{tasks.length} выполнено</span></div><div className="grid gap-2 p-3 sm:grid-cols-2 sm:px-4 xl:grid-cols-3">{sorted.map(task=>{const late=!task.done&&new Date(task.dueAt).getTime()<Date.now();return <article key={task.id} className={`flex min-w-0 gap-2 border p-3 ${late?"border-[#714331] bg-[#28211e]":"border-[#383e41] bg-[#1a1d1f]"}`}><input aria-label={`Отметить выполненной задачу: ${task.title}`} type="checkbox" checked={task.done} onChange={()=>onToggle(task.id)} className="mt-1 h-4 w-4 shrink-0 accent-[#ff6428]"/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-1"><h3 className={`break-words text-xs font-bold ${task.done?"text-[#7e878a] line-through":"text-[#f1f0eb]"}`}>{task.title}</h3><span className={`text-[9px] uppercase ${task.priority==="Высокий"?"text-[#ff986f]":"text-[#aeb5b6]"}`}>{task.priority}</span></div><p className="mt-1 break-words text-[10px] leading-4 text-[#929a9c]">{task.description}</p><div className="mt-2 flex flex-wrap items-center justify-between gap-1 border-t border-[#383e41] pt-2"><button onClick={()=>onOpen(task.requestId)} className="text-[10px] font-bold tabular-nums text-[#ff865c] hover:text-[#f1f0eb]">{task.requestId} →</button><span className={`text-[9px] tabular-nums ${late?"font-bold text-[#ff986f]":"text-[#899194]"}`}>{late?"Просрочено · ":"Срок · "}{formatTaskDue(task.dueAt)}</span></div></div></article>})}</div></section>; }

export default function AdminPage({ initialSection }: { initialSection?: Section } = {}) {
  const staff = useStaffSession();
  const can = (permission: string) => Boolean(staff && (staff.role === "SUPER_ADMIN" || (Array.isArray(staff.permissions) && staff.permissions.includes(permission))));
  const visibleSections = sections.filter(([id]) => {
    const required: Record<Section, string> = {
      dashboard: "admin.access", requests: "requests.read", orders: "orders.read", suppliers: "suppliers.read",
      import: "quotes.manage", quotes: "quotes.read", staff: "employees.read", customers: "customers.read",
      analytics: "analytics.read", finance: "finance.settings.read",
    };
    return can(required[id]);
  });
  const [section, setSection] = useState<Section>(initialSection ?? "dashboard");
  const [requests,setRequests]=useState(initialRequests);
  const [customers,setCustomers]=useState<Customer[]>([]);
  const [requestsHydrated,setRequestsHydrated]=useState(false);
  const [suppliers,setSuppliers]=useState<Supplier[]>(initialSuppliers);
  const [suppliersHydrated,setSuppliersHydrated]=useState(false);
  const [supplierFormMode,setSupplierFormMode]=useState<null|{kind:"create"}|{kind:"edit";id:string}>(null);
  const [supplierSearch,setSupplierSearch]=useState("");
  const [supplierStatusFilter,setSupplierStatusFilter]=useState<""|SupplierStatus>("");
  const [quotes,setQuotes]=useState<Quote[]>(()=>initialQuotes.map(quote=>({...quote,shippingBasis:"ORDER"})));
  const [quotesHydrated,setQuotesHydrated]=useState(false);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [selectedCustomerId,setSelectedCustomerId]=useState<string|null>(null);
  const [customerSearch,setCustomerSearch]=useState("");
  const [customerEditOpen,setCustomerEditOpen]=useState(false);
  const [customerEditDraft,setCustomerEditDraft]=useState<CustomerProfileFields>({name:"",phone:"",email:"",internalNote:""});
  const [customerEditErrors,setCustomerEditErrors]=useState<Partial<Record<keyof CustomerProfileFields,string>>>({});
  const [customerEditMessage,setCustomerEditMessage]=useState("");
  const [customerCreateOpen,setCustomerCreateOpen]=useState(false);
  const [customerCreateDraft,setCustomerCreateDraft]=useState<CustomerProfileFields>({name:"",phone:"",email:"",internalNote:""});
  const [customerCreateErrors,setCustomerCreateErrors]=useState<Partial<Record<keyof CustomerProfileFields,string>>>({});
  const [customerCreateMessage,setCustomerCreateMessage]=useState("");
  const customerSaveLock=useRef(false);
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState<RequestStatus|"">("");
  const [selectedQuoteIds,setSelectedQuoteIds]=useState<string[]>(["qt-146-1"]);
  const [financialConfig,setFinancialConfig]=useState<FinancialConfig>(initialFinancialConfig);
  const [priceOverrides,setPriceOverrides]=useState<Record<string,string>>({});
  const [priceHistory,setPriceHistory]=useState<PriceAdjustmentHistoryEntry[]>([]);
  const [financialDataHydrated,setFinancialDataHydrated]=useState(false);
  const [tasks,setTasks]=useState(initialTasks);
  const [tasksHydrated,setTasksHydrated]=useState(false);
  const [queuePreset,setQueuePreset]=useState<QueuePreset>("");
  const [priorityFilter,setPriorityFilter]=useState<""|"Высокий"|"Обычный">("");
  const [managerFilter,setManagerFilter]=useState("");
  const [sortMode,setSortMode]=useState<"newest"|"oldest"|"due">("newest");
  const [toast,setToast]=useState("");
  const [financePeriod,setFinancePeriod]=useState<FinancePeriod>("7d");
  const [createRequestOpen,setCreateRequestOpen]=useState(false);

  // Orders subsystem state
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [orderQueues, setOrderQueues] = useState<Record<string, number>>({});
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderQueue, setOrderQueue] = useState<OrderQueue>("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("");
  const [orderPaymentFilter, setOrderPaymentFilter] = useState("");
  const [orderDeliveryFilter, setOrderDeliveryFilter] = useState("");
  const [orderCountryFilter, setOrderCountryFilter] = useState("");
  const [ordersLoading, setOrdersLoading] = useState(false);

  const fetchOrders = async () => {
    try {
      setOrdersLoading(true);
      const params = new URLSearchParams();
      if (orderQueue && orderQueue !== "all") params.set("queue", orderQueue);
      if (orderSearch) params.set("query", orderSearch);
      if (orderStatusFilter) params.set("status", orderStatusFilter);
      if (orderPaymentFilter) params.set("paymentStatus", orderPaymentFilter);
      if (orderDeliveryFilter) params.set("deliveryStatus", orderDeliveryFilter);
      if (orderCountryFilter) params.set("country", orderCountryFilter);

      const res = await fetch(`/api/orders?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders ?? []);
        setOrderQueues(data.queues ?? {});
      }
    } catch (err) {
      console.error("Failed to fetch orders", err);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    if (section === "orders" || section === "dashboard") {
      fetchOrders();
    }
  }, [section, orderQueue, orderSearch, orderStatusFilter, orderPaymentFilter, orderDeliveryFilter, orderCountryFilter]);

  async function handleCreateOrderFromRequest(requestId: string) {
    try {
      setToast("Оформление официального заказа...");
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось оформить заказ");
      setToast(`Заказ ${data.order.orderNumber} успешно создан!`);
      setSelectedId(null);
      setSelectedOrderId(data.order.id);
      setSection("orders");
      await fetchOrders();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Ошибка оформления заказа");
    }
  }

  async function handleOrderStatusChange(status: string, reason?: string) {
    if (!selectedOrderId) return;
    try {
      const res = await fetch(`/api/orders/${selectedOrderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, rejectionReason: reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка обновления статуса");
      setToast(`Статус заказа изменён: ${status}`);
      await fetchOrders();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Ошибка обновления");
    }
  }

  async function handleOrderPayment(input: { amount: number; paymentMethod: string; externalPaymentId?: string; notes?: string }) {
    if (!selectedOrderId) return;
    try {
      const res = await fetch(`/api/orders/${selectedOrderId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка регистрации оплаты");
      setToast(`Платёж ${input.amount} ₽ успешно зафиксирован!`);
      await fetchOrders();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Ошибка оплаты");
    }
  }

  async function handleOrderShipment(input: { carrier?: string; trackingNumber?: string; status?: string; city?: string; address?: string }) {
    if (!selectedOrderId) return;
    try {
      const res = await fetch(`/api/orders/${selectedOrderId}/shipment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка обновления отправления");
      setToast("Параметры отправления сохранены!");
      await fetchOrders();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Ошибка отправления");
    }
  }

  async function handleOrderMessage(input: { message: string; isInternal?: boolean }) {
    if (!selectedOrderId) return;
    try {
      const res = await fetch(`/api/orders/${selectedOrderId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка добавления заметки");
      setToast("Заметка добавлена к заказу");
      await fetchOrders();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Ошибка заметки");
    }
  }
  useEffect(()=>{
    const readJson=(key:string):unknown=>{
      try {
        const raw=window.localStorage.getItem(key);
        return raw===null?null:JSON.parse(raw);
      } catch { return null; }
    };
    setFinancialConfig(normalizeStoredFinancialConfig(readJson(FINANCIAL_CONFIG_STORAGE_KEY)));
    setPriceOverrides(normalizeStoredPriceOverrides(readJson(PRICE_OVERRIDES_STORAGE_KEY)));
    setPriceHistory(normalizeStoredPriceHistory(readJson(PRICE_HISTORY_STORAGE_KEY)));
    setFinancialDataHydrated(true);
  },[]);
  useEffect(()=>{
    if(!financialDataHydrated)return;
    try { window.localStorage.setItem(FINANCIAL_CONFIG_STORAGE_KEY,JSON.stringify({version:1,config:financialConfig})); }
    catch { /* Financial controls remain usable if browser storage is unavailable. */ }
  },[financialConfig,financialDataHydrated]);
  useEffect(()=>{
    if(!financialDataHydrated)return;
    try { window.localStorage.setItem(PRICE_OVERRIDES_STORAGE_KEY,JSON.stringify({version:1,overrides:priceOverrides})); }
    catch { /* Financial controls remain usable if browser storage is unavailable. */ }
  },[priceOverrides,financialDataHydrated]);
  useEffect(()=>{
    if(!financialDataHydrated)return;
    try { window.localStorage.setItem(PRICE_HISTORY_STORAGE_KEY,JSON.stringify({version:1,entries:priceHistory})); }
    catch { /* Financial history remains available in memory if storage is unavailable. */ }
  },[priceHistory,financialDataHydrated]);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(()=>{
    let stage="start";
    if (initialSection) setSection(initialSection);
    else if (window.location.pathname.startsWith("/admin/requests")) setSection("requests");
    else if (window.location.pathname.startsWith("/admin/orders")) setSection("orders");
    else if (window.location.pathname.startsWith("/admin/staff")) setSection("staff");
    else if (window.location.pathname.startsWith("/admin/customers")) setSection("customers");
    else if (window.location.pathname.startsWith("/admin/import")) setSection("import");
    else setSection("dashboard");

    async function init() {
      try {
        stage="read_storage";
        const savedRequests=window.localStorage.getItem(DEMO_REQUESTS_STORAGE_KEY);
        const savedCustomers=window.localStorage.getItem(CUSTOMERS_STORAGE_KEY);
        const savedQuotes=window.localStorage.getItem(DEMO_QUOTES_STORAGE_KEY);
        const savedTasks=window.localStorage.getItem(DEMO_TASKS_STORAGE_KEY);
        const savedSuppliers=window.localStorage.getItem(DEMO_SUPPLIERS_STORAGE_KEY);

        // Keep backup in localStorage before migration
        if (savedRequests && !window.localStorage.getItem("zaptut.crm.demo.requests.v1.backup")) {
          window.localStorage.setItem("zaptut.crm.demo.requests.v1.backup", savedRequests);
        }

        let localCustomers: Customer[] = [];
        if (savedCustomers !== null) {
          try {
            const parsed = normalizeCustomers(JSON.parse(savedCustomers));
            if (parsed) localCustomers = parsed;
          } catch {}
        }

        let localRequests: CrmRequest[] = initialRequests;
        if (savedRequests !== null) {
          try {
            const parsed = normalizePersistedRequests(JSON.parse(savedRequests));
            if (parsed) localRequests = parsed;
          } catch {}
        }

        let localQuotes: Quote[] = initialQuotes.map(q => ({ ...q, shippingBasis: "ORDER" }));
        if (savedQuotes !== null) {
          try {
            const parsed = normalizePersistedQuotes(JSON.parse(savedQuotes));
            if (parsed) localQuotes = parsed;
          } catch {}
        }

        let localTasks: WorkTask[] = initialTasks;
        if (savedTasks !== null) {
          try {
            const parsed = normalizePersistedTasks(JSON.parse(savedTasks));
            if (parsed) localTasks = parsed;
          } catch {}
        }

        let localSuppliers: Supplier[] = initialSuppliers;
        if (savedSuppliers !== null) {
          try {
            const parsed = normalizePersistedSuppliers(JSON.parse(savedSuppliers));
            if (parsed) localSuppliers = parsed;
          } catch {}
        }

        stage="migrate_customers";
        const customerLinks = migrateCustomerLinks(localRequests, localCustomers);
        localRequests = customerLinks.requests;
        localCustomers = customerLinks.customers;

        // 1. Migrate customers to PostgreSQL
        try {
          if (localCustomers.length > 0) {
            const syncCust = await fetch("/api/customers", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ action: "migrate", customers: localCustomers }),
            });
            if (syncCust.ok) {
              const custSyncData = await syncCust.json();
              if (custSyncData.idMap) {
                localRequests = localRequests.map(r => ({
                  ...r,
                  customerId: (r.customerId && custSyncData.idMap[r.customerId]) ? custSyncData.idMap[r.customerId] : r.customerId,
                }));
              }
            }
          }
        } catch {
          // Continues to request migration
        }

        // 2. Migrate requests, quotes, tasks to PostgreSQL
        stage="migrate_requests";
        try {
          const syncReq = await fetch("/api/requests", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              action: "migrate",
              requests: localRequests,
              quotes: localQuotes,
              tasks: localTasks,
            }),
          });
          if (syncReq.ok) {
            const reqSyncData = await syncReq.json();
            if (reqSyncData.idMap) {
              // IdMap mapped
            }
          }
        } catch {
          // Continues to canonical load
        }

        // 3. Fetch canonical authoritative data from PostgreSQL
        stage="fetch_canonical";
        let canonicalRequests: CrmRequest[] = localRequests;
        let canonicalTasks: WorkTask[] = localTasks;
        let canonicalSuppliers: Supplier[] = localSuppliers;
        let canonicalCustomers: Customer[] = localCustomers;
        let canonicalQuotes: Quote[] = localQuotes;

        try {
          const [reqRes, taskRes, supRes, custRes] = await Promise.all([
            fetch("/api/requests?pageSize=100"),
            fetch("/api/tasks"),
            fetch("/api/admin/suppliers"),
            fetch("/api/customers?pageSize=100"),
          ]);

          if (reqRes.ok) {
            const reqData = await reqRes.json();
            if (Array.isArray(reqData.requests) && reqData.requests.length > 0) {
              canonicalRequests = reqData.requests;
            }
          } else {
            setDbError("Ошибка подключения к серверу PostgreSQL: не удалось загрузить заявки.");
          }

          if (taskRes.ok) {
            const taskData = await taskRes.json();
            if (Array.isArray(taskData.tasks) && taskData.tasks.length > 0) {
              canonicalTasks = taskData.tasks;
            }
          }

          if (supRes.ok) {
            const supData = await supRes.json();
            if (Array.isArray(supData.suppliers) && supData.suppliers.length > 0) {
              canonicalSuppliers = supData.suppliers;
            }
          }

          if (custRes.ok) {
            const custData = await custRes.json();
            if (Array.isArray(custData.customers) && custData.customers.length > 0) {
              canonicalCustomers = custData.customers.map((c: any) => ({
                id: c.id,
                name: c.name,
                phone: c.phone ?? "",
                normalizedPhone: c.normalizedPhone ?? "",
                email: c.email ?? "",
                normalizedEmail: c.normalizedEmail ?? "",
                internalNote: c.internalNote ?? "",
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
              }));
            }
          }
        } catch (fetchErr) {
          setDbError("Сервер PostgreSQL недоступен. Проверьте соединение с базой данных.");
        }

        // Update state with canonical data
        stage="update_state";
        setCustomers(canonicalCustomers);
        setRequests(canonicalRequests);
        setTasks(canonicalTasks);
        setSuppliers(canonicalSuppliers);
        setQuotes(canonicalQuotes);

        setSelectedQuoteIds(ids=>[...new Set([...ids,...canonicalRequests.flatMap(request=>request.customerOfferSnapshot?.financeLines?.map(line=>line.quoteId)??[])])]);
        setRequestsHydrated(true);
        setTasksHydrated(true);
        setSuppliersHydrated(true);
        setQuotesHydrated(true);
      } catch(error) {
        console.error("REQUESTS_MIGRATION_ERROR",{stage,origin:window.location.origin,error});
        setDbError("Ошибка инициализации данных CRM. Проверьте статус PostgreSQL.");
      }
    }

    init();
  },[]);

  // Update specific request card from PostgreSQL when selected
  useEffect(() => {
    if (!selectedId) return;
    async function loadRequestCard() {
      try {
        const res = await fetch(`/api/requests/${selectedId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.request) {
            setRequests(prev => prev.map(r => r.id === data.request.id ? { ...r, ...data.request } : r));
          }
          if (Array.isArray(data.quotes) && data.quotes.length > 0) {
            setQuotes(prev => {
              const existingMap = new Map(prev.map(q => [q.id, q]));
              data.quotes.forEach((q: Quote) => existingMap.set(q.id, q));
              return Array.from(existingMap.values());
            });
          }
          if (Array.isArray(data.tasks) && data.tasks.length > 0) {
            setTasks(prev => {
              const existingMap = new Map(prev.map(t => [t.id, t]));
              data.tasks.forEach((t: WorkTask) => existingMap.set(t.id, t));
              return Array.from(existingMap.values());
            });
          }
        }
      } catch {
        // Keep in-memory
      }
    }
    loadRequestCard();
  }, [selectedId]);
  const current=requests.find(r=>r.id===selectedId)??null;
  const selectedOrder = orders.find(o => o.id === selectedOrderId || o.orderNumber === selectedOrderId) ?? null;
  const customerRegistry=useMemo(()=>buildCustomerRegistry(customers,requests),[customers,requests]);
  const visibleCustomerRegistry=useMemo(()=>searchCustomerRegistry(customerRegistry,customerSearch),[customerRegistry,customerSearch]);
  const selectedCustomer=customerRegistry.find(entry=>entry.customer.id===selectedCustomerId)??null;
  function beginCustomerEdit(customer:Customer){customerSaveLock.current=false;setCustomerEditDraft({name:customer.name,phone:customer.phone,email:customer.email,internalNote:customer.internalNote});setCustomerEditErrors({});setCustomerEditMessage("");setCustomerEditOpen(true);}
  function cancelCustomerEdit(){setCustomerEditOpen(false);setCustomerEditErrors({});setCustomerEditMessage("");customerSaveLock.current=false;}
  async function saveCustomerEdit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(customerSaveLock.current||!selectedCustomer)return;
    customerSaveLock.current=true;
    setCustomerEditErrors({});
    setCustomerEditMessage("");
    try {
      const res = await fetch(`/api/customers/${selectedCustomer.customer.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(customerEditDraft),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Не удалось сохранить профиль");
      }
      const updatedDto = data.customer;
      const updated: Customer = {
        id: updatedDto.id,
        name: updatedDto.name,
        phone: updatedDto.phone ?? "",
        normalizedPhone: updatedDto.normalizedPhone ?? "",
        email: updatedDto.email ?? "",
        normalizedEmail: updatedDto.normalizedEmail ?? "",
        internalNote: updatedDto.internalNote ?? "",
        createdAt: updatedDto.createdAt,
        updatedAt: updatedDto.updatedAt,
      };
      setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c));
      setCustomerEditOpen(false);
      setToast("Профиль клиента обновлён в PostgreSQL");
    } catch(error) {
      customerSaveLock.current=false;
      const message=error instanceof Error?error.message:"Не удалось сохранить профиль";
      if(message.includes("имя"))setCustomerEditErrors({name:message});
      else if(message.includes("email"))setCustomerEditErrors({email:message});
      else if(message.includes("номер") || message.includes("телефон"))setCustomerEditErrors({phone:message});
      else setCustomerEditMessage(message);
    } finally {
      customerSaveLock.current=false;
    }
  }
  async function saveCustomerCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCustomerCreateErrors({});
    setCustomerCreateMessage("");
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(customerCreateDraft),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Не удалось создать клиента");
      }
      const createdDto = data.customer;
      const created: Customer = {
        id: createdDto.id,
        name: createdDto.name,
        phone: createdDto.phone ?? "",
        normalizedPhone: createdDto.normalizedPhone ?? "",
        email: createdDto.email ?? "",
        normalizedEmail: createdDto.normalizedEmail ?? "",
        internalNote: createdDto.internalNote ?? "",
        createdAt: createdDto.createdAt,
        updatedAt: createdDto.updatedAt,
      };
      setCustomers(prev => [created, ...prev]);
      setCustomerCreateOpen(false);
      setCustomerCreateDraft({ name: "", phone: "", email: "", internalNote: "" });
      setSelectedCustomerId(created.id);
      setToast("Клиент успешно создан в PostgreSQL");
    } catch(error) {
      const message = error instanceof Error ? error.message : "Не удалось создать клиента";
      if(message.includes("имя")) setCustomerCreateErrors({ name: message });
      else if(message.includes("email")) setCustomerCreateErrors({ email: message });
      else if(message.includes("номер") || message.includes("телефон")) setCustomerCreateErrors({ phone: message });
      else setCustomerCreateMessage(message);
    }
  }
  const fmt = (amount: string, currency: Quote["currency"]) => {
    try {
      return formatMinorUnits(toMinorUnits(amount || "0", currency).toString(), currency);
    } catch {
      return `${amount || "0"} ${currency}`;
    }
  };
  const quantityFor = (quote: Quote) => {
    const foundReq = requests.find((request) => (request.items ?? []).some((item) => item.id === quote.itemId));
    return foundReq?.items?.find((item) => item.id === quote.itemId)?.qty ?? 1;
  };
  const retailFor = (quote: Quote) => {
    try {
      const sup = suppliers.find((s) => s.id === quote.supplierId);
      const rawCountry = (quote as any).country || sup?.country || "Россия";
      const country = (["Россия", "Беларусь", "Польша"].includes(rawCountry) ? rawCountry : "Россия") as "Россия" | "Беларусь" | "Польша";
      return calculateRetailPositionPrice({
        unitPurchasePrice: quote.cost || "0",
        quantity: quantityFor(quote),
        currency: (quote.currency || "RUB") as any,
        supplierCountry: country,
        config: financialConfig,
      });
    } catch {
      return {
        purchaseMinor: "0",
        percentageMarkupMinor: "0",
        minimumMarkupMinor: "0",
        appliedMarkupMinor: "0",
        customerPriceMinor: "0",
        markupBasisPoints: 0,
      } as any;
    }
  };
  const finalRetail = (quote: Quote) => {
    try {
      if ((quote as any).customerPriceRub) return (quote as any).customerPriceRub;
      if (!quote.cost) return "0";
      return priceOverrides[quote.id]
        ? toMinorUnits(priceOverrides[quote.id], quote.currency).toString()
        : retailFor(quote).customerPriceMinor;
    } catch {
      return "0";
    }
  };
  const now = Date.now();
  const overdueTaskRequestIds = new Set(tasks.filter((t) => !t.done && new Date(t.dueAt).getTime() < now).map((t) => t.requestId));
  const nextTaskFor = (requestId: string) => tasks.filter((t) => t.requestId === requestId && !t.done).sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())[0];
  const visibleRequests = requests.filter((r) => {
    const matchesPreset = !queuePreset || (queuePreset === "new" ? r.status === "NEW" : queuePreset === "waiting_customer" ? r.status === "WAITING_CUSTOMER" : queuePreset === "overdue" ? overdueTaskRequestIds.has(r.id) : ["ASSIGNED", "SEARCHING", "WAITING_SUPPLIERS", "OFFERS_READY", "SENT_TO_CUSTOMER"].includes(r.status));
    return matchesPreset && (!statusFilter || r.status === statusFilter) && (!priorityFilter || r.priority === priorityFilter) && (!managerFilter || r.manager === managerFilter) && (!search || `${r.id} ${r.customer} ${r.make} ${r.model} ${(r.items ?? []).map((i) => i.name + " " + i.oem).join(" ")}`.toLowerCase().includes(search.toLowerCase()));
  }).sort((a, b) => sortMode === "due" ? ((new Date(nextTaskFor(a.id)?.dueAt ?? "2999-01-01").getTime()) - (new Date(nextTaskFor(b.id)?.dueAt ?? "2999-01-01").getTime())) : sortMode === "oldest" ? requestTimestamp(a.created) - requestTimestamp(b.created) : requestTimestamp(b.created) - requestTimestamp(a.created));
  const counts = useMemo(() => Object.fromEntries(Object.keys(statusLabels).map((s) => [s, requests.filter((r) => r.status === s).length])) as Record<RequestStatus, number>, [requests]);
  const requestQuotes = current ? quotes.filter((q) => (current.items ?? []).some((i) => i.id === q.itemId)) : [];
  const supplierCountryByRequest = Object.fromEntries(requests.map((request) => [request.id, [...new Set(quotes.filter((quote) => (request.items ?? []).some((item) => item.id === quote.itemId)).map((quote) => (quote as any).country || suppliers.find((supplier) => supplier.id === quote.supplierId)?.country).filter((country): country is string => Boolean(country)))]]));
  const periodStart = financePeriod === "today" ? new Date(new Date(now).getFullYear(), new Date(now).getMonth(), new Date(now).getDate()).getTime() : now - (financePeriod === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000;
  const confirmedRequests = requests.filter((r) => (r.status === "CONFIRMED" || r.status === "COMPLETED") && requestTimestamp(r.created) >= periodStart);
  const confirmedItemIds = new Set(confirmedRequests.flatMap((r) => (r.items ?? []).map((i) => i.id)));
  const confirmedQuoteTotals = quotes.filter((q) => q.status === "SELECTED" && confirmedItemIds.has(q.itemId)).reduce((totals, q) => {
    try {
      const calculation = retailFor(q);
      const rate = financialConfig.rubPerCurrencyUnit[q.currency] ?? "1.00";
      const [whole, fraction = ""] = rate.split(".");
      const scaledRate = BigInt(whole) * 10000n + BigInt((fraction + "0000").slice(0, 4));
      const purchase = BigInt(calculation?.purchaseMinor || "0");
      let retail = 0n;
      try {
        const rawFinal = finalRetail(q);
        const cleaned = typeof rawFinal === "string" ? rawFinal.replace(/[^\d]/g, "") : "";
        retail = cleaned ? BigInt(cleaned) : 0n;
      } catch {
        retail = 0n;
      }
      return { purchase: totals.purchase + (purchase * scaledRate + 5000n) / 10000n, turnover: totals.turnover + (retail * scaledRate + 5000n) / 10000n };
    } catch {
      return totals;
    }
  }, { purchase: 0n, turnover: 0n });
  const demoGrossProfit = confirmedQuoteTotals.turnover - confirmedQuoteTotals.purchase;
  const demoMarkup = confirmedQuoteTotals.purchase ? `${(demoGrossProfit * 10000n / confirmedQuoteTotals.purchase / 100n).toString()}.${((demoGrossProfit * 10000n / confirmedQuoteTotals.purchase) % 100n).toString().padStart(2, "0")}%` : "—";
  function navigateSection(target: Section) {
    if (!visibleSections.some(([id]) => id === target)) return;
    if (target === "requests" && window.location.pathname !== "/admin/requests") window.history.pushState(null, "", "/admin/requests");
    else if (target === "orders" && window.location.pathname !== "/admin/orders") window.history.pushState(null, "", "/admin/orders");
    else if (target === "staff" && window.location.pathname !== "/admin/staff") window.history.pushState(null, "", "/admin/staff");
    else if (target === "customers" && window.location.pathname !== "/admin/customers") window.history.pushState(null, "", "/admin/customers");
    else if (target === "import" && window.location.pathname !== "/admin/import") window.history.pushState(null, "", "/admin/import");
    else if (target !== "requests" && target !== "orders" && target !== "staff" && target !== "customers" && target !== "import" && window.location.pathname !== "/admin") window.history.pushState(null, "", "/admin");
    setSection(target);
    setSelectedId(null);
    setSelectedCustomerId(null);
    setSelectedOrderId(null);
  }
  function openQueue(preset:QueuePreset){setQueuePreset(preset);setStatusFilter("");setPriorityFilter("");setManagerFilter("");setSearch("");setSortMode(preset==="overdue"?"due":"newest");navigateSection("requests");}
  async function createRequest(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!requestsHydrated){setToast("Дождитесь загрузки данных клиентов и заявок");return;}
    const form=new FormData(e.currentTarget);
    const manager=String(form.get("manager"));
    const priority=String(form.get("priority")) as "Высокий"|"Обычный";
    const id=`ZP-2026-${String(149+requests.length-initialRequests.length).padStart(4,"0")}`;
    const customerName=`Демо: ${String(form.get("customer"))}`;
    const email=String(form.get("email"));
    const phone=String(form.get("phone"));
    const make=String(form.get("make"));
    const model=String(form.get("model"));
    const year=String(form.get("year"));
    const vin=String(form.get("vin"));
    const comment=String(form.get("comment"));
    const part=String(form.get("part"));
    const oem=String(form.get("oem"));

    try {
      // 1. Resolve or create customer
      let customerId: string | undefined;
      const custRes = await fetch("/api/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: customerName, phone, email }),
      });
      if (custRes.ok) {
        const custData = await custRes.json();
        customerId = custData.customer?.id;
      }

      // 2. Create request in PostgreSQL
      const reqRes = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          number: id,
          customerId: customerId || "00000000-0000-0000-0000-000000000000",
          customerNameSnapshot: customerName,
          customerPhoneSnapshot: phone,
          customerEmailSnapshot: email,
          vehicleMake: make,
          vehicleModel: model,
          vehicleYear: year,
          vehicleVin: vin,
          managerNameSnapshot: manager,
          priority,
          customerComment: comment,
          items: [{ description: part, requestedPartNumber: oem, quantity: 1 }],
        }),
      });

      if (!reqRes.ok) {
        const err = await reqRes.json();
        throw new Error(err.error || "Не удалось создать заявку");
      }

      const data = await reqRes.json();
      const newReq = data.request;
      setRequests(current => [newReq, ...current]);
      setCreateRequestOpen(false);
      openQueue("new");
      setToast(`${id} успешно создана в PostgreSQL`);
    } catch(err) {
      setToast(err instanceof Error ? err.message : "Ошибка создания заявки");
    }
  }
  function saveSupplier(id:string|null,fields:SupplierFields){const at=localDateLabel(new Date());const who="Анна Смирнова";if(!id){let newId=`sup-demo-${Date.now()}`;let suffix=2;while(suppliers.some(supplier=>supplier.id===newId)){newId=`sup-demo-${Date.now()}-${suffix++}`;}const created:Supplier={id:newId,...fields,lastContact:"—",events:[{at,text:"Поставщик создан",who}]};setSuppliers(previous=>[...previous,created]);setToast("Поставщик создан и сохранён локально");return;}const existing=suppliers.find(supplier=>supplier.id===id);if(!existing)return;const detailChanged=(Object.keys(fields) as Array<keyof SupplierFields>).filter(key=>key!=="status").some(key=>fields[key]!==existing[key]);const statusChanged=fields.status!==existing.status;const events=[...existing.events];if(detailChanged)events.push({at,text:"Данные поставщика изменены",who});if(statusChanged)events.push({at,text:`Статус изменён: ${existing.status} → ${fields.status}`,who});if(!detailChanged&&!statusChanged){setToast("Данные поставщика не изменились");return;}setSuppliers(previous=>previous.map(supplier=>supplier.id===id?{...supplier,...fields,events}:supplier));setToast("Данные поставщика обновлены и сохранены локально");}
  function updateSupplierStatus(id:string,status:SupplierStatus){const existing=suppliers.find(supplier=>supplier.id===id);if(!existing||existing.status===status)return;const at=localDateLabel(new Date());setSuppliers(previous=>previous.map(supplier=>supplier.id===id?{...supplier,status,events:[...supplier.events,{at,text:`Статус изменён: ${existing.status} → ${status}`,who:"Анна Смирнова"}]}:supplier));setToast("Статус поставщика обновлён и сохранён локально");}
  function savePriceOverride(quote:Quote,value:string,reason:PriceAdjustmentReason,explanation:string,lossManagerConfirmed:boolean,lossExplanation:string):boolean {
    if(!current){setToast("Откройте заявку перед корректировкой цены");return false;}
    const item=current.items.find(candidate=>candidate.id===quote.itemId);
    if(!item||!quotes.some(candidate=>candidate.id===quote.id&&candidate.itemId===quote.itemId)){setToast("Предложение не связано с открытой заявкой");return false;}
    let validation:ReturnType<typeof validatePriceOverride>;
    try {
      const automatic=retailFor(quote);
      validation=validatePriceOverride({newPrice:value,purchaseTotalMinor:automatic.purchaseMinor,currency:quote.currency,reason,explanation,lossManagerConfirmed,lossExplanation});
    } catch(error) { setToast(error instanceof Error?error.message:"Проверьте ручную цену и причину корректировки");return false; }
    const previousManualPrice=priceOverrides[quote.id]??null;
    const automaticPrice=retailFor(quote).customerPriceMinor;
    const entry:PriceAdjustmentHistoryEntry={id:globalThis.crypto?.randomUUID?.()??`price-${Date.now()}-${Math.random().toString(36).slice(2)}`,occurredAt:new Date().toISOString(),manager:current.manager,requestId:current.id,quoteId:quote.id,article:quote.article,previousManualPrice,automaticPrice,newManualPrice:value,currency:quote.currency,reason,explanation:(explanation ?? "").trim(),belowPurchaseCost:validation.belowPurchaseCost,lossManagerConfirmed:validation.belowPurchaseCost&&lossManagerConfirmed,lossExplanation:validation.belowPurchaseCost?(lossExplanation ?? "").trim():""};
    setPriceOverrides(old=>({...old,[quote.id]:value}));
    setPriceHistory(old=>appendPriceAdjustmentHistory(old,entry));
    if(validation.belowPurchaseCost){
      const loss=formatMinorUnits(validation.potentialLossMinor,quote.currency);
      addEvent(current.id,`Подтверждена ручная цена ниже закупки для ${quote.article}: потенциальный убыток ${loss}; причина: ${(lossExplanation ?? "").trim()}`,current.manager);
    } else addEvent(current.id,`Ручная корректировка цены для ${quote.article}; причина: ${reason}${(explanation ?? "").trim()?` — ${(explanation ?? "").trim()}`:""}`,current.manager);
    invalidateCustomerOffer(current.id);
    setToast("Ручная цена сохранена; причина и запись добавлены в историю");
    return true;
  }
  function addEvent(id:string,text:string,who?:string){const at=localDateLabel(new Date());setRequests(rs=>rs.map(r=>r.id===id?{...r,events:[{at,text,who:who??r.manager},...r.events]}:r));}
  async function updateStatus(id:string,status:RequestStatus){
    if(status==="SENT_TO_CUSTOMER"){setToast("Статус «Отправлена покупателю» доступен только после отправки через подключённый канал");return;}
    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Ошибка обновления статуса");
      }
      const data = await res.json();
      setRequests(rs => rs.map(r => r.id === id ? { ...r, ...data.request } : r));
      setToast(`Статус заявки обновлён в PostgreSQL: ${statusLabels[status]}`);
    } catch(err) {
      setToast(err instanceof Error ? err.message : "Ошибка обновления статуса");
    }
  }
  async function assign(id:string,manager:string){
    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ managerNameSnapshot: manager }),
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(rs => rs.map(r => r.id === id ? { ...r, ...data.request } : r));
        setToast(`Ответственный назначен в PostgreSQL: ${manager}`);
      }
    } catch {
      setToast("Ошибка назначения ответственного");
    }
  }
  async function saveNote(id:string,note:string){
    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ internalNote: note }),
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(rs => rs.map(r => r.id === id ? { ...r, ...data.request } : r));
        setToast("Внутренняя заметка сохранена в PostgreSQL");
      }
    } catch {
      setToast("Ошибка сохранения заметки");
    }
  }
  function invalidateCustomerOffer(id:string){const at=localDateLabel(new Date());setRequests(previous=>previous.map(request=>{if(request.id!==id||!request.customerOfferSnapshot)return request;const version=request.customerOfferSnapshot.version;const archived:CustomerOfferVersion={version,status:request.customerOfferStatus??"FORMED",responseStatus:request.customerResponseStatus??"NO_RESPONSE",sentAt:request.customerOfferSentAt,archivedAt:at,archivedBy:request.manager,snapshot:request.customerOfferSnapshot};return {...request,status:request.status==="OFFERS_READY"?"SEARCHING":request.status,customerOfferSnapshot:undefined,customerOfferVersions:[...(request.customerOfferVersions??[]),archived],customerOfferVersion:version,customerOfferStatus:"DRAFT",customerOfferSentAt:undefined,customerResponseStatus:"NO_RESPONSE",events:[{at,text:`Версия клиентского предложения №${version} заархивирована перед изменением`,who:request.manager},...request.events]};}));}
  async function saveWorkspaceQuote(value:WorkspaceQuote){
    if(!current)return;
    const exists=Boolean(value.id && !value.id.startsWith("qt-demo-"));
    try {
      const res = await fetch(`/api/requests/${current.id}/quotes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: value.id,
          requestItemId: value.itemId,
          supplierId: value.supplierId,
          partNumber: value.article,
          manufacturer: value.maker,
          condition: value.condition,
          purchasePrice: value.cost,
          currency: value.currency,
          deliveryDays: value.deliveryDays,
          deliveryCost: value.shipping,
          shippingBasis: value.shippingBasis || "ORDER",
          compatibilityNote: value.compatible,
          sourceUrl: value.source,
          internalComment: value.note,
          status: value.status,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const quote = data.quote;
        setQuotes(previous => exists ? previous.map(item => item.id === quote.id ? quote : item) : [quote, ...previous]);
        invalidateCustomerOffer(current.id);
        addEvent(current.id, `${exists ? "Изменено" : "Добавлено"} предложение поставщика в PostgreSQL`);
        setToast(exists ? "Предложение обновлено в PostgreSQL" : "Предложение сохранено в PostgreSQL");
      }
    } catch {
      setToast("Ошибка сохранения предложения");
    }
  }
  async function updateQuoteStatus(id:string,status:WorkspaceQuoteStatus){
    const quote=quotes.find(item=>item.id===id);
    if(!quote||quote.status===status)return;
    const relatedRequest=requests.find(request=>request.items.some(item=>item.id===quote.itemId));
    if(!relatedRequest)return;
    const nextStatus=status as QuoteStatus;
    const wasSelected=selectedQuoteIds.includes(id);
    setQuotes(previous=>previous.map(item=>item.id===id?{...item,status:nextStatus}:item));
    if(wasSelected&&nextStatus!=="RECEIVED"&&nextStatus!=="SELECTED"){
      setSelectedQuoteIds(ids=>ids.filter(value=>value!==id));
      invalidateCustomerOffer(relatedRequest.id);
    }
    try {
      await fetch(`/api/requests/${relatedRequest.id}/quotes/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      addEvent(relatedRequest.id, `Статус предложения ${quote.article} обновлён в PostgreSQL: ${quoteStatusLabels[nextStatus]}`);
    } catch {
      // Keep local
    }
  }
  function updateItemStatus(itemId:string,status:WorkspaceItem["selectionStatus"]){if(!current)return;setRequests(previous=>previous.map(request=>request.id===current.id?{...request,items:request.items.map(item=>item.id===itemId?{...item,selectionStatus:status}:item),events:[{at:localDateLabel(new Date()),text:`Обновлён статус подбора детали ${request.items.find(item=>item.id===itemId)?.name??""}`,who:request.manager},...request.events]}:request));}
  async function updatePriority(priority:"Высокий"|"Обычный"){
    if(!current)return;
    try {
      const res = await fetch(`/api/requests/${current.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ priority }),
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(previous => previous.map(request => request.id === current.id ? { ...request, ...data.request } : request));
        setToast(`Приоритет сохранён в PostgreSQL: ${priority}`);
      }
    } catch {
      setToast("Ошибка обновления приоритета");
    }
  }
  async function toggleQuote(id:string){
    const quote=quotes.find(item=>item.id===id);
    if(!quote||!current)return;
    setSelectedQuoteIds(ids=>[...ids.filter(value=>quotes.find(item=>item.id===value)?.itemId!==quote.itemId),id]);
    try {
      await fetch(`/api/requests/${current.id}/quotes/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "select" }),
      });
      setQuotes(previous => previous.map(q => q.id === id ? { ...q, status: "SELECTED" as QuoteStatus } : q));
      invalidateCustomerOffer(current.id);
      addEvent(current.id, `Для предложения выбрана котировка ${quote.article} в PostgreSQL`);
      setToast(`Котировка ${quote.article} выбрана в PostgreSQL`);
    } catch {
      // Keep local
    }
  }
  function updateBuyerComment(comment:string){if(!current||comment===current.customerOfferComment)return;invalidateCustomerOffer(current.id);setRequests(previous=>previous.map(request=>request.id===current.id?{...request,customerOfferComment:comment,events:[{at:localDateLabel(new Date()),text:"Изменён комментарий в клиентском предложении",who:request.manager},...request.events]}:request));}
  function updateBuyerLogistics(value:string){if(!current||value===current.customerOfferSharedLogisticsRub)return;try{toMinorUnits(value||"0","RUB");}catch{return;}invalidateCustomerOffer(current.id);setRequests(previous=>previous.map(request=>request.id===current.id?{...request,customerOfferSharedLogisticsRub:value,events:[{at:localDateLabel(new Date()),text:`Изменена общая логистика предложения · ${value} RUB`,who:request.manager},...request.events]}:request));}
  async function formCustomerOffer(snapshot:CustomerOfferSnapshot){
    if(!current||current.customerOfferStatus&&current.customerOfferStatus!=="DRAFT"||snapshot.version!==(current.customerOfferVersion??0)+1||snapshot.financeLines.length!==current.items.length)return;
    try {
      const res = await fetch(`/api/requests/${current.id}/customer-offer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          comment: current.customerOfferComment || snapshot.comment,
          sharedLogisticsRub: current.customerOfferSharedLogisticsRub || "0",
          status: "FORMED",
          snapshot,
        }),
      });
      if (res.ok) {
        setRequests(previous => previous.map(request => {
          if (request.id !== current.id) return request;
          return {
            ...request,
            status: "OFFERS_READY",
            customerOfferSnapshot: snapshot,
            customerOfferVersion: snapshot.version,
            customerOfferStatus: "FORMED",
            customerOfferSentAt: undefined,
            customerResponseStatus: "NO_RESPONSE",
          };
        }));
        setToast(`Версия №${snapshot.version} сохранена в PostgreSQL`);
      }
    } catch {
      setToast("Ошибка сохранения предложения в PostgreSQL");
    }
  }
  async function saveBuyerResponse(response:BuyerResponseStatus){
    if(!current||!current.customerOfferSnapshot||!(current.customerOfferStatus==="FORMED"||current.customerOfferStatus==="SENT"||current.customerOfferStatus==="VIEWED")){setToast("Сначала сформируйте локальное предложение");return;}
    if(response===(current.customerResponseStatus??"NO_RESPONSE"))return;
    try {
      const res = await fetch(`/api/requests/${current.id}/customer-response`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ responseStatus: response }),
      });
      if (res.ok) {
        setRequests(previous => previous.map(request => {
          if (request.id !== current.id) return request;
          return {
            ...request,
            customerResponseStatus: response,
            status: response === "ACCEPTED" ? "CONFIRMED" : request.status,
          };
        }));
        setToast("Ответ покупателя зафиксирован в PostgreSQL");
      }
    } catch {
      setToast("Ошибка сохранения ответа покупателя");
    }
  }
  async function saveWorkspaceTask(taskId:string|undefined,title:string,dueAt:string,priority:"Высокий"|"Обычный"){
    if(!current)return;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: taskId,
          title,
          requestId: current.id,
          dueAt,
          priority,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const task = data.task;
        setTasks(previous => [task, ...previous.filter(t => t.id !== task.id)]);
        setToast("Следующее действие сохранено в PostgreSQL");
      }
    } catch {
      setToast("Ошибка сохранения задачи");
    }
  }
  async function toggleTaskItem(id: string) {
    setTasks(current => current.map(task => task.id === id ? { ...task, done: !task.done } : task));
    try {
      await fetch(`/api/tasks/${id}`, { method: "PATCH" });
    } catch {
      // Keep optimistic
    }
  }
  const nav=<><div className="mb-8"><BrandLogo variant="dark" className="w-40" sizes="160px"/><small className="mt-2 block text-[9px] font-bold uppercase tracking-[.18em] text-[#ff6428]">Операционная CRM</small></div><nav className="grid gap-1">{visibleSections.map(([id,label])=>{const NavIcon=sectionIcons[id];return <button key={id} onClick={()=>navigateSection(id)} className={`flex min-h-10 items-center gap-3 border-l-2 px-3 py-2.5 text-left text-sm transition ${section===id?"border-[#ff6428] bg-[#2a2e31] font-semibold text-[#f1f0eb]":"border-transparent text-[#aeb5b6] hover:bg-[#24282b] hover:text-[#f1f0eb]"}`}><NavIcon className="h-4 w-4 shrink-0 text-[#ff6428]"/><span className="truncate">{label}</span>{id==="requests"&&<span className="ml-auto text-xs tabular-nums text-[#899194]">{requests.length}</span>}{id==="orders"&&<span className="ml-auto text-xs tabular-nums text-[#899194]">{orders.length}</span>}</button>;})}</nav><div className="mt-auto pt-8"><Link href="/" className="block border-t border-[#383e41] pt-4 text-xs text-[#aeb5b6] hover:text-[#f1f0eb]">← На сайт ZAPTUT.PRO</Link><p className="mt-3 text-[10px] leading-4 text-[#747d80]">ZAPTUT.PRO · Платформа B2B<br/>Рабочий контур</p></div></>;

  return <main className="min-h-screen bg-[#17191b] text-[#f1f0eb]"><div className="flex min-h-screen"><aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col border-r border-[#343a3d] bg-[#1c1f21] p-5 lg:flex">{nav}</aside><div className="min-w-0 flex-1"><header className="sticky top-0 z-20 flex min-h-[64px] items-center justify-between border-b border-[#343a3d] bg-[#17191b]/95 px-4 backdrop-blur sm:px-7"><div className="flex items-center gap-3"><span className="font-extrabold uppercase tracking-wide">{current?`Заявка / ${current.id}`:sections.find(x=>x[0]===section)?.[1]}</span><span className="hidden border border-[#414749] bg-[#1e2124] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#ff865c] sm:inline">Демо-контур</span></div><div className="flex items-center gap-3"><span className="hidden text-xs text-[#9da5a7] sm:inline">{staff.name || "Администратор"} · {staff.role || "ADMIN"}</span><span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full bg-[#303639] text-xs font-bold text-[#f1f0eb]">{(staff.name || "A").split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase() ?? "").join("") || "ZP"}</span><SignOutButton/></div></header>
     <div className="border-b border-[#343a3d] bg-[#202325] px-4 py-2 lg:hidden"><div className="flex gap-1.5 overflow-x-auto">{visibleSections.map(([id,label])=><button key={id} onClick={()=>navigateSection(id)} className={`shrink-0 px-3 py-2 text-xs font-semibold transition ${section===id?"bg-[#ff6428] font-bold text-[#17191b]":"text-[#c3c8ca] hover:text-[#f1f0eb]"}`}>{label}</button>)}</div></div>
    <div className="mx-auto max-w-[1440px] p-4 sm:p-7">
      {dbError && (
        <div className="mb-4 border border-[#e11d48]/60 bg-[#e11d48]/15 p-4 text-xs font-bold text-red-200">
          {dbError}
        </div>
      )}
      {section==="dashboard"&&!current&&(
        <div className="space-y-4 sm:space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#ff6428]">Операционная смена · CRM</p><h1 className="mt-1 text-2xl font-extrabold uppercase sm:text-3xl">Рабочий стол</h1><p className="mt-1 text-xs text-[#aeb5b6]">Текущая очередь заявок, подбор деталей и контроль сроков</p></div>
            <div className="flex flex-wrap gap-2"><button onClick={()=>setCreateRequestOpen(true)} className="min-h-10 border border-[#51595c] px-3.5 text-[10px] font-bold uppercase text-[#f1f0eb] hover:border-[#ff6428]">Создать заявку +</button><button onClick={()=>{setQueuePreset("");setStatusFilter("");setPriorityFilter("");setManagerFilter("");setSearch("");navigateSection("requests");}} className="min-h-10 bg-[#ff6428] px-3.5 text-[10px] font-extrabold uppercase text-[#17191b] hover:bg-[#ff8050]">Полный список →</button></div>
          </div>
          <section aria-label="Показатели очереди" className="grid grid-cols-2 gap-2 xl:grid-cols-4">
            <MetricLink label="Новые заявки" value={String(counts.NEW)} sub="первичный разбор" onClick={()=>openQueue("new")}/>
            <MetricLink label="В работе" value={String(counts.ASSIGNED+counts.SEARCHING+counts.WAITING_SUPPLIERS+counts.OFFERS_READY+counts.SENT_TO_CUSTOMER)} sub="подбор и предложения" onClick={()=>openQueue("work")}/>
            <MetricLink label="Просроченные" value={String(overdueTaskRequestIds.size)} sub="срок следующего действия прошёл" alert={overdueTaskRequestIds.size>0} onClick={()=>openQueue("overdue")}/>
            <MetricLink label="Ждут ответа покупателя" value={String(counts.WAITING_CUSTOMER)} sub="нужен follow-up" onClick={()=>openQueue("waiting_customer")}/>
          </section>
          <section aria-label="Финансовые показатели" className="border border-[#383e41] bg-[#202325] p-3 sm:p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-2"><h2 className="text-[10px] font-bold uppercase tracking-[.14em] text-[#aeb5b6]">Финансовая сводка</h2><span className="text-[9px] font-bold uppercase tracking-wide text-[#ff986f]">Демо · по дате заявки</span></div><label className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-wide text-[#929a9c]">Период<select aria-label="Период финансовой сводки" value={financePeriod} onChange={e=>setFinancePeriod(e.target.value as FinancePeriod)} className="border border-[#414749] bg-[#17191b] px-2 py-1.5 text-[10px] text-[#f1f0eb]"><option value="today">Сегодня</option><option value="7d">7 дней</option><option value="30d">30 дней</option></select></label></div>
            <div className="grid grid-cols-2 gap-x-2 xl:grid-cols-4"><FinanceMetric label="Оборот" value={formatMinorUnits(confirmedQuoteTotals.turnover.toString(),"RUB")} sub="подтверждённые предложения"/><FinanceMetric label="Валовая прибыль" value={formatMinorUnits(demoGrossProfit.toString(),"RUB")} sub="до вычета логистики"/><FinanceMetric label="Средняя наценка" value={demoMarkup} sub="по подтверждённой закупке"/><FinanceMetric label="Подтверждённые заказы" value={String(confirmedRequests.length)} sub="за выбранный период"/></div>
          </section>
          <DashboardQueue rows={visibleRequests} overdueIds={overdueTaskRequestIds} queuePreset={queuePreset} setQueuePreset={setQueuePreset} search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} priorityFilter={priorityFilter} setPriorityFilter={setPriorityFilter} managerFilter={managerFilter} setManagerFilter={setManagerFilter} sortMode={sortMode} setSortMode={setSortMode} onOpen={id=>setSelectedId(id)} nextTaskFor={nextTaskFor}/>
          <ManagerTasks tasks={tasks} onOpen={id=>setSelectedId(id)} onToggle={toggleTaskItem}/>
        </div>
      )}

      {section==="requests"&&<div className={current?"hidden":"space-y-4"}><div className="flex flex-wrap items-end justify-between gap-3"><PageTitle eyebrow="CRM · реестр" title="Заявки" subtitle="Полный список обращений, поручений и текущих сроков."/><span className="mb-6 text-xs text-[#aeb5b6]">Всего заявок: <b className="tabular-nums text-[#f1f0eb]">{requests.length}</b></span></div><RequestRegister rows={requests} overdueIds={overdueTaskRequestIds} countryByRequest={supplierCountryByRequest} nextTaskFor={nextTaskFor} onOpen={id=>setSelectedId(id)} onCreate={()=>setCreateRequestOpen(true)} onAssign={(ids,manager)=>{setRequests(prev=>prev.map(request=>ids.includes(request.id)?{...request,manager,events:[{at:localDateLabel(new Date()),text:`Массовое назначение: ${manager}`,who:"Анна Смирнова"},...request.events]}:request));setToast(`Назначен менеджер для ${ids.length} заявок`);}} onPriority={(ids,priority)=>{setRequests(prev=>prev.map(request=>ids.includes(request.id)?{...request,priority,events:[{at:localDateLabel(new Date()),text:`Массовое изменение приоритета: ${priority}`,who:"Анна Смирнова"},...request.events]}:request));setToast(`Приоритет изменён у ${ids.length} заявок`);}} onStatus={(ids,status)=>{if(status==="SENT_TO_CUSTOMER"){setToast("Статус отправки нельзя назначить вручную: подключённого канала связи нет");return;}setRequests(prev=>prev.map(request=>ids.includes(request.id)?{...request,status,events:[{at:localDateLabel(new Date()),text:`Массовая смена статуса: ${statusLabels[status]}`,who:"Анна Смирнова"},...request.events]}:request));setToast(`Статус изменён у ${ids.length} заявок`);}}/></div>}

      {current&&<RequestWorkspace key={current.id} request={current} suppliers={suppliers} quotes={requestQuotes} tasks={tasks} config={financialConfig} overrides={priceOverrides} priceHistory={priceHistory} selectedQuoteIds={selectedQuoteIds.filter(id=>requestQuotes.some(quote=>quote.id===id))} canReadFinancialData={can("quotes.purchase.read")} onBack={()=>{setSelectedId(null);navigateSection("requests");}} onStatus={status=>updateStatus(current.id,status)} onManager={manager=>assign(current.id,manager)} onPriority={updatePriority} onItemStatus={updateItemStatus} onSaveNote={note=>saveNote(current.id,note)} onSaveQuote={saveWorkspaceQuote} onQuoteStatus={updateQuoteStatus} onPriceOverride={savePriceOverride} onToggleQuote={toggleQuote} onFormOffer={formCustomerOffer} onBuyerComment={updateBuyerComment} onBuyerLogistics={updateBuyerLogistics} onBuyerResponse={saveBuyerResponse} onSaveTask={saveWorkspaceTask} onCreateOrder={()=>handleCreateOrderFromRequest(current.id)}/>}

      {section==="orders"&&!current&&(
        selectedOrder ? (
          <OrderWorkspace
            order={selectedOrder}
            onBack={()=>setSelectedOrderId(null)}
            onStatusChange={handleOrderStatusChange}
            onRecordPayment={handleOrderPayment}
            onUpdateShipment={handleOrderShipment}
            onAddDocument={async ()=>{}}
            onAddMessage={handleOrderMessage}
            onViewRequest={(reqId)=>{
              setSelectedOrderId(null);
              setSelectedId(reqId);
              setSection("requests");
            }}
          />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <PageTitle
                eyebrow="CRM · Управление заказами"
                title="Заказы"
                subtitle="Исполнение подтверждённых покупок, комплектация, оплата и логистика."
              />
              <span className="mb-6 text-xs text-[#aeb5b6]">
                Всего заказов: <b className="tabular-nums text-[#f1f0eb]">{orders.length}</b>
              </span>
            </div>
            <OrderRegister
              orders={orders}
              queues={orderQueues}
              activeQueue={orderQueue}
              onQueueChange={setOrderQueue}
              onSelectOrder={setSelectedOrderId}
              searchQuery={orderSearch}
              onSearchChange={setOrderSearch}
              statusFilter={orderStatusFilter}
              onStatusFilterChange={setOrderStatusFilter}
              paymentFilter={orderPaymentFilter}
              onPaymentFilterChange={setOrderPaymentFilter}
              deliveryFilter={orderDeliveryFilter}
              onDeliveryFilterChange={setOrderDeliveryFilter}
              countryFilter={orderCountryFilter}
              onCountryFilterChange={setOrderCountryFilter}
              loading={ordersLoading}
            />
          </div>
        )
      )}
      {section==="suppliers"&&!current&&<SupplierRegistry suppliers={suppliers} onSave={saveSupplier} onStatusChange={updateSupplierStatus}/>}
      {section==="import"&&!current&&(
        <FeedImportWorkspace
          suppliers={suppliers.map(s => ({ id: s.id, name: s.name, country: s.country }))}
        />
      )}

    {section==="quotes"&&!current&&(
      <>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <PageTitle eyebrow="Сравнение источников" title="Предложения поставщиков" subtitle="Сопоставление нескольких вариантов для каждой строки заявки."/>
          <span className="mb-6 text-xs text-[#aeb5b6]">Всего предложений: <b className="tabular-nums text-[#f1f0eb]">{quotes.length}</b></span>
        </div>
        <div className={`${panelClass} overflow-x-auto`}>
          <table className="w-full min-w-[1000px] text-left text-xs">
            <thead className="bg-[#292e30] text-[10px] uppercase text-[#aeb5b6]">
              <tr>{["Заявка / деталь","Поставщик / страна","Артикул","Состояние", can("quotes.purchase.read") ? "Закупка" : "Цена для клиента","В наличии","Доставка","Статус предложения"].map(t=><th key={t} className="p-3">{t}</th>)}</tr>
            </thead>
            <tbody>
              {quotes.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-sm text-[#929a9c]">Нет доступных предложений. Предложения создаются при подборе деталей в заявках.</td></tr>
              ) : (
                quotes.map(q=>{
                  const req=requests.find(r=>(r.items??[]).some(i=>i.id===q.itemId));
                  const item=req?.items?.find(i=>i.id===q.itemId);
                  const sup=suppliers.find(s=>s.id===q.supplierId);
                  const supName=(q as any).supplierName || sup?.name || "Поставщик";
                  const supCountry=(q as any).country || sup?.country || "—";
                  return <tr key={q.id} className="border-t border-[#383e41]">
                    <td className="p-3">
                      {req ? (
                        <button onClick={()=>{setSelectedId(req.id);setSection("requests");}} className="text-left hover:text-[#ff865c]">
                          <span className="font-bold text-[#ff865c]">{req.id}</span>
                          <small className="block text-[#8d9699]">{item?.name??"Деталь"} · {item?.oem??q.article}</small>
                        </button>
                      ) : (
                        <span className="text-[#8d9699]">{item?.name??q.article}<small className="block font-mono text-[10px]">{q.itemId}</small></span>
                      )}
                    </td>
                    <td className="p-3"><span className="font-medium text-[#f1f0eb]">{supName}</span><small className="block text-[#8d9699]">{supCountry}</small></td>
                    <td className="p-3"><span className="font-mono text-[#f1f0eb]">{q.article}</span><small className="block text-[#8d9699]">{q.maker}</small></td>
                    <td className="p-3">{q.condition}</td>
                    <td className="p-3 font-bold tabular-nums text-[#f1f0eb]">
                      {can("quotes.purchase.read") ? fmt(q.cost || "0", q.currency) : ((q as any).customerPriceRub ? (q as any).customerPriceRub : (finalRetail(q) && finalRetail(q) !== "0" ? `${(Number(finalRetail(q)) / 100).toLocaleString("ru-RU")} ₽` : "—"))}
                    </td>
                    <td className="p-3">{q.availability}</td>
                    <td className="p-3 tabular-nums">{q.deliveryDays} дн.</td>
                    <td className="p-3"><select value={q.status} onChange={e=>updateQuoteStatus(q.id,e.target.value as QuoteStatus)} className="border border-[#414749] bg-[#17191b] p-2 text-xs text-[#f1f0eb] outline-none focus:border-[#ff6428]"><option value="DRAFT">Черновик</option><option value="INQUIRY_SENT">Запрос отправлен</option><option value="RECEIVED">Получено</option><option value="SELECTED">Выбрано</option><option value="DECLINED">Отклонено</option><option value="EXPIRED">Истекло</option></select></td>
                  </tr>;
                })
              )}
            </tbody>
          </table>
        </div>
      </>
    )}

    {section==="staff"&&!current&&(
      <StaffRegistry currentStaffId={staff.userId} currentStaffRole={staff.role} />
    )}

      {section==="customers"&&!current&&(
        selectedCustomer?(
          <section className="space-y-4">
            <button type="button" onClick={()=>setSelectedCustomerId(null)} className="text-xs font-bold uppercase tracking-wide text-[#ff986f] hover:text-[#f1f0eb]">← Все клиенты</button>
            <PageTitle eyebrow="Профиль клиента" title={selectedCustomer.customer.name} subtitle={`${selectedCustomer.requests.length} ${selectedCustomer.requests.length===1?"заявка":"заявок"} в CRM`}/>
            <div className="flex justify-end"><button type="button" onClick={()=>beginCustomerEdit(selectedCustomer.customer)} className="min-h-10 bg-[#ff6428] px-4 text-xs font-extrabold uppercase text-[#17191b] hover:bg-[#ff8050]">Редактировать профиль</button></div>
            {customerEditOpen&&<form onSubmit={saveCustomerEdit} className={`${panelClass} space-y-4 p-4 sm:p-5`} aria-label="Редактирование профиля клиента">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#383e41] pb-3"><div><h2 className="text-sm font-extrabold uppercase">Редактирование профиля</h2><p className="mt-1 text-xs text-[#929a9c]">Изменения сохраняются в PostgreSQL; данные существующих заявок останутся прежними.</p></div><span className="text-[10px] font-bold uppercase tracking-wide text-emerald-400">PostgreSQL</span></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-[10px] font-bold uppercase tracking-wide text-[#aeb5b6]">Имя клиента<input autoFocus required maxLength={160} value={customerEditDraft.name} onChange={event=>{setCustomerEditDraft(draft=>({...draft,name:event.target.value}));setCustomerEditErrors(errors=>({...errors,name:undefined}));}} className={inputClass} aria-invalid={Boolean(customerEditErrors.name)}/>{customerEditErrors.name&&<span className="mt-1 block text-xs normal-case text-[#ff986f]">{customerEditErrors.name}</span>}</label>
                <label className="text-[10px] font-bold uppercase tracking-wide text-[#aeb5b6]">Телефон<input type="tel" maxLength={40} value={customerEditDraft.phone} onChange={event=>{setCustomerEditDraft(draft=>({...draft,phone:event.target.value}));setCustomerEditErrors(errors=>({...errors,phone:undefined}));setCustomerEditMessage("");}} className={`${inputClass} tabular-nums`} aria-invalid={Boolean(customerEditErrors.phone)}/>{customerEditErrors.phone&&<span className="mt-1 block text-xs normal-case text-[#ff986f]">{customerEditErrors.phone}</span>}</label>
                <label className="text-[10px] font-bold uppercase tracking-wide text-[#aeb5b6]">Email<input type="email" maxLength={254} value={customerEditDraft.email} onChange={event=>{setCustomerEditDraft(draft=>({...draft,email:event.target.value}));setCustomerEditErrors(errors=>({...errors,email:undefined}));setCustomerEditMessage("");}} className={inputClass} aria-invalid={Boolean(customerEditErrors.email)}/>{customerEditErrors.email&&<span className="mt-1 block text-xs normal-case text-[#ff986f]">{customerEditErrors.email}</span>}</label>
                <label className="text-[10px] font-bold uppercase tracking-wide text-[#aeb5b6] sm:col-span-2">Внутренняя заметка CRM<textarea rows={3} maxLength={3000} value={customerEditDraft.internalNote} onChange={event=>setCustomerEditDraft(draft=>({...draft,internalNote:event.target.value}))} className={inputClass}/></label>
              </div>
              {customerEditMessage&&<p role="alert" className="border border-[#7b3c25] bg-[#2a211e] px-3 py-2 text-xs text-[#ffb08c]">{customerEditMessage}</p>}
              <div className="flex flex-wrap justify-end gap-2 border-t border-[#383e41] pt-3"><button type="button" onClick={cancelCustomerEdit} className="min-h-10 border border-[#51595c] px-4 text-xs font-bold uppercase text-[#d0d5d6] hover:border-[#ff6428]">Отмена</button><button type="submit" disabled={!requestsHydrated} className="min-h-10 bg-[#ff6428] px-4 text-xs font-extrabold uppercase text-[#17191b] disabled:cursor-wait disabled:opacity-50">Сохранить</button></div>
            </form>}
            <div className={`${panelClass} grid gap-3 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4`}>
              <div><p className="text-[10px] font-bold uppercase tracking-wide text-[#929a9c]">Email профиля</p><p className="mt-1 break-all">{selectedCustomer.customer.email||"Не указан"}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wide text-[#929a9c]">Телефон профиля</p><p className="mt-1 tabular-nums">{selectedCustomer.customer.phone||"Не указан"}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wide text-[#929a9c]">Клиент с</p><p className="mt-1 tabular-nums">{new Intl.DateTimeFormat("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(selectedCustomer.customer.createdAt))}</p></div>
              <div className="sm:col-span-2 lg:col-span-4"><p className="text-[10px] font-bold uppercase tracking-wide text-[#929a9c]">Внутренняя заметка CRM</p><p className="mt-1 whitespace-pre-wrap break-words text-[#c5cbcc]">{selectedCustomer.customer.internalNote||"Нет заметки"}</p></div>
            </div>
            <section className={`${panelClass} overflow-hidden`}>
              <div className="flex items-center justify-between gap-3 border-b border-[#383e41] px-4 py-3"><div><h2 className="text-xs font-extrabold uppercase tracking-wide">История заявок</h2><p className="mt-1 text-[11px] text-[#929a9c]">Контакты профиля и данные, указанные в отдельных заявках, хранятся раздельно.</p></div><span className="tabular-nums text-xs text-[#c5cbcc]">{selectedCustomer.requests.length}</span></div>
              {selectedCustomer.requests.length?selectedCustomer.requests.map(request=><article key={request.id} className="border-b border-[#383e41] p-4 last:border-b-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0"><p className="font-bold tabular-nums text-[#ff865c]">{request.id}<span className="ml-2 text-xs font-normal text-[#aeb5b6]">{request.created}</span></p><p className="mt-1 text-sm font-semibold">{request.make} {request.model} · {request.year}</p><p className="mt-1 break-words text-xs text-[#b9c0c1]">{request.items.map(item=>`${item.name} ×${item.qty}${item.oem?` · OEM ${item.oem}`:""}`).join("; ")}</p></div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2"><Badge status={request.status}/><button type="button" onClick={()=>{if(window.location.pathname!=="/admin/requests")window.history.pushState(null,"","/admin/requests");setSection("requests");setSelectedCustomerId(null);setSelectedId(request.id);}} className="border border-[#4c5457] px-3 py-2 text-[10px] font-bold uppercase hover:border-[#ff6428]">Открыть заявку →</button></div>
                </div>
                <details className="mt-3 text-[11px] text-[#929a9c]"><summary className="w-fit cursor-pointer hover:text-[#f1f0eb]">Контактные данные из этой заявки</summary><div className="mt-2 grid gap-2 border-l border-[#51595c] pl-3 sm:grid-cols-3"><p>Имя: {request.customer||"—"}</p><p className="break-all">Email: {request.email||"—"}</p><p className="tabular-nums">Телефон: {request.phone||"—"}</p></div></details>
              </article>):<p className="p-5 text-sm text-[#929a9c]">У этого профиля пока нет связанных заявок.</p>}
            </section>
          </section>
        ):(
          <>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <PageTitle eyebrow="Покупатели" title="Клиенты" subtitle="Уникальные профили покупателей и связанные с ними заявки."/>
              <button type="button" onClick={()=>setCustomerCreateOpen(true)} className="min-h-10 bg-[#ff6428] px-4 text-xs font-extrabold uppercase text-[#17191b] hover:bg-[#ff8050]">Создать клиента +</button>
            </div>
            {customerCreateOpen&&(
              <form onSubmit={saveCustomerCreate} className={`${panelClass} mb-4 space-y-4 p-4 sm:p-5`} aria-label="Создание нового клиента">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#383e41] pb-3">
                  <div>
                    <h2 className="text-sm font-extrabold uppercase">Новый профиль клиента</h2>
                    <p className="mt-1 text-xs text-[#929a9c]">Профиль будет сохранён в единой базе данных PostgreSQL.</p>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-400">PostgreSQL</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-[10px] font-bold uppercase tracking-wide text-[#aeb5b6]">
                    Имя клиента *
                    <input autoFocus required maxLength={160} value={customerCreateDraft.name} onChange={e=>{setCustomerCreateDraft(d=>({...d,name:e.target.value}));setCustomerCreateErrors(err=>({...err,name:undefined}));}} className={inputClass} aria-invalid={Boolean(customerCreateErrors.name)}/>
                    {customerCreateErrors.name&&<span className="mt-1 block text-xs normal-case text-[#ff986f]">{customerCreateErrors.name}</span>}
                  </label>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-[#aeb5b6]">
                    Телефон
                    <input type="tel" maxLength={40} value={customerCreateDraft.phone} onChange={e=>{setCustomerCreateDraft(d=>({...d,phone:e.target.value}));setCustomerCreateErrors(err=>({...err,phone:undefined}));setCustomerCreateMessage("");}} className={`${inputClass} tabular-nums`} aria-invalid={Boolean(customerCreateErrors.phone)}/>
                    {customerCreateErrors.phone&&<span className="mt-1 block text-xs normal-case text-[#ff986f]">{customerCreateErrors.phone}</span>}
                  </label>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-[#aeb5b6]">
                    Email
                    <input type="email" maxLength={254} value={customerCreateDraft.email} onChange={e=>{setCustomerCreateDraft(d=>({...d,email:e.target.value}));setCustomerCreateErrors(err=>({...err,email:undefined}));setCustomerCreateMessage("");}} className={inputClass} aria-invalid={Boolean(customerCreateErrors.email)}/>
                    {customerCreateErrors.email&&<span className="mt-1 block text-xs normal-case text-[#ff986f]">{customerCreateErrors.email}</span>}
                  </label>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-[#aeb5b6] sm:col-span-2">
                    Внутренняя заметка CRM
                    <textarea rows={3} maxLength={3000} value={customerCreateDraft.internalNote} onChange={e=>setCustomerCreateDraft(d=>({...d,internalNote:e.target.value}))} className={inputClass}/>
                  </label>
                </div>
                {customerCreateMessage&&<p role="alert" className="border border-[#7b3c25] bg-[#2a211e] px-3 py-2 text-xs text-[#ffb08c]">{customerCreateMessage}</p>}
                <div className="flex flex-wrap justify-end gap-2 border-t border-[#383e41] pt-3">
                  <button type="button" onClick={()=>{setCustomerCreateOpen(false);setCustomerCreateErrors({});setCustomerCreateMessage("");}} className="min-h-10 border border-[#51595c] px-4 text-xs font-bold uppercase text-[#d0d5d6] hover:border-[#ff6428]">Отмена</button>
                  <button type="submit" className="min-h-10 bg-[#ff6428] px-4 text-xs font-extrabold uppercase text-[#17191b]">Создать клиента</button>
                </div>
              </form>
            )}
            <label className="mb-3 flex min-h-11 items-center gap-2 border border-[#414749] bg-[#202325] px-3 focus-within:border-[#ff6428]">
              <span aria-hidden="true" className="text-[#ff865c]">⌕</span>
              <input type="search" value={customerSearch} onChange={event=>setCustomerSearch(event.target.value)} placeholder="Имя, телефон, email, номер заявки или автомобиль" aria-label="Поиск клиентов" className="min-w-0 flex-1 bg-transparent py-2 text-sm text-[#f1f0eb] outline-none placeholder:text-[#818a8d]"/>
              {customerSearch&&<button type="button" onClick={()=>setCustomerSearch("")} aria-label="Очистить поиск клиентов" className="shrink-0 px-2 py-1 text-xs font-bold uppercase text-[#ff986f] hover:text-[#f1f0eb]">Очистить ×</button>}
            </label>
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-[#383e41] pb-2"><p className="text-xs text-[#aeb5b6]">{customerSearch?"Найдено профилей":"Профилей клиентов"}</p><b className="tabular-nums text-sm">{requestsHydrated?(customerSearch?visibleCustomerRegistry.length:customerRegistry.length):"—"}</b></div>
            {!requestsHydrated?<div className={`${panelClass} p-5 text-sm text-[#aeb5b6]`} role="status">Загружаем клиентские профили…</div>:customerRegistry.length===0?<div className={`${panelClass} p-5 text-sm text-[#aeb5b6]`}>Пока нет клиентских профилей.</div>:visibleCustomerRegistry.length===0?<div className={`${panelClass} p-5 text-sm text-[#aeb5b6]`} role="status">Клиенты не найдены.</div>:(
              <>
                <div className={`${panelClass} hidden overflow-hidden md:block`}><table className="w-full table-fixed text-left text-sm"><colgroup><col className="w-[24%]"/><col className="w-[17%]"/><col className="w-[27%]"/><col className="w-[32%]"/></colgroup><thead className="bg-[#292e30] text-[10px] uppercase tracking-wide text-[#aeb5b6]"><tr><th className="p-3">Клиент</th><th className="p-3">Телефон</th><th className="p-3">Заявки</th><th className="p-3">Автомобили</th></tr></thead><tbody>{visibleCustomerRegistry.map(({customer,requests:linkedRequests})=>{
                  const cars=[...new Set(linkedRequests.map(request=>[request.make,request.model,request.year].filter(Boolean).join(" ")).filter(Boolean))];
                  return <tr key={customer.id} className="border-t border-[#383e41] align-top hover:bg-[#252a2c]"><td className="p-3"><button type="button" onClick={()=>setSelectedCustomerId(customer.id)} className="text-left font-semibold hover:text-[#ff986f]">{customer.name||"Без имени"}<small className="mt-1 block break-all text-xs font-normal text-[#aeb5b6]">{customer.email||"Email не указан"}</small><small className="mt-1 block text-[10px] font-normal text-[#788184]">Открыть профиль →</small></button></td><td className="p-3 tabular-nums">{customer.phone||"—"}</td><td className="p-3"><span className="mb-1 block text-xs text-[#cbd0d1]">{linkedRequests.length} {linkedRequests.length===1?"заявка":"заявок"}</span><div className="flex flex-wrap gap-1">{linkedRequests.map(request=><span key={request.id} className="border border-[#4b5255] px-1.5 py-0.5 text-[10px] tabular-nums text-[#ff986f]">{request.id}</span>)}</div></td><td className="p-3"><div className="space-y-1 text-xs text-[#c5cbcc]">{cars.length?cars.map(car=><p key={car}>{car}</p>):<span className="text-[#818a8d]">Нет данных</span>}</div></td></tr>;
                })}</tbody></table></div>
                <div className="grid gap-2 md:hidden">{visibleCustomerRegistry.map(({customer,requests:linkedRequests})=>{
                  const cars=[...new Set(linkedRequests.map(request=>[request.make,request.model,request.year].filter(Boolean).join(" ")).filter(Boolean))];
                  return <article key={customer.id} className="min-w-0 border border-[#383e41] bg-[#202325] p-3"><button type="button" onClick={()=>setSelectedCustomerId(customer.id)} className="text-left"><span className="block break-words text-sm font-bold hover:text-[#ff986f]">{customer.name||"Без имени"}</span><span className="mt-1 block break-all text-xs text-[#aeb5b6]">{customer.email||"Email не указан"}</span></button><p className="mt-2 tabular-nums text-xs text-[#d2d7d8]">{customer.phone||"Телефон не указан"}</p><div className="mt-2 flex flex-wrap items-center gap-1.5"><span className="mr-1 text-[11px] text-[#aeb5b6]">{linkedRequests.length} заявок</span>{linkedRequests.map(request=><span key={request.id} className="border border-[#4b5255] px-1.5 py-0.5 text-[10px] tabular-nums text-[#ff986f]">{request.id}</span>)}</div><div className="mt-2 space-y-1 border-t border-[#383e41] pt-2 text-xs text-[#c5cbcc]">{cars.length?cars.map(car=><p key={car}>{car}</p>):<span className="text-[#818a8d]">Нет данных об автомобилях</span>}</div><button type="button" onClick={()=>setSelectedCustomerId(customer.id)} className="mt-3 text-[10px] font-bold uppercase text-[#ff986f]">История клиента →</button></article>;
                })}</div>
              </>
            )}
          </>
        )
      )}

      {section==="analytics"&&!current&&<>
        <PageTitle eyebrow="Операционная сводка" title="Аналитика" subtitle="Заявки — текущий демонабор. Фактические продажи в прототипе не учитываются."/>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Metric label="Заявок всего" value={String(requests.length)} sub="количество в текущем демонаборе"/>
          <Metric label="Подтверждено" value={String(counts.CONFIRMED)} sub="заявки со статусом CONFIRMED"/>
          <Metric label="Завершено" value={String(counts.COMPLETED)} sub="заявки со статусом COMPLETED"/>
          <Metric label="Среднее время обработки" value="Нет достоверных данных" valueClassName="text-base sm:text-lg" sub="временные отметки неполные"/>
          <Metric label="Оборот" value="—" sub="нет данных о фактических заказах и продажах"/>
          <Metric label="Валовая прибыль" value="—" sub="нет подтверждённых финансовых фактов"/>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <InfoPanel title="Заявки по статусам"><p className="-mt-2 mb-3 text-[10px] text-[#899194]">Каждая заявка учитывается только в своём текущем статусе.</p>{Object.entries(statusLabels).map(([status,label])=>{const count=counts[status as RequestStatus];const share=requests.length?count/requests.length*100:0;return <div key={status} className="mb-3 grid grid-cols-[160px_1fr_30px] items-center gap-3 text-xs"><span>{label}</span><div className="h-2 bg-[#343a3d]"><div className="h-2 bg-[#ff6428]" style={{width:`${Math.max(share,count?8:0)}%`}}/></div><b>{count}</b></div>;})}</InfoPanel>
          <InfoPanel title="Предложения поставщиков по странам"><p className="mb-4 text-xs text-[#9da5a7]">Считаются записи предложений, не заказы.</p>{["Россия","Беларусь","Польша"].map(country=>{const count=quotes.filter(quote=>suppliers.find(supplier=>supplier.id===quote.supplierId)?.country===country).length;return <div key={country} className="flex justify-between border-t border-[#383e41] py-3 text-sm"><span>{country}</span><b>{russianCountLabel(count,["запись","записи","записей"])}</b></div>;})}</InfoPanel>
        </div>
        <div className="mt-5"><InfoPanel title="Заявки по текущим ответственным">{managers.map(manager=>{const count=requests.filter(request=>request.manager===manager).length;return <div key={manager} className="flex justify-between border-t border-[#383e41] py-3 text-sm"><span>{manager}</span><span className="text-[#aeb5b6]">{russianCountLabel(count,["заявка","заявки","заявок"])} · текущая нагрузка</span></div>;})}</InfoPanel></div>
      </>}
      {section==="finance"&&can("finance.read")&&<><PageTitle eyebrow="Правила ценообразования" title="Финансовые настройки" subtitle="Тарифы применяются по стране поставщика. Настройки и курсы ниже — только демонстрационные."/><div className="mb-5 border border-[#7b3c25] bg-[#2a211e] p-4 text-xs leading-5 text-[#ffb08c]">Курсы валют — статические значения прототипа, не рыночные котировки. В production курс должен приходить из утверждённого источника с датой, временем и политикой фиксации.</div><div className="grid gap-4 lg:grid-cols-3">{(["Польша","Россия","Беларусь"] as const).map(country=><section key={country} className={`${panelClass} p-5`}><p className="text-xs font-bold uppercase tracking-widest text-[#ff865c]">Страна поставщика</p><h2 className="mt-1 text-xl font-extrabold">{country}</h2><label className="mt-4 block text-[10px] uppercase text-[#aeb5b6]">Наценка, %<input type="number" min="0" step="0.01" value={financialConfig.tariffs[country].markupBasisPoints/100} onChange={e=>setFinancialConfig(c=>({...c,tariffs:{...c.tariffs,[country]:{...c.tariffs[country],markupBasisPoints:Math.round(Number(e.target.value)*100)}}}))} className={inputClass}/></label><label className="mt-3 block text-[10px] uppercase text-[#aeb5b6]">Минимальная наценка, RUB<input type="number" min="0" step="0.01" value={Number(financialConfig.tariffs[country].minimumMarkupRubMinor)/100} onChange={e=>{try{const minor=toMinorUnits(e.target.value,"RUB").toString();setFinancialConfig(c=>({...c,tariffs:{...c.tariffs,[country]:{...c.tariffs[country],minimumMarkupRubMinor:minor}}}));}catch{}}} className={inputClass}/></label><p className="mt-3 text-[10px] text-[#9da5a7]">Тариф хранится в конфигурации; минимальная сумма задана в RUB.</p></section>)}</div><section className={`${panelClass} mt-5 p-5`}><h2 className="text-sm font-extrabold uppercase">Демо-курсы для пересчёта минимума</h2><p className="mt-1 text-xs text-[#929a9c]">Значение: RUB за 1 единицу валюты. Используются только для перевода минимальной наценки RUB в валюту закупки.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{(Object.keys(financialConfig.rubPerCurrencyUnit) as Array<keyof FinancialConfig["rubPerCurrencyUnit"]>).map(currency=><label key={currency} className="text-xs font-bold uppercase text-[#c2c7c8]">1 {currency} = RUB<input value={financialConfig.rubPerCurrencyUnit[currency]} onChange={e=>{const value=e.target.value;if(/^\d+(?:\.\d{1,4})?$/.test(value)&&Number(value)>0)setFinancialConfig(c=>({...c,rubPerCurrencyUnit:{...c.rubPerCurrencyUnit,[currency]:value}}))}} className={inputClass}/></label>)}</div></section><section className={`${panelClass} mt-5 p-5`}><h2 className="text-sm font-extrabold uppercase">История ручных корректировок</h2><p className="mb-3 mt-1 text-xs text-[#929a9c]">Ручная цена заменяет автоматическую только для выбранного предложения.</p>{priceHistory.length?priceHistory.map(entry=><p key={entry.id} className="border-t border-[#383e41] py-3 text-xs text-[#c2c7c8]">{describePriceAdjustmentHistoryEntry(entry)}</p>):<p className="border-t border-[#383e41] py-3 text-xs text-[#929a9c]">Пока нет изменений в этой демо-сессии.</p>}</section></>}
    </div></div></div>{createRequestOpen&&<div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-black/75 p-3 sm:p-6" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setCreateRequestOpen(false);}}><section role="dialog" aria-modal="true" aria-labelledby="create-request-title" className="my-auto max-h-[94vh] w-full max-w-3xl overflow-y-auto border border-[#4b5255] bg-[#202325] p-4 sm:p-6"><div className="flex items-start justify-between gap-3 border-b border-[#383e41] pb-4"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#ff6428]">Локальное действие · демо</p><h2 id="create-request-title" className="mt-1 text-xl font-extrabold uppercase">Создать заявку</h2><p className="mt-1 text-xs text-[#aeb5b6]">Данные останутся в текущей сессии браузера.</p></div><button type="button" aria-label="Закрыть форму" onClick={()=>setCreateRequestOpen(false)} className="border border-[#51595c] px-3 py-2 text-sm hover:border-[#ff6428]">Закрыть ×</button></div><form onSubmit={createRequest} className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2"><label className="min-w-0 text-[10px] font-bold uppercase text-[#aeb5b6]">Имя покупателя<input required name="customer" className={inputClass}/></label><label className="min-w-0 text-[10px] font-bold uppercase text-[#aeb5b6]">Телефон<input required name="phone" type="tel" className={inputClass}/></label><label className="min-w-0 text-[10px] font-bold uppercase text-[#aeb5b6]">Email<input required name="email" type="email" className={inputClass}/></label><label className="min-w-0 text-[10px] font-bold uppercase text-[#aeb5b6]">Автомобиль<input required name="make" placeholder="Марка" className={inputClass}/></label><label className="min-w-0 text-[10px] font-bold uppercase text-[#aeb5b6]">Модель<input required name="model" className={inputClass}/></label><label className="min-w-0 text-[10px] font-bold uppercase text-[#aeb5b6]">Год<input required name="year" inputMode="numeric" className={inputClass}/></label><label className="min-w-0 text-[10px] font-bold uppercase text-[#aeb5b6] sm:col-span-2">VIN<input required name="vin" className={`${inputClass} font-mono uppercase`}/></label><label className="min-w-0 text-[10px] font-bold uppercase text-[#aeb5b6]">Запрашиваемая деталь<input required name="part" className={inputClass}/></label><label className="min-w-0 text-[10px] font-bold uppercase text-[#aeb5b6]">OEM / артикул<input name="oem" className={`${inputClass} font-mono uppercase`}/></label><label className="min-w-0 text-[10px] font-bold uppercase text-[#aeb5b6]">Ответственный менеджер<select name="manager" className={inputClass}>{managers.map(manager=><option key={manager}>{manager}</option>)}</select></label><label className="min-w-0 text-[10px] font-bold uppercase text-[#aeb5b6]">Приоритет<select name="priority" className={inputClass}><option>Обычный</option><option>Высокий</option></select></label><label className="min-w-0 text-[10px] font-bold uppercase text-[#aeb5b6] sm:col-span-2">Комментарий<textarea name="comment" rows={3} className={inputClass}/></label><div className="flex flex-wrap justify-end gap-2 border-t border-[#383e41] pt-4 sm:col-span-2"><button type="button" onClick={()=>setCreateRequestOpen(false)} className="min-h-10 border border-[#51595c] px-4 text-xs font-bold uppercase text-[#d0d5d6]">Отмена</button><button className="min-h-10 bg-[#ff6428] px-4 text-xs font-extrabold uppercase text-[#17191b]">Создать демо-заявку</button></div></form></section></div>}{toast&&<button onClick={()=>setToast("")} className="fixed bottom-5 right-5 z-50 max-w-sm border border-[#ff6428] bg-[#24282b] px-4 py-3 text-left text-sm shadow-xl">{toast}<span className="ml-3 text-[#ff865c]">×</span></button>}</main>;
}

function PageTitle({eyebrow,title,subtitle}:{eyebrow:string;title:string;subtitle:string}) { return <div className="mb-6"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#ff6428]">{eyebrow}</p><h1 className="mt-2 text-3xl font-extrabold uppercase">{title}</h1><p className="mt-2 text-sm text-[#aeb5b6]">{subtitle}</p></div>; }
function InfoPanel({title,children}:{title:string;children:React.ReactNode}) { return <section className={`${panelClass} min-w-0 p-4 sm:p-5`}><h2 className="mb-4 border-b border-[#383e41] pb-3 text-xs font-extrabold uppercase tracking-[.12em] text-[#d8dcdd]">{title}</h2>{children}</section>; }

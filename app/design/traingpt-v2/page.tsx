'use client';

import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowRight, Check, ChevronDown, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import './preview.css';

type Sport = 'RUN' | 'SWIM' | 'BIKE' | 'STRENGTH';
type Workout = {
  id: string; date: string; sport: Sport; title: string; minutes: number;
  status: 'completed' | 'planned'; focus: string; description: string;
};
type Screen = 'schedule' | 'today' | 'system';

const workouts: Workout[] = [
  {id:'w1',date:'2026-11-02',sport:'RUN',title:'Afternoon Run',minutes:35,status:'completed',focus:'Easy aerobic',description:'Steady running at an easy effort.'},
  {id:'w2',date:'2026-11-03',sport:'SWIM',title:'Swim Technique',minutes:50,status:'planned',focus:'Technique',description:'Technique drills followed by continuous swimming.'},
  {id:'w3',date:'2026-11-04',sport:'RUN',title:'Run Easy',minutes:25,status:'completed',focus:'Aerobic',description:'Conversational running with relaxed form.'},
  {id:'w4',date:'2026-11-04',sport:'STRENGTH',title:'Strength',minutes:30,status:'planned',focus:'Full body',description:'Low-fatigue supporting strength work.'},
  {id:'w5',date:'2026-11-05',sport:'BIKE',title:'Bike Endurance',minutes:55,status:'planned',focus:'Endurance',description:'Sustained aerobic riding.'},
  {id:'w6',date:'2026-11-05',sport:'RUN',title:'Afternoon Run',minutes:58,status:'completed',focus:'Aerobic',description:'Relaxed aerobic running.'},
  {id:'w7',date:'2026-11-06',sport:'SWIM',title:'Swim Endurance',minutes:60,status:'planned',focus:'Endurance',description:'Smooth, sustained aerobic swimming.'},
  {id:'w8',date:'2026-11-07',sport:'BIKE',title:'Long Ride',minutes:120,status:'planned',focus:'Aerobic endurance',description:'Long aerobic ride with controlled pacing.'},
  {id:'w9',date:'2026-11-07',sport:'RUN',title:'Brick Run',minutes:12,status:'planned',focus:'Transition',description:'Short relaxed run off the bike.'},
  {id:'w10',date:'2026-11-08',sport:'RUN',title:'Long Run',minutes:60,status:'planned',focus:'Endurance',description:'Sustainable, steady running.'},
  {id:'w11',date:'2026-11-10',sport:'SWIM',title:'Swim Technique',minutes:50,status:'planned',focus:'Technique',description:'Controlled drills and form.'},
  {id:'w12',date:'2026-11-10',sport:'RUN',title:'Afternoon Run',minutes:40,status:'completed',focus:'Easy',description:'Comfortable aerobic pace.'},
  {id:'w13',date:'2026-11-11',sport:'RUN',title:'Run Easy',minutes:35,status:'planned',focus:'Easy aerobic',description:'Build aerobic consistency while keeping effort relaxed.'},
  {id:'w14',date:'2026-11-11',sport:'STRENGTH',title:'Strength',minutes:30,status:'planned',focus:'Full body',description:'Maintain strength and movement quality without adding fatigue.'},
  {id:'w15',date:'2026-11-12',sport:'BIKE',title:'Bike Endurance',minutes:55,status:'planned',focus:'Endurance',description:'Sustained aerobic riding.'},
  {id:'w16',date:'2026-11-13',sport:'SWIM',title:'Swim Endurance',minutes:60,status:'planned',focus:'Endurance',description:'Smooth, sustained aerobic swimming.'},
  {id:'w17',date:'2026-11-14',sport:'BIKE',title:'Long Ride',minutes:127,status:'planned',focus:'Aerobic endurance',description:'Extend duration while maintaining an easy effort.'},
  {id:'w18',date:'2026-11-14',sport:'RUN',title:'Brick Run',minutes:14,status:'planned',focus:'Transition',description:'Easy running off the bike.'},
  {id:'w19',date:'2026-11-15',sport:'RUN',title:'Long Run',minutes:64,status:'planned',focus:'Endurance',description:'Steady aerobic running.'},
  {id:'w20',date:'2026-11-17',sport:'SWIM',title:'Swim Technique',minutes:50,status:'planned',focus:'Technique',description:'Controlled drills.'},
  {id:'w21',date:'2026-11-18',sport:'RUN',title:'Run Easy',minutes:35,status:'planned',focus:'Aerobic',description:'Controlled easy running.'},
  {id:'w22',date:'2026-11-18',sport:'STRENGTH',title:'Strength',minutes:30,status:'planned',focus:'Full body',description:'Supporting strength.'},
  {id:'w23',date:'2026-11-19',sport:'BIKE',title:'Bike Endurance',minutes:55,status:'planned',focus:'Endurance',description:'Aerobic riding.'},
  {id:'w24',date:'2026-11-20',sport:'SWIM',title:'Swim Endurance',minutes:60,status:'planned',focus:'Endurance',description:'Aerobic swimming.'},
  {id:'w25',date:'2026-11-21',sport:'BIKE',title:'Long Ride',minutes:133,status:'planned',focus:'Endurance',description:'Long easy ride.'},
  {id:'w26',date:'2026-11-21',sport:'RUN',title:'Brick Run',minutes:15,status:'planned',focus:'Transition',description:'Brief aerobic transition.'},
  {id:'w27',date:'2026-11-22',sport:'RUN',title:'Long Run',minutes:68,status:'planned',focus:'Endurance',description:'Easy endurance.'},
  {id:'w28',date:'2026-11-24',sport:'SWIM',title:'Swim Technique',minutes:30,status:'planned',focus:'Technique',description:'Deload swim.'},
  {id:'w29',date:'2026-11-26',sport:'BIKE',title:'Bike Endurance',minutes:35,status:'planned',focus:'Easy',description:'Deload ride.'},
  {id:'w30',date:'2026-11-28',sport:'BIKE',title:'Long Ride',minutes:99,status:'planned',focus:'Endurance',description:'Reduced-volume ride.'},
  {id:'w31',date:'2026-11-28',sport:'RUN',title:'Brick Run',minutes:12,status:'planned',focus:'Transition',description:'Easy transition.'},
  {id:'w32',date:'2026-11-29',sport:'RUN',title:'Run Easy',minutes:25,status:'planned',focus:'Easy',description:'Recovery-oriented running.'}
];

const pad = (n: number) => String(n).padStart(2, '0');
const keyFromDate = (date: Date) => [date.getUTCFullYear(), pad(date.getUTCMonth() + 1), pad(date.getUTCDate())].join('-');
const fromKey = (key: string) => new Date(key + 'T12:00:00Z');
const monthName = (year: number, month: number) => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month, 1)));
const fullDay = (key: string) => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(fromKey(key));
const shortDay = (key: string) => new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(fromKey(key));
const displayDuration = (n: number) => n >= 60 ? Math.floor(n / 60) + 'h' + (n % 60 ? ' ' + (n % 60) + 'm' : '') : n + 'm';
const monday = (key: string) => {
  const date = fromKey(key); date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7)); return date;
};
const sameDay = (key: string) => workouts.filter(w => w.date === key);
const weekDays = (key: string) => Array.from({length:7},(_,i)=>{const d=monday(key);d.setUTCDate(d.getUTCDate()+i);return keyFromDate(d);});
const label = (w: Workout) => w.sport === 'STRENGTH' ? 'GYM' : w.sport;

function V2Mark() {
  return <span className="v2-wordmark">Train<span>GPT</span></span>;
}

function ProductHeader({active}: {active: 'Schedule' | 'Today'}) {
  const tabs = ['Plan','Schedule','Progress','Coach'];
  return <header className="v2-product-header">
    <V2Mark />
    <nav aria-label="Prototype product navigation" className="v2-product-tabs">
      {tabs.map(t=><span className={active==='Schedule'&&t==='Schedule'?'v2-nav-current':''} key={t}>{t}</span>)}
    </nav>
    <div className="v2-header-end">
      <span className="v2-connection"><span/> Strava connected</span>
      <span className="v2-avatar" aria-label="Example athlete">TG</span>
    </div>
  </header>;
}

function SmallWorkout({w,onClick,selected}: {w:Workout,onClick:()=>void,selected:boolean}) {
  return <button type="button" className={'v2-workout-mini'+(w.status==='completed'?' is-completed':'')+(selected?' is-active':'')} onClick={onClick} aria-label={w.title+' '+displayDuration(w.minutes)}>
    <span className="v2-workout-mini-top"><span>{label(w)}</span><span>{displayDuration(w.minutes)}</span></span>
    <span className="v2-workout-mini-title">{w.title}</span>
    {w.status==='completed' && <span className="v2-workout-mini-done"><Check size={10} strokeWidth={2.6}/> Completed</span>}
  </button>;
}

function MonthGrid({month,selectedDate,selectedWorkout,onPick}: {month:Date,selectedDate:string,selectedWorkout:string,onPick:(date:string,workout?:string)=>void}) {
  const year=month.getUTCFullYear(), m=month.getUTCMonth();
  const first=new Date(Date.UTC(year,m,1)); const offset=(first.getUTCDay()+6)%7;
  const numDays=new Date(Date.UTC(year,m+1,0)).getUTCDate();
  const rows=Math.ceil((numDays+offset)/7);
  const days=Array.from({length:rows*7},(_,i)=>{const d=new Date(Date.UTC(year,m,1+i-offset)); return d;});
  return <div className="v2-calendar" aria-label="Illustrative monthly training calendar">
    {['M','T','W','T','F','S','S'].map((day,i)=><div key={i} className="v2-weekday">{day}</div>)}
    {days.map(date=>{
      const key=keyFromDate(date), outside=date.getUTCMonth()!==m, chosen=selectedDate===key;
      return <div key={key} className={'v2-date-cell'+(outside?' is-outside':'')+(chosen?' is-selected':'')}>
        <button type="button" className="v2-date-number" aria-pressed={chosen} onClick={()=>onPick(key)}>
          {date.getUTCDate()}
        </button>
        <div className="v2-cell-sessions">{sameDay(key).map(w=><SmallWorkout key={w.id} w={w} selected={selectedWorkout===w.id} onClick={()=>onPick(key,w.id)}/>)}</div>
      </div>;
    })}
  </div>;
}

function ProgressTrack() {
  return <section className="v2-progress-track">
    <div className="v2-track-heading"><span>TRAINING BLOCK</span><span>06 / 16</span></div>
    <div className="v2-track-segments">{Array.from({length:16},(_,i)=><span key={i} className={i===5?'v2-track-now':i<5?'v2-track-past':''}/>)}</div>
    <div className="v2-track-captions"><span>Base</span><span>Build</span><span>Peak</span><span>Taper</span></div>
  </section>;
}

function WorkoutInspector({date,activeWorkout}: {date:string,activeWorkout:string}) {
  const day= sameDay(date); const current=day.find(w=>w.id===activeWorkout) ?? day[0];
  const total=day.reduce((a,b)=>a+b.minutes,0);
  return <aside className="v2-inspector">
    <div className="v2-inspector-hero">
      <p className="v2-eyebrow">DAY INSPECTOR <span>/</span> {shortDay(date).toUpperCase()}</p>
      <h2>{day.length===0?'Recovery day':day.length+' '+(day.length===1?'session':'sessions')}</h2>
      <p className="v2-inspector-sub">{day.length?displayDuration(total)+' of planned training':'No session scheduled'}</p>
      <div className="v2-inspector-graphic">
        <div className="v2-inspector-number">{day.length?pad(day.length):'00'}</div>
        
      </div>
    </div>
    <div className="v2-inspector-content">
      <div className="v2-inspector-sectionhead"><span>ON THE SCHEDULE</span><span>01 — {pad(Math.max(day.length,1))}</span></div>
      {day.length ? day.map((w,i)=><div className={'v2-inspector-row'+(current?.id===w.id?' selected':'')} key={w.id}>
        <span className="v2-inspector-index">{pad(i+1)}</span>
        <div className="v2-inspector-description">
          <p>{w.title}</p><span>{label(w)} <span className="v2-mid-dot">·</span> {displayDuration(w.minutes)}</span>
        </div>
        <span className="v2-status-indicator">{w.status==='completed'?<Check size={15}/>:<ArrowRight size={15}/>}</span>
      </div>) : <p className="v2-empty">A lighter day. No sessions planned.</p>}
      {current && <>
        <div className="v2-details-rule"/>
        <div className="v2-detail-columns">
          <div><span className="v2-meta-label">INTENT</span><strong>{current.focus}</strong></div>
          <div><span className="v2-meta-label">DURATION</span><strong>{displayDuration(current.minutes)}</strong></div>
          <div><span className="v2-meta-label">STATUS</span><strong>{current.status==='completed'?'Completed':'Planned'}</strong></div>
        </div>
        <div className="v2-editorial-note"><p className="v2-note-eyebrow">FROM YOUR COACH</p><p className="v2-note-copy">{current.description}</p></div>
      </>}
      <ProgressTrack/>
    </div>
  </aside>;
}

function SchedulePreview() {
  const [month,setMonth] = useState(new Date(Date.UTC(2026,10,1)));
  const [selectedDate,setSelectedDate] = useState('2026-11-11');
  const [selectedWorkout,setSelectedWorkout] = useState('w13');
  const [panelOpen,setPanelOpen] = useState(true);
  const [view,setView] = useState<'month'|'agenda'>('month');
  const changeMonth=(delta:number)=>{
    const next=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+delta,1));
    setMonth(next);setSelectedDate(keyFromDate(next));setSelectedWorkout('');
  };
  const onPick=(date:string,wid?:string)=>{
    setSelectedDate(date);setSelectedWorkout(wid??sameDay(date)[0]?.id??'');
  };
  const currentMonth=monthName(month.getUTCFullYear(),month.getUTCMonth());
  const agenda=workouts.filter(w=>w.date.startsWith([month.getUTCFullYear(),pad(month.getUTCMonth()+1)].join('-')));
  return <div className="v2-app v2-app-desktop">
    <ProductHeader active="Schedule"/>
    <div className="v2-content">
      <section className="v2-page-intro">
        <div><p className="v2-eyebrow">TRAINING <span>/</span> SCHEDULE</p><h1>{currentMonth}<span className="v2-page-accent">.</span></h1><p>Every session in context. Every week moving forward.</p></div>
        <div className="v2-schedule-actions"><span className="v2-small-context">OCEANSIDE 70.3 <span>/</span> BASE BLOCK</span>
          <button type="button" className="v2-subtle-action" onClick={()=>setPanelOpen(open=>!open)} aria-expanded={panelOpen}>{panelOpen?'Hide details':'Show details'} {panelOpen?<Minus size={14}/>:<Plus size={14}/>}</button>
        </div>
      </section>
      <div className={'v2-schedule-layout'+(!panelOpen?' v2-expanded':'')}>
        <div className="v2-calendar-pane">
          <div className="v2-calendar-toolbar">
            <div className="v2-toolbar-left"><span className="v2-calendar-title">YOUR MONTH</span><button aria-label="Previous month" onClick={()=>changeMonth(-1)}><ChevronLeft size={17}/></button><button aria-label="Next month" onClick={()=>changeMonth(1)}><ChevronRight size={17}/></button></div>
            <div className="v2-view-toggle"><button className={view==='month'?'selected':''} onClick={()=>setView('month')}>Month</button><button className={view==='agenda'?'selected':''} onClick={()=>setView('agenda')}>Agenda</button></div>
          </div>
          {view==='month'?<MonthGrid month={month} selectedDate={selectedDate} selectedWorkout={selectedWorkout} onPick={onPick}/>:
          <div className="v2-agenda">
            {agenda.map(w=><button key={w.id} onClick={()=>onPick(w.date,w.id)} className={'v2-agenda-row'+(selectedWorkout===w.id?' selected':'')}><span>{shortDay(w.date)}</span><strong>{w.title}</strong><small>{label(w)} / {displayDuration(w.minutes)}</small><ArrowRight size={16}/></button>)}
            {agenda.length===0&&<p className="v2-empty">No planned sessions in this month.</p>}
          </div>}
          <div className="v2-calendar-footer"><span><span className="v2-legend-dot"/> Completed</span><span>Illustrative data · Design study 01</span></div>
        </div>
        {panelOpen&&<WorkoutInspector date={selectedDate} activeWorkout={selectedWorkout}/>}
      </div>
    </div>
  </div>;
}

function WeekSelect({active,onPick}: {active:string,onPick:(key:string)=>void}) {
  const keys=weekDays(active);
  return <div className="v2-mobile-week">{keys.map(key=><button type="button" key={key} onClick={()=>onPick(key)} aria-pressed={active===key} className={active===key?'active':''}><span>{new Intl.DateTimeFormat('en-US',{weekday:'short',timeZone:'UTC'}).format(fromKey(key)).slice(0,1)}</span><strong>{fromKey(key).getUTCDate()}</strong>{sameDay(key).some(w=>w.status==='completed')&&<i/>}</button>)}</div>;
}

function MobileToday() {
  const [date,setDate]=useState('2026-11-11');
  const [expanded,setExpanded]=useState<string|null>('w13');
  const sessions=sameDay(date);
  const total=sessions.reduce((a,w)=>a+w.minutes,0);
  const caption=new Intl.DateTimeFormat('en-US',{weekday:'long',timeZone:'UTC'}).format(fromKey(date));
  const dateCaption=new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',timeZone:'UTC'}).format(fromKey(date));
  return <div className="v2-mobile-stage">
    <div className="v2-phone">
      <div className="v2-phone-status"><span>9:41</span><div className="v2-dynamic-island"/><span>●●● ▰</span></div>
      <div className="v2-phone-body">
        <div className="v2-phone-top"><V2Mark/><span>• •</span></div>
        <p className="v2-eyebrow">WEEK 06 <span>/</span> BASE</p>
        <div className="v2-phone-title"><p>{caption},</p><h2>{dateCaption}<span>.</span></h2></div>
        <p className="v2-phone-subtitle">{sessions.length?sessions.length+' sessions ahead · '+displayDuration(total)+' planned':'Time to recover'}</p>
        <WeekSelect active={date} onPick={key=>{setDate(key);setExpanded(sameDay(key)[0]?.id??null);}}/>
        <div className="v2-phone-divider"/>
        <div className="v2-mobile-sectionheading"><span>TODAY'S WORK</span><span>{pad(sessions.length)} / {pad(sessions.length)}</span></div>
        {sessions.map((w,i)=><button key={w.id} type="button" onClick={()=>setExpanded(prev=>prev===w.id?null:w.id)} aria-expanded={expanded===w.id} className={'v2-mobile-workout'+(expanded===w.id?' is-open':'')}>
          <div className="v2-mobile-workout-summary"><span className="v2-mobile-workout-index">{pad(i+1)}</span><div><span className="v2-mobile-workout-sport">{label(w)} <span>•</span> {displayDuration(w.minutes)}</span><h3>{w.title}</h3></div><ChevronDown size={17}/></div>
          {expanded===w.id&&<div className="v2-mobile-expanded"><div><span>INTENT</span><strong>{w.focus}</strong></div><div><span>SESSION NOTE</span><p>{w.description}</p></div></div>}
        </button>)}
        {!sessions.length&&<div className="v2-mobile-rest"><p>Room to recover.</p><span>The next session is part of the plan, too.</span></div>}
        <div className="v2-mobile-coach"><p className="v2-note-eyebrow">COACH'S NOTE</p><p className="v2-phone-editorial">{sessions.length?'Progress comes from stacking ordinary days, consistently.':'Recovery is part of getting stronger.'}</p><span>TRAIN THE LONG GAME <ArrowDownRight size={14}/></span></div>
      </div>
      <div className="v2-bottom-nav"><div>Plan</div><div className="active">Today</div><div>Progress</div><div>Coach</div></div>
    </div>
  </div>;
}

function DesignSystemPreview() {
  const swatches=[['Ink','#161820','Primary text'],['Paper','#FFFFFF','Primary surface'],['Mist','#F5F6F8','Secondary'],['Line','#E5E7EC','Structure'],['Blue','#435CF4','Focus / action'],['Success','#1C8563','Completion']];
  return <div className="v2-system">
    <div className="v2-system-head"><p className="v2-eyebrow">TRAIN GPT <span>/</span> VISUAL SYSTEM 01</p><h1>Quiet intelligence<span>.</span></h1><p>A training instrument, not a fitness dashboard. Clarity first. Character through type, information, and motion.</p></div>
    <div className="v2-system-divider"/>
    <section className="v2-system-section"><div><span>01 / COLOUR</span><h2>Color makes meaning.</h2></div><div className="v2-swatches">{swatches.map(([name,color,usage])=><div key={name}><div style={{background:color}} className="v2-swatch"/><strong>{name}</strong><span>{color}</span><small>{usage}</small></div>)}</div></section>
    <section className="v2-system-section"><div><span>02 / TYPOGRAPHY</span><h2>Precision with a human voice.</h2></div><div className="v2-type-showcase"><p className="v2-system-type-hero">Tomorrow starts today.</p><p className="v2-system-type-detail">35 min <span>Easy aerobic run</span></p><p className="v2-system-type-editorial">The work you do consistently is what makes the difference.</p></div></section>
    <section className="v2-system-section"><div><span>03 / COMPONENTS</span><h2>No decoration for decoration's sake.</h2></div><div className="v2-components-demo"><div className="v2-system-button-demo"><span>Selected state</span><span className="v2-example-action">Continue <ArrowRight size={14}/></span></div><div className="v2-system-sample-workout"><span>01</span><div><small>RUN / 35 MIN</small><strong>Easy aerobic</strong></div><Check size={16}/></div><div className="v2-system-progress-demo"><span>BASE / BUILD / PEAK / TAPER</span><ProgressTrack/></div></div></section>
    <footer className="v2-system-footer">Linear / structure. Granola / personality. Framer / composition. TrainGPT / training intelligence.</footer>
  </div>;
}

export default function TrainGPTDesignPreview() {
  const [screen,setScreen]=useState<Screen>('schedule');
  const {title,description}=useMemo(()=>({
    schedule:{title:'Desktop Schedule',description:'Months, sessions, and decisions'},
    today:{title:'Mobile Today',description:'The day, not the dashboard'},
    system:{title:'Design foundation',description:'Visual rules for every surface'}
  }[screen]),[screen]);
  return <main className="v2-preview-root">
    <div className="v2-review-bar">
      <div className="v2-review-mark"><span className="v2-review-dot"/> TRAIN GPT <span>/ DESIGN EXPLORATION 01</span></div>
      <nav aria-label="Design previews">
        <button type="button" className={screen==='schedule'?'active':''} onClick={()=>setScreen('schedule')}>Desktop Schedule</button>
        <button type="button" className={screen==='today'?'active':''} onClick={()=>setScreen('today')}>Mobile Today</button>
        <button type="button" className={screen==='system'?'active':''} onClick={()=>setScreen('system')}>System</button>
      </nav>
      <span className="v2-review-status">Concept · Not live</span>
    </div>
    <div className="v2-review-heading"><div><p>VISUAL IDENTITY / 01</p><h2>{title}</h2></div><span>{description}</span></div>
    {screen==='schedule'?<SchedulePreview/>:screen==='today'?<MobileToday/>:<DesignSystemPreview/>}
    <footer className="v2-review-footer"><span>TrainGPT / Quiet intelligence</span><span>Prototype only · Sample training data · No account changes</span></footer>
  </main>;
}

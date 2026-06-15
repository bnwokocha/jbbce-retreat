import React, { useState } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, setDoc, deleteField } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { useCollection } from '../hooks/useCollection';
import { TRIP_DAYS, MEAL_TYPES, MEAL_OPTIONS, fmt12, fmtFull, fmtDOW, fmtMon, dayKey, isNightEvent, safeUrl } from '../constants';
import Modal from '../components/Modal';
import Avatar from '../components/Avatar';
import PlaceInput from '../components/PlaceInput';
import { CalendarIcon, UtensilsIcon, LightbulbIcon, SunIcon, MoonIcon } from '../components/Icons';

export default function EventsPage() {
  const { profile } = useAuth();
  const { docs: events } = useCollection('events');
  const { docs: ideas } = useCollection('ideas');
  const { docs: users } = useCollection('users');
  const { docs: meals } = useCollection('meals');
  const [sub, setSub] = useState('calendar');
  const [selDay, setSelDay] = useState(0);
  const [filter, setFilter] = useState('all');
  const isAdmin = profile?.admin;

  const eventsForDay = (idx) => events.filter(ev => {
    if (!(ev.recurring || ev.dayIdx === idx)) return false;
    if (filter === 'night') return isNightEvent(ev);
    if (filter === 'day') return !isNightEvent(ev);
    return true;
  }).sort((a,b) => (a.time||'').localeCompare(b.time||''));

  return (
    <div className="page">
      <div className="stabs">
        <button className={`stab ${sub==='calendar'?'active':''}`} onClick={()=>setSub('calendar')}><CalendarIcon size={13}/>Calendar</button>
        <button className={`stab ${sub==='meals'?'active':''}`} onClick={()=>setSub('meals')}><UtensilsIcon size={13}/>Meals</button>
        <button className={`stab ${sub==='ideas'?'active':''}`} onClick={()=>setSub('ideas')}>
          <LightbulbIcon size={13}/>Propose &amp; vote{ideas.length>0 && <span className="notif-dot">{ideas.length}</span>}
        </button>
      </div>

      {sub==='calendar' && (
        <div className="events-layout">
          <div className="events-main">
            <div className="btn-row" style={{marginBottom:10}}>
              {[['all',null,'All'],['day',SunIcon,'Day'],['night',MoonIcon,'Night (after 4pm)']].map(([f,Icon,l]) => (
                <button key={f} className="btn-mini" style={{display:'inline-flex',alignItems:'center',gap:4,...(filter===f?{borderColor:'var(--ocean)',color:'var(--ocean)',fontWeight:'bold'}:{})}}
                  onClick={()=>setFilter(f)}>{Icon && <Icon size={12}/>}{l}</button>
              ))}
            </div>
            <div className="day-strip">
              {TRIP_DAYS.map((d,i) => (
                <div key={i} className={`day-chip ${i===selDay?'active':''} ${dayKey(d)===dayKey(new Date())?'today':''}`} onClick={()=>setSelDay(i)}>
                  <div className="dow">{fmtDOW(d)}</div>
                  <div className="dn">{d.getDate()}</div>
                  <div className="dmo">{fmtMon(d)}</div>
                  <div className="ec">{eventsForDay(i).length}</div>
                </div>
              ))}
            </div>
            <EventList events={eventsForDay(selDay)} users={users} profile={profile} selDay={selDay} isAdmin={isAdmin} />
            <AddEventForm profile={profile} />
          </div>
          <div className="ideas-sidebar">
            <div style={{fontWeight:'bold',color:'var(--ocean)',fontSize:13,marginBottom:8,display:'flex',alignItems:'center',gap:5}}>
              <LightbulbIcon size={14}/>Proposed ideas{ideas.length>0 && <span className="notif-dot">{ideas.length}</span>}
            </div>
            <IdeasSidebar ideas={ideas} users={users} profile={profile} isAdmin={isAdmin} />
          </div>
        </div>
      )}

      {sub==='meals' && <MealsTab meals={meals} users={users} profile={profile} isAdmin={isAdmin} />}
      {sub==='ideas' && <IdeasTab ideas={ideas} users={users} profile={profile} isAdmin={isAdmin} />}
    </div>
  );
}

/* ============ EVENT LIST — per-day RSVP for recurring, working edit, duplicate ============ */
function EventList({ events, users, profile, selDay, isAdmin }) {
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(null); // separate state — THIS was the edit bug

  // RSVP: recurring events store per-day under rsvpsByDay[dayIdx]; one-time events use rsvps
  function getRsvp(ev, uid) {
    if (ev.recurring) return ev.rsvpsByDay?.[selDay]?.[uid] || 'none';
    return ev.rsvps?.[uid] || 'none';
  }
  async function setRsvp(ev, status) {
    try {
      if (ev.recurring) {
        await updateDoc(doc(db,'events',ev.id), { [`rsvpsByDay.${selDay}.${profile.uid}`]: status });
      } else {
        await updateDoc(doc(db,'events',ev.id), { [`rsvps.${profile.uid}`]: status });
      }
    } catch {
      alert('RSVP didn\'t save — check your connection and try again.');
    }
  }
  async function duplicateEvent(ev, dayIdx) {
    const copy = { ...ev, dayIdx, recurring: false, rsvps: {}, rsvpsByDay: {}, owner: profile.uid, createdAt: new Date().toISOString() };
    delete copy.id;
    await addDoc(collection(db,'events'), copy);
    alert(`Copied to ${fmtDOW(TRIP_DAYS[dayIdx])} ${fmtMon(TRIP_DAYS[dayIdx])} ${TRIP_DAYS[dayIdx].getDate()}`);
  }

  if (events.length === 0) return <div className="empty-note">Wide open this day — nothing booked in this filter.</div>;

  return events.map(ev => {
    const my = getRsvp(ev, profile?.uid);
    const going = users.filter(u => getRsvp(ev, u.uid) === 'going');
    const canEdit = isAdmin || ev.owner === profile?.uid;
    const isOpen = expanded === ev.id;
    const isEditing = editing === ev.id;
    return (
      <div key={ev.id} className="card">
        <div className="card-head" onClick={() => setExpanded(isOpen ? null : ev.id)}>
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginBottom:3}}>
              <span className="card-title">{ev.title}</span>
              {isNightEvent(ev) && <span className="badge badge-p">night</span>}
              {ev.recurring && <span className="badge badge-o">daily</span>}
              {ev.strict && <span className="strict-flag">⏱ strict</span>}
            </div>
            <div className="card-sub">{ev.time?fmt12(ev.time):'TBD'}{ev.cost?` · ${ev.cost}`:''}{going.length>0?` · ${going.length} going${ev.recurring?' today':''}`:''}</div>
            <div className="avatar-row" style={{marginTop:3}}>
              {going.map(u => <Avatar key={u.uid} user={u} size={24} />)}
            </div>
          </div>
          <span className={`chev ${isOpen?'open':''}`}>▼</span>
        </div>
        {isOpen && (
          <div className="card-body" style={{paddingTop:11}}>
            <div style={{fontSize:13,color:'var(--muted)',marginBottom:8}}>{ev.desc}</div>
            <div className="grid2">
              <div><div style={{fontSize:11,color:'var(--muted)'}}>WHEN</div>
                <div style={{fontSize:14}}>{ev.recurring?'Every day':fmtFull(TRIP_DAYS[ev.dayIdx||0])}{ev.time?` at ${fmt12(ev.time)}`:''}</div></div>
              <div><div style={{fontSize:11,color:'var(--muted)'}}>COST</div><div style={{fontSize:14}}>{ev.cost||'—'}</div></div>
            </div>
            {ev.loc && <div style={{marginTop:5}}><span style={{fontSize:11,color:'var(--muted)'}}>WHERE: </span>{ev.loc}</div>}
            {safeUrl(ev.url) && <div style={{marginTop:5}}><a href={safeUrl(ev.url)} target="_blank" rel="noopener noreferrer" className="link-url">{ev.url} ↗</a></div>}

            {ev.recurring && (
              <div className="tip-box" style={{marginTop:8,marginBottom:4}}>
                📅 Daily event — your RSVP below applies to <b>{fmtFull(TRIP_DAYS[selDay])}</b> only. Switch days on the strip above to RSVP per day.
              </div>
            )}

            {/* Everyone's status for this day */}
            <div className="avatar-row" style={{marginTop:6}}>
              {users.map(u => {
                const s = getRsvp(ev, u.uid);
                return <Avatar key={u.uid} user={u} size={26} status={s==='none'?'out':s} />;
              })}
            </div>

            <div className="rsvp-row">
              <button className={`rsvp-btn ${my==='going'?'going':''}`} onClick={()=>setRsvp(ev,'going')}>✓ Going{ev.recurring?' today':''}</button>
              <button className={`rsvp-btn ${my==='maybe'?'maybe':''}`} onClick={()=>setRsvp(ev,'maybe')}>? Maybe</button>
              <button className={`rsvp-btn ${my==='out'?'out':''}`} onClick={()=>setRsvp(ev,'out')}>✗ Out{ev.recurring?' today':''}</button>
            </div>
            <div className="btn-row" style={{marginTop:9}}>
              <button className="btn-mini" onClick={()=>calExport(ev, selDay)}>📅 Calendar</button>
              <select value="" style={{width:'auto',fontSize:12,padding:'5px 10px',color:'var(--muted)',borderRadius:8}}
                onChange={e=>{if(e.target.value!=='')duplicateEvent(ev, parseInt(e.target.value));}}>
                <option value="">📋 Repeat on day…</option>
                {TRIP_DAYS.map((d,i)=><option key={i} value={i}>{fmtDOW(d)} {fmtMon(d)} {d.getDate()}</option>)}
              </select>
              {canEdit && <button className="btn-mini" onClick={()=>setEditing(isEditing?null:ev.id)}>✏️ Edit</button>}
              {canEdit && <button className="btn btn-danger" onClick={async()=>{if(window.confirm('Delete this event?'))await deleteDoc(doc(db,'events',ev.id));}}>🗑</button>}
            </div>
            {isEditing && <EditEventForm ev={ev} onDone={()=>setEditing(null)} />}
          </div>
        )}
      </div>
    );
  });
}

function calExport(ev, selDay) {
  const di = ev.recurring ? selDay : (ev.dayIdx||0);
  const d = TRIP_DAYS[di];
  const [h,m] = (ev.time||'10:00').split(':').map(Number);
  const st = new Date(d); st.setHours(h,m,0,0);
  const en = new Date(st.getTime()+2*3600000);
  const z = n => String(n).padStart(2,'0');
  const ic = dt => `${dt.getFullYear()}${z(dt.getMonth()+1)}${z(dt.getDate())}T${z(dt.getHours())}${z(dt.getMinutes())}00`;
  const b = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART:${ic(st)}\nDTEND:${ic(en)}\nSUMMARY:${ev.title}\nLOCATION:${ev.loc||'Provincetown'}\nDESCRIPTION:${(ev.desc||'').replace(/\n/g,' ')}\nEND:VEVENT\nEND:VCALENDAR`;
  const url = URL.createObjectURL(new Blob([b],{type:'text/calendar'}));
  const a = document.createElement('a'); a.href=url; a.download=ev.title.replace(/[^a-z0-9]/gi,'_')+'.ics'; a.click();
  URL.revokeObjectURL(url);
}

function EditEventForm({ ev, onDone }) {
  const [form, setForm] = useState({
    title: ev.title||'', time: ev.time||'', cost: ev.cost||'', loc: ev.loc||'',
    url: ev.url||'', desc: ev.desc||'', dayIdx: ev.dayIdx!=null?String(ev.dayIdx):'0', strict: !!ev.strict,
  });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  async function save() {
    const upd = { title:form.title, time:form.time, cost:form.cost, loc:form.loc, url:form.url, desc:form.desc, strict:form.strict };
    if (!ev.recurring) upd.dayIdx = parseInt(form.dayIdx);
    await updateDoc(doc(db,'events',ev.id), upd);
    onDone();
  }
  return (
    <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid var(--border)'}}>
      <div className="form-group"><label>Title</label><input value={form.title} onChange={e=>set('title',e.target.value)} /></div>
      <div className="grid2">
        {!ev.recurring && <div className="form-group"><label>Day</label>
          <select value={form.dayIdx} onChange={e=>set('dayIdx',e.target.value)}>
            {TRIP_DAYS.map((d,i)=><option key={i} value={i}>{fmtDOW(d)} {fmtMon(d)} {d.getDate()}</option>)}
          </select></div>}
        <div className="form-group"><label>Time</label><input type="time" value={form.time} onChange={e=>set('time',e.target.value)} /></div>
        <div className="form-group"><label>Cost</label><input value={form.cost} onChange={e=>set('cost',e.target.value)} /></div>
      </div>
      <div className="form-group"><label><input type="checkbox" checked={form.strict} onChange={e=>set('strict',e.target.checked)} style={{width:'auto',marginRight:6}} />Strict leaving time</label></div>
      <div className="form-group"><label>Location</label><PlaceInput value={form.loc} onChange={v=>set('loc',v)} /></div>
      <div className="form-group"><label>Link</label><input value={form.url} onChange={e=>set('url',e.target.value)} /></div>
      <div className="form-group"><label>Details</label><textarea value={form.desc} onChange={e=>set('desc',e.target.value)} /></div>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={save}>Save changes</button>
        <button className="btn-mini" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

function AddEventForm({ profile }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title:'',dayIdx:'0',time:'',recurring:false,strict:false,cost:'',url:'',loc:'',desc:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  async function submit(e) {
    e.preventDefault();
    await addDoc(collection(db,'events'), {
      ...form, dayIdx: form.recurring?null:parseInt(form.dayIdx),
      rsvps:{}, rsvpsByDay:{}, owner: profile.uid, ownerName: profile.displayName, createdAt: new Date().toISOString(),
    });
    setForm({title:'',dayIdx:'0',time:'',recurring:false,strict:false,cost:'',url:'',loc:'',desc:''});
    setOpen(false);
  }
  return (
    <div className="card" style={{marginTop:8}}>
      <div className="card-head" onClick={()=>setOpen(!open)}>
        <div className="card-title">+ Add an event</div><span className={`chev ${open?'open':''}`}>▼</span>
      </div>
      {open && <div className="card-body" style={{paddingTop:12}}>
        <form onSubmit={submit}>
          <div className="form-group"><label>Event name</label><input value={form.title} onChange={e=>set('title',e.target.value)} required /></div>
          <div className="grid2">
            <div className="form-group"><label>Day</label>
              <select value={form.dayIdx} onChange={e=>set('dayIdx',e.target.value)} disabled={form.recurring}>
                {TRIP_DAYS.map((d,i)=><option key={i} value={i}>{fmtDOW(d)} {fmtMon(d)} {d.getDate()}</option>)}
              </select></div>
            <div className="form-group"><label>Time</label><input type="time" value={form.time} onChange={e=>set('time',e.target.value)} /></div>
          </div>
          <div className="form-group"><label><input type="checkbox" checked={form.recurring} onChange={e=>set('recurring',e.target.checked)} style={{width:'auto',marginRight:6}} />Repeats every day</label></div>
          <div className="form-group"><label><input type="checkbox" checked={form.strict} onChange={e=>set('strict',e.target.checked)} style={{width:'auto',marginRight:6}} />Strict leaving time</label></div>
          <div className="grid2">
            <div className="form-group"><label>Cost</label><input value={form.cost} onChange={e=>set('cost',e.target.value)} /></div>
            <div className="form-group"><label>Tickets / website</label><input value={form.url} onChange={e=>set('url',e.target.value)} placeholder="https://..." /></div>
          </div>
          <div className="form-group"><label>Location</label><PlaceInput value={form.loc} onChange={v=>set('loc',v)} /></div>
          <div className="form-group"><label>Details</label><textarea value={form.desc} onChange={e=>set('desc',e.target.value)} /></div>
          <button className="btn btn-primary" type="submit">Add event</button>
        </form>
      </div>}
    </div>
  );
}

/* ============ IDEAS — collaborative editing, voter avatars, my-vote indicator ============ */
function IdeasSidebar({ ideas, users, profile, isAdmin }) {
  if (!ideas.length) return <div style={{fontSize:12,color:'var(--muted)'}}>Nothing proposed yet — float an idea for the crew to vote on.</div>;
  return ideas.map(idea => {
    const yesUsers = users.filter(u => idea.votes?.[u.uid]==='yes');
    const noUsers = users.filter(u => idea.votes?.[u.uid]==='no');
    const mv = idea.votes?.[profile?.uid];
    const canP = isAdmin || idea.by === profile?.uid;
    return (
      <div key={idea.id} className="idea-card">
        <div style={{fontWeight:'bold',fontSize:13}}>{idea.title}</div>
        <div style={{fontSize:11,color:'var(--muted)'}}>by {idea.byName}</div>
        <div style={{fontSize:11,margin:'4px 0',display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <span style={{display:'inline-flex',alignItems:'center',gap:2}}>👍 {yesUsers.map(u=><Avatar key={u.uid} user={u} size={17} />)}{yesUsers.length===0&&'0'}</span>
          <span style={{display:'inline-flex',alignItems:'center',gap:2}}>👎 {noUsers.map(u=><Avatar key={u.uid} user={u} size={17} />)}{noUsers.length===0&&'0'}</span>
        </div>
        {mv && <div style={{fontSize:10,color:'var(--ocean)',marginBottom:4}}>Your vote: {mv==='yes'?'👍 Yes':'👎 No'}</div>}
        <div className="btn-row">
          <button className="btn-mini" style={mv==='yes'?{borderColor:'var(--sage)',color:'var(--sage)',fontWeight:'bold'}:{}}
            onClick={async()=>await updateDoc(doc(db,'ideas',idea.id),{[`votes.${profile.uid}`]:mv==='yes'?null:'yes'})}>👍</button>
          <button className="btn-mini" style={mv==='no'?{borderColor:'var(--coral)',color:'var(--coral)',fontWeight:'bold'}:{}}
            onClick={async()=>await updateDoc(doc(db,'ideas',idea.id),{[`votes.${profile.uid}`]:mv==='no'?null:'no'})}>👎</button>
          {canP && <button className="btn-mini" onClick={async()=>{
            await addDoc(collection(db,'events'),{title:idea.title,dayIdx:idea.suggestedDayIdx??0,time:idea.suggestedTime||'',recurring:false,strict:false,cost:idea.cost||'',url:idea.url||'',loc:idea.loc||'',desc:idea.desc||'',rsvps:{},rsvpsByDay:{},owner:idea.by,ownerName:idea.byName,createdAt:new Date().toISOString()});
            await deleteDoc(doc(db,'ideas',idea.id));
          }}>→ Add</button>}
        </div>
      </div>
    );
  });
}

function IdeasTab({ ideas, users, profile, isAdmin }) {
  const [expanded, setExpanded] = useState(null);
  const [editingIdea, setEditingIdea] = useState(null);
  const [comment, setComment] = useState('');
  const [form, setForm] = useState({ title:'',desc:'',suggestedDayIdx:'',suggestedTime:'',cost:'',url:'',loc:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  async function submit(direct) {
    if (!form.title.trim()) { alert('Give it a name!'); return; }
    const base = {
      title: form.title, desc: form.desc,
      suggestedDayIdx: form.suggestedDayIdx!==''?parseInt(form.suggestedDayIdx):null,
      suggestedTime: form.suggestedTime||'', cost: form.cost, url: form.url, loc: form.loc,
    };
    if (direct) {
      await addDoc(collection(db,'events'),{title:base.title,dayIdx:base.suggestedDayIdx??0,time:base.suggestedTime,recurring:false,strict:false,cost:base.cost,url:base.url,loc:base.loc,desc:base.desc,rsvps:{},rsvpsByDay:{},owner:profile.uid,ownerName:profile.displayName,createdAt:new Date().toISOString()});
      alert(`"${form.title}" added straight to Events!`);
    } else {
      await addDoc(collection(db,'ideas'),{...base,by:profile.uid,byName:profile.displayName,votes:{},comments:[],createdAt:new Date().toISOString()});
    }
    setForm({title:'',desc:'',suggestedDayIdx:'',suggestedTime:'',cost:'',url:'',loc:''});
  }

  async function saveIdeaEdit(idea, edits) {
    await updateDoc(doc(db,'ideas',idea.id), edits);
    setEditingIdea(null);
  }

  return (
    <div>
      <div className="section-sub">Propose an idea. Anyone can refine the details — add times, locations, costs. Vote and comment below.</div>
      <div className="card">
        <div className="card-head"><div className="card-title">+ Propose an idea</div></div>
        <div className="card-body" style={{paddingTop:12}}>
          <div className="form-group"><label>Idea name</label><input value={form.title} onChange={e=>set('title',e.target.value)} /></div>
          <div className="form-group"><label>Description</label><textarea value={form.desc} onChange={e=>set('desc',e.target.value)} /></div>
          <div className="grid2">
            <div className="form-group"><label>Suggested day</label>
              <select value={form.suggestedDayIdx} onChange={e=>set('suggestedDayIdx',e.target.value)}>
                <option value="">TBD</option>
                {TRIP_DAYS.map((d,i)=><option key={i} value={i}>{fmtDOW(d)} {fmtMon(d)} {d.getDate()}</option>)}
              </select></div>
            <div className="form-group"><label>Suggested time</label><input type="time" value={form.suggestedTime} onChange={e=>set('suggestedTime',e.target.value)} /></div>
          </div>
          <div className="grid2">
            <div className="form-group"><label>Est. cost</label><input value={form.cost} onChange={e=>set('cost',e.target.value)} /></div>
            <div className="form-group"><label>Link</label><input value={form.url} onChange={e=>set('url',e.target.value)} placeholder="https://..." /></div>
          </div>
          <div className="form-group"><label>Location</label><PlaceInput value={form.loc} onChange={v=>set('loc',v)} placeholder="optional" /></div>
          <div className="btn-row">
            <button className="btn btn-secondary" onClick={()=>submit(false)}>Send to the boys for a vote 🗳</button>
            <button className="btn btn-primary" onClick={()=>submit(true)}>Add straight to Events ↗</button>
          </div>
        </div>
      </div>

      {ideas.length===0 && <div className="empty-note">Nothing proposed yet — float a show or a dinner and the crew votes.</div>}
      {ideas.map(idea => {
        const yesUsers = users.filter(u=>idea.votes?.[u.uid]==='yes');
        const noUsers = users.filter(u=>idea.votes?.[u.uid]==='no');
        const undecided = users.length - yesUsers.length - noUsers.length;
        const mv = idea.votes?.[profile?.uid];
        const canPromote = isAdmin || idea.by === profile?.uid;
        const isOpen = expanded === idea.id;
        const isEditing = editingIdea === idea.id;
        return (
          <div key={idea.id} className="card">
            <div className="card-head" onClick={()=>{setExpanded(isOpen?null:idea.id);setComment('');}}>
              <div>
                <div className="card-title">{idea.title}</div>
                <div className="card-sub">
                  proposed by <b>{idea.byName}</b>
                  {idea.suggestedDayIdx!=null && ` · ${fmtDOW(TRIP_DAYS[idea.suggestedDayIdx])} ${fmtMon(TRIP_DAYS[idea.suggestedDayIdx])} ${TRIP_DAYS[idea.suggestedDayIdx].getDate()}`}
                  {idea.suggestedTime && ` ${fmt12(idea.suggestedTime)}`}
                  {idea.cost && ` · ${idea.cost}`}
                </div>
                {mv && <span className="badge badge-o" style={{marginTop:3}}>You voted: {mv==='yes'?'👍 Yes':'👎 No'}</span>}
              </div>
              <span className={`chev ${isOpen?'open':''}`}>▼</span>
            </div>
            {isOpen && (
              <div className="card-body" style={{paddingTop:11}}>
                {!isEditing ? (
                  <>
                    <div style={{fontSize:13,color:'var(--muted)',marginBottom:6}}>{idea.desc}</div>
                    {idea.loc && <div style={{fontSize:13}}>📍 {idea.loc}</div>}
                    {safeUrl(idea.url) && <a href={safeUrl(idea.url)} target="_blank" rel="noopener noreferrer" className="link-url">{idea.url} ↗</a>}
                    <button className="btn-mini" style={{marginTop:8}} onClick={()=>setEditingIdea(idea.id)}>✏️ Refine details (anyone can edit)</button>
                  </>
                ) : (
                  <IdeaEditForm idea={idea} onSave={saveIdeaEdit} onCancel={()=>setEditingIdea(null)} />
                )}

                {/* Votes with avatars */}
                <div style={{marginTop:12,display:'flex',gap:18,flexWrap:'wrap'}}>
                  <div>
                    <div style={{fontSize:11,color:'var(--sage)',fontWeight:'bold'}}>👍 YES ({yesUsers.length})</div>
                    <div style={{display:'flex',gap:3,marginTop:3}}>
                      {yesUsers.map(u=><Avatar key={u.uid} user={u} size={22} />)}
                      {yesUsers.length===0 && <span style={{fontSize:11,color:'var(--muted)'}}>nobody yet</span>}
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:11,color:'var(--coral)',fontWeight:'bold'}}>👎 NO ({noUsers.length})</div>
                    <div style={{display:'flex',gap:3,marginTop:3}}>
                      {noUsers.map(u=><Avatar key={u.uid} user={u} size={22} />)}
                      {noUsers.length===0 && <span style={{fontSize:11,color:'var(--muted)'}}>nobody yet</span>}
                    </div>
                  </div>
                  <div style={{fontSize:11,color:'var(--muted)',alignSelf:'flex-end'}}>{undecided} undecided</div>
                </div>

                <div className="rsvp-row">
                  <button className={`rsvp-btn ${mv==='yes'?'going':''}`}
                    onClick={async()=>await updateDoc(doc(db,'ideas',idea.id),{[`votes.${profile.uid}`]:mv==='yes'?null:'yes'})}>👍 Yes!</button>
                  <button className={`rsvp-btn ${mv==='no'?'out':''}`}
                    onClick={async()=>await updateDoc(doc(db,'ideas',idea.id),{[`votes.${profile.uid}`]:mv==='no'?null:'no'})}>👎 Nope</button>
                </div>

                {/* Comments with names + avatars */}
                <div style={{marginTop:12}}>
                  <div style={{fontSize:12,fontWeight:'bold',marginBottom:5}}>Comments & suggestions</div>
                  {(idea.comments||[]).map((c,i) => {
                    const cu = users.find(u=>u.uid===c.by);
                    return (
                      <div key={i} style={{fontSize:12,padding:'5px 0',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'baseline',gap:5}}>
                        <Avatar user={cu} size={18} /> <span><b>{c.byName}:</b> {c.text}</span>
                      </div>
                    );
                  })}
                  <div style={{display:'flex',gap:6,marginTop:7}}>
                    <input placeholder="Add a comment..." value={expanded===idea.id?comment:''} onChange={e=>setComment(e.target.value)} />
                    <button className="btn-mini" onClick={async()=>{
                      if(!comment.trim())return;
                      await updateDoc(doc(db,'ideas',idea.id),{comments:[...(idea.comments||[]),{by:profile.uid,byName:profile.displayName,text:comment.trim(),at:new Date().toISOString()}]});
                      setComment('');
                    }}>Send</button>
                  </div>
                </div>

                {canPromote && (
                  <div className="btn-row" style={{marginTop:12}}>
                    <button className="btn btn-primary" style={{fontSize:12}} onClick={async()=>{
                      await addDoc(collection(db,'events'),{title:idea.title,dayIdx:idea.suggestedDayIdx??0,time:idea.suggestedTime||'',recurring:false,strict:false,cost:idea.cost||'',url:idea.url||'',loc:idea.loc||'',desc:idea.desc||'',rsvps:{},rsvpsByDay:{},owner:idea.by,ownerName:idea.byName,createdAt:new Date().toISOString()});
                      await deleteDoc(doc(db,'ideas',idea.id));
                    }}>→ Add to Events{idea.suggestedDayIdx!=null?` (${fmtDOW(TRIP_DAYS[idea.suggestedDayIdx])} ${TRIP_DAYS[idea.suggestedDayIdx].getDate()})`:''}</button>
                    <button className="btn btn-danger" onClick={async()=>{if(window.confirm('Delete this idea?'))await deleteDoc(doc(db,'ideas',idea.id));}}>🗑 Delete</button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function IdeaEditForm({ idea, onSave, onCancel }) {
  const [f, setF] = useState({
    title: idea.title||'', desc: idea.desc||'',
    suggestedDayIdx: idea.suggestedDayIdx!=null?String(idea.suggestedDayIdx):'',
    suggestedTime: idea.suggestedTime||'', cost: idea.cost||'', url: idea.url||'', loc: idea.loc||'',
  });
  const set = (k,v) => setF(x=>({...x,[k]:v}));
  return (
    <div style={{marginTop:8}}>
      <div className="form-group"><label>Title</label><input value={f.title} onChange={e=>set('title',e.target.value)} /></div>
      <div className="form-group"><label>Description</label><textarea value={f.desc} onChange={e=>set('desc',e.target.value)} /></div>
      <div className="grid2">
        <div className="form-group"><label>Day</label>
          <select value={f.suggestedDayIdx} onChange={e=>set('suggestedDayIdx',e.target.value)}>
            <option value="">TBD</option>
            {TRIP_DAYS.map((d,i)=><option key={i} value={i}>{fmtDOW(d)} {fmtMon(d)} {d.getDate()}</option>)}
          </select></div>
        <div className="form-group"><label>Time</label><input type="time" value={f.suggestedTime} onChange={e=>set('suggestedTime',e.target.value)} /></div>
      </div>
      <div className="grid2">
        <div className="form-group"><label>Cost</label><input value={f.cost} onChange={e=>set('cost',e.target.value)} /></div>
        <div className="form-group"><label>Location</label><input value={f.loc} onChange={e=>set('loc',e.target.value)} /></div>
      </div>
      <div className="form-group"><label>Link</label><input value={f.url} onChange={e=>set('url',e.target.value)} /></div>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={()=>onSave(idea,{...f,suggestedDayIdx:f.suggestedDayIdx!==''?parseInt(f.suggestedDayIdx):null})}>Save</button>
        <button className="btn-mini" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/* ============ MEALS — visible votes, cooks selection, vote toggle, admin clear ============ */
function MealsTab({ meals, users, profile, isAdmin }) {
  const [voteModal, setVoteModal] = useState(null);
  const [pendingVote, setPendingVote] = useState('');

  function getMealDoc(mt, i) { return meals.find(m => m.id === `${mt}-${i}`); }
  function getWinner(mt, i) {
    const d = getMealDoc(mt, i);
    if (d?.final) return MEAL_OPTIONS.find(o=>o.value===d.final);
    const counts = {};
    Object.values(d?.votes||{}).forEach(v => { counts[v]=(counts[v]||0)+1; });
    let best='',bn=0;
    Object.entries(counts).forEach(([k,n])=>{if(n>bn){bn=n;best=k;}});
    return best ? MEAL_OPTIONS.find(o=>o.value===best) : null;
  }

  // ── CHANGED: toggle logic — same option = remove vote, different = update ──
  async function submitVote() {
    if (!voteModal) return;
    const mealRef = doc(db, 'meals', `${voteModal.mt}-${voteModal.i}`);
    const currentVote = getMealDoc(voteModal.mt, voteModal.i)?.votes?.[profile.uid];

    if (pendingVote && pendingVote !== currentVote) {
      // New vote or changed to a different option
      await setDoc(mealRef, { votes: { [profile.uid]: pendingVote } }, { merge: true });
    } else {
      // Tapped same option again, or cleared — remove the vote entirely
      await updateDoc(mealRef, { [`votes.${profile.uid}`]: deleteField() }).catch(async () => {
        // Doc may not exist yet — nothing to delete, that's fine
      });
    }
    setVoteModal(null);
    setPendingVote('');
  }

  async function setFinal(mt, i, val) {
    await setDoc(doc(db,'meals',`${mt}-${i}`), { final: val }, { merge: true });
  }
  async function setCooks(mt, i, cooks) {
    await setDoc(doc(db,'meals',`${mt}-${i}`), { cooks }, { merge: true });
  }

  // Admin: remove one person's vote
  async function clearVote(mt, i, uid) {
    await updateDoc(doc(db, 'meals', `${mt}-${i}`), { [`votes.${uid}`]: deleteField() });
  }

  const mealDoc = voteModal ? getMealDoc(voteModal.mt, voteModal.i) : null;
  const currentVoteInModal = mealDoc?.votes?.[profile?.uid] || '';

  return (
    <div>
      <div className="section-sub">Tap any cell to vote — tap your choice again to remove your vote. Everyone's votes are visible in the popup.</div>
      <div style={{overflowX:'auto'}}>
        <div className="mv-grid" style={{gridTemplateColumns:`80px repeat(${TRIP_DAYS.length}, 1fr)`}}>
          <div />
          {TRIP_DAYS.map((d,i)=><div key={i} className="mv-head">{fmtDOW(d)}<br/>{d.getDate()}</div>)}
          {MEAL_TYPES.map(mt => [
            <div key={mt} className="mv-label">{mt}</div>,
            ...TRIP_DAYS.map((_,i) => {
              const d = getMealDoc(mt,i);
              const myVote = d?.votes?.[profile?.uid] || '';
              const opt = myVote ? MEAL_OPTIONS.find(o=>o.value===myVote) : null;
              const w = getWinner(mt,i);
              const vc = Object.keys(d?.votes||{}).length;
              const cooks = (d?.cooks||[]).map(uid=>users.find(u=>u.uid===uid)).filter(Boolean);
              return (
                <div key={`${mt}-${i}`} className={`mv-cell ${myVote?'voted':''}`}
                  onClick={()=>{setVoteModal({mt,i});setPendingVote(myVote||'');}}>
                  {opt ? <div style={{fontSize:12}}>{opt.icon}</div> : <div style={{fontSize:9,color:'var(--muted)'}}>vote</div>}
                  {vc>0 && <div style={{fontSize:8,color:'var(--muted)'}}>{vc} voted</div>}
                  {w && <div className="mv-result">{w.icon}</div>}
                  {cooks.length>0 && <div style={{fontSize:9}}>{cooks.map(c=>c.avatar&&c.avatar!=='⭐'?c.avatar:'👤').join('')}</div>}
                </div>
              );
            })
          ])}
        </div>
      </div>
      <div style={{marginTop:10,fontSize:12,color:'var(--muted)'}}>
        <b>Options:</b> {MEAL_OPTIONS.map(o=>o.label).join(' · ')}
      </div>

      {isAdmin && (
        <div style={{marginTop:16}}>
          <div style={{fontWeight:'bold',color:'var(--ocean)',marginBottom:4}}>Set final plans & cooks (admin)</div>
          <div style={{fontSize:12,color:'var(--muted)',marginBottom:8}}>Pick the winning plan per meal. If it's a cook-at-home meal, select who's cooking — it shows on the Today page ("Brandon is cooking breakfast").</div>
          <div style={{overflowX:'auto'}}>
            <table className="cost-table" style={{minWidth:700}}>
              <thead><tr><th>Meal</th>{TRIP_DAYS.map((d,i)=><th key={i} style={{textAlign:'center',minWidth:90}}>{fmtDOW(d)} {d.getDate()}</th>)}</tr></thead>
              <tbody>
                {MEAL_TYPES.map(mt => (
                  <tr key={mt}>
                    <td style={{fontWeight:'bold'}}>{mt}</td>
                    {TRIP_DAYS.map((_,i) => {
                      const d = getMealDoc(mt,i);
                      const cur = d?.final || '';
                      const cooks = d?.cooks || [];
                      const showCooks = cur==='ill_cook' || cur==='house';
                      const existingVotes = Object.entries(d?.votes||{});
                      return (
                        <td key={i} style={{padding:3,verticalAlign:'top'}}>
                          <select style={{fontSize:10,padding:3,marginBottom:3}} value={cur} onChange={e=>setFinal(mt,i,e.target.value)}>
                            <option value="">—</option>
                            {MEAL_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          {showCooks && (
                            <div style={{display:'flex',flexDirection:'column',gap:2}}>
                              {users.map(u => (
                                <label key={u.uid} style={{fontSize:9,display:'flex',alignItems:'center',gap:3,cursor:'pointer'}}>
                                  <input type="checkbox" style={{width:'auto'}} checked={cooks.includes(u.uid)}
                                    onChange={e => setCooks(mt,i, e.target.checked ? [...cooks,u.uid] : cooks.filter(x=>x!==u.uid))} />
                                  {u.avatar&&u.avatar!=='⭐'?u.avatar:'👤'} {u.displayName?.split(' ')[0]}
                                </label>
                              ))}
                            </div>
                          )}
                          {/* ── CHANGED: admin clear-vote section ── */}
                          {existingVotes.length > 0 && (
                            <div style={{marginTop:4,paddingTop:3,borderTop:'1px solid var(--border)'}}>
                              <div style={{fontSize:8,color:'var(--muted)',marginBottom:2}}>CLEAR VOTES</div>
                              {existingVotes.map(([uid, v]) => {
                                const u = users.find(x=>x.uid===uid);
                                const opt = MEAL_OPTIONS.find(o=>o.value===v);
                                if (!u) return null;
                                return (
                                  <div key={uid} style={{display:'flex',alignItems:'center',gap:3,marginBottom:2}}>
                                    <span style={{fontSize:9,flexShrink:0}}>
                                      {u.avatar&&u.avatar!=='⭐'?u.avatar:'👤'} {opt?.icon}
                                    </span>
                                    <button
                                      style={{fontSize:8,padding:'1px 4px',border:'1px solid var(--coral)',borderRadius:4,background:'none',cursor:'pointer',color:'var(--coral)',flexShrink:0}}
                                      onClick={()=>clearVote(mt,i,uid)}
                                      title={`Clear ${u.displayName}'s vote`}
                                    >✕</button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CHANGED: vote modal — tap same = deselect, button label updates ── */}
      {voteModal && (
        <Modal title={`${voteModal.mt} — ${fmtFull(TRIP_DAYS[voteModal.i])}`} onClose={()=>{setVoteModal(null);setPendingVote('');}}>
          <div style={{fontSize:12,color:'var(--muted)',marginBottom:10}}>
            {currentVoteInModal
              ? <>Your current vote: <b>{MEAL_OPTIONS.find(o=>o.value===currentVoteInModal)?.label}</b> — tap it again to remove.</>
              : "Tap an option to vote."}
          </div>
          {MEAL_OPTIONS.map(opt => {
            const votersFor = users.filter(u => mealDoc?.votes?.[u.uid]===opt.value);
            const isMyCurrentVote = currentVoteInModal === opt.value;
            const isSelected = pendingVote === opt.value;
            return (
              <div key={opt.value}
                className={`vote-option ${isSelected?'selected':''}`}
                style={isMyCurrentVote && !isSelected ? {borderColor:'var(--ocean)',opacity:0.5} : {}}
                onClick={()=>setPendingVote(prev => prev===opt.value ? '' : opt.value)}>
                <span style={{fontSize:20}}>{opt.icon}</span>
                <span style={{flex:1}}>{opt.label.replace(/^[^ ]+ /,'')}</span>
                <span style={{display:'flex',gap:2,alignItems:'center'}}>
                  {votersFor.map(u=><Avatar key={u.uid} user={u} size={20} />)}
                </span>
              </div>
            );
          })}
          <div className="btn-row" style={{marginTop:14}}>
            <button className="btn btn-primary" onClick={submitVote}>
              {pendingVote === currentVoteInModal && pendingVote
                ? '🗑 Remove my vote'
                : pendingVote
                ? 'Submit vote'
                : currentVoteInModal
                ? '🗑 Remove my vote'
                : 'Submit vote'}
            </button>
            <button className="btn-mini" onClick={()=>{setVoteModal(null);setPendingVote('');}}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { doc, updateDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { useCollection } from '../hooks/useCollection';
import { ROOMS, TRAVEL_MODES_ARR, TRAVEL_MODES_DEP } from '../constants';
import Avatar from '../components/Avatar';
import { UserIcon, LogInIcon, LogOutIcon, SlidersIcon, BellIcon } from '../components/Icons';
import { enablePush, disablePush, pushState } from '../lib/push';

export default function SettingsPage() {
  const { profile } = useAuth();
  const { docs: users } = useCollection('users');
  const isAdmin = profile?.admin;
  const [sub, setSub] = useState('me');

  return (
    <div className="page">
      <div className="stabs">
        <button className={`stab ${sub==='me'?'active':''}`} onClick={()=>setSub('me')}><UserIcon size={13}/>My Profile</button>
        <button className={`stab ${sub==='arrivals'?'active':''}`} onClick={()=>setSub('arrivals')}><LogInIcon size={13}/>Arrivals</button>
        <button className={`stab ${sub==='departures'?'active':''}`} onClick={()=>setSub('departures')}><LogOutIcon size={13}/>Departures</button>
        {isAdmin && <button className={`stab ${sub==='admin'?'active':''}`} onClick={()=>setSub('admin')}><SlidersIcon size={13}/>Admin</button>}
      </div>
      {sub==='me' && <MyProfile profile={profile} />}
      {sub==='arrivals' && <TravelTab kind="arr" users={users} profile={profile} isAdmin={isAdmin} />}
      {sub==='departures' && <TravelTab kind="dep" users={users} profile={profile} isAdmin={isAdmin} />}
      {isAdmin && sub==='admin' && <AdminTab users={users} profile={profile} />}
    </div>
  );
}

/* ─── MY PROFILE ─────────────────────────────────────────────────────────── */
function MyProfile({ profile }) {
  const [avatar, setAvatar] = useState((profile?.avatar || '').replace(/[A-Za-z0-9\s]/g, ''));
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [fullName, setFullName] = useState(profile?.fullName || profile?.displayName || '');
  // ── NEW: payment contact fields ──
  const [venmoHandle, setVenmoHandle] = useState(profile?.venmoHandle || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [saved, setSaved] = useState(false);
  const roomName = ROOMS.find(r => r.id === profile?.room)?.name;

  // Keep fields in sync if profile loads after mount
  useEffect(() => {
    setAvatar((profile?.avatar || '').replace(/[A-Za-z0-9\s]/g, ''));
    setDisplayName(profile?.displayName || '');
    setFullName(profile?.fullName || profile?.displayName || '');
    setVenmoHandle(profile?.venmoHandle || '');
    setPhone(profile?.phone || '');
  }, [profile?.uid]);

  async function save() {
    await updateDoc(doc(db, 'users', profile.uid), {
      avatar: avatar.replace(/[A-Za-z0-9\s]/g, '').trim() || '⭐',
      displayName: displayName.trim(),
      fullName: fullName.trim(),
      venmoHandle: venmoHandle.trim().replace(/^@/, ''), // strip leading @ if they typed it
      phone: phone.replace(/\D/g, ''),                   // digits only
    });
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div>
      <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:16 }}>
        <span style={{ fontSize:42 }}>{avatar && avatar!=='⭐' ? avatar : '👤'}</span>
        <div>
          <div style={{ fontSize:18,fontWeight:'bold' }}>{profile?.displayName || profile?.email}</div>
          <div style={{ fontSize:12,color:'var(--muted)' }}>{profile?.email}</div>
          <div style={{ fontSize:13,color:'var(--ocean)',fontWeight:'bold',marginTop:2 }}>
            {roomName ? `🛏 ${roomName}` : 'No room assigned yet'}
          </div>
        </div>
      </div>

      <div className="form-group">
        <label>Display name (what everyone sees)</label>
        <input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="e.g. Brandon N" />
      </div>
      <div className="form-group">
        <label>Full name</label>
        <input value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="e.g. Brandon Nwokocha" />
      </div>
      <div className="form-group">
        <label>Your avatar — type any emoji</label>
        <input value={avatar} onChange={e=>setAvatar(e.target.value)} maxLength={4}
          style={{ fontSize:28,textAlign:'center' }} placeholder="🏖️" />
        <div style={{ fontSize:11,color:'var(--muted)',marginTop:3 }}>
          iPhone: tap 🌐 key · Android: emoji button · Mac: ⌘+Ctrl+Space · Windows: Win+.
        </div>
      </div>

      {/* ── NEW: payment info ── */}
      <div className="divider" />
      <div className="info-head" style={{marginTop:0}}>💸 PAYMENT INFO</div>
      <div style={{fontSize:12,color:'var(--muted)',marginBottom:10}}>
        Used so others can pay you back directly from a receipt. Only visible to your crew.
      </div>
      <div className="form-group">
        <label>Venmo username</label>
        <input value={venmoHandle} onChange={e=>setVenmoHandle(e.target.value)}
          placeholder="e.g. brandon-Nwokocha (without the @)" />
        {venmoHandle ? (
          <div style={{fontSize:11,color:'var(--sage)',marginTop:3}}>
            ✓ Venmo link: venmo.com/{venmoHandle.replace(/^@/,'')}
          </div>
        ) : (
          <div style={{fontSize:11,color:'var(--muted)',marginTop:3}}>
            Add your Venmo so others can pay you with one tap.
          </div>
        )}
      </div>
      <div className="form-group">
        <label>Phone number (for Apple Cash via iMessage)</label>
        <input value={phone} onChange={e=>setPhone(e.target.value)}
          placeholder="e.g. 4696930889" type="tel" />
        {phone ? (
          <div style={{fontSize:11,color:'var(--sage)',marginTop:3}}>
            ✓ Apple Cash payments will open Messages to {phone}
          </div>
        ) : (
          <div style={{fontSize:11,color:'var(--muted)',marginTop:3}}>
            Add your number so others can send you Apple Cash directly.
          </div>
        )}
      </div>

      <button className="btn btn-primary" onClick={save}>{saved ? 'Saved! ✓' : 'Save changes'}</button>
      <NotificationsToggle uid={profile?.uid} />
    </div>
  );
}

/* ─── NOTIFICATIONS TOGGLE (unchanged) ───────────────────────────────────── */
function NotificationsToggle({ uid }) {
  const [state, setState] = useState('loading');
  const [busy, setBusy] = useState(false);
  useEffect(() => { pushState().then(setState); }, []);

  if (state === 'loading' || state === 'unsupported') return null;

  async function turnOn() {
    setBusy(true);
    try { await enablePush(uid); setState('on'); }
    catch (e) { setState(['needs-install','denied'].includes(e.message) ? e.message : 'off'); }
    finally { setBusy(false); }
  }
  async function turnOff() {
    setBusy(true);
    try { await disablePush(uid); } finally { setState('off'); setBusy(false); }
  }

  return (
    <div style={{ marginTop:18, paddingTop:16, borderTop:'1px solid var(--border)' }}>
      <div className="info-head" style={{ marginTop:0 }}><BellIcon size={12}/>NOTIFICATIONS</div>
      {state === 'on' && (
        <>
          <div style={{ fontSize:13, color:'var(--muted)', marginBottom:8 }}>
            On for this device — pings for heads-ups, receipts you're tagged in, and confirmed payments. Nothing else.
          </div>
          <button className="btn-mini" disabled={busy} onClick={turnOff}>Turn off</button>
        </>
      )}
      {state === 'off' && (
        <>
          <div style={{ fontSize:13, color:'var(--muted)', marginBottom:8 }}>
            Get a ping for important heads-ups, receipts you're tagged in, and confirmed payments. That's it — no spam.
          </div>
          <button className="btn btn-primary" disabled={busy} onClick={turnOn}>{busy ? '…' : 'Turn on notifications'}</button>
        </>
      )}
      {state === 'needs-install' && (
        <div style={{ fontSize:13, color:'var(--muted)' }}>
          To get notifications on iPhone, add this app to your Home Screen first: tap <b>Share</b> → <b>Add to Home Screen</b>, then open it from there and flip this on.
        </div>
      )}
      {state === 'denied' && (
        <div style={{ fontSize:13, color:'var(--muted)' }}>
          Notifications are blocked. Re-enable them in your phone's Settings → this app → Notifications, then reload.
        </div>
      )}
    </div>
  );
}

/* ─── TRAVEL TAB (unchanged) ─────────────────────────────────────────────── */
function TravelTab({ kind, users, profile, isAdmin }) {
  const [editUid, setEditUid] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [savedUid, setSavedUid] = useState(null);
  const MODES = kind==='arr' ? TRAVEL_MODES_ARR : TRAVEL_MODES_DEP;
  const needsFlight = m => /Flight/i.test(m||'');
  const needsFerry = m => /Ferry/i.test(m||'');

  function startEdit(u) {
    setError('');
    setEditUid(u.uid);
    setForm(kind==='arr' ? {
      mode: u.travelModeArr || TRAVEL_MODES_ARR[0],
      dateRaw: u.arrivalDateRaw || '',
      time: u.arrivalTime || '',
      ferry: u.arrivalFerry || '',
      flightNum: u.arrivalFlight || '',
      notes: u.arrivalNotes || '',
    } : {
      mode: u.travelModeDep || TRAVEL_MODES_DEP[0],
      dateRaw: u.departureDateRaw || '',
      time: u.departureTime || '',
      ferry: u.departureFerry || '',
      flightNum: u.departureFlight || '',
      notes: u.departureNotes || '',
    });
  }

  async function save(uid) {
    if (!form.dateRaw) {
      setError(kind==='arr' ? '⚠️ Arrival date missing — date is required to save.' : '⚠️ Departure date is required to save.');
      return;
    }
    setError('');
    const upd = kind==='arr' ? {
      travelModeArr: form.mode, arrivalDateRaw: form.dateRaw, arrivalTime: form.time,
      arrivalFerry: form.ferry, arrivalFlight: form.flightNum, arrivalNotes: form.notes,
    } : {
      travelModeDep: form.mode, departureDateRaw: form.dateRaw, departureTime: form.time,
      departureFerry: form.ferry, departureFlight: form.flightNum, departureNotes: form.notes,
    };
    await updateDoc(doc(db, 'users', uid), upd);
    setSavedUid(uid);
    setTimeout(() => setSavedUid(null), 2000);
    setEditUid(null);
  }

  return (
    <div>
      <div className="section-sub">{kind==='arr'?'Arrivals':'Departures'} — tap a card to edit (yours, or anyone's if admin). Dates drive the cost split.</div>
      {users.map(u => {
        const canEdit = u.uid === profile?.uid || isAdmin;
        const dateRaw = kind==='arr' ? u.arrivalDateRaw : u.departureDateRaw;
        const time = kind==='arr' ? u.arrivalTime : u.departureTime;
        const mode = kind==='arr' ? u.travelModeArr : u.travelModeDep;
        const flight = kind==='arr' ? u.arrivalFlight : u.departureFlight;
        const ferry = kind==='arr' ? u.arrivalFerry : u.departureFerry;
        const notes = kind==='arr' ? u.arrivalNotes : u.departureNotes;
        const isEditing = editUid === u.uid;
        return (
          <div key={u.uid} className="card">
            <div className="card-head" onClick={() => canEdit && (isEditing ? setEditUid(null) : startEdit(u))}>
              <div>
                <div className="card-title" style={{display:'flex',alignItems:'center',gap:8}}>
                  <Avatar user={u} size={24} />
                  {u.displayName}
                  {savedUid===u.uid && <span className="badge badge-s">Saved ✓</span>}
                </div>
                <div className="card-sub">
                  {mode || 'Not set'}{dateRaw ? ` · ${dateRaw}` : ' · ⚠️ no date set'}{time ? ` · ${time}` : ''}
                </div>
                {flight && needsFlight(mode) && (
                  <div style={{fontSize:11,marginTop:2}}>
                    ✈ {flight} ·{' '}
                    <a href={`https://www.google.com/search?q=flight+${encodeURIComponent(flight)}+status`}
                      target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{color:'var(--ocean)'}}>status ↗</a>
                  </div>
                )}
                {ferry && needsFerry(mode) && <div style={{fontSize:11,marginTop:2}}>⛴ {ferry}</div>}
                {notes && <div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>{notes}</div>}
              </div>
              {canEdit && <span className={`chev ${isEditing?'open':''}`}>▼</span>}
            </div>
            {isEditing && canEdit && (
              <div className="card-body" style={{paddingTop:12}}>
                {error && <div className="error-msg">{error}</div>}
                <div className="form-group"><label>Mode</label>
                  <select value={form.mode} onChange={e=>setForm(f=>({...f,mode:e.target.value}))}>
                    {MODES.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="grid2">
                  <div className="form-group">
                    <label>{kind==='arr'?'Arrival date':'Departure date'} <span style={{color:'var(--coral)'}}>*required</span></label>
                    <input type="date" value={form.dateRaw} min="2026-06-29" max="2026-07-11"
                      onChange={e=>setForm(f=>({...f,dateRaw:e.target.value}))} />
                  </div>
                  <div className="form-group"><label>Time (optional)</label>
                    <input type="time" value={form.time} onChange={e=>setForm(f=>({...f,time:e.target.value}))} />
                  </div>
                </div>
                {needsFerry(form.mode) && (
                  <div className="form-group"><label>Ferry details (optional)</label>
                    <input value={form.ferry} onChange={e=>setForm(f=>({...f,ferry:e.target.value}))} placeholder="e.g. Bay State 3:30pm from WTC" />
                  </div>
                )}
                {needsFlight(form.mode) && (
                  <div className="form-group"><label>Flight number (optional)</label>
                    <input value={form.flightNum} onChange={e=>setForm(f=>({...f,flightNum:e.target.value}))} placeholder="e.g. 9K 123" />
                  </div>
                )}
                <div className="form-group"><label>Notes</label>
                  <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} />
                </div>
                <div className="btn-row">
                  <button className="btn btn-primary" onClick={()=>save(u.uid)}>Save</button>
                  <button className="btn-mini" onClick={()=>{setEditUid(null);setError('');}}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── ADMIN TAB ──────────────────────────────────────────────────────────── */
const EXPORT_COLLECTIONS = ['users','events','ideas','meals','receipts','bulletins','groceries','infoCustom','payments','config'];

// ── NEW: seed data — phone numbers + Venmo handles for the crew
// Keyed by email so it works regardless of UID
const CONTACT_SEED = {
  'bnwokocha@gmail.com':       { phone: '4696930889', venmoHandle: 'brandon-Nwokocha' },
  // Add crew emails below — update if they sign up with different emails
  // These are matched by email address on the user doc
};
// Venmo handles by display name as fallback (in case email isn't stored)
const VENMO_BY_NAME = {
  'Brandon N':   'brandon-Nwokocha',
  'Jace':        'Jace-fowl-13',
  'Jace Fowler': 'Jace-fowl-13',
  'Evan':        'evan-mcanulty',
  'Evan McAnulty':'evan-mcanulty',
  'Brandon B':   'brandon-berryman-31',
  'Brandon Berryman':'brandon-berryman-31',
  'Chris':       'chris-ladeau',
  'Chris Ladeau':'chris-ladeau',
};
const PHONE_BY_NAME = {
  'Brandon N':    '4696930889',
  'Brandon Nwokocha':'4696930889',
  'Jace':         '9797774992',
  'Jace Fowler':  '9797774992',
  'Evan':         '7133151419',
  'Evan McAnulty':'7133151419',
  'Brandon B':    '8324838423',
  'Brandon Berryman':'8324838423',
  'Chris':        '9512104084',
  'Chris Ladeau': '9512104084',
};

function AdminTab({ users, profile }) {
  const [exporting, setExporting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedDone, setSeedDone] = useState(false);

  async function toggleAdmin(uid, cur) { await updateDoc(doc(db,'users',uid), { admin: !cur }); }
  async function toggleAccountant(uid, cur) { await updateDoc(doc(db,'users',uid), { accountant: !cur }); }
  async function approve(uid) { await updateDoc(doc(db,'users',uid), { approved: true }); }

  async function exportAll() {
    setExporting(true);
    try {
      const dump = { exportedAt: new Date().toISOString() };
      for (const name of EXPORT_COLLECTIONS) {
        const snap = await getDocs(collection(db, name));
        dump[name] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      const url = URL.createObjectURL(new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = `jbbce-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
      URL.revokeObjectURL(url);
    } finally { setExporting(false); }
  }

  // ── NEW: seed contact info for all existing users
  async function seedContactInfo() {
    if (!window.confirm('This will write phone numbers and Venmo handles for all crew members who don\'t have them yet. OK?')) return;
    setSeeding(true);
    try {
      const batch = writeBatch(db);
      let count = 0;
      users.forEach(u => {
        const name = u.displayName || '';
        const venmo = u.venmoHandle || VENMO_BY_NAME[name] || '';
        const phone = u.phone || PHONE_BY_NAME[name] || '';
        if (venmo || phone) {
          const upd = {};
          if (!u.venmoHandle && venmo) upd.venmoHandle = venmo;
          if (!u.phone && phone) upd.phone = phone;
          if (Object.keys(upd).length) { batch.update(doc(db,'users',u.uid), upd); count++; }
        }
      });
      await batch.commit();
      setSeedDone(true);
      setTimeout(() => setSeedDone(false), 4000);
    } finally { setSeeding(false); }
  }

  const pending = users.filter(u => u.approved === false);

  return (
    <div>
      <div className="section-sub">Toggle admin for other users. Admins can edit/delete anything and manage rooms. The accountant (Chris) can edit cost line items and confirm house-fund payments.</div>

      {pending.length > 0 && (
        <div style={{marginBottom:14}}>
          <div className="info-head" style={{marginTop:0}}>⏳ WAITING FOR APPROVAL</div>
          {pending.map(u => (
            <div key={u.uid} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
              <span style={{fontSize:15}}>{u.displayName} <span style={{fontSize:11,color:'var(--muted)'}}>{u.email}</span></span>
              <button className="btn btn-primary" style={{fontSize:12,padding:'6px 12px'}} onClick={()=>approve(u.uid)}>✓ Approve</button>
            </div>
          ))}
        </div>
      )}

      {/* ── NEW: seed contact info button */}
      <div className="tip-box" style={{marginBottom:14,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <span style={{flex:1}}>
          📇 <b>Seed contact info</b> — writes Venmo handles and phone numbers for all crew members who don't have them yet. Tap once after everyone has signed up. Users can always update their own info in My Profile.
        </span>
        <button className="btn btn-secondary" disabled={seeding} onClick={seedContactInfo}>
          {seeding ? 'Writing…' : seedDone ? '✓ Done!' : 'Seed contact info'}
        </button>
      </div>

      <div className="tip-box" style={{marginBottom:14,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <span style={{flex:1}}>💾 Download everything (receipts, payments, events…) as a JSON file. Do this weekly and on the last day — there are no other backups.</span>
        <button className="btn btn-secondary" disabled={exporting} onClick={exportAll}>{exporting?'Exporting…':'Export backup'}</button>
      </div>

      {users.filter(u => u.uid !== profile.uid).map(u => (
        <div key={u.uid} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,padding:'8px 0',borderBottom:'1px solid var(--border)',flexWrap:'wrap'}}>
          <div>
            <span style={{fontSize:16}}>{u.avatar && u.avatar!=='⭐' ? u.avatar : '👤'} {u.displayName}</span>
            <div style={{fontSize:11,color:'var(--muted)',marginTop:1}}>
              {u.venmoHandle && `@${u.venmoHandle}`}{u.venmoHandle && u.phone && ' · '}{u.phone && `📱 ${u.phone}`}
              {!u.venmoHandle && !u.phone && <span style={{color:'var(--gold)'}}>⚠️ no contact info — seed or ask them to add in profile</span>}
            </div>
          </div>
          <div className="btn-row">
            <button className="btn-mini" style={u.admin?{borderColor:'var(--sage)',color:'var(--sage)'}:{}}
              onClick={()=>toggleAdmin(u.uid, u.admin)}>
              {u.admin ? '✓ Admin — remove' : 'Make admin'}
            </button>
            <button className="btn-mini" style={u.accountant?{borderColor:'var(--sage)',color:'var(--sage)'}:{}}
              onClick={()=>toggleAccountant(u.uid, u.accountant)}>
              {u.accountant ? '✓ Accountant — remove' : 'Make accountant'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

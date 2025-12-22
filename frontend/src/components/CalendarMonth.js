import React, { useMemo, useState, useEffect } from 'react';

// Small month calendar component
// Props:
// - year, month (1-based). If omitted, uses current month
// - vacationRequests: array of { start_date, end_date, status }
// - onSelect: callback({ start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' | null }) when selection changes

// ISO using local date components (avoid timezone shifts from toISOString())
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const parseISO = (s) => {
  const [y,m,day] = s.split('-').map(Number);
  // create local date at midnight
  return new Date(y, m-1, day);
};

const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

const buildDatesSet = (vacationRequests) => {
  const set = new Set();
  if (!vacationRequests) return set;
  vacationRequests.forEach(req => {
    try {
      let cur = parseISO(req.start_date);
      const end = parseISO(req.end_date);
      while (cur <= end) {
        set.add(iso(cur));
        cur = addDays(cur, 1);
      }
    } catch (e) {
      // ignore
    }
  });
  return set;
};

const buildDatesSetFiltered = (vacationRequests, predicate) => {
  const list = (vacationRequests || []).filter(predicate);
  return buildDatesSet(list);
};

const getMonthMatrix = (year, month) => {
  const first = new Date(year, month-1, 1);
  const start = addDays(first, -((first.getDay()+6)%7)); // Monday start
  const weeks = [];
  let cur = new Date(start);
  for (let w=0; w<6; w++) {
    const week = [];
    for (let d=0; d<7; d++) {
      week.push(new Date(cur));
      cur = addDays(cur,1);
    }
    weeks.push(week);
  }
  return weeks;
};

const isSameDate = (a,b) => a && b && iso(a) === iso(b);

export default function CalendarMonth({ year, month, vacationRequests = [], onSelect }){
  const today = new Date();
  const initYear = year || today.getFullYear();
  const initMonth = month || (today.getMonth()+1);

  const [curYear, setCurYear] = useState(initYear);
  const [curMonth, setCurMonth] = useState(initMonth);

  useEffect(()=>{
    // keep in sync if props change
    if (typeof year !== 'undefined' && year !== curYear) setCurYear(year);
    if (typeof month !== 'undefined' && month !== curMonth) setCurMonth(month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const monthMatrix = useMemo(() => getMonthMatrix(curYear,curMonth), [curYear,curMonth]);
  const approvedSet = useMemo(()=> buildDatesSetFiltered(vacationRequests, req => req.status === 'approved'), [vacationRequests]);
  const pendingSet = useMemo(()=> buildDatesSetFiltered(vacationRequests, req => req.status === 'pending'), [vacationRequests]);
  const vacationSet = useMemo(()=> buildDatesSet(vacationRequests), [vacationRequests]);

  const prevMonth = () => {
    if (curMonth === 1) { setCurMonth(12); setCurYear(curYear - 1); }
    else setCurMonth(curMonth - 1);
  };
  const nextMonth = () => {
    if (curMonth === 12) { setCurMonth(1); setCurYear(curYear + 1); }
    else setCurMonth(curMonth + 1);
  };
  const goToToday = () => { setCurYear(today.getFullYear()); setCurMonth(today.getMonth()+1); };

  // selection state
  const [start, setStart] = useState(null); // ISO
  const [end, setEnd] = useState(null);

  useEffect(()=>{
    if (onSelect) onSelect({ start, end });
  }, [start,end]);

  const onDayClick = (d) => {
    const dayIso = iso(d);
    // prevent selecting days that are already approved vacation
    if (approvedSet.has(dayIso)) return;

    if (!start) {
      setStart(dayIso);
      setEnd(null);
      return;
    }
    if (start && !end) {
      // second click: if clicked < start => new start
      if (dayIso < start) {
        if (approvedSet.has(dayIso)) return;
        setStart(dayIso);
        setEnd(null);
      } else if (dayIso === start) {
        // toggle same-day selection to single-day
        setEnd(dayIso);
      } else {
        // ensure the range does not include approved vacation days
        const a = parseISO(start);
        const b = parseISO(dayIso);
        let cur = new Date(a);
        while (cur <= b) {
          if (approvedSet.has(iso(cur))) {
            alert('Auswahl enthält bereits genehmigte Urlaubstage; bitte einen anderen Bereich wählen.');
            return;
          }
          cur = addDays(cur,1);
        }
        setEnd(dayIso);
      }
      return;
    }
    // both start and end exist -> third click resets start
    if (approvedSet.has(dayIso)) return;
    setStart(dayIso);
    setEnd(null);
  };

  const inRange = (d) => {
    if (!start) return false;
    const dayIso = iso(d);
    if (start && !end) return dayIso === start;
    if (start && end) return dayIso >= start && dayIso <= end;
    return false;
  };

  const isStart = (d) => start && iso(d) === start;
  const isEnd = (d) => end && iso(d) === end;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="px-2 py-1 rounded border">◀</button>
          <button onClick={goToToday} className="px-2 py-1 rounded border">Heute</button>
          <button onClick={nextMonth} className="px-2 py-1 rounded border">▶</button>
          <div className="text-sm font-medium ml-3">{new Date(curYear, curMonth-1).toLocaleString(undefined,{month: 'long', year: 'numeric'})}</div>
        </div>
        <div className="text-xs text-gray-500">Legende: <span className="inline-block w-3 h-3 bg-green-400 rounded ml-2 mr-1 align-middle"></span>Genehmigt &nbsp; <span className="inline-block w-3 h-3 bg-yellow-300 rounded ml-2 mr-1 align-middle"></span>Ausstehend &nbsp; <span className="inline-block w-3 h-3 bg-blue-600 rounded ml-2 mr-1 align-middle"></span>Start/Ende &nbsp; <span className="inline-block w-3 h-3 bg-blue-200 rounded ml-2 mr-1 align-middle"></span>Auswahl</div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-sm">
        {['Mo','Di','Mi','Do','Fr','Sa','So'].map(d => (
          <div key={d} className="text-center text-xs text-gray-600 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 mt-1">
        {monthMatrix.map((week, wi) => (
          <React.Fragment key={wi}>
            {week.map((d, di) => {
              const dayIso = iso(d);
              const inMonth = d.getMonth() === (curMonth-1);
              const isVacation = vacationSet.has(dayIso);
              const selected = inRange(d);
              const startMark = isStart(d);
              const endMark = isEnd(d);

              // determine classes and attributes
              let classes = 'p-2 rounded text-center select-none ';
              let attrs = {};

              if (!inMonth) {
                classes += 'text-gray-300 bg-white';
              } else if (startMark || endMark) {
                classes += 'bg-blue-600 text-white font-semibold cursor-pointer';
              } else if (selected && start && end) {
                classes += 'bg-blue-200 text-gray-900 cursor-pointer';
              } else if (approvedSet.has(dayIso)) {
                classes += 'bg-green-400 text-white cursor-not-allowed opacity-80';
                attrs.title = 'Genehmigter Urlaub — nicht auswählbar';
                attrs['aria-disabled'] = true;
              } else if (pendingSet.has(dayIso)) {
                classes += 'bg-yellow-300 text-gray-900 cursor-pointer';
                attrs.title = 'Ausstehender Urlaubsantrag';
              } else {
                classes += 'bg-white text-gray-900 border cursor-pointer';
              }

              return (
                <div key={di} className={classes} onClick={()=>onDayClick(d)} {...attrs}>
                  <div className="text-sm">{d.getDate()}</div>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

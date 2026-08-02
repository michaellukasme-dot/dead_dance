/* ============================================================================
 * dd_recurring.js — the RECURRING EVENT container (universal cadence).
 *
 * EVERYTHING worth selling recurs:
 *   • MusikFest recurs ANNUALLY (same ~10 days each August) — and so do the 800.
 *   • Joe's Karaoke recurs WEEKLY (every Tuesday).
 *   • A market or trivia night can recur MONTHLY.
 * Define the SERIES once (venue/name, cadence, anchor, kind, genre); this spawns
 * each edition's INSTANCE — a container with a stable id, ticket, roster (singers),
 * and winners (trivia/games). Same machinery as a one-off act, on a repeating clock.
 * The recurrence is what makes it a year-round DATA and SALES asset (CRM Venue Sales).
 *
 * Pure + deterministic + guarded (no backend = no-op). Dual browser/node export.
 * ==========================================================================*/
;(function (root) {
  'use strict';
  function slug(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }
  function cap(s){ s=String(s||''); return s.charAt(0).toUpperCase()+s.slice(1); }
  function p2(n){ return ('0'+n).slice(-2); }
  var DOW = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 };
  var CADENCES = ['weekly','monthly','annual'];

  function norm(spec){ spec=spec||{};
    var cadence=slug(spec.cadence||'weekly'); if(CADENCES.indexOf(cadence)<0) cadence='weekly';
    var wd=spec.weekday; if(typeof wd==='string') wd=DOW[String(wd).slice(0,3).toLowerCase()];
    wd=(wd==null?2:((wd%7)+7)%7);
    var kind=slug(spec.kind||(cadence==='annual'?'festival':'karaoke'))||'event';
    var anchor=spec.anchor || (spec.date? String(spec.date).slice(5,10) : null);  // 'MM-DD' for annual
    return { id:spec.id||slug((spec.venue||spec.title||'event')+'-'+kind),
             title:spec.title||(cap(kind)+' Night'), venue:spec.venue||'', city:spec.city||'',
             cadence:cadence, weekday:wd, anchor:anchor,
             dayOfMonth:(spec.dayOfMonth!=null?Math.max(1,Math.min(28,+spec.dayOfMonth||1)):15),
             time:spec.time||'8:00 PM', kind:kind, genre:spec.genre?slug(spec.genre):null,
             host:spec.host||null, image:spec.image||null,
             cover:(spec.cover!=null?Math.max(0,+spec.cover||0):0), days:Math.max(1,+spec.days||1) };
  }

  function today(){ return new Date().toISOString().slice(0,10); }
  function addDays(iso,k){ var d=new Date(iso+'T00:00:00Z'); if(isNaN(d)) return iso; d.setUTCDate(d.getUTCDate()+k); return d.toISOString().slice(0,10); }
  function addMonths(iso,k){ var d=new Date(iso+'T00:00:00Z'); if(isNaN(d)) return iso; d.setUTCMonth(d.getUTCMonth()+k); return d.toISOString().slice(0,10); }
  function addYears(iso,k){ var d=new Date(iso+'T00:00:00Z'); if(isNaN(d)) return iso; d.setUTCFullYear(d.getUTCFullYear()+k); return d.toISOString().slice(0,10); }
  function dow(iso){ var d=new Date(iso+'T00:00:00Z'); return isNaN(d)?0:d.getUTCDay(); }
  function nextOnOrAfter(iso, wd){ var add=(((wd - dow(iso)) % 7) + 7) % 7; return addDays(iso, add); }
  function nextMonthly(from, dom){ var y=+from.slice(0,4), m=+from.slice(5,7), d=+from.slice(8,10);
    if(d>dom){ m++; if(m>12){ m=1; y++; } } return y+'-'+p2(m)+'-'+p2(dom); }

  function ticketUrl(series, date){ var s=norm(series);
    var q={ band:s.title, sub:s.venue, venue:(s.venue+(s.city?(' · '+s.city):'')), date:date,
            price:(s.cover>0?('$'+s.cover):'FREE'), ev:'recurring:'+s.id, color:'#7c3aed' };
    if(s.image) q.img=s.image;
    return 'ticket.html?'+Object.keys(q).map(function(k){ return k+'='+encodeURIComponent(q[k]); }).join('&'); }

  // the upcoming INSTANCES (editions) for a series — N of them from a start date
  function occurrences(series, fromISO, count){ var s=norm(series); count=Math.max(0, count|0);
    if(!count) return []; var from=fromISO||today(); var dates=[];
    if(s.cadence==='annual'){ var y=+from.slice(0,4), md=from.slice(5,10), anchor=s.anchor||'01-01';
      var first=(md<=anchor)?(y+'-'+anchor):((y+1)+'-'+anchor);
      for(var i=0;i<count;i++) dates.push(addYears(first, i)); }
    else if(s.cadence==='monthly'){ var start=nextMonthly(from, s.dayOfMonth);
      for(var j=0;j<count;j++) dates.push(addMonths(start, j)); }
    else { var f=nextOnOrAfter(from, s.weekday); for(var k=0;k<count;k++) dates.push(addDays(f, k*7)); }
    return dates.map(function(date){ var eid=s.id+'|'+date;
      return { seriesId:s.id, eventId:eid, date:date, endDate:(s.days>1?addDays(date, s.days-1):date),
               title:s.title, venue:s.venue, city:s.city, cadence:s.cadence, kind:s.kind, genre:s.genre,
               time:s.time, cover:s.cover, ticket:ticketUrl(s, date),
               rosterKey:'dd.roster|'+eid, winnersKey:'dd.winners|'+eid }; });
  }
  function next(series, todayISO){ var o=occurrences(series, todayISO||today(), 1); return o.length?o[0].date:null; }
  function upcoming(series, todayISO, n){ return occurrences(series, todayISO||today(), n||4); }

  // guarded spine (no-op until a backend + table exist)
  function C(){ try{ return root.ddClient && root.ddClient(); }catch(e){ return null; } }
  function save(series){ var c=C(); if(!c||!c.rpc) return false; try{ var s=norm(series);
    c.rpc('sf_recurring_set',{ p_id:s.id, p_title:s.title, p_venue:s.venue, p_city:s.city||null,
      p_cadence:s.cadence, p_weekday:s.weekday, p_anchor:s.anchor, p_day_of_month:s.dayOfMonth,
      p_time:s.time, p_kind:s.kind, p_genre:s.genre, p_cover:s.cover, p_days:s.days }); return true; }catch(e){ return false; } }

  var api = { norm:norm, occurrences:occurrences, instances:occurrences, upcoming:upcoming, next:next,
              ticketUrl:ticketUrl, save:save, slug:slug, DOW:DOW, CADENCES:CADENCES };
  root.DDRecurring = api;
  if (typeof module!=='undefined' && module.exports) module.exports = api;
})(typeof window!=='undefined' ? window : (typeof global!=='undefined' ? global : this));

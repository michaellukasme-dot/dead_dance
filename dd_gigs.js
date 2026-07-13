/* dd_gigs.js — Autonomous Gig Management client (bands).
   Adding a gig auto-generates a paced plan server-side (dd_gig_create). This
   module lists gigs/tasks and FIRES tasks:
     • channel 'feed'     → posts FOR REAL to dd_posts (DDFeed.post), marks done
     • channel 'external' → opens the share sheet (one human tap), marks done
     • channel 'ops'      → checklist toggle
   "Run the plan" fires every due in-app post at once. Nothing SMS, nothing
   charges, nothing posts to outside networks without a human tap. Best-effort. */
(function (root) {
  function client() { try { return root.ddClient && root.ddClient(); } catch (e) { return null; } }
  function myId() { try { var i = root.ddId && root.ddId(); return (i && i.id) ? String(i.id) : null; } catch (e) { return null; } }
  function ready() { return !!(client() && myId()); }
  function inviteLink(slug) { return 'https://deaddance.app/welcome_role.html?role=fan&ref=' + encodeURIComponent(slug || 'a-band') + '&src=gig'; }

  function createGig(g) {
    g = g || {}; var c = client();
    if (!c) return Promise.reject('no-backend');
    return c.rpc('dd_gig_create', {
      p_member_id: myId(), p_band: g.band || null, p_slug: g.slug || null,
      p_venue: g.venue || null, p_city: g.city || null,
      p_date: g.date || null, p_door: g.door || null, p_template: g.template || 'band'
    }).then(function (r) { if (r && r.error) throw r.error; return (r && r.data) || null; });
  }
  function listGigs(kind) {
    var c = client(), id = myId(); if (!c) return Promise.resolve([]);
    return c.rpc('dd_gigs_list', { p_member_id: id, p_kind: kind || null }).then(function (r) { return (r && r.data) || []; }).catch(function () { return []; });
  }
  function tasksFor(gigId) {
    var c = client(); if (!c || !gigId) return Promise.resolve([]);
    return c.rpc('dd_gig_tasks', { p_gig_id: gigId }).then(function (r) { return (r && r.data) || []; }).catch(function () { return []; });
  }
  function setTask(taskId, status, postedId) {
    var c = client(); if (!c) return Promise.resolve('no-backend');
    return c.rpc('dd_gig_task_set', { p_task_id: taskId, p_status: status, p_posted_id: postedId || null })
      .then(function (r) { return (r && r.data) || 'ok'; }).catch(function () { return 'err'; });
  }

  // fire one task. resolves {status, postedId, opened}
  function fireTask(task, ctx) {
    ctx = ctx || {};
    if (!task) return Promise.resolve({ status: 'skip' });
    var body = String(task.body || '').replace('{invite_link}', inviteLink(ctx.slug)).replace('{group_post}', ctx.groupPost || '');
    if (task.channel === 'feed') {
      if (!(root.DDFeed && root.DDFeed.ready())) return Promise.resolve({ status: 'nobackend' });
      return root.DDFeed.post(body).then(function (pid) {
        return setTask(task.id, 'done', pid).then(function () { return { status: 'done', postedId: pid }; });
      }).catch(function () { return { status: 'err' }; });
    }
    if (task.channel === 'external') {
      var opened = false;
      try { if (root.navigator && root.navigator.share) { root.navigator.share({ title: 'DeadDance', text: body, url: inviteLink(ctx.slug) }); opened = true; } } catch (e) {}
      return setTask(task.id, 'done', null).then(function () { return { status: 'done', opened: opened, external: true }; });
    }
    // ops checklist
    return setTask(task.id, 'done', null).then(function () { return { status: 'done', ops: true }; });
  }
  function skipTask(task) { return setTask(task && task.id, 'skipped', null); }

  // autopilot: fire all still-pending IN-APP (feed) posts that are due (or all)
  function runPlan(gigId, ctx, dueOnly) {
    return tasksFor(gigId).then(function (tasks) {
      var today = new Date().toISOString().slice(0, 10);
      var todo = tasks.filter(function (t) {
        // autopilot fires ready-to-go in-app posts only; anything needing a human paste ({group_post}) is skipped
        if (t.channel !== 'feed' || t.status !== 'pending') return false;
        if (String(t.body || '').indexOf('{group_post}') >= 0) return false;
        return (!dueOnly || !t.due_date || t.due_date <= today);
      });
      var n = 0;
      return todo.reduce(function (p, t) {
        return p.then(function () { return fireTask(t, ctx).then(function (r) { if (r.status === 'done') n++; }); });
      }, Promise.resolve()).then(function () { return { fired: n, total: todo.length }; });
    });
  }

  root.DDGigs = { ready: ready, createGig: createGig, listGigs: listGigs, tasksFor: tasksFor, fireTask: fireTask, skipTask: skipTask, runPlan: runPlan, inviteLink: inviteLink, myId: myId };
})(typeof window !== 'undefined' ? window : this);

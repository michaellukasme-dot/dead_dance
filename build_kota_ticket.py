#!/usr/bin/env python3
# KOTA ticket — the Karnival poster as hero + a StageFill pass. Self-contained.
import base64, io, os
from PIL import Image
HERE=os.path.dirname(os.path.abspath(__file__))
POSTER="/sessions/vibrant-awesome-wright/mnt/uploads/Karnival of the ARTS .png"
def uri(path,maxw=760,q=88,crop_h=None):
    im=Image.open(path)
    if im.mode in ("RGBA","LA","P"):
        im=im.convert("RGBA"); bg=Image.new("RGBA",im.size,(255,255,255,255)); im=Image.alpha_composite(bg,im).convert("RGB")
    else: im=im.convert("RGB")
    if crop_h: im=im.crop((0,0,im.width,int(im.height*crop_h)))   # keep only the top art
    if im.width>maxw: im=im.resize((maxw,round(im.height*maxw/im.width)),Image.LANCZOS)
    b=io.BytesIO(); im.save(b,format="JPEG",quality=q,optimize=True)
    return "data:image/jpeg;base64,"+base64.b64encode(b.getvalue()).decode()
POST=uri(POSTER,crop_h=0.575)   # top art + gold ribbon frame; lineup text below is cut

HTML='''<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>Karnival of the Arts · StageFill</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&family=Playfair+Display:wght@800&display=swap');
:root{--ink:#241026;--purple:#4a1e5c;--gold:#e0a92e;--red:#c0334b;--muted:#8a7d92;--line:#efe6f2}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#1a0f22;font-family:'DM Sans',system-ui,sans-serif;display:flex;justify-content:center;padding:18px 12px}
.tk{width:100%;max-width:380px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 18px 60px rgba(0,0,0,.5)}
.poster{display:block;width:100%}
.hd{display:flex;align-items:center;justify-content:space-between;padding:12px 15px 6px;background:linear-gradient(180deg,#2c1338,#4a1e5c);color:#fff}
.hd .b{font-weight:800;font-size:13px}.hd .b span{color:var(--gold)}
.hd .s{font-size:11px;font-weight:700;color:#8ff0a8;display:flex;gap:4px}
.body{padding:8px 18px 16px}
.eg{font-size:10px;letter-spacing:.14em;color:var(--muted);text-transform:uppercase;font-weight:700;margin-top:6px}
.ev{font-family:'Playfair Display';font-size:22px;color:var(--purple);line-height:1.05;margin:2px 0 4px}
.sub{font-size:13px;color:#5b4f63}
.dir{font-size:13px;color:var(--red);font-weight:700;text-decoration:none;display:inline-block;margin-top:2px}
.when{margin:9px 0 2px}.when b{font-size:15px;color:var(--ink)}.when span{font-size:12px;color:var(--muted)}
.ga{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#b8791a;font-weight:800;text-align:center;margin:12px 0 6px}
.code{border:1px solid var(--line);border-radius:12px;padding:12px 10px 8px;text-align:center;position:relative;overflow:hidden}
.bars{height:62px;display:flex;gap:2px;justify-content:center;align-items:stretch}.bars i{width:3px;background:var(--ink);border-radius:1px}
.scan{position:absolute;top:8px;bottom:26px;left:50%;width:3px;background:linear-gradient(var(--gold),#fff0c2);box-shadow:0 0 10px var(--gold);animation:sc 2.2s ease-in-out infinite}
@keyframes sc{0%{left:16%}50%{left:84%}100%{left:16%}}
.code .note{font-size:12px;color:var(--ink);font-weight:600;margin-top:7px}
.price{display:flex;align-items:center;justify-content:space-between;margin:12px 0 4px}
.price .p{font-size:22px;font-weight:800;color:var(--ink)}.price .p small{display:block;font-size:11px;color:#2e7d46;font-weight:700}
.buy{background:var(--purple);color:#fff;border:0;border-radius:12px;padding:12px 15px;font-size:14px;font-weight:800;cursor:pointer}
.tag{font-size:12px;color:#5b4f63;text-align:center;margin:8px 0}
.act{width:100%;border:1px dashed #d9c6e0;background:#fff;border-radius:11px;padding:11px;font-size:13px;font-weight:700;color:var(--red);margin:7px 0;cursor:pointer;text-align:center}
.act.mic{border-color:#d8c2e6;color:var(--purple)}
.trip{display:flex;gap:7px}.trip button{flex:1;border:1px solid var(--line);background:#fff;border-radius:11px;padding:10px;font-weight:700;font-size:12.5px;color:var(--purple);cursor:pointer}
.qrwrap{background:linear-gradient(180deg,#2c1338,#1a0f22);color:#efe6f2;padding:15px 16px 18px}
.qrid{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#c6b3d6;margin-bottom:10px}
.qrid .pass{border:1px solid #5a3d6b;border-radius:14px;padding:3px 10px;font-weight:700;color:#f0e2ff}
.qrrow{display:flex;gap:12px}.qr{background:#fff;border-radius:8px;padding:7px;flex:0 0 92px}.qr svg{display:block;width:78px;height:78px}
.qrtx{font-size:11.5px;color:#d6c6e2;line-height:1.5}.qrtx b{color:#fff}
.ft{font-size:10.5px;color:#8a7d92;text-align:center;padding:10px 16px 16px}
.q{display:inline-flex;align-items:center;justify-content:center;width:17px;height:17px;border-radius:50%;border:0;background:#6d28d9;color:#fff;font-size:11px;font-weight:800;cursor:pointer;vertical-align:middle;margin-left:3px}
.secov{position:fixed;inset:0;background:rgba(20,8,25,.62);display:none;align-items:center;justify-content:center;z-index:60;padding:20px}
.secov.on{display:flex}
.secmod{background:#fff;border-radius:18px;max-width:340px;width:100%;padding:20px;box-shadow:0 22px 64px rgba(0,0,0,.55);text-align:left}
.secmod .lock{font-size:26px}.secmod .tg{font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:#b8791a;font-weight:800;margin-top:4px}
.secmod h3{margin:3px 0 2px;color:var(--purple);font-family:'Playfair Display';font-size:19px;line-height:1.1}
.secmod p{font-size:13px;color:#4a4356;margin:8px 0}
.secmod .two{display:flex;gap:8px;margin:10px 0}
.secmod .two div{flex:1;background:#faf7fe;border:1px solid var(--line);border-radius:10px;padding:9px 10px;font-size:11.5px;color:#3a2352}
.secmod .two b{display:block;color:var(--purple);font-size:12px;margin-bottom:2px}
.secmod .close{width:100%;border:0;border-radius:11px;background:var(--purple);color:#fff;font-weight:800;padding:11px;font-size:14px;cursor:pointer;margin-top:6px}
</style></head><body>
<div class="tk">
  <img class="poster" src="__POSTER__" alt="Karnival of the Arts 2026 poster">
  <div class="hd"><div class="b">KOTA · <span>StageFill</span></div><div class="s">&#128274; SECURE</div></div>
  <div class="body">
    <div class="eg">Entry · Weekend Pass</div>
    <div class="ev">Karnival of the Arts East 2026</div>
    <div class="sub">Kempton Community Center · 83 Community Center Dr, Kempton, PA 19529</div>
    <a class="dir" href="https://maps.google.com/?q=83+Community+Center+Dr+Kempton+PA+19529" target="_blank">&#128205; Directions &amp; parking &rsaquo;</a>
    <div class="when"><b>Sept 3&ndash;7, 2026</b> <span>· Thu 12:00 PM &ndash; Mon 3:00 PM EST · triple stage · camping</span></div>
    <div class="ga">General Admission &middot; 4-Day &middot; Camping Included</div>
    <div class="code"><div class="bars" id="bars"></div><div class="scan"></div><div class="note">Screenshots won&rsquo;t get you in. <button class="q" onclick="openSec()" aria-label="Why so secure?">?</button></div></div>
    <div class="price"><div class="p">$214.49<small>no service fees</small></div><button class="buy">&#127903; Get my pass</button></div>
    <div class="tag">Your weekend. Your people. No toll booth.</div>
    <div class="act">&#128205; Check in &mdash; in your voice</div>
    <div class="act mic">&#127908; I&rsquo;m performing &mdash; sell my tickets</div>
    <div class="trip"><button>&#127925; Lineup</button><button>&#128506; Map</button><button>&#8599; Share</button></div>
  </div>
  <div class="qrwrap">
    <div class="qrid"><span>Pass ID · d.dance/t/KOTA-2026</span><span class="pass">SHOW PASS</span></div>
    <div class="qrrow">
      <div class="qr"><svg viewBox="0 0 33 33" xmlns="http://www.w3.org/2000/svg"><rect width="33" height="33" fill="#fff"/><g fill="#241026"><rect x="1" y="1" width="5" height="5"/><rect x="2" y="2" width="3" height="3" fill="#fff"/><rect x="27" y="1" width="5" height="5"/><rect x="28" y="2" width="3" height="3" fill="#fff"/><rect x="1" y="27" width="5" height="5"/><rect x="2" y="28" width="3" height="3" fill="#fff"/><rect x="9" y="2" width="2" height="2"/><rect x="13" y="1" width="2" height="2"/><rect x="17" y="3" width="2" height="2"/><rect x="21" y="1" width="2" height="2"/><rect x="10" y="9" width="2" height="2"/><rect x="14" y="10" width="2" height="2"/><rect x="18" y="8" width="2" height="2"/><rect x="22" y="11" width="2" height="2"/><rect x="26" y="9" width="2" height="2"/><rect x="30" y="10" width="2" height="2"/><rect x="9" y="14" width="2" height="2"/><rect x="13" y="16" width="2" height="2"/><rect x="17" y="14" width="2" height="2"/><rect x="21" y="17" width="2" height="2"/><rect x="25" y="15" width="2" height="2"/><rect x="29" y="16" width="2" height="2"/><rect x="11" y="21" width="2" height="2"/><rect x="15" y="23" width="2" height="2"/><rect x="19" y="21" width="2" height="2"/><rect x="23" y="24" width="2" height="2"/><rect x="27" y="22" width="2" height="2"/><rect x="12" y="28" width="2" height="2"/><rect x="16" y="30" width="2" height="2"/><rect x="20" y="28" width="2" height="2"/><rect x="24" y="30" width="2" height="2"/><rect x="28" y="28" width="2" height="2"/></g></svg></div>
      <div class="qrtx"><b>Your weekend QR.</b> Scan at the gate each day, get set times &amp; map pins pushed to you, and keep it as your Karnival in history. &#127882;</div>
    </div>
  </div>
  <div class="ft">Sample StageFill pass for Karnival of the Arts (Kollective Grounds). Live rotating code &amp; QR are server-issued (see the white paper). Price shown with <b>no service fees</b> vs. the current all-in ticket.</div>
</div>
<div class="secov" id="secov" onclick="if(event.target===this)closeSec()"><div class="secmod">
  <span class="lock">&#128274;</span><div class="tg">Most Secure Ticket</div>
  <h3>Screenshots won&rsquo;t get you in &mdash; really.</h3>
  <p>Your pass is a <b>rotating, single-use code</b>. The barcode regenerates every ~15&nbsp;seconds from a key only our server holds.</p>
  <div class="two"><div><b>Your phone</b>rolls a fresh code every 15s &mdash; the screen is always live.</div><div><b>The gate</b>takes only the current code, and rejects any stale or reused one.</div></div>
  <p>So a screenshot freezes a code that&rsquo;s already dead by the time anyone reaches the door. One tap, one entry, no fakes.</p>
  <button class="close" onclick="closeSec()">Got it</button>
</div></div>
<script>var b=document.getElementById("bars"),h="";for(var i=0;i<66;i++){h+="<i style=\\"height:"+(36+Math.round(Math.random()*28))+"px\\"></i>";}b.innerHTML=h;
function openSec(){document.getElementById("secov").classList.add("on");}
function closeSec(){document.getElementById("secov").classList.remove("on");}</script>
</body></html>'''
HTML=HTML.replace("__POSTER__",POST)
out=os.path.join(HERE,"kota_ticket.html"); open(out,"w").write(HTML)
print("wrote",out,"(%.0f KB)"%(os.path.getsize(out)/1024))

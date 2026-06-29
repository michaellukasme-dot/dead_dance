/* dead_dance — LOCAL game audio for "Name That Tune".
   We NEVER stream from archive.org. The music lives LOCALLY in the PWA.
   Drop your owned/licensed audio files into ./audio/ and list them here.
   The game plays a few seconds from a RANDOM point in each track (not just the
   beginning) — so any clip from any track is a fresh puzzle, multiplying the pool.

   The `title` MUST match a song name in the game's guess list (see SONGS in index.html).
   Files are same-origin, so the service worker caches them on first play (offline-ready).

   Example:
   window.DD_TUNE_FILES = [
     { title:"Scarlet Begonias",  file:"audio/scarlet_begonias.mp3" },
     { title:"Fire on the Mountain", file:"audio/fire_on_the_mountain.mp3" },
     { title:"Eyes of the World", file:"audio/eyes_of_the_world.mp3" }
   ];
*/
window.DD_TUNE_FILES = [
  // add your local tracks here — title must match a SONGS entry
];

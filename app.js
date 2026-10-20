(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('canvas'), ctx = canvas.getContext('2d');
  var SIZES = { '16:9': [1280, 720], '9:16': [720, 1280], '1:1': [1080, 1080] };

  var S = {
    images: [],      // {url, img, name}
    video: null,     // {url, el, dur}
    audio: null,     // {url, dur}
    playing: false, exporting: false,
    elapsed: 0, t0: 0, raf: 0,
    recorder: null, chunks: [], dlUrl: null
  };

  var audioEl = new Audio();
  audioEl.preload = 'auto';
  var audioGraph = null;

  /* ---------- Trạng thái ---------- */
  function setStatus(msg, kind) {
    var el = $('status');
    el.textContent = msg;
    el.className = 'status' + (kind ? ' ' + kind : '');
  }
  function fmt(s) {
    s = Math.max(0, Math.floor(s));
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }

  /* ---------- Thời lượng và phụ đề ---------- */
  function perImage() {
    var v = parseFloat($('per-image').value);
    return isNaN(v) ? 4 : Math.min(30, Math.max(1, v));
  }
  function duration() {
    if (S.audio && S.video) return Math.max(S.audio.dur, S.video.dur);
    if (S.audio) return S.audio.dur;
    if (S.video) return S.video.dur;
    if (S.images.length) return S.images.length * perImage();
    return 0;
  }
  function buildCues() {
    var text = $('script').value.trim();
    if (!text) return [];
    var parts = text.split(/\n+/).reduce(function (acc, line) {
      return acc.concat(line.split(/(?<=[.!?…])\s+/));
    }, []);
    var out = [];
    parts.forEach(function (p) {
      p = p.trim();
      if (!p) return;
      while (p.length > 90) {
        var cut = p.lastIndexOf(',', 90);
        if (cut < 30) cut = p.lastIndexOf(' ', 90);
        if (cut < 1) cut = 90;
        out.push(p.slice(0, cut + 1).trim());
        p = p.slice(cut + 1).trim();
      }
      if (p) out.push(p);
    });
    return out;
  }
  function cueAt(t, total) {
    var cues = buildCues();
    if (!cues.length || total <= 0) return '';
    var sum = cues.reduce(function (a, c) { return a + c.length + 10; }, 0), acc = 0;
    for (var i = 0; i < cues.length; i++) {
      var w = (cues[i].length + 10) / sum * total;
      if (t < acc + w) return cues[i];
      acc += w;
    }
    return cues[cues.length - 1];
  }

  /* ---------- Vẽ khung hình ---------- */
  function drawMedia(el, w, h) {
    var iw = el.videoWidth || el.naturalWidth, ih = el.videoHeight || el.naturalHeight;
    if (!iw || !ih) return;
    var k = $('fit').value === 'cover' ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih);
    var dw = iw * k, dh = ih * k;
    ctx.drawImage(el, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }
  function wrap(text, maxW) {
    var words = text.split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) {
      var test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  function render(t) {
    var w = canvas.width, h = canvas.height, total = duration();
    ctx.fillStyle = $('bg').value;
    ctx.fillRect(0, 0, w, h);
    if (S.video) {
      drawMedia(S.video.el, w, h);
    } else if (S.images.length) {
      var idx = total > 0 ? Math.min(S.images.length - 1, Math.floor(t / total * S.images.length)) : 0;
      drawMedia(S.images[idx].img, w, h);
    }
    if ($('sub-on').checked) {
      var cue = cueAt(t, total);
      if (cue) {
        var size = parseInt($('sub-size').value, 10) * Math.min(w, h) / 720;
        ctx.font = '700 ' + size + 'px "Segoe UI",Roboto,Arial,sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        var lines = wrap(cue, w * 0.86), lh = size * 1.3, bh = lines.length * lh + size * 0.5;
        var pos = $('sub-pos').value;
        var cy = pos === 'top' ? h * 0.06 + bh / 2 : pos === 'middle' ? h / 2 : h * 0.94 - bh / 2;
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.fillRect(w * 0.04, cy - bh / 2, w * 0.92, bh);
        ctx.fillStyle = $('sub-color').value;
        lines.forEach(function (l, i) {
          ctx.fillText(l, w / 2, cy - bh / 2 + size * 0.25 + lh * (i + 0.5));
        });
      }
    }
    var pct = total > 0 ? Math.min(100, t / total * 100) : 0;
    $('bar-fill').style.width = pct + '%';
    $('t-now').textContent = fmt(t);
    $('t-total').textContent = fmt(total);
  }
  function idleFrame() { if (!S.playing) render(S.elapsed); }

  /* ---------- Phát ---------- */
  function ensureAudioGraph() {
    if (audioGraph) return audioGraph;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    var ac = new AC();
    var src = ac.createMediaElementSource(audioEl);
    var dest = ac.createMediaStreamDestination();
    src.connect(ac.destination);
    src.connect(dest);
    audioGraph = { ac: ac, dest: dest };
    return audioGraph;
  }
  function hasVisual() { return !!(S.video || S.images.length); }

  function tick() {
    if (!S.playing) return;
    var t = (performance.now() - S.t0) / 1000, total = duration();
    if (t >= total) { finish(); return; }
    S.elapsed = t;
    render(t);
    if (S.exporting) setStatus('Đang dựng video… ' + Math.round(t / total * 100) + '% (hãy giữ tab này mở)', 'busy');
    S.raf = requestAnimationFrame(tick);
  }
  function play() {
    if (!hasVisual()) { setStatus('Chưa có hình ảnh hoặc video. Hãy tải lên ở bước 2.', 'error'); return false; }
    if (S.playing) return true;
    if (S.elapsed >= duration()) S.elapsed = 0;
    S.t0 = performance.now() - S.elapsed * 1000;
    S.playing = true;
    if (S.audio) {
      var g = ensureAudioGraph();
      if (g && g.ac.state === 'suspended') g.ac.resume();
      audioEl.currentTime = S.elapsed;
      audioEl.play().catch(function () { setStatus('Trình duyệt chặn phát âm thanh. Hãy bấm lại nút Phát.', 'error'); });
    }
    if (S.video) { S.video.el.currentTime = S.elapsed % (S.video.dur || 1); S.video.el.play().catch(function () {}); }
    S.raf = requestAnimationFrame(tick);
    return true;
  }
  function halt() {
    S.playing = false;
    cancelAnimationFrame(S.raf);
    audioEl.pause();
    if (S.video) S.video.el.pause();
  }
  function pause() {
    if (S.exporting) { setStatus('Không thể tạm dừng khi đang xuất video.', 'error'); return; }
    if (!S.playing) return;
    halt();
    setStatus('Đã tạm dừng.');
  }
  function stop() {
    if (S.exporting) { cancelExport(); return; }
    halt(); S.elapsed = 0;
    audioEl.currentTime = 0;
    if (S.video) S.video.el.currentTime = 0;
    render(0);
    setStatus('Đã về đầu video.');
  }
  function finish() {
    halt();
    if (S.exporting) { stopRecording(); return; }
    S.elapsed = 0;
    render(duration());
    setStatus('Đã phát xong.', 'ok');
  }

  /* ---------- Xuất video ---------- */
  function pickMime() {
    var list = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    for (var i = 0; i < list.length; i++) if (MediaRecorder.isTypeSupported(list[i])) return list[i];
    return '';
  }
  function exportVideo() {
    if (S.exporting) return;
    $('download').hidden = true; $('convert').hidden = true;
    if (!window.MediaRecorder || !canvas.captureStream) {
      setStatus('Trình duyệt này không hỗ trợ xuất video (thiếu MediaRecorder). Hãy dùng Chrome, Edge hoặc Firefox bản mới trên máy tính.', 'error');
      return;
    }
    if (!hasVisual()) { setStatus('Không thể xuất: chưa có hình ảnh hoặc video.', 'error'); return; }
    if (!S.audio && !confirm('Bạn chưa tải file âm thanh nên video xuất ra sẽ KHÔNG có tiếng. Vẫn xuất?')) {
      setStatus('Đã hủy xuất. Hãy tải lên file âm thanh ở bước 2.');
      return;
    }
    var mime = pickMime();
    if (!mime) { setStatus('Trình duyệt không hỗ trợ định dạng video nào để ghi. Hãy thử Chrome hoặc Edge.', 'error'); return; }
    var stream = canvas.captureStream(30);
    if (S.audio) {
      var g = ensureAudioGraph();
      if (!g) { setStatus('Trình duyệt không hỗ trợ Web Audio nên không thể đưa âm thanh vào video.', 'error'); return; }
      g.dest.stream.getAudioTracks().forEach(function (tr) { stream.addTrack(tr); });
    }
    try { S.recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5000000 }); }
    catch (e) { setStatus('Không khởi tạo được bộ ghi video: ' + e.message, 'error'); return; }
    S.chunks = [];
    S.recorder.ondataavailable = function (e) { if (e.data && e.data.size) S.chunks.push(e.data); };
    S.recorder.onerror = function (e) { S.exporting = false; halt(); lockUI(false); setStatus('Lỗi khi ghi video: ' + (e.error && e.error.message || 'không rõ'), 'error'); };
    S.recorder.onstop = function () {
      stream.getTracks().forEach(function (tr) { tr.stop(); });
      var cancelled = S.recorder._cancelled;
      S.exporting = false; lockUI(false);
      if (cancelled) { setStatus('Đã hủy xuất video.'); return; }
      var blob = new Blob(S.chunks, { type: mime.split(';')[0] });
      if (!blob.size) { setStatus('Xuất thất bại: file video rỗng. Hãy thử lại hoặc đổi trình duyệt.', 'error'); return; }
      if (S.dlUrl) URL.revokeObjectURL(S.dlUrl);
      S.dlUrl = URL.createObjectURL(blob);
      var ext = mime.indexOf('mp4') > -1 ? 'mp4' : 'webm';
      var a = $('download');
      a.href = S.dlUrl; a.download = 'ai-video-studio.' + ext; a.textContent = 'Tải video xuống (.' + ext + ', ' + (blob.size / 1048576).toFixed(1) + ' MB)';
      a.hidden = false;
      if (ext === 'webm') {
        $('convert').hidden = false;
        $('convert').textContent = 'Định dạng WebM: phát tốt trên Chrome, Edge, Firefox. Muốn MP4, hãy mở file bằng VLC, hoặc dùng công cụ miễn phí như HandBrake (Tệp → Mở nguồn → xuất MP4) hay CloudConvert.';
      }
      setStatus('Đã xuất xong video. Bấm nút tải xuống bên dưới để lưu.', 'ok');
    };
    S.exporting = true; lockUI(true);
    S.elapsed = 0;
    S.recorder.start(500);
    setStatus('Đang dựng video… 0% (hãy giữ tab này mở)', 'busy');
    play();
  }
  function stopRecording() {
    if (S.recorder && S.recorder.state !== 'inactive') {
      setTimeout(function () { S.recorder.stop(); }, 300);
    }
    S.elapsed = 0;
  }
  function cancelExport() {
    halt();
    if (S.recorder && S.recorder.state !== 'inactive') { S.recorder._cancelled = true; S.recorder.stop(); }
    S.elapsed = 0; render(0);
  }
  function lockUI(on) {
    ['btn-play', 'btn-pause', 'btn-export'].forEach(function (id) { $(id).disabled = on; });
    $('btn-stop').textContent = on ? 'Hủy xuất' : 'Về đầu';
  }

  /* ---------- Tải tệp ---------- */
  function addImages(files) {
    var ok = ['image/jpeg', 'image/png', 'image/webp'];
    Array.prototype.forEach.call(files, function (f) {
      if (ok.indexOf(f.type) < 0) { setStatus('“' + f.name + '” không phải ảnh JPG, PNG hoặc WebP nên đã bị bỏ qua.', 'error'); return; }
      var url = URL.createObjectURL(f), img = new Image();
      img.onload = function () { S.images.push({ url: url, img: img, name: f.name }); refresh(); setStatus('Đã thêm ảnh “' + f.name + '”.', 'ok'); };
      img.onerror = function () { URL.revokeObjectURL(url); setStatus('Không đọc được ảnh “' + f.name + '”. File có thể bị hỏng.', 'error'); };
      img.src = url;
    });
  }
  function renderThumbs() {
    var ul = $('thumbs'); ul.innerHTML = '';
    S.images.forEach(function (it, i) {
      var li = document.createElement('li'), im = document.createElement('img'), b = document.createElement('button');
      im.src = it.url; im.alt = it.name;
      b.type = 'button'; b.textContent = '×'; b.setAttribute('aria-label', 'Xóa ảnh ' + it.name);
      b.onclick = function () { if (S.exporting) return; URL.revokeObjectURL(it.url); S.images.splice(i, 1); refresh(); };
      li.appendChild(im); li.appendChild(b); ul.appendChild(li);
    });
  }
  function setVideo(f) {
    if (!f) return;
    if (['video/mp4', 'video/webm'].indexOf(f.type) < 0) { setStatus('Video phải là MP4 hoặc WebM.', 'error'); $('in-video').value = ''; return; }
    var url = URL.createObjectURL(f), v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
    v.onloadedmetadata = function () {
      if (S.video) URL.revokeObjectURL(S.video.url);
      S.video = { url: url, el: v, dur: v.duration || 0 };
      if (!isFinite(S.video.dur) || S.video.dur <= 0) { S.video = null; setStatus('Không xác định được thời lượng video này.', 'error'); return; }
      $('video-info').textContent = f.name + ' – ' + fmt(S.video.dur);
      v.currentTime = 0.01;
      v.onseeked = function () { v.onseeked = null; refresh(); };
      setStatus('Đã tải video nền.', 'ok');
    };
    v.onerror = function () { URL.revokeObjectURL(url); $('in-video').value = ''; setStatus('Trình duyệt không phát được video này (codec không được hỗ trợ). Hãy thử file MP4 H.264 hoặc WebM.', 'error'); };
    v.src = url;
  }
  function setAudio(f) {
    if (!f) return;
    if (f.type.indexOf('audio/') !== 0) { setStatus('Đây không phải file âm thanh.', 'error'); $('in-audio').value = ''; return; }
    var url = URL.createObjectURL(f), probe = new Audio();
    probe.preload = 'metadata';
    probe.onloadedmetadata = function () {
      if (!isFinite(probe.duration) || probe.duration <= 0) { setStatus('Không xác định được thời lượng âm thanh.', 'error'); return; }
      if (S.audio) URL.revokeObjectURL(S.audio.url);
      S.audio = { url: url, dur: probe.duration };
      audioEl.src = url;
      $('audio-info').textContent = f.name + ' – ' + fmt(probe.duration);
      refresh(); setStatus('Đã tải âm thanh. Thời lượng video sẽ theo âm thanh.', 'ok');
    };
    probe.onerror = function () { URL.revokeObjectURL(url); $('in-audio').value = ''; setStatus('Trình duyệt không đọc được file âm thanh này. Hãy thử MP3 hoặc WAV.', 'error'); };
    probe.src = url;
  }

  /* ---------- Giọng đọc thử ---------- */
  function loadVoices() {
    var sel = $('voice'), lang = $('lang').value.slice(0, 2);
    if (!('speechSynthesis' in window)) {
      sel.innerHTML = '<option>Trình duyệt không hỗ trợ giọng đọc</option>';
      $('btn-speak').disabled = true; $('btn-stop-speak').disabled = true; return;
    }
    var vs = speechSynthesis.getVoices().filter(function (v) { return v.lang.toLowerCase().indexOf(lang) === 0; });
    sel.innerHTML = '';
    if (!vs.length) { sel.innerHTML = '<option value="">Không có giọng cho ngôn ngữ này trên thiết bị</option>'; return; }
    vs.forEach(function (v) { var o = document.createElement('option'); o.value = v.name; o.textContent = v.name + ' (' + v.lang + ')'; sel.appendChild(o); });
  }
  function speak() {
    var text = $('script').value.trim();
    if (!text) { setStatus('Hãy nhập kịch bản trước khi đọc thử.', 'error'); return; }
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = $('lang').value;
    var v = speechSynthesis.getVoices().filter(function (x) { return x.name === $('voice').value; })[0];
    if (v) u.voice = v; else setStatus('Thiết bị chưa có giọng cho ngôn ngữ này, sẽ dùng giọng mặc định.');
    u.onerror = function (e) { if (e.error !== 'canceled' && e.error !== 'interrupted') setStatus('Không đọc được kịch bản: ' + e.error, 'error'); };
    speechSynthesis.speak(u);
  }

  /* ---------- Khởi tạo ---------- */
  function applyRatio() {
    var s = SIZES[$('ratio').value];
    canvas.width = s[0]; canvas.height = s[1];
    idleFrame();
  }
  function refresh() { renderThumbs(); S.elapsed = Math.min(S.elapsed, duration()); render(S.elapsed); }

  $('in-images').addEventListener('change', function (e) { addImages(e.target.files); e.target.value = ''; });
  $('in-video').addEventListener('change', function (e) { setVideo(e.target.files[0]); });
  $('in-audio').addEventListener('change', function (e) { setAudio(e.target.files[0]); });
  $('btn-play').addEventListener('click', play);
  $('btn-pause').addEventListener('click', pause);
  $('btn-stop').addEventListener('click', stop);
  $('btn-export').addEventListener('click', exportVideo);
  $('btn-speak').addEventListener('click', speak);
  $('btn-stop-speak').addEventListener('click', function () { if ('speechSynthesis' in window) speechSynthesis.cancel(); });
  $('lang').addEventListener('change', loadVoices);
  $('ratio').addEventListener('change', applyRatio);
  $('sub-size').addEventListener('input', function () { $('sub-size-out').textContent = $('sub-size').value; idleFrame(); });
  ['script', 'bg', 'sub-on', 'sub-color', 'sub-pos', 'fit'].forEach(function (id) { $(id).addEventListener('input', idleFrame); $(id).addEventListener('change', idleFrame); });
  $('per-image').addEventListener('input', idleFrame);
  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();
  if (!window.MediaRecorder) setStatus('Cảnh báo: trình duyệt này không hỗ trợ xuất video. Bạn vẫn xem trước được.', 'error');
  render(0);
})();

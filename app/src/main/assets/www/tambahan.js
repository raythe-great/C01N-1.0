/* C01N — tambahan tampilan (hanya menambah, tidak mengubah file lain).
   1) Huruf 0 pada tulisan "C01N" di Beranda menjadi koin emas kuno.
   2) Logo "C" (layar PIN, sambutan, Tentang) menjadi koin emas kuno. */
(function () {
  'use strict';
  var COIN = '<svg class="coin" viewBox="0 0 48 48" aria-hidden="true">' +
    '<circle cx="24" cy="24" r="22" fill="#B9801F"/><circle cx="24" cy="24" r="20" fill="#E9B94B"/>' +
    '<circle cx="24" cy="24" r="17" fill="none" stroke="#A8741A" stroke-width="2" stroke-dasharray="1.8 2.5"/>' +
    '<circle cx="24" cy="24" r="12.5" fill="none" stroke="#B9801F" stroke-width="1.6"/>' +
    '<path d="M24 15.5l3 6.5 6.5 2-6.5 2-3 6.5-3-6.5-6.5-2 6.5-2z" fill="#B9801F"/>' +
    '<path d="M9 20a16 16 0 0 1 11-10" fill="none" stroke="#FFF1BF" stroke-width="2.2" stroke-linecap="round" opacity=".85"/></svg>';

  function decorate() {
    var heads = document.querySelectorAll('#page-home .page-head h1');
    for (var i = 0; i < heads.length; i++) {
      var h = heads[i];
      if (h.dataset.brand || h.textContent.trim() !== 'C01N') continue;
      h.dataset.brand = '1';
      h.setAttribute('aria-label', 'C01N');
      h.innerHTML = '<span class="brand-l">C</span>' + COIN + '<span class="brand-l">1N</span>';
    }
    var logos = document.querySelectorAll('.logo');
    for (var j = 0; j < logos.length; j++) {
      var l = logos[j];
      if (l.dataset.coin || l.textContent.trim() !== 'C') continue;
      l.dataset.coin = '1';
      l.setAttribute('aria-label', 'C01N');
      l.innerHTML = COIN;
    }
  }

  var root = document.getElementById('app') || document.body;
  new MutationObserver(decorate).observe(root, { childList: true, subtree: true });
  decorate();
})();
